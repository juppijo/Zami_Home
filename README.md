# Zami_Home
Home page von Zaminias Welt

# 🌍 Zaminia Home – Deine persönliche digitale Oase

![Zaminia Logo](bild.jpg)

**Zaminia Home** ist ein interaktives, Zen-inspiriertes Dashboard, das als Startseite für den Browser dient. Es kombiniert ästhetisches Design mit funktionaler Link-Verwaltung und einer dynamischen Farbwelt.

## ✨ Features

* **Dynamisches Design:** Die gesamte Farbpalette der Seite lässt sich über Schieberegler (Hue, Sättigung, Helligkeit) in Echtzeit anpassen.
* **Interaktives Intro:** Ein persönliches Willkommens-Video (`Zami_Welt.mp4`), das beim Start sanft in das Logo oben links verschwindet.
* **Klappbare Kategorien:** Deine Links sind in übersichtlichen Karten organisiert, die sich platzsparend einklappen lassen.
* **GitHub-Integration:** Die Link-Daten werden direkt aus einer `links.json` von GitHub geladen – so kannst du deine Links aktualisieren, ohne den Code anzupassen.
* **Zen-Modus:** Ein integrierter Sound-Player für Hintergrundmusik und ein automatischer Farbdurchlauf (Auto-Hue) für maximale Entspannung.
* **Dark Mode & Vollbild:** Unterstützung für dunkles Design und einen ablenkungsfreien Vollbildmodus.

## 🚀 Installation & Nutzung

1.  **Repository klonen:**
    ```bash
    git clone [https://github.com/juppijo/Zami_Home.git](https://github.com/juppijo/Zami_Home.git)
    ```
2.  **Dateien lokal öffnen:**
    Öffne einfach die `index.html` in einem modernen Webbrowser.

3.  **Links anpassen:**
    Bearbeite die Datei `links.json`, um deine eigenen Kategorien und URLs hinzuzufügen. Das Format sieht so aus:
    ```json
    [
      {
        "title": "Meine Tools",
        "links": [
          { "label": "Google", "url": "[https://google.com](https://google.com)", "icon": "🔍" }
        ]
      }
    ]
    ```

## 🛠️ Technische Details

* **HTML5 & CSS3:** Nutzung von CSS-Variablen (Custom Properties) für das dynamische Theming.
* **JavaScript (Vanilla):** Fetch-API zum Laden der JSON-Daten und DOM-Manipulation für die Animationen.
* **Responsive:** Das Grid-Layout passt sich automatisch an verschiedene Bildschirmgrößen (Desktop, Tablet, Smartphone) an.

## 🧘‍♂️ Philosophie
Inspiriert von der Ruhe und Klarheit von *Shambala*, dient Zaminia als Ankerpunkt im digitalen Alltag.

---
Erstellt mit Achtsamkeit von **Zami**.
