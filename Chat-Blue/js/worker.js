// js/worker.js
self.onmessage = function(e) {
    const jsonString = e.data;
    try {
        const data = JSON.parse(jsonString);
        const conversations = Array.isArray(data) ? data : [data];
        
        const parsed = conversations.map(chat => {
            const messages = [];
            if (chat.mapping) {
                Object.values(chat.mapping).forEach(node => {
                    if (node.message && node.message.content && node.message.content.parts) {
                        messages.push({
                            id: node.message.id,
                            role: node.message.author.role,
                            text: node.message.content.parts.join('\n'),
                            time: node.message.create_time
                        });
                    }
                });
            }
            messages.sort((a, b) => (a.time || 0) - (b.time || 0));
            return { title: chat.title || "Unbenannter Chat", messages: messages };
        });

        self.postMessage({ success: true, conversations: parsed });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};