const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// ============================================
// 🎭 System Prompt
// ملاحظة: المساعد افتراضياً يعطي نصائح مهنية (كارير أدفايس).
// لا تعرض بطاقات/حاويات الوظائف إلا إذا طلب المستخدم ذلك صراحةً.
// يمكنك التحكم بالسلوك بإرسال { allowJobCards: true } في جسم الطلب.
 // ============================================
const SYSTEM_PROMPT = 'أنت مساعد مهنتي لي، مساعد وظائف ودود. رد بالعربية فقط وبشكل مختصر.\n' +
'المطور: صلاح مهدلي\n' +
'افتراضياً: قدّم نصائح مهنية ومقترحات لتحسين فرص التوظيف، ولا تعرض بطاقات أو روابط للتقديم أو أي حاويات تمثل وظائف. إذا طلب المستخدم صراحةً "عرض الوظائف" أو أرسل { allowJobCards: true } فمسموح بعرض نتائج الوظائف.';

// ============================================
// 📡 Chat with Ollama
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    const { message, conversationHistory = [], allowJobCards = false } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const userMessage = message.trim();
    const lowerMessage = userMessage.toLowerCase();

    // ============================================
    // التحقق من أسئلة المطور (معلومة ثابتة)
    // ============================================
    if (lowerMessage.includes('من صنعك') || lowerMessage.includes('من طورك') ||
        lowerMessage.includes('من برمجك') || lowerMessage.includes('من أنشأك') ||
        lowerMessage.includes('من عملك') || lowerMessage.includes('من بناك')) {
      res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: 'تم تطويري من قبل المطور المبدع صلاح مهدلي 💻🚀 أنا هنا لمساعدتك بنصائح مهنية.' }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: 'تم تطويري من قبل المطور المبدع صلاح مهدلي 💻🚀 أنا هنا لمساعدتك بنصائح مهنية.' }) + '\n\n');
      res.end();
      return;
    }

    // ============================================
    // بناء سياق المحادثة الكاملة
    // ============================================
    var fullContext = '';
    for (var i = 0; i < conversationHistory.length; i++) {
      fullContext += ' ' + conversationHistory[i].content;
    }
    fullContext += ' ' + userMessage;
    fullContext = fullContext.toLowerCase();

    // استخراج معلومات الوظيفة (نية المستخدم)
    var jobInfo = extractJobInfo(fullContext);

    // تحديد ما إذا كان المستخدم طلب صريح لعرض الوظائف (الذي يسمح بعرض الحاويات)
    const explicitJobRequestPhrases = [
      'عرض الوظائف', 'اعرض الوظائف', 'اعرض لي الوظائف', 'أعرض الوظائف', 
      'أريد وظائف', 'أظهر وظائف', 'ابحث عن وظائف لي', 'ابحث لي عن وظائف'
    ];
    let explicitJobRequest = false;
    for (let p of explicitJobRequestPhrases) {
      if (lowerMessage.includes(p)) {
        explicitJobRequest = true;
        break;
      }
    }
    // allowJobCards (boolean) يمكن إرساله من الواجهة لتفعيل عرض النتائج
    const allowCards = explicitJobRequest || Boolean(allowJobCards);

    // ============================================
    // سلوك البحث:
    // - إذا المستخدم طلب صراحة عرض الوظائف أو allowJobCards=true -> عرض بطاقات الوظائف كما في السابق
    // - إذا توجد نية البحث عن وظيفة لكن بدون طلب صريح -> لا تعرض حاويات، بل أعطِ نصائح/ملخص
    // ============================================
    var jobResults = [];
    var aiContext = '';

    if (jobInfo.hasJobIntent && (jobInfo.jobType || jobInfo.city)) {
      // نعلم المستخدم أننا سنبحث
      res.write('data: ' + JSON.stringify({ type: 'status', status: 'searching', message: 'جاري معالجة طلبك 🔍' }) + '\n\n');

      // اجلب النتائج داخليًا
      jobResults = await searchRealJobs(jobInfo.jobType, jobInfo.city);

      if (jobResults.length > 0) {
        if (allowCards) {
          // سلوك قديم: إرسال حاويات/وظائف بصيغة jobs
          res.write('data: ' + JSON.stringify({
            type: 'jobs',
            jobs: jobResults,
            count: jobResults.length
          }) + '\n\n');

          aiContext = '[لقد وجدت ' + jobResults.length + ' وظيفة. قدم للمستخدم نصائح سريعة حول التقديم وتوجيه للتواصل.]';
        } else {
          // جديد: لا نرسل بطاقات. نرسل ملخصًا + نصائح مهنية فقط.
          const summaryLines = [];
          for (let i = 0; i < Math.min(jobResults.length, 4); i++) {
            const j = jobResults[i];
            summaryLines.push(`${i+1}. ${j.title} - ${j.city || 'الموقع غير محدد'}${j.company ? ' - ' + j.company : ''} ${j.jobStatus && j.jobStatus === 'closed' ? '(مغلق)' : ''}`);
          }
          const summary = 'وجدت بعض الفرص المتاحة:\n' + summaryLines.join('\n') + '\n\n';
          const advice = 'نصيحتي: حسّن عنوان سيرتك، أضف ملخصًا قصيرًا عن خبراتك، تواصل عبر رقم الهاتف أو البريد إذا متاح. إذا تريد عرض تفاصيل التقديم أو روابط التقديم الفعلية اكتب "عرض الوظائف" أو أرسل allowJobCards=true.';
          // لا نرسل حدث jobs؛ نرسل chunks نصية للمحادثة
          res.write('data: ' + JSON.stringify({ type: 'chunk', content: summary + advice }) + '\n\n');
          aiContext = '[ملخص للوظائف مع نصائح — لم تُعرض حاويات وفق سياسة النصائح الافتراضية.]';
        }
      } else {
        // لا توجد نتائج
        const apologyAndAdvice = 'لم أجد وظائف مطابقة الآن. نصيحتي: وسّع بحثك بالكلمات المفتاحية، فعّل الإشعارات للوظائف الجديدة، وحسّن سيرتك الذاتية. إذا تريد أن أجلب لك نتائج خارجية فعلًا اكتب "عرض الوظائف".';
        res.write('data: ' + JSON.stringify({ type: 'chunk', content: apologyAndAdvice }) + '\n\n');
        aiContext = '[لم يتم العثور على وظائف، قدم نصائح بديلة].';
      }
    }

    // ============================================
    // إعداد الرسائل لموديل LLM (Ollama)
    // ============================================
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');

    var systemMsg = SYSTEM_PROMPT;
    if (aiContext) {
      systemMsg += '\n\n' + aiContext;
    }

    var messages = [{ role: 'system', content: systemMsg }];

    var recent = conversationHistory.slice(-3);
    for (var k = 0; k < recent.length; k++) {
      messages.push({
        role: recent[k].role === 'user' ? 'user' : 'assistant',
        content: recent[k].content
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
          options: { temperature: 0.5, num_predict: 200 }
        },
        { responseType: 'stream', timeout: 60000 }
      );

      var fullText = '';

      response.data.on('data', function(chunk) {
        var lines = chunk.toString().split('\n');

        for (var m = 0; m < lines.length; m++) {
          if (!lines[m].trim()) continue;
          try {
            var data = JSON.parse(lines[m]);
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
// استخراج معلومات الوظيفة
// (نفس التعريف الأصلي، يمكن توسيعه لاحقاً)
// ============================================
function extractJobInfo(text) {
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

  for (var j = 0; j < types.length; j++) {
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
// البحث الحقيقي في قاعدة البيانات
// (نفس الدالة الأصلية، تُعيد مصفوفة نتائج)
// ============================================
async function searchRealJobs(jobType, city) {
  var results = [];

  try {
    console.log('[AI Search] Searching for:', jobType, 'in', city);

    // بناء الفلتر
    var filter = { type: 'job' };

    // البحث بنوع الوظيفة
    if (jobType) {
      filter.$or = [
        { title: { $regex: jobType, $options: 'i' } },
        { content: { $regex: jobType, $options: 'i' } },
        { category: { $regex: jobType, $options: 'i' } }
      ];
    }

    // البحث بالمدينة
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    // البحث في الوظائف الداخلية
    var jobs = await Post.find(filter)
      .populate('user', 'name profileImage phone')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    console.log('[AI Search] Found', jobs.length, 'internal jobs');

    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];

      results.push({
        id: job._id,
        title: job.title || 'وظيفة متاحة',
        description: job.content ? job.content.substring(0, 120) + '...' : '',
        city: job.city || 'غير محدد',
        country: job.country || '',
        salary: (job.jobDetails && job.jobDetails.salary) ? job.jobDetails.salary : 'قابل للتفاوض',
        jobType: (job.jobDetails && job.jobDetails.jobType) ? job.jobDetails.jobType : 'دوام كامل',
        company: job.user ? job.user.name : 'صاحب العمل',
        companyImage: job.user ? job.user.profileImage : null,
        contactPhone: job.contactPhone || (job.user ? job.user.phone : null) || null,
        contactEmail: job.contactEmail || null,
        status: job.status,
        jobStatus: job.jobStatus || 'open',
        isExternal: false,
        externalUrl: null,
        createdAt: job.createdAt
      });
    }

    // إذا لم نجد وظائف داخلية، نبحث في الخارجية
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
          description: ext.description ? translateText(ext.description.substring(0, 120)) + '...' : '',
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
          isExternal: true,
          externalUrl: ext.applyUrl || ext.jobUrl || null,
          createdAt: ext.postedAt
        });
      }
    }

  } catch (err) {
    console.error('[AI Search] Error:', err);
  }

  return results;
}

// ترجمة بسيطة
function translateText(text) {
  if (!text) return '';
  var trans = {
    'driver': 'سائق', 'engineer': 'مهندس', 'accountant': 'محاسب',
    'manager': 'مدير', 'teacher': 'معلم', 'sales': 'مبيعات',
    'developer': 'مطور', 'designer': 'مصمم', 'heavy': 'ثقي��',
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
  return trans[city.toLowerCase()] || city;
}

function translateJobType(type) {
  if (!type) return null;
  var trans = {
    'full-time': 'دوام كامل', 'part-time': 'دوام جزئي',
    'contract': 'عقد', 'temporary': 'مؤقت', 'remote': 'عن بعد'
  };
  return trans[type.toLowerCase()] || type;
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