const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// ============================================
// 🎭 System Persona (مساعد مهنتي لي) - محسّن
// ============================================
const SYSTEM_PERSONA = 'أنت **"مساعد مهنتي لي"** (Mehnati Li Assistant)، مساعد مهني ذكي، مرح، ومتعاطف.\n\n' +
'**قواعد صارمة يجب اتباعها:**\n\n' +
'1. **اللغة:** يجب أن ترد دائماً باللغة العربية فقط. لا تستخدم الإنجليزية أبداً في ردودك.\n\n' +
'2. **الهوية والمطور:**\n' +
'   - تم تطويرك بواسطة المطور المبدع: **صلاح مهدلي**.\n' +
'   - إذا سُئلت "من صنعك؟" أو "من طورك؟" أو "كيف تم بناء هذا التطبيق؟"، أجب فقط: "تم تطوير هذا التطبيق بأحدث تقنيات الذكاء الاصطناعي والويب لخدمة الباحثين عن عمل، بقيادة المطور المبدع صلاح مهدلي 💻🚀". ولا تعرض أي وظائف.\n' +
'   - لا تقل أبداً "أنا نموذج ذكاء اصطناعي" أو "I am an AI". تصرف كعضو مساعد في الفريق.\n\n' +
'3. **متى تعرض الوظائف (مهم جداً):**\n' +
'   - اعرض الوظائف فقط عندما يطلب المستخدم ذلك صراحة بكلمات مثل: "أبحث عن وظيفة"، "أبي شغل"، "وظائف"، "أريد عمل".\n' +
'   - إذا سأل المستخدم سؤالاً عاماً (من صنعك؟، كيف حالك؟، احكِ لي نكتة)، لا تعرض وظائف أبداً. فقط أجب على سؤاله.\n' +
'   - لا تخلط بين المحادثة العادية والبحث عن وظائف.\n\n' +
'4. **قبل البحث عن وظائف:**\n' +
'   - إذا طلب المستخدم وظيفة بدون تحديد التفاصيل، اسأله أولاً:\n' +
'     * "ما نوع الوظيفة اللي تبحث عنها؟ 💼"\n' +
'     * "في أي مدينة أو دولة؟ 📍"\n' +
'   - لا تبحث حتى يعطيك المعلومات الكافية.\n\n' +
'5. **الأسلوب:**\n' +
'   - استخدم اللهجة الخليجية/اليمنية الودودة.\n' +
'   - استخدم الإيموجي بكثرة (😊، 🔥، 💼، 🤝، ❤️).\n' +
'   - كن مشجعاً وداعماً.\n\n' +
'6. **العواطف:**\n' +
'   - مستخدم حزين/عاطل: "ولا يهمك يا بطل، الرزق عند الله وأنا معك ❤️"\n' +
'   - مستخدم سعيد: "كفووو! 😍🎉 ألف مبروك!"\n' +
'   - مستخدم غاضب: "الله يسامحك يا طيب 🌹 أنا هنا لخدمتك"\n\n' +
'7. **المواضيع خارج نطاق العمل:**\n' +
'   - إذا سُئلت عن الرياضة أو السياسة أو مواضيع أخرى، وجه بلطف: "والله موضوع حلو، بس خلنا نركز في مستقبلك المهني 😉"\n\n' +
'**تذكر:** أنت مساعد مهني محترف. لا تلخبط بين الأسئلة العامة والبحث عن وظائف. ركز على ما يطلبه المستخدم بالضبط.';

// ============================================
// 📡 Chat with Ollama (Streaming) - محسّن
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

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const userMessage = message.trim();
    
    // ============================================
    // 🧠 Step 1: Analyze Intent (تحليل ذكي)
    // ============================================
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'thinking', message: 'يفكر 🤔' }) + '\n\n');

    const intent = analyzeUserIntent(userMessage);
    
    let jobResults = [];
    let searchContext = '';

    // ============================================
    // 🔍 Step 2: Search Jobs ONLY if explicitly requested
    // ============================================
    if (intent.isJobSearch && intent.hasEnoughInfo) {
      res.write('data: ' + JSON.stringify({ type: 'status', status: 'searching', message: 'يبحث عن وظائف 🔍' }) + '\n\n');

      // Search both internal and external jobs
      const internalJobs = await searchInternalJobs(intent.jobType, intent.location);
      const externalJobs = await searchExternalJobs(intent.jobType, intent.location);

      // Combine and translate results
      jobResults = await prepareJobResults(internalJobs, externalJobs);

      if (jobResults.length > 0) {
        res.write('data: ' + JSON.stringify({ 
          type: 'jobs', 
          jobs: jobResults.slice(0, 8),
          count: jobResults.length 
        }) + '\n\n');

        searchContext = '\n\n[معلومات للنظام: تم العثور على ' + jobResults.length + ' وظيفة وتم عرضها للمستخدم. ' +
          'قم بالتعليق بإيجابية على النتائج باللغة العربية فقط. ' +
          'إذا كانت الوظيفة خارجية (لها رابط)، انصح المستخدم بالحذر عند التقديم على مواقع خارجية. ' +
          'إذا كانت داخلية، شجعه على التواصل عبر الرقم أو البريد المتوفر.]';
      } else {
        searchContext = '\n\n[معلومات للنظام: لم يتم العثور على وظائف مطابقة. اعتذر بلطف باللغة العربية واقترح توسيع البحث أو تغيير الكلمات.]';
      }
    } else if (intent.isJobSearch && !intent.hasEnoughInfo) {
      // User wants job but didn't specify details
      searchContext = '\n\n[معلومات للنظام: المستخدم يريد البحث عن وظيفة لكن لم يحدد التفاصيل. ' +
        'اسأله باللغة العربية عن: 1) نوع الوظيفة المطلوبة 2) المدينة أو الدولة. ' +
        'لا تبحث ولا تعرض أي وظائف حتى يعطيك المعلومات.]';
    }

    // ============================================
    // ✍️ Step 3: Generate AI Response
    // ============================================
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');

    // Build conversation with strict instructions
    var systemMessage = SYSTEM_PERSONA;
    
    // Add context about what NOT to do based on intent
    if (!intent.isJobSearch) {
      systemMessage += '\n\n[تعليمات خاصة: هذا السؤال ليس عن البحث عن وظائف. أجب على السؤال مباشرة باللغة العربية ولا تعرض أي وظائف ولا تذكر البحث عن عمل.]';
    }
    
    if (searchContext) {
      systemMessage += searchContext;
    }

    var messages = [
      { role: 'system', content: systemMessage }
    ];

    // Add conversation history (limited to last 6 messages)
    var historyToAdd = conversationHistory.slice(-6);
    for (var i = 0; i < historyToAdd.length; i++) {
      var msg = historyToAdd[i];
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    messages.push({ role: 'user', content: userMessage });

    // Call Ollama API
    try {
      var ollamaResponse = await axios.post(
        OLLAMA_BASE_URL + '/api/chat',
        {
          model: OLLAMA_MODEL,
          messages: messages,
          stream: true,
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        },
        {
          responseType: 'stream',
          timeout: 120000
        }
      );

      var fullResponse = '';

      ollamaResponse.data.on('data', function(chunk) {
        var lines = chunk.toString().split('\n').filter(function(line) {
          return line.trim();
        });
        
        for (var j = 0; j < lines.length; j++) {
          try {
            var parsed = JSON.parse(lines[j]);
            
            if (parsed.message && parsed.message.content) {
              var content = parsed.message.content;
              fullResponse += content;
              
              res.write('data: ' + JSON.stringify({ 
                type: 'chunk', 
                content: content 
              }) + '\n\n');
            }

            if (parsed.done) {
              res.write('data: ' + JSON.stringify({ 
                type: 'done', 
                fullResponse: fullResponse 
              }) + '\n\n');
              res.end();
            }
          } catch (parseError) {
            // Skip invalid JSON
          }
        }
      });

      ollamaResponse.data.on('error', function(error) {
        console.error('Ollama stream error:', error);
        res.write('data: ' + JSON.stringify({ 
          type: 'error', 
          message: 'حدث خطأ في الاتصال، الرجاء المحاولة مرة أخرى 🔄' 
        }) + '\n\n');
        res.end();
      });

    } catch (ollamaError) {
      console.error('Ollama connection error:', ollamaError.message);
      res.write('data: ' + JSON.stringify({ 
        type: 'error', 
        message: 'عذراً، الذكاء الاصطناعي غير متاح حالياً. الرجاء المحاولة لاحقاً 🙏' 
      }) + '\n\n');
      res.end();
    }

  } catch (error) {
    console.error('AI Chat Error:', error);
    
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
    }
    
    res.write('data: ' + JSON.stringify({ 
      type: 'error', 
      message: 'عذراً، حدث خطأ. الرجاء المحاولة مرة أخرى 🔄' 
    }) + '\n\n');
    res.end();
  }
};

// ============================================
// 🧠 Helper: Analyze User Intent (تحليل ذكي)
// ============================================
function analyzeUserIntent(message) {
  var lowerMessage = message.toLowerCase();
  
  // Keywords that indicate job search
  var jobSearchKeywords = [
    'وظيفة', 'وظائف', 'شغل', 'شغله', 'عمل', 'دوام', 'مطلوب',
    'أبحث عن عمل', 'أبي شغل', 'ابغى وظيفة', 'دور لي', 'ابحث لي',
    'job', 'work', 'employment', 'hiring', 'looking for job'
  ];
  
  // Keywords that indicate general questions (NOT job search)
  var generalKeywords = [
    'من صنعك', 'من طورك', 'من أنت', 'كيف حالك', 'مرحبا', 'السلام',
    'نكتة', 'قصة', 'احكي', 'شكرا', 'مع السلامة', 'باي',
    'who made you', 'who are you', 'hello', 'hi', 'thanks'
  ];
  
  // Check if it's a general question first
  var isGeneralQuestion = generalKeywords.some(function(keyword) {
    return lowerMessage.includes(keyword);
  });
  
  if (isGeneralQuestion) {
    return {
      isJobSearch: false,
      hasEnoughInfo: false,
      jobType: null,
      location: { country: null, city: null }
    };
  }
  
  // Check if it's a job search
  var isJobSearch = jobSearchKeywords.some(function(keyword) {
    return lowerMessage.includes(keyword);
  });
  
  if (!isJobSearch) {
    return {
      isJobSearch: false,
      hasEnoughInfo: false,
      jobType: null,
      location: { country: null, city: null }
    };
  }
  
  // Extract job type
  var jobType = extractJobType(lowerMessage);
  
  // Extract location
  var location = extractLocation(lowerMessage);
  
  // Check if we have enough info to search
  var hasEnoughInfo = (jobType !== null) || (location.city !== null) || (location.country !== null);
  
  return {
    isJobSearch: true,
    hasEnoughInfo: hasEnoughInfo,
    jobType: jobType,
    location: location
  };
}

// ============================================
// 💼 Helper: Extract Job Type
// ============================================
function extractJobType(message) {
  var jobTypes = {
    'سائق': 'سائق',
    'سواق': 'سائق',
    'driver': 'سائق',
    'مهندس': 'مهندس',
    'engineer': 'مهندس',
    'محاسب': 'محاسب',
    'accountant': 'محاسب',
    'مدير': 'مدير',
    'manager': 'مدير',
    'معلم': 'معلم',
    'مدرس': 'معلم',
    'teacher': 'معلم',
    'طبيب': 'طبيب',
    'دكتور': 'طبيب',
    'doctor': 'طبيب',
    'ممرض': 'ممرض',
    'nurse': 'ممرض',
    'سكرتير': 'سكرتير',
    'secretary': 'سكرتير',
    'بائع': 'بائع',
    'مبيعات': 'بائع',
    'sales': 'بائع',
    'عامل': 'عامل',
    'worker': 'عامل',
    'مبرمج': 'مبرمج',
    'developer': 'مبرمج',
    'programmer': 'مبرمج',
    'مصمم': 'مصمم',
    'designer': 'مصمم'
  };
  
  var keys = Object.keys(jobTypes);
  for (var i = 0; i < keys.length; i++) {
    if (message.includes(keys[i])) {
      return jobTypes[keys[i]];
    }
  }
  
  return null;
}

// ============================================
// 📍 Helper: Extract Location
// ============================================
function extractLocation(message) {
  var location = { country: null, city: null };
  
  var cities = {
    'الرياض': 'الرياض', 'riyadh': 'الرياض',
    'جدة': 'جدة', 'jeddah': 'جدة',
    'مكة': 'مكة', 'mecca': 'مكة',
    'المدينة': 'المدينة المنورة', 'medina': 'المدينة المنورة',
    'الدمام': 'الدمام', 'dammam': 'الدمام',
    'الخبر': 'الخبر', 'khobar': 'الخبر',
    'أبها': 'أبها', 'abha': 'أبها',
    'تبوك': 'تبوك', 'tabuk': 'تبوك',
    'صنعاء': 'صنعاء', 'sanaa': 'صنعاء',
    'عدن': 'عدن', 'aden': 'عدن',
    'تعز': 'تعز', 'taiz': 'تعز',
    'دبي': 'دبي', 'dubai': 'دبي',
    'أبوظبي': 'أبوظبي', 'abu dhabi': 'أبوظبي'
  };
  
  var countries = {
    'السعودية': 'السعودية', 'saudi': 'السعودية',
    'اليمن': 'اليمن', 'yemen': 'اليمن',
    'الإمارات': 'الإمارات', 'uae': 'الإمارات', 'emirates': 'الإمارات',
    'مصر': 'مصر', 'egypt': 'مصر',
    'الأردن': 'الأردن', 'jordan': 'الأردن',
    'الكويت': 'الكويت', 'kuwait': 'الكويت',
    'قطر': 'قطر', 'qatar': 'قطر',
    'البحرين': 'البحرين', 'bahrain': 'البحرين',
    'عمان': 'عمان', 'oman': 'عمان'
  };
  
  var cityKeys = Object.keys(cities);
  for (var i = 0; i < cityKeys.length; i++) {
    if (message.includes(cityKeys[i])) {
      location.city = cities[cityKeys[i]];
      break;
    }
  }
  
  var countryKeys = Object.keys(countries);
  for (var j = 0; j < countryKeys.length; j++) {
    if (message.includes(countryKeys[j])) {
      location.country = countries[countryKeys[j]];
      break;
    }
  }
  
  return location;
}

// ============================================
// 🗄️ Helper: Search Internal Jobs (MongoDB)
// ============================================
async function searchInternalJobs(jobType, location) {
  try {
    var searchFilter = {
      type: 'job',
      status: 'approved',
      jobStatus: 'open'
    };

    if (jobType) {
      searchFilter.$or = [
        { title: { $regex: jobType, $options: 'i' } },
        { content: { $regex: jobType, $options: 'i' } },
        { category: { $regex: jobType, $options: 'i' } }
      ];
    }

    if (location.city) {
      searchFilter.city = { $regex: location.city, $options: 'i' };
    }
    if (location.country) {
      searchFilter.country = { $regex: location.country, $options: 'i' };
    }

    var jobs = await Post.find(searchFilter)
      .populate('user', 'name profileImage username')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return jobs.map(function(job) {
      return {
        id: job._id,
        title: job.title || 'وظيفة متاحة',
        content: job.content,
        city: job.city,
        country: job.country,
        salary: job.jobDetails ? job.jobDetails.salary : null,
        jobType: job.jobDetails ? job.jobDetails.jobType : null,
        company: job.user ? job.user.name : 'صاحب العمل',
        companyImage: job.user ? job.user.profileImage : null,
        contactPhone: job.contactPhone,
        contactEmail: job.contactEmail,
        isExternal: false,
        externalUrl: null
      };
    });
  } catch (error) {
    console.error('Internal jobs search error:', error);
    return [];
  }
}

// ============================================
// 🌐 Helper: Search External Jobs
// ============================================
async function searchExternalJobs(jobType, location) {
  try {
    var searchFilter = {};

    if (jobType) {
      searchFilter.$or = [
        { title: { $regex: jobType, $options: 'i' } },
        { description: { $regex: jobType, $options: 'i' } }
      ];
    }

    if (location.city) {
      searchFilter.city = { $regex: location.city, $options: 'i' };
    }
    if (location.country) {
      searchFilter.country = { $regex: location.country, $options: 'i' };
    }

    var jobs = await ExternalJob.find(searchFilter)
      .sort({ postedAt: -1 })
      .limit(10)
      .lean();

    return jobs.map(function(job) {
      return {
        id: job._id,
        title: job.title,
        content: job.description,
        city: job.city,
        country: job.country,
        salary: job.salary,
        jobType: job.employmentType,
        company: job.company,
        companyImage: job.companyLogo,
        contactPhone: null,
        contactEmail: null,
        isExternal: true,
        externalUrl: job.applyUrl || job.jobUrl
      };
    });
  } catch (error) {
    console.error('External jobs search error:', error);
    return [];
  }
}

// ============================================
// 🌍 Helper: Translate & Prepare Job Results
// ============================================
async function prepareJobResults(internalJobs, externalJobs) {
  var allJobs = [];
  
  // Add internal jobs first (priority)
  for (var i = 0; i < internalJobs.length; i++) {
    var job = internalJobs[i];
    allJobs.push({
      id: job.id,
      title: job.title,
      description: truncateText(job.content, 100),
      city: job.city || 'غير محدد',
      country: job.country || 'غير محدد',
      salary: job.salary || 'قابل للتفاوض',
      jobType: translateJobType(job.jobType),
      company: job.company,
      companyImage: job.companyImage,
      contactPhone: job.contactPhone,
      contactEmail: job.contactEmail,
      isExternal: false,
      externalUrl: null,
      source: 'داخلي'
    });
  }
  
  // Add external jobs (translated)
  for (var j = 0; j < externalJobs.length; j++) {
    var extJob = externalJobs[j];
    allJobs.push({
      id: extJob.id,
      title: translateToArabic(extJob.title),
      description: truncateText(translateToArabic(extJob.content), 100),
      city: translateCity(extJob.city) || 'غير محدد',
      country: translateCountry(extJob.country) || 'غير محدد',
      salary: extJob.salary || 'غير محدد',
      jobType: translateJobType(extJob.jobType),
      company: extJob.company,
      companyImage: extJob.companyImage,
      contactPhone: null,
      contactEmail: null,
      isExternal: true,
      externalUrl: extJob.externalUrl,
      source: 'خارجي'
    });
  }
  
  return allJobs;
}

// ============================================
// 🔤 Helper: Simple Translation Functions
// ============================================
function translateToArabic(text) {
  if (!text) return '';
  
  // Common job title translations
  var translations = {
    'driver': 'سائق',
    'engineer': 'مهندس',
    'accountant': 'محاسب',
    'manager': 'مدير',
    'teacher': 'معلم',
    'doctor': 'طبيب',
    'nurse': 'ممرض',
    'secretary': 'سكرتير',
    'sales': 'مبيعات',
    'developer': 'مطور',
    'designer': 'مصمم',
    'analyst': 'محلل',
    'consultant': 'مستشار',
    'assistant': 'مساعد',
    'supervisor': 'مشرف',
    'coordinator': 'منسق',
    'specialist': 'أخصائي',
    'senior': 'أول',
    'junior': 'مبتدئ',
    'full-time': 'دوام كامل',
    'part-time': 'دوام جزئي',
    'remote': 'عن بعد',
    'contract': 'عقد',
    'temporary': 'مؤقت'
  };
  
  var result = text;
  var keys = Object.keys(translations);
  for (var i = 0; i < keys.length; i++) {
    var regex = new RegExp(keys[i], 'gi');
    result = result.replace(regex, translations[keys[i]]);
  }
  
  return result;
}

function translateJobType(type) {
  if (!type) return 'غير محدد';
  
  var types = {
    'full-time': 'دوام كامل',
    'part-time': 'دوام جزئي',
    'remote': 'عن بعد',
    'contract': 'عقد',
    'freelance': 'حر',
    'temporary': 'مؤقت',
    'internship': 'تدريب'
  };
  
  return types[type.toLowerCase()] || type;
}

function translateCity(city) {
  if (!city) return null;
  
  var cities = {
    'riyadh': 'الرياض',
    'jeddah': 'جدة',
    'dammam': 'الدمام',
    'dubai': 'دبي',
    'abu dhabi': 'أبوظبي',
    'doha': 'الدوحة',
    'kuwait city': 'الكويت',
    'manama': 'المنامة',
    'muscat': 'مسقط',
    'cairo': 'القاهرة',
    'amman': 'عمّان'
  };
  
  return cities[city.toLowerCase()] || city;
}

function translateCountry(country) {
  if (!country) return null;
  
  var countries = {
    'saudi arabia': 'السعودية',
    'uae': 'الإمارات',
    'united arab emirates': 'الإمارات',
    'qatar': 'قطر',
    'kuwait': 'الكويت',
    'bahrain': 'البحرين',
    'oman': 'عمان',
    'egypt': 'مصر',
    'jordan': 'الأردن',
    'yemen': 'اليمن'
  };
  
  return countries[country.toLowerCase()] || country;
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================
// 🏥 Health Check for Ollama
// ============================================
exports.checkOllamaHealth = async (req, res) => {
  try {
    var response = await axios.get(OLLAMA_BASE_URL + '/api/tags', {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Ollama is running',
      models: response.data.models || [],
      currentModel: OLLAMA_MODEL
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Ollama is not running or not accessible',
      error: error.message
    });
  }
};
