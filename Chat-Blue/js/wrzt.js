const WRZTToolkit = {
    constantes: {
        'Xi': { name: 'Ur-Spannung (\\(\\Xi\\))', value: '5,897427 × 10^-19 kg/m', desc: 'Die fundamentale Ur-Spannungs-Konstante der Wellenraumzeit.' },
        'eta': { name: 'Raumzeit-Trägheit (\\(\\eta\\))', value: '4,5543 × 10^-31 kg', desc: 'Trägheitskomponente der Raumzeit-Struktur.' },
        'R_min': { name: 'Minimal-Radius (\\(R_{min}\\))', value: '7,716 × 10^-13 m', desc: 'Der minimale Strukturradius des Wellenraumzeit-Netzes.' },
        'alpha': { name: 'Feinstrukturkonstante (\\(\\alpha\\))', value: 'ca. 1/137', desc: 'Gibt die Stärke der elektromagnetischen Wechselwirkung an.' }
    },

    // Hebt WRZT-Begriffe im Text hervor und fügt Tooltips hinzu
    highlightSymbols(htmlText) {
        let text = htmlText;
        // Ersetzt z.B. Xi oder eta mit einem interaktiven Element, solange es nicht in HTML-Tags steht
        text = text.replace(/\b(Ur-Spannung|Raumzeit-Trägheit|Minimal-Radius)\b/g, (match) => {
            return `<span class="wrzt-term" title="Klicken für WRZT-Info">${match}</span>`;
        });
        return text;
    },

    // Einfacher Konverter: Berechnet c aus deinen Konstanten
    calculateC(xi, eta, rMin) {
        // Formel: c = (Xi / eta) * R_min
        try {
            const c = (xi / eta) * rMin;
            return c;
        } catch(e) { return 0; }
    }
};