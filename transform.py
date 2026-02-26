import csv
import json
import os

def create_links_json(input_csv, output_json):
    repositories = {}

    # Öffnen der Datei (Excel-Export-Format)
    with open(input_csv, mode='r', encoding='cp1252', errors='ignore') as csvfile:
        reader = csv.DictReader(csvfile)
        
        for row in reader:
            repo = row.get('Repository', 'Unkategorisiert')
            label = row.get('Pfad', 'Link')
            raw_url = row.get('GitHub Link', '')

            # 1. URL umwandeln: Von Code-Ansicht zu Live-Pages-Ansicht
            # Wir ersetzen den GitHub-Pfad durch den Pages-Pfad
            live_url = raw_url.replace("github.com/juppijo/", "juppijo.github.io/")
            live_url = live_url.replace("/blob/main/", "/")
            
            # 2. Leerzeichen durch %20 ersetzen
            final_url = live_url.replace(" ", "%20")
            
            if repo not in repositories:
                repositories[repo] = []
            
            repositories[repo].append({
                "label": label,
                "url": final_url,
                "icon": "✨"
            })

    # In JSON-Struktur überführen
    json_data = []
    for title, links in repositories.items():
        json_data.append({
            "title": title,
            "links": links
        })

    # Als UTF-8 speichern
    with open(output_json, mode='w', encoding='utf-8') as jsonfile:
        json.dump(json_data, jsonfile, indent=2, ensure_ascii=False)

    print(f"✅ Fertig! Die Live-Links für {output_json} wurden generiert.")

# Pfade (bitte prüfen, ob der Dateiname exakt stimmt)
base_path = os.path.dirname(os.path.abspath(__file__))
input_file = os.path.join(base_path, 'GitHub Repository Index - GITALL.csv')
output_file = os.path.join(base_path, 'links.json')

create_links_json(input_file, output_file)
