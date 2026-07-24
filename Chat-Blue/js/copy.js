const WRZTCopy = {
    // Erstellt einen eleganten Kopier-Button
    createButton(textToCopy) {
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.innerHTML = '📋 Kopieren';
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Verhindert ungewollten Formel-Zoom bei Klick
            navigator.clipboard.writeText(textToCopy).then(() => {
                btn.innerHTML = '✅ Kopiert!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = '📋 Kopieren';
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(err => console.error('Fehler beim Kopieren:', err));
        });
        
        return btn;
    }
};