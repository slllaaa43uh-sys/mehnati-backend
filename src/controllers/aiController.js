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
// 🎭 System Prompt - منع اللغة الصينية بشدة
// ============================================
const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في تطبيق "مهنتي لي". 

⚠️ **قواعد إلزامية:**

1. **اللغة:** 
   ❌ لا تستخدم الصينية بتاتاً!   
   ❌ لا تستخدم الإنجليزية! 
   ✅ استخدم العربية فقط بـ 100%

2. **الأسلوب:**
   ✅ كن ودياً ومرحباً
   ✅ كن واضحاً ومختصراً
   ✅ استخدم رموز تعبيرية 😊

3. **التذكر:**
   ✅ تذكر السؤال السابق
   ✅ ابن على المحادثة السابقة
   ✅ استخدم السياق

4. **خاص - من طورك:**
   ❌ إذا سأل "من طورك؟" - أجب فقط:  "طورني صلاح مهدلي 💙"
   ❌ لا تكرر الجملة، رد قصير فقط

**تحذير:** إذا كتبت أي حرف صيني أو إنجليزي (إلا الضرورة)، فأنت فشلت!  🚫`;

// ============================================
// 📡 Chat with AI - مع حفظ الذاكرة
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

    // ✅ تحضير الذاكرة (conversation history)
    if (! conversationHistory) {
      conversationHistory = [];
    }
    
    if (! Array.isArray(conversationHistory)) {
      conversationHistory = [];
    }
    
    // تنظيف البيانات
    conversationHistory = conversationHistory.filter(msg => {
      return msg && msg.content && msg.role && msg.content.trim();
    });

    console.log(`📊 Conversation history length: ${conversationHistory.length}`);
    
    // حفظ الرسالة الحالية للذاكرة لاحقاً
    const userMessage = message. trim();
    const lowerMessage = userMessage.toLowerCase();

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ============================================
    // 🔍 البحث في Knowledge Base أولاً
    // ============================================
    console.log('🔎 Searching Knowledge Base...');
    const answer = findAnswer(userMessage);
    
    if (answer) {
      console.log('✅ Found in Knowledge Base');
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

    console.log('⚠️ Not in KB, using Ollama with memory...');
    
    // ============================================
    // 🤖 استخدم Ollama مع حفظ الذاكرة الكاملة
    // ============================================
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: ' + JSON.stringify({ 
      type: 'status', 
      status: 'responding', 
      message: 'يكتب ✍️' 
    }) + '\n\n');

    // 🧠 **بناء المحادثة الكاملة مع التاريخ**
    var messages = [
      { 
        role: 'system', 
        content: SYSTEM_PROMPT 
      }
    ];
    
    // ✅ أضف كل السجل السابق (حفظ الذاكرة)
    console.log(`📚 Adding ${conversationHistory.length} previous messages to memory`);
    for (var i = 0; i < conversationHistory.length; i++) {
      if (conversationHistory[i]. content. trim()) {
        messages.push({
          role: conversationHistory[i].role === 'user' ? 'user' : 'assistant',
          content: conversationHistory[i].content
        });
        console.log(`   ✅ Added message ${i + 1} (${conversationHistory[i]. role})`);
      }
    }
    
    // ✅ أضف السؤال الحالي
    messages.push({ 
      role: 'user', 
      content: userMessage 
    });
    
    console.log(`✅ Final messages count: ${messages.length}`);
    console.log('🧠 Memory is ready with full conversation history');

    try {
      // ============================================
      // الاتصال بـ Ollama
      // ============================================
      console.log('🔗 Connecting to Ollama.. .');
      
      var response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model:  OLLAMA_MODEL,
          messages: messages,
          stream: true,
          options: {
            temperature: 0.3,  // تقليل الإبداع لمنع الصينية
            num_predict: 500,
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

      console.log('✅ Connected to Ollama, receiving stream...');
      
      var fullText = '';
      var chunkCount = 0;

      response.data.on('data', function(chunk) {
        chunkCount++;
        var lines = chunk.toString().split('\n');
        
        for (var m = 0; m < lines. length; m++) {
          if (! lines[m].trim()) continue;
          
          try {
            var data = JSON. parse(lines[m]);
            
            if (data.message && data.message.content) {
              var content = data.message.content;
              
              // 🚫 **منع اللغة الصينية والإنجليزية**
              if (isChinese(content)) {
                console.log('❌ [BLOCKED] Chinese detected, skipping');
                continue; // تخطي الرد الصيني
              }
              
              if (hasEnglish(content)) {
                console.log('⚠️ [WARN] English detected, removing');
                content = removeEnglish(content);
              }
              
              fullText += content;
              res.write('data: ' + JSON.stringify({ 
                type: 'chunk', 
                content: content 
              }) + '\n\n');
            }
            
            if (data.done) {
              console.log('✅ Stream complete');
              
              // ✅ **حفظ الرد في الذاكرة**
              if (fullText.trim()) {
                conversationHistory.push({
                  role: 'user',
                  content: userMessage
                });
                conversationHistory.push({
                  role: 'assistant',
                  content: fullText
                });
                console.log('💾 Saved to memory - new history length:', conversationHistory.length);
              }
              
              res.write('data: ' + JSON.stringify({ 
                type: 'done', 
                fullResponse:  fullText,
                memorySize: conversationHistory.length  // أخبر الـ Frontend بحجم الذاكرة
              }) + '\n\n');
              res.end();
            }
          } catch (e) {
            console.error('❌ Parse error:', e. message);
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
// 🚫 دوال منع اللغة الصينية والإنجليزية
// ============================================

function isChinese(text) {
  // الحروف الصينية
  const chineseRegex = /[\u4E00-\u9FFF]/g;
  return chineseRegex.test(text);
}

function hasEnglish(text) {
  // الأحرف الإنجليزية (إلا في الكلمات الضرورية)
  const englishWords = text.match(/[A-Za-z]+/g);
  if (!englishWords) return false;
  
  // الكلمات المسموحة
  const allowedWords = ['ai', 'cv', 'otp', 'qr', 'url', 'api', 'http'];
  
  for (var word of englishWords) {
    if (! allowedWords.includes(word. toLowerCase())) {
      return true;
    }
  }
  return false;
}

function removeEnglish(text) {
  // إزالة الأحرف الإنجليزية (إلا الكلمات المسموحة)
  return text.replace(/[a-zA-Z]+/g, function(match) {
    const allowedWords = ['ai', 'cv', 'otp', 'qr', 'url', 'api', 'http'];
    if (allowedWords.includes(match. toLowerCase())) {
      return match;
    }
    return '';  // حذف الكلمة
  });
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
