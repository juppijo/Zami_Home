import json
import time

def erstelle_links_cl3(file1_path, file2_path, output_path):
    # 1. Datei 1 laden (Aktuelle Referenzstruktur & neue Einträge)
    try:
        with open(file1_path, 'r', encoding='utf-8') as f:
            data1 = json.load(f)
    except FileNotFoundError:
        print(f"Fehler: Die Datei '{file1_path}' wurde nicht gefunden.")
        return

    # 2. Datei 2 laden (Enthält die reichhaltigen Metadaten)
    try:
        with open(file2_path, 'r', encoding='utf-8') as f:
            data2 = json.load(f)
    except FileNotFoundError:
        print(f"Fehler: Die Datei '{file2_path}' wurde nicht gefunden.")
        return

    # Ein Lookup-Dictionary für Datei 2 aufbauen, um schnell auf Metadaten
    # über den Schlüssel (Kategorie-Titel, Label) zuzugreifen.
    meta_dict = {}
    for cat in data2:
        title = cat.get("title")
        for link in cat.get("links", []):
            label = link.get("label")
            meta_dict[(title, label)] = link

    result = []
    entfernt_zaehler = 0
    neu_zaehler = 0
    gemeinsam_zaehler = 0

    # 3. Durchlaufe Datei 1, um die aktuelle Struktur beizubehalten
    for cat1 in data1:
        title = cat1.get("title")
        new_links = []
        
        for link1 in cat1.get("links", []):
            label = link1.get("label")
            key = (title, label)
            
            if key in meta_dict:
                # Gemeinsamer Datensatz: Nimm die Metadaten aus Datei 2
                merged_link = meta_dict[key].copy()
                # Falls sich URLs oder Icons in Datei 1 aktualisiert haben sollten, diese aktualisieren:
                for k, v in link1.items():
                    if k not in merged_link or not merged_link[k]:
                        merged_link[k] = v
                new_links.append(merged_link)
                gemeinsam_zaehler += 1
            else:
                # Neuer Datensatz, der nur in Datei 1 existiert
                new_links.append(link1)
                neu_zaehler += 1
                
        result.append({
            "title": title,
            "links": new_links
        })

    # Ermitteln, wie viele alte Datensätze aus Datei 2 entfernt wurden
    total_file2_links = sum(len(c.get("links", [])) for c in data2)
    entfernt_zaehler = total_file2_links - gemeinsam_zaehler

    # 4. Speichern der neuen Datei links_cl3.json
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("--- Zusammenfassung des Vergleichs ---")
    print(f" Gemeinsame Datensätze übernommen: {gemeinsam_zaehler}")
    print(f" Neue Datensätze aus Datei 1 hinzugefügt: {neu_zaehler}")
    print(f" Nicht mehr vorhandene Datensätze entfernt: {entfernt_zaehler}")
    print(f" Erfolgreich neue Datei erstellt: '{output_path}'")

if __name__ == "__main__":
    # Dateinamen anpassen falls nötig
    erstelle_links_cl3("links_cl.json", "links_cl2.json", "links_cl3.json")

    # Dein restlicher Programmcode...
    print("Das Programm beendet in 3 sek. ...")

    # Hier wird das Programm für 2 Sekunden angehalten
    time.sleep(3)

    print("Programm beendet.")
    time.sleep(1)



    
