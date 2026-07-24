const WRZTParser = {
    parseChatJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const conversations = Array.isArray(data) ? data : [data];
            
            return conversations.map(chat => {
                const messages = [];
                if (chat.mapping) {
                    Object.values(chat.mapping).forEach(node => {
                        if (node.message && node.message.content && node.message.content.parts) {
                            
                            let rawText = node.message.content.parts.join('\n');
                            
                            // --- ULTRA-TOLERANTER LATEX-FIX FÜR NACKTE KLAMMERN ---
                            
                            // 1. Schütze bereits korrekt formatierte LaTeX-Ausdrücke mit Backslash (falls vorhanden)
                            rawText = rawText.replace(/\\\[/g, '___B_START___');
                            rawText = rawText.replace(/\\\]/g, '___B_END___');
                            rawText = rawText.replace(/\\\(/g, '___I_START___');
                            rawText = rawText.replace(/\\\)/g, '___I_END___');

                            // 2. Repariere nackte eckige Klammern [ ... ], die auf einer eigenen Zeile stehen 
                            // oder mathematische Sonderzeichen wie \frac, \sqrt, ^, _ enthalten.
                            rawText = rawText.replace(/(?<!\\)\[([\s\S]*?)\]/g, (match, formula) => {
                                // Wenn es mehrzeilig ist oder typische LaTeX-Befehle enthält, machen wir ein Block-LaTeX daraus
                                if (formula.includes('\n') || formula.includes('\\') || formula.includes('_') || formula.includes('^')) {
                                    return '___B_START___' + formula + '___B_END___';
                                }
                                return match; // Ansonsten belassen wir es als normalen Text/Klammer
                            });

                            // 3. Repariere nackte runde Klammern ( e ) oder ( \epsilon_0 ), die einzelne Variablen im Fließtext umschließen
                            rawText = rawText.replace(/(?<!\\)\(([\s\S]*?)\)/g, (match, formula) => {
                                const trimmed = formula.trim();
                                // Wenn der Inhalt kurz ist (Variable) oder LaTeX-Symbole enthält
                                if (trimmed.length <= 5 || trimmed.includes('\\') || trimmed.includes('_') || trimmed.includes('^')) {
                                    return '___I_START___ ' + trimmed + ' ___I_END___';
                                }
                                return match;
                            });

                            // 4. Alles in die echten MathJax-Steuerzeichen umwandeln, die MathJax zwingend braucht
                            rawText = rawText.replace(/___B_START___/g, '\\[');
                            rawText = rawText.replace(/___B_END___/g, '\\]');
                            rawText = rawText.replace(/___I_START___/g, '\\(');
                            rawText = rawText.replace(/___I_END___/g, '\\)');

                            messages.push({
                                role: node.message.author.role,
                                text: rawText,
                                time: node.message.create_time
                            });
                        }
                    });
                }
                messages.sort((a, b) => (a.time || 0) - (b.time || 0));
                return { title: chat.title || "Unbenannter Chat", messages };
            });
        } catch (e) {
            console.error("Fehler beim Parsen:", e);
            alert("Ungültiges JSON-Format.");
            return [];
        }
    }
};