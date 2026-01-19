const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

// ============================================
// 🤖 Ollama Configuration - FIXED
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';

console.log('🔧 [INIT] Ollama Configuration: ');
console.log(`   Base URL: ${OLLAMA_BASE_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);

// ============================================
// 🎭 System Prompt - ENFORCE ARABIC
// ============================================
const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في البحث عن الوظائف. 
⚠️ تحذير مهم: يجب أن تجيب باللغة العربية فقط في جميع الأوقات.  لا تستخدم أي لغة أخرى مطلقاً.
اجعل ردودك مختصرة وودية وفي صيغة بسيطة. 
المطور:  صلاح مهدلي
إذا سألك أحد: من صنعك؟ من طورك؟ من برمجك؟ - قل: تم تطويري من قبل المطور صلاح مهدلي 💻`;

// ============================================
// 📡 Chat with Ollama
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    console.log('═════════════════════════════════════════════════��═');
    console.log('📨 [AI-CHAT] New chat request received');
    console.log('═══════════════════════════════════════════════════');
    
    let { message, conversationHistory } = req.body;

    console. log('📝 [DEBUG] Message received:', message);
    
    if (!message || ! message.trim()) {
      console.error('❌ [ERROR] Message is empty or invalid');
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    console.log('📚 [DEBUG] conversationHistory received:', conversationHistory);
    
    if (!conversationHistory) {
      console.warn('⚠️ [WARN] conversationHistory is undefined, setting to empty array');
      conversationHistory = [];
    }
    
    if (! Array.isArray(conversationHistory)) {
      console.error('❌ [ERROR] conversationHistory is not an array');
      conversationHistory = [];
    }
    
    conversationHistory = conversationHistory.filter(msg => {
      if (! msg || !msg.content || !msg.role) {
        return false;
      }
      return true;
    });
    
    console.log(`📊 [DEBUG] Filtered conversationHistory length: ${conversationHistory.length}`);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const userMessage = message. trim();
    const lowerMessage = userMessage.toLowerCase();
    
    console.log('💬 [DEBUG] User message:', userMessage);
    
    // ============================================
    // التحقق من أسئلة المطور
    // ============================================
    if (lowerMessage.includes('من صنعك') || lowerMessage.includes('من طورك') || 
        lowerMessage.includes('من برمجك') || lowerMessage.includes('من أنشأك') ||
        lowerMessage.includes('من عملك') || lowerMessage.includes('من بناك')) {
      console.log('🎯 [DEBUG] Developer question detected');
      res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: 'تم تطويري من قبل المطور المبدع صلاح مهدلي 💻🚀 أنا هنا لمساعدتك في البحث عن الوظيفة المناسبة!' }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: 'تم تطويري من قبل المطور المبدع صلاح مهدلي 💻🚀 أنا هنا لمساعدتك في البحث عن الوظيفة المناسبة!' }) + '\n\n');
      res.end();
      return;
    }
    
    // ============================================
    // تحليل المحادثة للبحث عن وظائف
    // ============================================
    console.log('🔎 [DEBUG] Analyzing conversation for job intent...');
    
    var fullContext = '';
    for (var i = 0; i < conversationHistory.length; i++) {
      if (conversationHistory[i] && conversationHistory[i].content) {
        fullContext += ' ' + conversationHistory[i]. content;
      }
    }
    fullContext += ' ' + userMessage;
    
    var jobInfo = extractJobInfo(fullContext. toLowerCase());
    console.log('💼 [DEBUG] Job info extracted:', jobInfo);
    
    var jobResults = [];
    var aiContext = '';

    // ============================================
    // البحث الحقيقي في قاعدة البيانات
    // ============================================
    if (jobInfo.hasJobIntent && (jobInfo.jobType || jobInfo.city)) {
      console.log('🔍 [DEBUG] Job search initiated');
      res.write('data: ' + JSON.stringify({ type: 'status', status: 'searching', message: 'جاري البحث في قاعدة البيانات 🔍' }) + '\n\n');
      
      jobResults = await searchRealJobs(jobInfo. jobType, jobInfo.city);
      console.log('✅ [DEBUG] Job results found:', jobResults.length);
      
      if (jobResults.length > 0) {
        console.log('📤 [DEBUG] Sending job results to client');
        res.write('data: ' + JSON.stringify({ 
          type: 'jobs', 
          jobs: jobResults,
          count: jobResults.length 
        }) + '\n\n');
        
        var jobSummary = 'وجدت ' + jobResults.length + ' وظيفة:\n';
        for (var j = 0; j < jobResults.length; j++) {
          var job = jobResults[j];
          jobSummary += (j + 1) + '. ' + job.title;
          if (job.status === 'closed' || job.jobStatus === 'closed') {
            jobSummary += ' (تم التوظيف ❌)';
          } else {
            jobSummary += ' (متاحة ✅)';
          }
          if (job.contactPhone) {
            jobSummary += ' - للتواصل:  ' + job.contactPhone;
          }
          jobSummary += '\n';
        }
        aiContext = '[' + jobSummary + ']\nقل للمستخدم: لقيت لك هذه الوظائف.  إذا الوظيفة متاحة يتواصل مع صاحبها، وإذا مكتوب تم التوظيف يجرب غيرها. ';
      } else {
        console.log('⚠️ [DEBUG] No job results found');
        aiContext = '[لم أجد وظائف مطابقة في قاعدة البيانات.  اعتذر وقل:  للأسف ما لقيت وظائف حالياً، جرب تغير نوع الوظيفة أو المدينة.]';
      }
    }

    // ============================================
    // إرسال الرد
    // ============================================
    console.log('🤖 [DEBUG] Sending AI response...');
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');

    var systemMsg = SYSTEM_PROMPT;
    if (aiContext) {
      systemMsg += '\n\n' + aiContext;
    }

    var messages = [{ role: 'system', content:  systemMsg }];
    
    var recent = conversationHistory.filter(msg => msg && msg.content && msg.role).slice(-3);
    console.log('📚 [DEBUG] Recent messages count:', recent.length);
    
    for (var k = 0; k < recent. length; k++) {
      messages.push({
        role: recent[k]. role === 'user' ? 'user' : 'assistant',
        content: recent[k].content
      });
    }
    
    messages.push({ role: 'user', content: userMessage });
    
    console.log('✅ [DEBUG] Final messages array prepared');

    try {
      console.log('🔗 [DEBUG] Connecting to Ollama at:', OLLAMA_BASE_URL);
      console.log('🤖 [DEBUG] Using model:', OLLAMA_MODEL);
      
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

      console.log('✅ [DEBUG] Ollama connection established');
      
      var fullText = '';
      var chunkCount = 0;

      response.data.on('data', function(chunk) {
        chunkCount++;
        console.log(`📥 [DEBUG] Received chunk #${chunkCount}`);
        
        var lines = chunk.toString().split('\n');
        
        for (var m = 0; m < lines. length; m++) {
          if (! lines[m]. trim()) continue;
          
          try {
            var data = JSON.parse(lines[m]);
            
            if (data.message && data.message.content) {
              fullText += data.message. content;
              console.log(`   ✅ Content chunk:  "${data.message.content. substring(0, 50)}..."`);
              res.write('data: ' + JSON.stringify({ type: 'chunk', content:  data.message.content }) + '\n\n');
            }
            
            if (data.done) {
              console.log('✅ [DEBUG] Stream complete from Ollama');
              res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: fullText }) + '\n\n');
              res.end();
            }
          } catch (e) {
            console.error('❌ [ERROR] JSON parsing error:', e. message);
          }
        }
      });

      response.data.on('error', function(err) {
        console.error('❌ [ERROR] Stream error:', err. message);
        res.write('data: ' + JSON.stringify({ type: 'error', message:  'حدث خطأ في البث' }) + '\n\n');
        res.end();
      });
      
    } catch (err) {
      console.error('❌ [ERROR] Ollama connection error:', err.message);
      console.error('   Error status:', err.response?.status);
      
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

// ============================================
// استخراج معلومات الوظيفة
// ============================================
function extractJobInfo(text) {
  console.log('🔎 [DEBUG] extractJobInfo called');
  
  var jobWords = ['وظيفة', 'وظائف', 'شغل', 'عمل', 'ابحث', 'دور', 'ابغى', 'أبي', 'محتاج', 'متعطل', 'عاطل', 'نعم ابحث', 'ابحث لي'];
  var hasJobIntent = false;
  for (var i = 0; i < jobWords.length; i++) {
    if (text.includes(jobWords[i])) {
      hasJobIntent = true;
      break;
    }
  }
  
  var jobType = null;
  var types = [
    ['سائق', 'سواق', 'driver'],
    ['نقل ثقيل', 'شاحنة', 'تريلا', 'نقل'],
    ['مهندس', 'engineer'],
    ['محاسب', 'accountant'],
    ['مدير', 'manager'],
    ['معلم', 'مدرس', 'teacher'],
    ['طبيب', 'دكتور', 'doctor'],
    ['ممرض', 'nurse'],
    ['بائع', 'مبيعات', 'sales'],
    ['عامل', 'worker'],
    ['مبرمج', 'developer'],
    ['مصمم', 'designer'],
    ['حارس', 'أمن', 'security'],
    ['فني', 'technician'],
    ['كهربائي'],
    ['سباك'],
    ['نجار'],
    ['طباخ', 'شيف'],
    ['عامل نظافة'],
    ['موظف استقبال']
  ];
  
  for (var j = 0; j < types. length; j++) {
    for (var k = 0; k < types[j].length; k++) {
      if (text.includes(types[j][k])) {
        jobType = types[j][0];
        break;
      }
    }
    if (jobType) break;
  }
  
  var city = null;
  var cities = [
    ['الرياض', 'رياض'],
    ['جدة', 'جده'],
    ['مكة', 'مكه'],
    ['المدينة'],
    ['الدمام', 'دمام'],
    ['الخبر'],
    ['الطائف'],
    ['تبوك'],
    ['أبها'],
    ['صنعاء'],
    ['عدن'],
    ['تعز'],
    ['دبي'],
    ['أبوظبي']
  ];
  
  for (var m = 0; m < cities. length; m++) {
    for (var n = 0; n < cities[m].length; n++) {
      if (text.includes(cities[m][n])) {
        city = cities[m][0];
        break;
      }
    }
    if (city) break;
  }
  
  return { hasJobIntent:  hasJobIntent, jobType: jobType, city: city };
}

// ============================================
// البحث الحقيقي في قاعدة البيانات
// ============================================
async function searchRealJobs(jobType, city) {
  var results = [];
  
  try {
    console.log('[AI Search] Searching for:', jobType, 'in', city);
    
    var filter = { type: 'job' };
    
    if (jobType) {
      filter.$or = [
        { title: { $regex: jobType, $options: 'i' } },
        { content: { $regex: jobType, $options: 'i' } },
        { category: { $regex: jobType, $options: 'i' } }
      ];
    }
    
    if (city) {
      filter. city = { $regex: city, $options:  'i' };
    }
    
    var jobs = await Post.find(filter)
      .populate('user', 'name profileImage phone')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    console.log('[AI Search] Found', jobs. length, 'internal jobs');
    
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      
      results.push({
        id: job._id,
        title: job.title || 'وظيفة متاحة',
        description: job.content ?  job.content.substring(0, 120) + '...' : '',
        city: job.city || 'غير محدد',
        country: job.country || '',
        salary: (job.jobDetails && job.jobDetails.salary) ? job.jobDetails.salary :  'قابل للتفاوض',
        jobType: (job.jobDetails && job.jobDetails.jobType) ? job.jobDetails.jobType : 'دوام كامل',
        company: job.user ?  job.user.name : 'صاحب العمل',
        companyImage: job.user ? job.user.profileImage : null,
        contactPhone: job.contactPhone || (job.user ?  job.user.phone : null) || null,
        contactEmail: job.contactEmail || null,
        status: job.status,
        jobStatus: job.jobStatus || 'open',
        isExternal: false,
        externalUrl: null,
        createdAt: job.createdAt
      });
    }
    
    if (results.length < 3) {
      var extFilter = {};
      
      if (jobType) {
        extFilter.$or = [
          { title: { $regex: jobType, $options: 'i' } },
          { description: { $regex: jobType, $options: 'i' } }
        ];
      }
      
      if (city) {
        extFilter.city = { $regex: city, $options: 'i' };
      }
      
      var extJobs = await ExternalJob.find(extFilter)
        .sort({ postedAt: -1 })
        .limit(3)
        .lean();
      
      console.log('[AI Search] Found', extJobs.length, 'external jobs');
      
      for (var j = 0; j < extJobs.length; j++) {
        var ext = extJobs[j];
        
        results.push({
          id: ext._id,
          title: translateText(ext.title) || 'وظيفة خارجية',
          description:  ext.description ?  translateText(ext.description. substring(0, 120)) + '...' : '',
          city: translateCity(ext.city) || 'غير محدد',
          country: ext.country || '',
          salary: ext.salary || 'غير محدد',
          jobType: translateJobType(ext.employmentType) || 'دوام كامل',
          company: ext.company || 'شركة',
          companyImage: ext.companyLogo || null,
          contactPhone: null,
          contactEmail: null,
          status: 'approved',
          jobStatus: 'open',
          isExternal:  true,
          externalUrl:  ext.applyUrl || ext.jobUrl || null,
          createdAt:  ext.postedAt
        });
      }
    }
    
  } catch (err) {
    console.error('[AI Search] Error:', err);
  }
  
  return results;
}

function translateText(text) {
  if (!text) return '';
  var trans = {
    'driver': 'سائق', 'engineer': 'مهندس', 'accountant': 'محاسب',
    'manager': 'مدير', 'teacher': 'معلم', 'sales': 'مبيعات',
    'developer': 'مطور', 'designer': 'مصمم', 'heavy':  'ثقيل',
    'truck': 'شاحنة', 'security': 'حارس أمن', 'technician': 'فني',
    'full-time': 'دوام كامل', 'part-time': 'دوام جزئي'
  };
  var result = text;
  var keys = Object.keys(trans);
  for (var i = 0; i < keys.length; i++) {
    result = result.replace(new RegExp(keys[i], 'gi'), trans[keys[i]]);
  }
  return result;
}

function translateCity(city) {
  if (!city) return null;
  var trans = {
    'riyadh': 'الرياض', 'jeddah': 'جدة', 'dubai': 'دبي',
    'dammam': 'الدمام', 'mecca': 'مكة', 'medina': 'المدينة'
  };
  return trans[city. toLowerCase()] || city;
}

function translateJobType(type) {
  if (!type) return null;
  var trans = {
    'full-time': 'دوام كامل', 'part-time': 'دوام جزئي',
    'contract': 'عقد', 'temporary': 'مؤقت', 'remote': 'عن بعد'
  };
  return trans[type.toLowerCase()] || type;
}

exports.checkOllamaHealth = async (req, res) => {
  try {
    console.log('🏥 [DEBUG] Health check started');
    var response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    console.log('✅ [DEBUG] Health check passed');
    res.json({ 
      success: true, 
      message:  'Ollama is running',
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_MODEL,
      models: response.data.models || [] 
    });
  } catch (error) {
    console.error('❌ [DEBUG] Health check failed:', error.message);
    res.status(503).json({ 
      success: false, 
      message: 'Ollama not available',
      error: error.message
    });
  }
};
