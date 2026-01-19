const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// ============================================
// 🎭 System Prompt - بسيط ومباشر
// ============================================
const SYSTEM_PROMPT = 'أنت مساعد مهنتي لي، مساعد وظائف ودود يتحدث العربية فقط.\n' +
'اسمك: مساعد مهنتي لي\n' +
'المطور: صلاح مهدلي\n\n' +
'قواعد بسيطة:\n' +
'1. رد دائما بالعربية\n' +
'2. كن ودودا واستخدم الايموجي\n' +
'3. اذا سال عن وظيفة، ساعده\n' +
'4. اذا سال سؤال عام، اجب عليه فقط\n' +
'5. لا تكرر نفسك';

// ============================================
// 📡 Chat with Ollama
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'الرجاء إدخال رسالة'
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const userMessage = message.trim();
    
    // تحليل بسيط: هل يريد وظيفة؟
    const wantsJob = checkIfWantsJob(userMessage);
    
    let jobResults = [];
    let jobContext = '';

    // البحث عن وظائف فقط اذا طلبها بوضوح
    if (wantsJob.search) {
      res.write('data: ' + JSON.stringify({ type: 'status', status: 'searching', message: 'جاري البحث 🔍' }) + '\n\n');
      
      jobResults = await findJobs(wantsJob.jobType, wantsJob.city);
      
      if (jobResults.length > 0) {
        res.write('data: ' + JSON.stringify({ 
          type: 'jobs', 
          jobs: jobResults.slice(0, 6),
          count: jobResults.length 
        }) + '\n\n');
        
        jobContext = '\n\n[تم عرض ' + jobResults.length + ' وظيفة للمستخدم. علق بايجابية قصيرة.]';
      } else {
        jobContext = '\n\n[لم توجد وظائف. اعتذر واقترح توسيع البحث.]';
      }
    }

    // ارسال الرد
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');

    // بناء المحادثة
    var messages = [{ role: 'system', content: SYSTEM_PROMPT + jobContext }];
    
    // اضافة اخر 4 رسائل فقط
    var recent = conversationHistory.slice(-4);
    for (var i = 0; i < recent.length; i++) {
      messages.push({
        role: recent[i].role === 'user' ? 'user' : 'assistant',
        content: recent[i].content
      });
    }
    
    messages.push({ role: 'user', content: userMessage });

    // استدعاء Ollama
    try {
      var response = await axios.post(
        OLLAMA_BASE_URL + '/api/chat',
        {
          model: OLLAMA_MODEL,
          messages: messages,
          stream: true,
          options: {
            temperature: 0.7,
            num_predict: 200
          }
        },
        {
          responseType: 'stream',
          timeout: 60000
        }
      );

      var fullText = '';

      response.data.on('data', function(chunk) {
        var lines = chunk.toString().split('\n');
        
        for (var j = 0; j < lines.length; j++) {
          if (!lines[j].trim()) continue;
          
          try {
            var data = JSON.parse(lines[j]);
            
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
        res.write('data: ' + JSON.stringify({ type: 'error', message: 'حدث خطأ، حاول مرة أخرى' }) + '\n\n');
        res.end();
      });

    } catch (err) {
      console.error('Ollama error:', err.message);
      res.write('data: ' + JSON.stringify({ type: 'error', message: 'الذكاء الاصطناعي غير متاح حاليا' }) + '\n\n');
      res.end();
    }

  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
    }
    res.write('data: ' + JSON.stringify({ type: 'error', message: 'حدث خطأ' }) + '\n\n');
    res.end();
  }
};

// ============================================
// تحليل: هل يريد وظيفة؟
// ============================================
function checkIfWantsJob(msg) {
  var m = msg.toLowerCase();
  
  // كلمات تدل على طلب وظيفة
  var jobWords = ['وظيفة', 'وظائف', 'شغل', 'عمل', 'ابحث', 'دور لي', 'ابغى', 'أبي', 'محتاج'];
  
  var wantsJob = false;
  for (var i = 0; i < jobWords.length; i++) {
    if (m.includes(jobWords[i])) {
      wantsJob = true;
      break;
    }
  }
  
  if (!wantsJob) {
    return { search: false, jobType: null, city: null };
  }
  
  // استخراج نوع الوظيفة
  var jobType = null;
  var types = ['سائق', 'سواق', 'مهندس', 'محاسب', 'مدير', 'معلم', 'طبيب', 'ممرض', 'بائع', 'عامل', 'مبرمج', 'مصمم'];
  for (var j = 0; j < types.length; j++) {
    if (m.includes(types[j])) {
      jobType = types[j];
      break;
    }
  }
  
  // استخراج المدينة
  var city = null;
  var cities = {
    'الرياض': 'الرياض', 'رياض': 'الرياض',
    'جدة': 'جدة', 'جده': 'جدة',
    'مكة': 'مكة', 'مكه': 'مكة',
    'الدمام': 'الدمام', 'دمام': 'الدمام',
    'الخبر': 'الخبر',
    'صنعاء': 'صنعاء',
    'عدن': 'عدن',
    'دبي': 'دبي',
    'أبوظبي': 'أبوظبي'
  };
  
  var cityKeys = Object.keys(cities);
  for (var k = 0; k < cityKeys.length; k++) {
    if (m.includes(cityKeys[k])) {
      city = cities[cityKeys[k]];
      break;
    }
  }
  
  // البحث فقط اذا حدد على الاقل المدينة او نوع الوظيفة
  var shouldSearch = (jobType !== null || city !== null);
  
  return { search: shouldSearch, jobType: jobType, city: city };
}

// ============================================
// البحث عن الوظائف
// ============================================
async function findJobs(jobType, city) {
  var allJobs = [];
  
  try {
    // البحث في الوظائف الداخلية
    var filter = { type: 'job', status: 'approved' };
    
    if (jobType) {
      filter.$or = [
        { title: { $regex: jobType, $options: 'i' } },
        { content: { $regex: jobType, $options: 'i' } }
      ];
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
        description: job.content ? job.content.substring(0, 80) : '',
        city: job.city || 'غير محدد',
        salary: job.jobDetails ? job.jobDetails.salary : 'قابل للتفاوض',
        company: job.user ? job.user.name : 'صاحب العمل',
        companyImage: job.user ? job.user.profileImage : null,
        contactPhone: job.contactPhone,
        contactEmail: job.contactEmail,
        isExternal: false,
        externalUrl: null
      });
    }
    
    // البحث في الوظائف الخارجية
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
    
    var external = await ExternalJob.find(extFilter)
      .sort({ postedAt: -1 })
      .limit(5)
      .lean();
    
    for (var j = 0; j < external.length; j++) {
      var ext = external[j];
      allJobs.push({
        id: ext._id,
        title: translateTitle(ext.title),
        description: ext.description ? ext.description.substring(0, 80) : '',
        city: translateCity(ext.city) || 'غير محدد',
        salary: ext.salary || 'غير محدد',
        company: ext.company,
        companyImage: ext.companyLogo,
        contactPhone: null,
        contactEmail: null,
        isExternal: true,
        externalUrl: ext.applyUrl || ext.jobUrl
      });
    }
    
  } catch (err) {
    console.error('Job search error:', err);
  }
  
  return allJobs;
}

// ترجمة بسيطة
function translateTitle(title) {
  if (!title) return 'وظيفة';
  
  var trans = {
    'driver': 'سائق', 'engineer': 'مهندس', 'accountant': 'محاسب',
    'manager': 'مدير', 'teacher': 'معلم', 'sales': 'مبيعات',
    'developer': 'مطور', 'designer': 'مصمم'
  };
  
  var result = title;
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
    'dammam': 'الدمام', 'mecca': 'مكة'
  };
  
  return trans[city.toLowerCase()] || city;
}

// ============================================
// Health Check
// ============================================
exports.checkOllamaHealth = async (req, res) => {
  try {
    var response = await axios.get(OLLAMA_BASE_URL + '/api/tags', { timeout: 5000 });
    res.json({ success: true, message: 'Ollama is running', models: response.data.models || [] });
  } catch (error) {
    res.status(503).json({ success: false, message: 'Ollama not available' });
  }
};
