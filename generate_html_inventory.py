import os
import json
from pathlib import Path
from bs4 import BeautifulSoup  # Optional, für schöneres Auslesen von HTML-Titeln

def scan_html_directory(root_dir):
    root_path = Path(root_dir).resolve()
    structured_data = {}

    # Rekursives Durchsuchen aller HTML-Dateien
    for html_file in root_path.rglob("*.html"):
        # Relativen Pfad ermitteln, um Bereiche über Ordnerstrukturen abzuleiten
        relative_path = html_file.relative_to(root_path)
        parts = relative_path.parts

        # Ordnerstruktur bestimmen (Bereich / Unterbereich)
        if len(parts) >= 3:
            bereich = parts[0].replace("_", " ").title()
            unterbereich = parts[1].replace("_", " ").title()
        elif len(parts) == 2:
            bereich = parts[0].replace("_", " ").title()
            unterbereich = "Allgemein"
        else:
            bereich = "Root / Sonstige"
            unterbereich = "Allgemein"

        # Verwendungs-Bemerkung aus HTML extrahieren (<title> oder erster <h1>)
        bemerkung = "Keine Beschreibung verfügbar."
        try:
            with open(html_file, "r", encoding="utf-8") as f:
                soup = BeautifulSoup(f.read(), "html.parser")
                if soup.title and soup.title.string:
                    bemerkung = soup.title.string.strip()
                elif soup.h1:
                    bemerkung = soup.h1.get_text().strip()
        except Exception:
            pass

        file_entry = {
            "datei": html_file.name,
            "bereich": bereich,
            "unterbereich": unterbereich,
            "verwendungs_bemerkung": bemerkung,
            "absoluter_pfad": str(html_file)
        }

        # In Struktur einsortieren
        if bereich not in structured_data:
            structured_data[bereich] = {}
        if unterbereich not in structured_data[bereich]:
            structured_data[bereich][unterbereich] = []

        structured_data[bereich][unterbereich].append(file_entry)

    # Innerhalb der Unterbereiche alphabetisch nach Dateiname sortieren
    for bereich in structured_data:
        for unterbereich in structured_data[bereich]:
            structured_data[bereich][unterbereich].sort(key=lambda x: x["datei"].lower())

    # Bereiche und Unterbereiche ebenfalls alphabetisch sortieren
    sorted_structured_data = {
        b: {ub: structured_data[b][ub] for ub in sorted(structured_data[b].keys())}
        for b in sorted(structured_data.keys())
    }

    final_output = {
        "basis_verzeichnis": str(root_path),
        "struktur": sorted_structured_data
    }

    return final_output

if __name__ == "__main__":
    # Pfad zu deinem lokalen Verzeichnis anpassen (z. B. '.' für das aktuelle Verzeichnis)
    ziel_verzeichnis = "." 
    
    print(" Scanne Verzeichnis nach HTML-Dateien...")
    ergebnis = scan_html_directory(ziel_verzeichnis)

    output_filename = "html_struktur.json"
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(ergebnis, f, ensure_ascii=False, indent=4)

    print(f" Erfolgreich! JSON-Struktur wurde in '{output_filename}' gespeichert.")
