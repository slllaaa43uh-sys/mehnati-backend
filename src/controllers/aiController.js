const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');
const { findAnswer } = require('../data/knowledgeBase');

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';

console.log('🔧 [INIT] Ollama Configuration: ');
console.log(`   Base URL: ${OLLAMA_BASE_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);

// ============================================
// 🎭 System Prompt
// ============================================
const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في تطبيق "مهنتي لي". 

⚠️ قواعد الإجابة:
1. اجب باللغة العربية فقط
2. ردودك يجب أن تكون سهلة وبسيطة
3. إذا سأل:  "من طورك؟" أجب فقط:  "طورني صلاح مهدلي"
4. كن ودياً وسهل التعامل معك`;

// ============================================
// 📡 Chat with AI
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('📨 [AI-CHAT] New chat request received');
    console.log('═══════════════════════════════════════════════════');
    
    let { message, conversationHistory } = req.body;

    console.log('📝 [DEBUG] Message:', message);
    
    if (!message || !message.trim()) {
      console.error('❌ [ERROR] Message is empty');
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    if (! conversationHistory) {
      conversationHistory = [];
    }
    
    if (! Array.isArray(conversationHistory)) {
      conversationHistory = [];
    }
    
    conversationHistory = conversationHistory.filter(msg => {
      return msg && msg.content && msg.role;
    });
    
    console.log(`📊 [DEBUG] History length: ${conversationHistory.length}`);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const userMessage = message.trim();
    const lowerMessage = userMessage.toLowerCase();
    
    console.log('💬 [DEBUG] User message:', userMessage);
    
    // ============================================
    // 🔍 البحث في Knowledge Base أولاً
    // ============================================
    console.log('🔎 [DEBUG] Searching in Knowledge Base...');
    const answer = findAnswer(userMessage);
    
    if (answer) {
      console.log('✅ [DEBUG] Found answer in Knowledge Base! ');
      res.write('data: ' + JSON.stringify({ 
        type: 'chunk', 
        content: answer 
      }) + '\n\n');
      res.write('data: ' + JSON.stringify({ 
        type: 'done', 
        fullResponse: answer 
      }) + '\n\n');
      res.end();
      return;
    }

    console.log('⚠️ [DEBUG] No answer in Knowledge Base, using Ollama...');
    
    // ============================================
    // 🤖 استخدم Ollama للأسئلة الأخرى
    // ============================================
    res.write('data: ' + JSON.stringify({ 
      type: 'status', 
      status: 'responding', 
      message: 'يكتب ✍️' 
    }) + '\n\n');

    var systemMsg = SYSTEM_PROMPT;
    var messages = [{ role: 'system', content:  systemMsg }];
    
    var recent = conversationHistory.filter(msg => msg && msg.content && msg.role).slice(-3);
    
    for (var k = 0; k < recent. length; k++) {
      messages.push({
        role: recent[k].role === 'user' ? 'user' : 'assistant',
        content: recent[k].content
      });
    }
    
    messages.push({ role: 'user', content: userMessage });
    
    console.log('✅ [DEBUG] Messages prepared, connecting to Ollama');

    try {
      var response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model:  OLLAMA_MODEL,
          messages: messages,
          stream: true
        },
        { 
          responseType: 'stream', 
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ [DEBUG] Ollama connected, receiving stream.. .');
      
      var fullText = '';

      response.data.on('data', function(chunk) {
        var lines = chunk.toString().split('\n');
        
        for (var m = 0; m < lines. length; m++) {
          if (! lines[m].trim()) continue;
          
          try {
            var data = JSON.parse(lines[m]);
            
            if (data.message && data.message.content) {
              fullText += data.message. content;
              res.write('data: ' + JSON.stringify({ 
                type: 'chunk', 
                content: data. message.content 
              }) + '\n\n');
            }
            
            if (data. done) {
              console.log('✅ [DEBUG] Stream complete');
              res.write('data: ' + JSON.stringify({ 
                type: 'done', 
                fullResponse: fullText 
              }) + '\n\n');
              res.end();
            }
          } catch (e) {
            console.error('❌ [ERROR] Parsing error:', e.message);
          }
        }
      });

      response.data.on('error', function(err) {
        console.error('❌ [ERROR] Stream error:', err. message);
        res.write('data: ' + JSON.stringify({ 
          type: 'error', 
          message: 'حدث خطأ في البث' 
        }) + '\n\n');
        res.end();
      });
      
    } catch (err) {
      console.error('❌ [ERROR] Ollama error:', err.message);
      res.write('data: ' + JSON.stringify({ 
        type: 'error', 
        message: 'الخدمة غير متاحة حالياً',
        error: err.message
      }) + '\n\n');
      res.end();
    }

  } catch (error) {
    console.error('❌ [ERROR] Chat error:', error. message);
    if (! res.headersSent) res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: ' + JSON.stringify({ 
      type: 'error', 
      message: 'حدث خطأ',
      error: error.message 
    }) + '\n\n');
    res.end();
  }
};

exports.checkOllamaHealth = async (req, res) => {
  try {
    console.log('🏥 Health check');
    var response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    res.json({ 
      success: true, 
      message: 'Ollama is running',
      model: OLLAMA_MODEL,
      status: '✅ جاهز'
    });
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    res.status(503).json({ 
      success: false, 
      message: 'Ollama not available',
      error: error.message
    });
  }
};
