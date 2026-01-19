const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');
const KNOWLEDGE_BASE = require('../data/knowledgeBase');

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';

console.log('🔧 [INIT] Ollama Configuration:  ');
console.log(`   Base URL: ${OLLAMA_BASE_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);

// ============================================
// 🎭 Enhanced System Prompt مع Knowledge Base
// ============================================
const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في تطبيق "مهنتي لي". 

⚠️ قواعد الإجابة:
1. اجب باللغة العر��ية فقط، بدون لغات أخرى مطلقاً
2. ردودك يجب أن تكون سهلة وبسيطة مثل ChatGPT و Gemini
3. إذا سأل المستخدم:  "من طورك؟" أو "من صنعك؟" أجب فقط:  "طورني صلاح مهدلي"
4. لا تقول "تم تطويري من قبل صلاح مهدلي" - قل فقط "طورني صلاح مهدلي"
5. إذا ذكر المستخدم اسم "صلاح" فقط، لا تضيف شيء - انتقل للموضوع التالي
6. كن ودياً وسهل التعامل معك مثل ChatGPT تماماً

📚 معلومات التطبيق:
${Object.entries(KNOWLEDGE_BASE)
  .map(([key, value]) => `• ${value.title}`)
  .join('\n')}

استخدم هذه المعلومات للرد على أسئلة المستخدم عن التطبيق بدقة وسهولة.`;

// ============================================
// 📡 Chat with Ollama - IMPROVED
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

    if (!conversationHistory) {
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
    // 🔍 معالجة أسئلة "من طورك"
    // ============================================
    if (lowerMessage.includes('من طورك') || lowerMessage.includes('من صنعك') || 
        lowerMessage.includes('من أنشأك') || lowerMessage.includes('من برمجك')) {
      console.log('🎯 [DEBUG] Developer question detected');
      res.write('data: ' + JSON.stringify({ 
        type: 'chunk', 
        content: 'طورني صلاح مهدلي 💙' 
      }) + '\n\n');
      res.write('data: ' + JSON.stringify({ 
        type: 'done', 
        fullResponse: 'طورني صلاح مهدلي 💙' 
      }) + '\n\n');
      res.end();
      return;
    }
    
    // ============================================
    // 🔍 تحليل سؤال المستخدم عن التطبيق
    // ============================================
    let relevantKnowledge = '';
    const questionKeywords = {
      'تسجيل':  ['registration', 'signup'],
      'دخول': ['login'],
      'خروج': ['logout'],
      'ملف': ['profile'],
      'منشور': ['createPost'],
      'وظيفة': ['searchJobs', 'urgent'],
      'سيرة':  ['cv'],
      'قصة': ['stories'],
      'حراج': ['haraj'],
      'إعدادات': ['settings'],
      'إشعارات': ['notifications'],
      'ترجمة': ['global'],
      'عالمي': ['global'],
      'مميز': ['premium'],
      'طور': ['developer'],
      'صلاح': ['developer']
    };

    for (const [keyword, keys] of Object.entries(questionKeywords)) {
      if (lowerMessage.includes(keyword)) {
        for (const key of keys) {
          if (KNOWLEDGE_BASE[key]) {
            relevantKnowledge += `\n${KNOWLEDGE_BASE[key].content}\n`;
          }
        }
      }
    }
    
    // ============================================
    // 🔎 البحث عن الوظائف
    // ============================================
    let jobResults = [];
    const jobKeywords = ['وظيفة', 'وظائف', 'شغل', 'عمل', 'ابحث', 'ابغى'];
    const hasJobIntent = jobKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasJobIntent) {
      console.log('🔍 [DEBUG] Job search intent detected');
      res.write('data: ' + JSON.stringify({ 
        type: 'status', 
        status: 'searching', 
        message: 'جاري البحث في قاعدة البيانات 🔍' 
      }) + '\n\n');
      
      jobResults = await searchRealJobs(userMessage);
      console.log('✅ [DEBUG] Found', jobResults.length, 'jobs');
      
      if (jobResults.length > 0) {
        res.write('data: ' + JSON.stringify({ 
          type: 'jobs', 
          jobs: jobResults,
          count: jobResults.length 
        }) + '\n\n');
      }
    }

    // ============================================
    // 🤖 إرسال الرد من Ollama
    // ============================================
    console.log('🤖 [DEBUG] Sending request to Ollama.. .');
    res.write('data: ' + JSON.stringify({ 
      type: 'status', 
      status: 'responding', 
      message: 'يكتب ✍️' 
    }) + '\n\n');

    var systemMsg = SYSTEM_PROMPT;
    if (relevantKnowledge) {
      systemMsg += `\n\nمعلومات ذات صلة:${relevantKnowledge}`;
    }

    var messages = [{ role: 'system', content: systemMsg }];
    
    var recent = conversationHistory.filter(msg => msg && msg.content && msg.role).slice(-3);
    
    for (var k = 0; k < recent. length; k++) {
      messages.push({
        role: recent[k]. role === 'user' ? 'user' : 'assistant',
        content: recent[k].content
      });
    }
    
    messages.push({ role: 'user', content: userMessage });
    
    console.log('✅ [DEBUG] Messages prepared, connecting to Ollama');

    try {
      var response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model: OLLAMA_MODEL,
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
            
            if (data.done) {
              console.log('✅ [DEBUG] Stream complete');
              res.write('data: ' + JSON.stringify({ 
                type: 'done', 
                fullResponse: fullText 
              }) + '\n\n');
              res.end();
            }
          } catch (e) {
            console.error('❌ [ERROR] Parsing error:', e. message);
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
    console.error('❌ [ERROR] Chat error:', error.message);
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
// البحث عن الوظائف
// ============================================
async function searchRealJobs(message) {
  var results = [];
  
  try {
    var filter = { type: 'job' };
    
    var jobs = await Post.find(filter)
      .populate('user', 'name profileImage phone')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    console.log('[Search] Found', jobs.length, 'jobs');
    
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      
      results.push({
        id: job._id,
        title: job.title || 'وظيفة متاحة',
        description: job.content ?  job.content. substring(0, 120) + '...' : '',
        city: job.city || 'غير محدد',
        salary: (job.jobDetails && job.jobDetails.salary) ?  job.jobDetails.salary : 'قابل للتفاوض',
        company: job.user ?  job.user.name : 'صاحب العمل',
        contactPhone: job.contactPhone || (job.user ?  job.user.phone : null) || null,
        status: job.status
      });
    }
    
  } catch (err) {
    console.error('[Search] Error:', err);
  }
  
  return results;
}

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
    console.error('❌ Health check failed:', error. message);
    res.status(503).json({ 
      success: false, 
      message: 'Ollama not available',
      error: error. message
    });
  }
};
