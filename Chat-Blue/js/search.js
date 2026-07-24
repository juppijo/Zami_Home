const WRZTSearch = {
    // Filtert die Konversationen basierend auf einem Suchbegriff
    filter(conversations, query) {
        if (!query || query.trim() === "") return conversations;
        
        const lowerQuery = query.toLowerCase();
        return conversations.filter(chat => {
            // Treffer im Titel?
            if (chat.title.toLowerCase().includes(lowerQuery)) return true;
            
            // Treffer in einer der Nachrichten?
            return chat.messages.some(msg => msg.text.toLowerCase().includes(lowerQuery));
        });
    }
};