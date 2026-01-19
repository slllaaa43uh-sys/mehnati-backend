// Enhanced logging for conversationHistory
console.log('Conversation History:', conversationHistory);

// Enhanced message validation
if (!message || typeof message !== 'string') {
    console.error('Invalid message:', message);
    return;
}