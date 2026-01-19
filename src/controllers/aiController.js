const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');
const { KNOWLEDGE_BASE } = require('../data/knowledgeBase');

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';

console.log('🔧 [INIT] Ollama Configuration:  ');
console.log(`   Base URL: ${OLLAMA_BASE_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);

// ============================================
// 🧠 بناء قاعدة البيانات المدمجة في System Prompt
// ============================================

function buildTrainingData() {
  console.log('\n📚 [TRAINING] Building AI Knowledge Base...\n');
  
  let trainingText = `أنت مساعد ذكي متخصص في تطبيق "مهنتي لي".  

⚠️ **قواعد إلزامية:**
1. اللغة العربية فقط (لا صينية، لا إنجليزية)
2. كن ودياً وواضحاً ومختصراً
3. تذكر المحادثات السابقة
4. إذا سأل "من طورك؟" أجب:  "طورني صلاح مهدلي 💙"

📖 **المعلومات التالية درسها جيداً واستخدمها:**

`;

  // ➕ أضف كل البيانات من Knowledge Base للـ System Prompt
  for (const [topic, data] of Object.entries(KNOWLEDGE_BASE)) {
    trainingText += `\n=== ${topic} ===\n`;
    trainingText += `الكلمات المفتاحية: ${data.keywords.join(', ')}\n`;
    trainingText += `الإجابة:\n${data.answer}\n\n`;
    
    console.log(`✅ [TRAINING] Added: ${topic}`);
  }

  trainingText += `\n⚡ تذكر: أنت تحتفظ بكل هذه المعلومات وتستخدمها في الإجابة على الأسئلة.\n`;
  trainingText += `لا تقل "لا أعرف"، استخدم ما درسته! `;

  console.log('\n✅ [TRAINING] Knowledge Base loaded into AI Memory\n');
  console.log(`📊 Total Topics: ${Object.keys(KNOWLEDGE_BASE).length}`);
  console.log(`📊 Total Size: ${trainingText.length} characters\n`);

  return trainingText;
}

// ✅ بناء البيانات عند بدء الخادم
const TRAINED_KNOWLEDGE = buildTrainingData();

// ============================================
// 🎭 System Prompt - يحتوي على كل المعلومات
// ============================================
const SYSTEM_PROMPT = TRAINED_KNOWLEDGE;

// ============================================
// 📡 Chat with AI - مع الذاكرة الكاملة
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('📨 [AI-CHAT] New chat request');
    console.log('═══════════════════════════════════════════════════');
    
    let { message, conversationHistory } = req.body;

    console.log('📝 Message:', message);
    
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    // ✅ تحضير الذاكرة
    if (!conversationHistory) {
      conversationHistory = [];
    }
    
    if (! Array.isArray(conversationHistory)) {
      conversationHistory = [];
    }
    
    conversationHistory = conversationHistory.filter(msg => {
      return msg && msg.content && msg.role && msg.content.trim();
    });

    console.log(`📊 Conversation history length: ${conversationHistory.length}`);
    
    const userMessage = message.trim();

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ============================================
    // 🤖 استخدم Ollama مع البيانات المدمجة
    // ============================================
    
    res.write('data: ' + JSON.stringify({ 
      type: 'status', 
      status: 'responding', 
      message: 'يكتب ✍️' 
    }) + '\n\n');

    // 🧠 **بناء المحادثة مع الذاكرة الكاملة**
    var messages = [
      { 
        role: 'system', 
        content: SYSTEM_PROMPT   // ✅ يحتوي على كل البيانات
      }
    ];
    
    // ✅ أضف السجل السابق (حفظ الذاكرة)
    console.log(`📚 Adding ${conversationHistory.length} previous messages to memory`);
    for (var i = 0; i < conversationHistory.length; i++) {
      if (conversationHistory[i]. content. trim()) {
        messages.push({
          role: conversationHistory[i].role === 'user' ? 'user' : 'assistant',
          content: conversationHistory[i].content
        });
      }
    }
    
    // ✅ أضف السؤال الحالي
    messages.push({ 
      role: 'user', 
      content: userMessage 
    });
    
    console.log(`✅ Final messages count: ${messages.length}`);
    console.log('🧠 AI has full Knowledge Base in memory');

    try {
      console.log('🔗 Connecting to Ollama...');
      
      var response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model:  OLLAMA_MODEL,
          messages: messages,
          stream: true,
          options: {
            temperature: 0.3,
            num_predict: 1000,
            top_p: 0.9,
            top_k: 40
          }
        },
        { 
          responseType: 'stream', 
          timeout: 60000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      console.log('✅ Connected, receiving stream...');
      
      var fullText = '';

      response.data.on('data', function(chunk) {
        var lines = chunk.toString().split('\n');
        
        for (var m = 0; m < lines. length; m++) {
          if (! lines[m].trim()) continue;
          
          try {
            var data = JSON.parse(lines[m]);
            
            if (data.message && data.message.content) {
              var content = data.message.content;
              
              // 🚫 منع اللغة الصينية
              if (isChinese(content)) {
                console.log('❌ [BLOCKED] Chinese detected');
                continue;
              }
              
              fullText += content;
              res.write('data: ' + JSON.stringify({ 
                type: 'chunk', 
                content: content 
              }) + '\n\n');
            }
            
            if (data.done) {
              console.log('✅ Stream complete');
              
              // ✅ حفظ الرد في الذاكرة
              if (fullText.trim()) {
                conversationHistory.push({
                  role: 'user',
                  content: userMessage
                });
                conversationHistory.push({
                  role: 'assistant',
                  content: fullText
                });
                console.log('💾 Saved to memory - history length:', conversationHistory.length);
              }
              
              res.write('data: ' + JSON.stringify({ 
                type: 'done', 
                fullResponse: fullText,
                memorySize: conversationHistory.length
              }) + '\n\n');
              res.end();
            }
          } catch (e) {
            console.error('❌ Parse error:', e.message);
          }
        }
      });

      response.data.on('error', function(err) {
        console.error('❌ Stream error:', err. message);
        res.write('data: ' + JSON.stringify({ 
          type: 'error', 
          message: 'حدث خطأ في البث' 
        }) + '\n\n');
        res.end();
      });
      
    } catch (err) {
      console.error('❌ Ollama error:', err.message);
      res.write('data: ' + JSON.stringify({ 
        type: 'error', 
        message: 'الخدمة غير متاحة',
        error: err.message
      }) + '\n\n');
      res.end();
    }

  } catch (error) {
    console.error('❌ Chat error:', error. message);
    if (! res.headersSent) res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: ' + JSON.stringify({ 
      type: 'error', 
      message: 'حدث خطأ',
      error: error.message 
    }) + '\n\n');
    res.end();
  }
};

// ============================================
// 🚫 منع اللغة الصينية
// ============================================

function isChinese(text) {
  const chineseRegex = /[\u4E00-\u9FFF]/g;
  return chineseRegex.test(text);
}

// ============================================
// Health Check
// ============================================
exports.checkOllamaHealth = async (req, res) => {
  try {
    console.log('🏥 Health check');
    var response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    res.json({ 
      success: true, 
      message: 'Ollama running',
      model: OLLAMA_MODEL,
      knowledgeBaseLoaded: true,
      topicsCount: Object.keys(KNOWLEDGE_BASE).length,
      status: '✅ جاهز'
    });
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    res.status(503).json({ 
      success: false, 
      message: 'غير متاح',
      error: error.message
    });
  }
};
