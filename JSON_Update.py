import json
import copy

def smart_merge(base, source):
    """
    Führt JSON-Daten intelligent zusammen:
    - Erkennt verschachtelte Kategorien/Gruppen sowie flache Link-Listen.
    - Verhindert Duplikate bei gleichem 'label' oder gleicher 'url'.
    - Fügt in bestehende Einträge NUR die fehlenden Attribute hinzu.
    """
    if isinstance(base, list) and isinstance(source, list):
        # Prüfen, ob die Liste aus Kategorien/Gruppen besteht (z.B. mit 'title', 'name' oder 'category')
        is_category_list = False
        if base and isinstance(base[0], dict):
            group_keys = ('title', 'name', 'category', 'group')
            if any(k in base[0] for k in group_keys):
                is_category_list = True

        if is_category_list:
            # Kategorien/Gruppen anhand ihres Namens/Titels zuordnen
            for src_group in source:
                if isinstance(src_group, dict):
                    matched_group = None
                    group_key = next((k for k in ('title', 'name', 'category', 'group') if k in src_group), None)
                    
                    if group_key:
                        for base_group in base:
                            if isinstance(base_group, dict) and base_group.get(group_key) == src_group.get(group_key):
                                matched_group = base_group
                                break
                    
                    if matched_group:
                        # Gruppe gefunden -> Inhalte (z.B. 'items' oder 'links') rekursiv mergen
                        for k, v in src_group.items():
                            if k not in matched_group:
                                matched_group[k] = copy.deepcopy(v)
                            else:
                                matched_group[k] = smart_merge(matched_group[k], v)
                    else:
                        if src_group not in base:
                            base.append(copy.deepcopy(src_group))
        else:
            # Flache Link-Liste: Strenger Abgleich über label oder url
            for src_item in source:
                if isinstance(src_item, dict):
                    matched_base_item = None
                    for base_item in base:
                        if isinstance(base_item, dict):
                            src_label = src_item.get('label')
                            base_label = base_item.get('label')
                            src_url = src_item.get('url')
                            base_url = base_item.get('url')
                            
                            # Wenn Label ODER URL übereinstimmt, ist es derselbe Eintrag!
                            if (src_label and base_label and src_label == base_label) or \
                               (src_url and base_url and src_url == base_url):
                                matched_base_item = base_item
                                break
                    
                    if matched_base_item:
                        # Eintrag existiert bereits -> NUR fehlende Schlüssel ergänzen (kein Duplikat!)
                        for key, val in src_item.items():
                            if key not in matched_base_item:
                                matched_base_item[key] = copy.deepcopy(val)
                    else:
                        # Eintrag existiert wirklich gar nicht -> neu anhängen
                        if src_item not in base:
                            base.append(copy.deepcopy(src_item))
                else:
                    if src_item not in base:
                        base.append(src_item)
                        
    elif isinstance(base, dict) and isinstance(source, dict):
        for key, value in source.items():
            if key not in base:
                base[key] = copy.deepcopy(value)
            else:
                base[key] = smart_merge(base[key], value)
                
    return base

def update_json_file(file_base, file_source, output_path):
    try:
        print(f"Lade Basis-Datei '{file_base}'...")
        with open(file_base, 'r', encoding='utf-8') as f:
            base_data = json.load(f)
            
        print(f"Lade Quell-Datei '{file_source}'...")
        with open(file_source, 'r', encoding='utf-8') as f:
            source_data = json.load(f)
            
        merged_data = copy.deepcopy(base_data)
        smart_merge(merged_data, source_data)
        
        with open(output_path, 'w', encoding='utf-8') as out_f:
            json.dump(merged_data, out_f, ensure_ascii=False, indent=4)
            
        print(f"Erfolgreich! Keine doppelten Labels, Attribute wurden sauber ergänzt in '{output_path}'.")
        
    except FileNotFoundError as e:
        print(f"Fehler: Eine Datei wurde nicht gefunden: {e}")
    except json.JSONDecodeError as e:
        print(f"Fehler beim Lesen des JSON-Formats: {e}")

if __name__ == "__main__":
    file1 = 'links_cl.json'   # Deine bestehende Datei
    file2 = 'links_cl3.json'  # Die Datei mit den Attributen
    output = 'links_cln.json'

    print("Starte präzise Zusammenführung ohne Duplikate...")
    update_json_file(file1, file2, output)
