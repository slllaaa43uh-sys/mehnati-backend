const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// ============================================
// 🎭 System Prompt - مختصر جداً
// ============================================
const SYSTEM_PROMPT = 'أنت مساعد مهنتي لي. رد بالعربية فقط. كن مختصراً وودوداً. المطور: صلاح مهدلي.';

// ============================================
// 📡 Chat with Ollama
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const userMessage = message.trim();
    
    // ============================================
    // تحليل المحادثة كاملة (الحالية + السابقة)
    // ============================================
    var fullContext = '';
    for (var i = 0; i < conversationHistory.length; i++) {
      fullContext += ' ' + conversationHistory[i].content;
    }
    fullContext += ' ' + userMessage;
    fullContext = fullContext.toLowerCase();
    
    // استخراج المعلومات من كل المحادثة
    var jobInfo = extractJobInfo(fullContext);
    
    var jobResults = [];
    var aiContext = '';

    // ============================================
    // البحث إذا توفرت معلومات كافية
    // ============================================
    if (jobInfo.hasJobIntent && (jobInfo.jobType || jobInfo.city)) {
      res.write('data: ' + JSON.stringify({ type: 'status', status: 'searching', message: 'جاري البحث 🔍' }) + '\n\n');
      
      jobResults = await findJobs(jobInfo.jobType, jobInfo.city);
      
      if (jobResults.length > 0) {
        res.write('data: ' + JSON.stringify({ 
          type: 'jobs', 
          jobs: jobResults.slice(0, 6),
          count: jobResults.length 
        }) + '\n\n');
        
        aiContext = '[وجدت ' + jobResults.length + ' وظيفة وعرضتها. قل له: لقيت لك وظائف، شوفها وإذا عجبتك واحدة تواصل معهم. لا تسأله أسئلة إضافية.]';
      } else {
        aiContext = '[لم أجد وظائف مطابقة. اعتذر له وقل: للأسف ما لقيت وظائف حالياً، جرب تغير البحث أو ارجع لاحقاً.]';
      }
    }

    // ============================================
    // إرسال الرد
    // ============================================
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');

    var systemMsg = SYSTEM_PROMPT;
    if (aiContext) {
      systemMsg += '\n\n' + aiContext;
    }

    var messages = [{ role: 'system', content: systemMsg }];
    
    // إضافة آخر 3 رسائل فقط
    var recent = conversationHistory.slice(-3);
    for (var j = 0; j < recent.length; j++) {
      messages.push({
        role: recent[j].role === 'user' ? 'user' : 'assistant',
        content: recent[j].content
      });
    }
    
    messages.push({ role: 'user', content: userMessage });

    try {
      var response = await axios.post(
        OLLAMA_BASE_URL + '/api/chat',
        {
          model: OLLAMA_MODEL,
          messages: messages,
          stream: true,
          options: { temperature: 0.5, num_predict: 150 }
        },
        { responseType: 'stream', timeout: 60000 }
      );

      var fullText = '';

      response.data.on('data', function(chunk) {
        var lines = chunk.toString().split('\n');
        
        for (var k = 0; k < lines.length; k++) {
          if (!lines[k].trim()) continue;
          try {
            var data = JSON.parse(lines[k]);
            if (data.message && data.message.content) {
              fullText += data.message.content;
              res.write('data: ' + JSON.stringify({ type: 'chunk', content: data.message.content }) + '\n\n');
            }
            if (data.done) {
              res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: fullText }) + '\n\n');
              res.end();
            }
          } catch (e) {}
        }
      });

      response.data.on('error', function() {
        res.write('data: ' + JSON.stringify({ type: 'error', message: 'حدث خطأ' }) + '\n\n');
        res.end();
      });

    } catch (err) {
      console.error('Ollama error:', err.message);
      res.write('data: ' + JSON.stringify({ type: 'error', message: 'الخدمة غير متاحة حالياً' }) + '\n\n');
      res.end();
    }

  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: ' + JSON.stringify({ type: 'error', message: 'حدث خطأ' }) + '\n\n');
    res.end();
  }
};

// ============================================
// استخراج معلومات الوظيفة من كل المحادثة
// ============================================
function extractJobInfo(text) {
  // هل يريد وظيفة؟
  var jobWords = ['وظيفة', 'وظائف', 'شغل', 'عمل', 'ابحث', 'دور', 'ابغى', 'أبي', 'محتاج', 'متعطل', 'عاطل', 'بطال'];
  var hasJobIntent = false;
  for (var i = 0; i < jobWords.length; i++) {
    if (text.includes(jobWords[i])) {
      hasJobIntent = true;
      break;
    }
  }
  
  // نوع الوظيفة
  var jobType = null;
  var types = [
    ['سائق', 'سواق', 'driver'], 
    ['نقل ثقيل', 'شاحنة', 'تريلا'],
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
    ['كهربائي', 'electrician'],
    ['سباك', 'plumber'],
    ['نجار', 'carpenter']
  ];
  
  for (var j = 0; j < types.length; j++) {
    for (var k = 0; k < types[j].length; k++) {
      if (text.includes(types[j][k])) {
        jobType = types[j][0]; // أول كلمة هي الأساسية
        break;
      }
    }
    if (jobType) break;
  }
  
  // المدينة
  var city = null;
  var cities = [
    ['الرياض', 'رياض', 'riyadh'],
    ['جدة', 'جده', 'jeddah'],
    ['مكة', 'مكه', 'mecca'],
    ['المدينة', 'medina'],
    ['الدمام', 'دمام', 'dammam'],
    ['الخبر', 'khobar'],
    ['الطائف', 'taif'],
    ['تبوك', 'tabuk'],
    ['أبها', 'abha'],
    ['صنعاء', 'sanaa'],
    ['عدن', 'aden'],
    ['تعز', 'taiz'],
    ['دبي', 'dubai'],
    ['أبوظبي', 'abu dhabi']
  ];
  
  for (var m = 0; m < cities.length; m++) {
    for (var n = 0; n < cities[m].length; n++) {
      if (text.includes(cities[m][n])) {
        city = cities[m][0];
        break;
      }
    }
    if (city) break;
  }
  
  return { hasJobIntent: hasJobIntent, jobType: jobType, city: city };
}

// ============================================
// البحث عن الوظائف
// ============================================
async function findJobs(jobType, city) {
  var allJobs = [];
  
  try {
    // الوظائف الداخلية
    var filter = { type: 'job', status: 'approved' };
    var orConditions = [];
    
    if (jobType) {
      orConditions.push({ title: { $regex: jobType, $options: 'i' } });
      orConditions.push({ content: { $regex: jobType, $options: 'i' } });
      orConditions.push({ category: { $regex: jobType, $options: 'i' } });
    }
    
    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }
    
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }
    
    var internal = await Post.find(filter)
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    for (var i = 0; i < internal.length; i++) {
      var job = internal[i];
      allJobs.push({
        id: job._id,
        title: job.title || 'وظيفة متاحة',
        description: job.content ? job.content.substring(0, 100) : '',
        city: job.city || 'غير محدد',
        salary: (job.jobDetails && job.jobDetails.salary) ? job.jobDetails.salary : 'قابل للتفاوض',
        company: job.user ? job.user.name : 'صاحب العمل',
        companyImage: job.user ? job.user.profileImage : null,
        contactPhone: job.contactPhone || null,
        contactEmail: job.contactEmail || null,
        isExternal: false,
        externalUrl: null
      });
    }
    
    // الوظائف الخارجية
    var extFilter = {};
    var extOr = [];
    
    if (jobType) {
      extOr.push({ title: { $regex: jobType, $options: 'i' } });
      extOr.push({ description: { $regex: jobType, $options: 'i' } });
    }
    
    if (extOr.length > 0) {
      extFilter.$or = extOr;
    }
    
    if (city) {
      extFilter.city = { $regex: city, $options: 'i' };
    }
    
    var external = await ExternalJob.find(extFilter)
      .sort({ postedAt: -1 })
      .limit(5)
      .lean();
    
    for (var j = 0; j < external.length; j++) {
      var ext = external[j];
      allJobs.push({
        id: ext._id,
        title: translateText(ext.title),
        description: ext.description ? translateText(ext.description.substring(0, 100)) : '',
        city: translateCity(ext.city) || 'غير محدد',
        salary: ext.salary || 'غير محدد',
        company: ext.company || 'شركة',
        companyImage: ext.companyLogo || null,
        contactPhone: null,
        contactEmail: null,
        isExternal: true,
        externalUrl: ext.applyUrl || ext.jobUrl || null
      });
    }
    
  } catch (err) {
    console.error('Job search error:', err);
  }
  
  return allJobs;
}

// ترجمة بسيطة
function translateText(text) {
  if (!text) return '';
  var trans = {
    'driver': 'سائق', 'engineer': 'مهندس', 'accountant': 'محاسب',
    'manager': 'مدير', 'teacher': 'معلم', 'sales': 'مبيعات',
    'developer': 'مطور', 'designer': 'مصمم', 'heavy': 'ثقيل',
    'truck': 'شاحنة', 'security': 'حارس أمن', 'technician': 'فني'
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
  return trans[city.toLowerCase()] || city;
}

// Health Check
exports.checkOllamaHealth = async (req, res) => {
  try {
    var response = await axios.get(OLLAMA_BASE_URL + '/api/tags', { timeout: 5000 });
    res.json({ success: true, message: 'Ollama is running', models: response.data.models || [] });
  } catch (error) {
    res.status(503).json({ success: false, message: 'Ollama not available' });
  }
};
