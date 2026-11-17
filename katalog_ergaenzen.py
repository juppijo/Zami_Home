#!/usr/bin/env python3
"""
Ergänzt html_katalog.json um HTML-Dateien, die in links_cl2.json vorhanden sind,
im Katalog aber noch fehlen.

Aufruf:
    python katalog_ergaenzen.py                       # Dateien im aktuellen Ordner
    python katalog_ergaenzen.py links_cl2.json html_katalog.json
    python katalog_ergaenzen.py links_cl2.json html_katalog.json -o neu.json
    python katalog_ergaenzen.py --dry-run             # nur anzeigen, nichts schreiben

Ohne -o wird html_katalog.json überschrieben (vorher entsteht ein .bak-Backup).
"""
import argparse
import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path
from urllib.parse import unquote

HTML_ENDUNGEN = (".html", ".htm")
HAUPT = "Hauptverzeichnis"
KI_SUFFIX = re.compile(r"[-_](g|cl)$", re.IGNORECASE)


def norm_url(url: str) -> str:
    """URLs vergleichbar machen (%-Kodierung auflösen)."""
    return unquote(url).strip()


def norm_pfad(text: str) -> str:
    """Geschützte/typografische Bindestriche in normale '-' umwandeln."""
    return text.replace("\u2011", "-").replace("\u2010", "-")


def ist_html(label: str) -> bool:
    return label.lower().endswith(HTML_ENDUNGEN)


def sort_key(text: str):
    return text.lower()


def einfuegen(liste: list, item, key):
    """Item an der alphabetisch passenden Stelle einfügen, ohne die übrige Reihenfolge anzutasten."""
    k = key(item)
    for i, vorhandenes in enumerate(liste):
        if key(vorhandenes) > k:
            liste.insert(i, item)
            return
    liste.append(item)


def verwendung_aus_link(link: dict, dateiname: str) -> str:
    """Beschreibung aus 'comment' ableiten; sonst aus dem Dateinamen bauen."""
    comment = (link.get("comment") or "").strip()
    if comment:
        # Muster "Gruppe – Titel": der letzte Teil ist die eigentliche Verwendung
        teile = [t.strip() for t in comment.split(" – ") if t.strip()]
        text = teile[-1] if teile else comment
        # angehängtes "(index.html)" o. ä. entfernen
        text = re.sub(r"\s*\([^()]*\.html?\)\s*$", "", text, flags=re.IGNORECASE)
        return text.strip()

    # Fallback: Dateiname menschenlesbar machen
    stem = Path(dateiname).stem
    ki = bool(KI_SUFFIX.search(stem))
    stem = KI_SUFFIX.sub("", stem)
    text = re.sub(r"[_]+", " ", stem).strip()
    text = text.replace("-", " ") if text.count("-") > 1 else text
    if text and text == text.lower():
        text = text.title()
    return f"{text} (KI-Variante)" if ki else text


def eintrag_bauen(link: dict) -> tuple[str, dict]:
    """Gibt (unterbereich, datei-dict) für einen Link zurück."""
    label = link["label"]
    ordner, _, dateiname = label.rpartition("/")
    unterbereich = norm_pfad(ordner) if ordner else HAUPT
    return unterbereich, {
        "dateiname": dateiname,
        "pfad": label,
        "url": link["url"],
        "verwendung": verwendung_aus_link(link, dateiname),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("links", nargs="?", default="links_cl2.json")
    ap.add_argument("katalog", nargs="?", default="html_katalog.json")
    ap.add_argument("-o", "--output", help="Zieldatei (Standard: Katalog wird überschrieben)")
    ap.add_argument("--dry-run", action="store_true", help="Nur anzeigen, nichts schreiben")
    ap.add_argument("--auch-versteckte", action="store_true",
                    help="Auch Links mit hidden=true übernehmen")
    args = ap.parse_args()

    links_pfad, katalog_pfad = Path(args.links), Path(args.katalog)
    for p in (links_pfad, katalog_pfad):
        if not p.exists():
            sys.exit(f"Datei nicht gefunden: {p}")

    links = json.loads(links_pfad.read_text(encoding="utf-8"))
    katalog = json.loads(katalog_pfad.read_text(encoding="utf-8"))

    bereiche = {b["bereich"]: b for b in katalog["bereiche"]}
    vorhanden = {
        norm_url(d["url"])
        for b in katalog["bereiche"]
        for u in b["unterbereiche"]
        for d in u["dateien"]
    }

    neu = []  # (bereich, unterbereich, datei)
    for gruppe in links:
        titel = gruppe["title"]
        for link in gruppe["links"]:
            if not ist_html(link["label"]):
                continue
            if link.get("hidden") and not args.auch_versteckte:
                continue
            if norm_url(link["url"]) in vorhanden:
                continue
            unterbereich, datei = eintrag_bauen(link)
            neu.append((titel, unterbereich, datei))
            vorhanden.add(norm_url(link["url"]))

    if not neu:
        print("Nichts zu ergänzen – der Katalog ist bereits vollständig.")
        return

    for titel, unterbereich, datei in neu:
        bereich = bereiche.get(titel)
        if bereich is None:  # komplett neuer Bereich
            bereich = {"bereich": titel, "unterbereiche": []}
            einfuegen(katalog["bereiche"], bereich, lambda b: sort_key(b["bereich"]))
            bereiche[titel] = bereich
        ub = next((u for u in bereich["unterbereiche"] if u["unterbereich"] == unterbereich), None)
        if ub is None:
            ub = {"unterbereich": unterbereich, "dateien": []}
            einfuegen(bereich["unterbereiche"], ub,
                      lambda u: (u["unterbereich"] != HAUPT, sort_key(u["unterbereich"])))
        einfuegen(ub["dateien"], datei, lambda d: sort_key(d["dateiname"]))
        print(f"+ {titel} / {unterbereich} / {datei['dateiname']}  ->  \"{datei['verwendung']}\"")

    # Meta aktualisieren
    meta = katalog.setdefault("meta", {})
    meta["aktualisiert_am"] = date.today().isoformat()
    meta["gesamtanzahl_bereiche"] = len(katalog["bereiche"])
    meta["gesamtanzahl_html_dateien"] = sum(
        len(u["dateien"]) for b in katalog["bereiche"] for u in b["unterbereiche"]
    )

    print(f"\n{len(neu)} Datei(en) ergänzt, gesamt jetzt {meta['gesamtanzahl_html_dateien']}.")

    if args.dry_run:
        print("Dry-Run: es wurde nichts geschrieben.")
        return

    ziel = Path(args.output) if args.output else katalog_pfad
    if ziel == katalog_pfad:
        backup = katalog_pfad.with_suffix(katalog_pfad.suffix + ".bak")
        shutil.copy2(katalog_pfad, backup)
        print(f"Backup: {backup}")
    ziel.write_text(json.dumps(katalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Geschrieben: {ziel}")


if __name__ == "__main__":
    main()
