const WRZTRenderer = {
    render(conversations, targetElement, sidebarElement) {
        targetElement.innerHTML = '';
        if (sidebarElement) sidebarElement.innerHTML = '';
        
        if (conversations.length === 0) {
            targetElement.innerHTML = '<div class="no-results">Keine Chats gefunden.</div>';
            return;
        }

        conversations.forEach((chat, index) => {
            const chatId = `chat-${index}`;
            
            if (sidebarElement) {
                const link = document.createElement('a');
                link.href = `#${chatId}`;
                link.className = 'sidebar-link';
                link.textContent = chat.title;
                sidebarElement.appendChild(link);
            }

            const convDiv = document.createElement('div');
            convDiv.className = 'conversation';
            convDiv.id = chatId;
            
            const titleHeader = document.createElement('div');
            titleHeader.className = 'chat-header';
            
            const title = document.createElement('h3');
            title.textContent = chat.title;
            titleHeader.appendChild(title);
            
            const fullText = chat.messages.map(m => `${m.role}: ${m.text}`).join('\n\n');
            titleHeader.appendChild(WRZTCopy.createButton(fullText));
            convDiv.appendChild(titleHeader);
            
            chat.messages.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `message ${msg.role}`;
                
                const authorRow = document.createElement('div');
                authorRow.className = 'author-row';
                
                const author = document.createElement('div');
                author.className = 'author';
                author.textContent = msg.role === 'user' ? 'Jup (Du)' : 'Zaminia / AI';
                
                authorRow.appendChild(author);
                authorRow.appendChild(WRZTCopy.createButton(msg.text));
                
                const content = document.createElement('div');
                content.className = 'content';
                
                // WICHTIG: innerHTML verwenden und Zeilenumbrüche erhalten
                if (window.marked) {
                    content.innerHTML = window.marked.parse(msg.text);
                } else {
                    content.innerHTML = msg.text.replace(/\n/g, '<br>');
                }
                
                msgDiv.appendChild(authorRow);
                msgDiv.appendChild(content);
                convDiv.appendChild(msgDiv);
            });
            
            targetElement.appendChild(convDiv);
        });
        
        // MathJax das Signal zum Rendern geben
        if (typeof WRZTMath !== 'undefined' && WRZTMath.triggerRepaint) {
            WRZTMath.triggerRepaint();
        }
    }
};