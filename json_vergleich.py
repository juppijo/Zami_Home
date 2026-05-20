import json
import os

def load_json(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Fehler beim Laden von {filepath}: {e}")
        return None

def extract_category_links(data, category_title):
    """Extrahiert alle Links einer bestimmten Kategorie als Set von URLs und ein Mapping von URL zu Label"""
    links_set = set()
    url_to_label = {}
    
    if not isinstance(data, list):
        return links_set, url_to_label
        
    for item in data:
        if isinstance(item, dict) and item.get("title") == category_title:
            links = item.get("links", [])
            for link in links:
                url = link.get("url")
                label = link.get("label")
                if url:
                    links_set.add(url)
                    url_to_label[url] = label
            break
    return links_set, url_to_label

def compare_categories(file1, file2, category_title="WRZT"):
    data1 = load_json(file1)
    data2 = load_json(file2)
    
    if data1 is None or data2 is None:
        return
        
    set1, labels1 = extract_category_links(data1, category_title)
    set2, labels2 = extract_category_links(data2, category_title)
    
    print(f"=== Vergleich der Kategorie '{category_title}' ===")
    print(f"Einträge in {os.path.basename(file1)}: {len(set1)}")
    print(f"Einträge in {os.path.basename(file2)}: {len(set2)}")
    print("-" * 50)
    
    # Nur in Datei 1
    only_in_1 = set1 - set2
    if only_in_1:
        print(f"Nur in {os.path.basename(file1)} vorhanden ({len(only_in_1)}):")
        for url in sorted(only_in_1):
            print(f"  - Label: {labels1.get(url)} | URL: {url}")
    else:
        print(f"Keine Einträge, die exklusiv nur in {os.path.basename(file1)} sind.")
        
    print("-" * 50)
    
    # Nur in Datei 2
    only_in_2 = set2 - set1
    if only_in_2:
        print(f"Nur in {os.path.basename(file2)} vorhanden ({len(only_in_2)}):")
        for url in sorted(only_in_2):
            print(f"  - Label: {labels2.get(url)} | URL: {url}")
    else:
        print(f"Keine Einträge, die exklusiv nur in {os.path.basename(file2)} sind.")

if __name__ == "__main__":
    # Pfade zu deinen Dateien (hier anpassen falls nötig)
    datei1 = "links.json"
    datei2 = "links2.json"
    
    # Standardmäßig wird die Kategorie "WRZT" verglichen
    compare_categories(datei1, datei2, "Zami_Buecher")
