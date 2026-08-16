let chatHistory = [];
let chatImageContext = null;
let webSearchEnabled = false;
let chatMode = 'medical'; // medical, therapy, voice

function initChat() {
    document.getElementById('chatSendBtn').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    document.getElementById('chatFileInput').addEventListener('change', handleChatImage);
    document.getElementById('chatPdfInput').addEventListener('change', handleChatPdf);
    document.getElementById('searchToggleBtn').addEventListener('click', toggleWebSearch);
}

function toggleWebSearch() {
    webSearchEnabled = !webSearchEnabled;
    const btn = document.getElementById('searchToggleBtn');
    if (webSearchEnabled) {
        btn.style.background = 'var(--primary)';
        btn.style.color = 'white';
        addChatMessage('assistant', '🔍 Web search enabled. I\'ll search medical databases for your questions.');
    } else {
        btn.style.background = '';
        btn.style.color = '';
        addChatMessage('assistant', 'Web search disabled.');
    }
}

async function handleChatPdf(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    addChatMessage('user', `📄 ${file.name}`, true);
    const typingId = addChatMessage('assistant', '...', false, true);
    
    const formData = new FormData();
    formData.append('files', file);
    formData.append('category', selectedCategory || 'General');
    formData.append('text', 'Please analyze this PDF document.');
    
    try {
        const response = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        document.getElementById(typingId).remove();
        
        if (response.ok && data.summary) {
            addChatMessage('assistant', `📊 **PDF Analysis Complete**\n\n${data.summary}`);
            
            if (data.critical_values && data.critical_values.length > 0) {
                let criticalMsg = '\n\n⚠️ **Critical Values:**\n';
                data.critical_values.forEach(cv => {
                    criticalMsg += `- ${cv.title}: ${cv.message}\n`;
                });
                addChatMessage('assistant', criticalMsg);
            }
            
            chatHistory.push({
                role: 'system',
                content: `PDF Analysis: ${data.summary}`
            });
        } else {
            addChatMessage('assistant', `❌ ${data.error || 'Error analyzing PDF'}`);
        }
    } catch (error) {
        document.getElementById(typingId).remove();
        addChatMessage('assistant', '❌ Error analyzing PDF. Please try again.');
    }
    
    e.target.value = '';
}

async function handleChatImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        chatImageContext = event.target.result;
        
        // Display image preview
        addChatMessage('user', `<img src="${chatImageContext}" style="max-width: 200px; border-radius: 8px;">`, true);
        
        const typingId = addChatMessage('assistant', '...', false, true);
        
        const formData = new FormData();
        formData.append('files', file);
        formData.append('category', selectedCategory || 'General');
        formData.append('text', 'Please analyze this medical image.');
        
        try {
            const response = await fetch('http://localhost:8000/analyze', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            document.getElementById(typingId).remove();
            
            if (response.ok) {
                if (data.extracted_text) {
                    addChatMessage('assistant', `🔍 **OCR Extracted Text:**\n\n${data.extracted_text.substring(0, 500)}${data.extracted_text.length > 500 ? '...' : ''}`);
                }
                
                if (data.summary) {
                    addChatMessage('assistant', `💡 **Analysis:**\n\n${data.summary}`);
                }
                
                chatHistory.push({
                    role: 'system',
                    content: `Image context: ${data.extracted_text || 'Medical image uploaded'}`
                });
            } else {
                addChatMessage('assistant', `❌ ${data.error || 'Error processing image'}`);
            }
        } catch (error) {
            document.getElementById(typingId).remove();
            addChatMessage('assistant', '❌ Error processing image. Please try again.');
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    addChatMessage('user', message);
    input.value = '';
    
    // Get current mode
    const activeMode = document.querySelector('.mode-btn.active');
    chatMode = activeMode ? activeMode.dataset.mode : 'medical';
    
    chatHistory.push({
        role: 'user',
        content: message
    });
    
    const typingId = addChatMessage('assistant', '...', false, true);
    
    try {
        // Adjust system prompt based on mode
        let systemContext = '';
        if (chatMode === 'therapy') {
            systemContext = 'You are a compassionate mental health support AI. Provide empathetic responses to health anxiety and emotional concerns. Always remind users to seek professional help for serious mental health issues.';
        } else if (chatMode === 'voice') {
            systemContext = 'You are helping transcribe and organize doctor visit notes. Provide structured summaries of medical conversations.';
        }
        
        const response = await fetch('http://localhost:8000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: chatHistory,
                context: currentAnalysis ? JSON.stringify(currentAnalysis) : null,
                web_search: webSearchEnabled,
                mode: chatMode,
                system_context: systemContext
            })
        });
        
        const data = await response.json();
        document.getElementById(typingId).remove();
        
        addChatMessage('assistant', data.response);
        chatHistory.push({
            role: 'assistant',
            content: data.response
        });
        
    } catch (error) {
        document.getElementById(typingId).remove();
        addChatMessage('assistant', '❌ Sorry, I encountered an error. Please try again.');
    }
}

function addChatMessage(role, content, isImage = false, isTyping = false) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageId = `msg-${Date.now()}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.id = messageId;
    
    if (isTyping) {
        messageDiv.innerHTML = `<div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    } else {
        // Convert markdown-style formatting
        let formattedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        messageDiv.innerHTML = `<div class="message-content">${formattedContent}</div>`;
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    return messageId;
}

// Initialize chat when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
} else {
    initChat();
}
