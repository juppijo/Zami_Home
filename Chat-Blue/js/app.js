document.addEventListener('DOMContentLoaded', () => {
    const fileLoader = document.getElementById('fileLoader');
    const searchBar = document.getElementById('searchBar');
    const root = document.getElementById('root');
    const toc = document.getElementById('toc');
    
    let rawConversations = []; // Cache für die ungefilterten Daten

    fileLoader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            rawConversations = WRZTParser.parseChatJson(event.target.result);
            if (rawConversations.length > 0) {
                // UI freischalten
                searchBar.disabled = false;
                // Erstmalig rendern
                WRZTRenderer.render(rawConversations, root, toc);
            }
        };
        reader.readAsText(file);
    });

    // Echtzeit-Suche mit Input-Event
    searchBar.addEventListener('input', (e) => {
        const filtered = WRZTSearch.filter(rawConversations, e.target.value);
        // Neu rendern (Sidebar bleibt stabil, Hauptbereich ändert sich)
        WRZTRenderer.render(filtered, root, null); 
    });
});