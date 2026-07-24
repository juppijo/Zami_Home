const WRZTMath = {
    triggerRepaint() {
        this.initLiveConverter();
        
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise().catch(err => console.error(err));
        }
    },

    initLiveConverter() {
        const inputField = document.getElementById('math-live-input');
        const popupBody = document.getElementById('math-popup-body');
        
        if (!inputField || !popupBody) return;
        if (inputField.dataset.liveInit) return;
        inputField.dataset.liveInit = "true";

        inputField.addEventListener('input', () => {
            let value = inputField.value.trim();
            
            if (value === "") {
                popupBody.innerHTML = '<div class="math-placeholder">Warte auf Eingabe...</div>';
                return;
            }

            // Automatische LaTeX-Verpackung falls nackt kopiert
            if (!value.startsWith('\\\[') && !value.startsWith('\\\(') && !value.startsWith('$$') && !value.startsWith('$')) {
                if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1).trim();
                else if (value.startsWith('(') && value.endsWith(')')) value = value.slice(1, -1).trim();
                
                value = `\\[ ${value} \\]`;
            }

            popupBody.innerHTML = value;

            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([popupBody]).catch(err => console.error(err));
            }
        });
    }
};

// Direkte Button-Schaltung für Mini- oder Breitansicht
document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById('toggle-converter-btn');
    const converterSidebar = document.getElementById('math-converter-sidebar');
    
    if (toggleBtn && converterSidebar) {
        toggleBtn.onclick = function(e) {
            e.preventDefault();
            converterSidebar.classList.toggle('collapsed');
        };
    }
});