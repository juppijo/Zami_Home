#!/usr/bin/env python3
"""
Ergänzt fehlende HTML-Dateien in html_struktur.json anhand von links_cl2.json.

- Es werden nur .html / .htm Einträge berücksichtigt.
- Vorhandene Einträge bleiben unverändert (nichts wird überschrieben).
- Zuordnung: "<Repo-Titel>/<label>" aus links_cl2.json  <->  Pfad relativ zum
  basis_verzeichnis aus html_struktur.json (Groß-/Kleinschreibung egal).
- Bereich / Unterbereich werden aus bestehenden Einträgen übernommen; gibt es
  noch keinen, wird der Name wie bisher gebildet (Unterstriche -> Leerzeichen,
  Title Case; Dateien direkt im Repo-Ordner -> "Allgemein").
- verwendungs_bemerkung: "comment" aus links_cl2.json, sonst Dateiname als Fallback.

Aufruf:
    python ergaenze_html_struktur.py
    python ergaenze_html_struktur.py --links links_cl2.json --struktur html_struktur.json
    python ergaenze_html_struktur.py --dry-run          # nur anzeigen, nichts schreiben
    python ergaenze_html_struktur.py --output neu.json  # in andere Datei schreiben
"""

import argparse
import json
import shutil
import sys
from pathlib import Path, PurePosixPath

HTML_ENDUNGEN = (".html", ".htm")


def lade_json(pfad: Path):
    with pfad.open("r", encoding="utf-8") as f:
        return json.load(f)


def speichere_json(pfad: Path, daten) -> None:
    with pfad.open("w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=2)
        f.write("\n")


def norm(text: str) -> str:
    return text.replace("\\", "/").strip("/").lower()


def relativer_pfad(eintrag: dict, basis: str) -> str:
    """Pfad eines bestehenden Eintrags relativ zum Basisverzeichnis."""
    voll = eintrag["absoluter_pfad"].replace("\\", "/")
    b = basis.replace("\\", "/").rstrip("/")
    if voll.lower().startswith(b.lower() + "/"):
        return voll[len(b) + 1:]
    return voll


def schoener_name(ordner: str) -> str:
    """Gleiche Namenslogik wie in der bestehenden Datei: 'Zami_Buecher' -> 'Zami Buecher'."""
    return ordner.replace("_", " ").title()


def ist_html(label: str) -> bool:
    return label.lower().endswith(HTML_ENDUNGEN)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--links", default="links_cl2.json", type=Path)
    ap.add_argument("--struktur", default="html_struktur.json", type=Path)
    ap.add_argument("--output", type=Path, default=None,
                    help="Zieldatei (Standard: html_struktur.json wird überschrieben, Backup als .bak)")
    ap.add_argument("--dry-run", action="store_true", help="Nur anzeigen, nichts schreiben")
    args = ap.parse_args()

    links = lade_json(args.links)
    daten = lade_json(args.struktur)
    basis = daten["basis_verzeichnis"]
    struktur = daten["struktur"]

    # --- Bestandsaufnahme -------------------------------------------------
    vorhanden = set()          # relative Pfade (klein) aller bestehenden Einträge
    repo_zu_bereich = {}       # 'zami_buecher' -> 'Zami Buecher'
    ordner_zu_unter = {}       # ('zami_buecher', 'rgb_led') -> 'Rgb Led'

    for bereich, unterbereiche in struktur.items():
        for unterbereich, eintraege in unterbereiche.items():
            for e in eintraege:
                rel = relativer_pfad(e, basis)
                vorhanden.add(norm(rel))
                teile = PurePosixPath(rel.replace("\\", "/")).parts
                if len(teile) >= 2:
                    repo_zu_bereich.setdefault(teile[0].lower(), bereich)
                if len(teile) >= 3:
                    ordner_zu_unter.setdefault((teile[0].lower(), teile[1].lower()), unterbereich)

    # --- Fehlende HTML-Dateien finden und ergänzen ------------------------
    neu = []
    for repo in links:
        titel = repo["title"]
        for link in repo.get("links", []):
            label = link["label"]
            if not ist_html(label):
                continue
            rel = f"{titel}/{label}"
            if norm(rel) in vorhanden:
                continue

            teile = PurePosixPath(label).parts
            datei = teile[-1]
            ordner = teile[:-1]

            bereich = repo_zu_bereich.get(titel.lower()) or schoener_name(titel)
            if ordner:
                unterbereich = ordner_zu_unter.get((titel.lower(), ordner[0].lower())) \
                               or schoener_name(ordner[0])
            else:
                unterbereich = "Allgemein"

            bemerkung = (link.get("comment") or "").strip() or Path(datei).stem.replace("_", " ")

            absolut = "\\".join([basis.rstrip("\\/"), titel, *teile])

            eintrag = {
                "datei": datei,
                "bereich": bereich,
                "unterbereich": unterbereich,
                "verwendungs_bemerkung": bemerkung,
                "absoluter_pfad": absolut,
            }
            struktur.setdefault(bereich, {}).setdefault(unterbereich, []).append(eintrag)
            vorhanden.add(norm(rel))
            neu.append((rel, eintrag))

    # --- Ausgabe ----------------------------------------------------------
    if not neu:
        print("Nichts zu ergänzen – alle HTML-Dateien sind bereits vorhanden.")
        return 0

    print(f"{len(neu)} fehlende HTML-Datei(en) ergänzt:")
    for rel, e in neu:
        print(f"  + {rel}  ->  {e['bereich']} / {e['unterbereich']}  ({e['verwendungs_bemerkung']})")

    # Sortierung wie in der Originaldatei (Groß-/Kleinschreibung ignorieren)
    daten["struktur"] = {
        b: {u: sorted(es, key=lambda x: x["datei"].lower())
            for u, es in sorted(unter.items(), key=lambda kv: kv[0].lower())}
        for b, unter in sorted(struktur.items(), key=lambda kv: kv[0].lower())
    }

    if args.dry_run:
        print("\n--dry-run: es wurde nichts geschrieben.")
        return 0

    ziel = args.output or args.struktur
    if ziel == args.struktur:
        backup = args.struktur.with_suffix(args.struktur.suffix + ".bak")
        shutil.copy2(args.struktur, backup)
        print(f"\nBackup: {backup}")
    speichere_json(ziel, daten)
    print(f"Gespeichert: {ziel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
