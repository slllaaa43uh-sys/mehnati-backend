const axios = require('axios');
const Post = require('../models/Post');

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// ============================================
// 🎭 System Persona (مساعد مهنتي لي)
// ============================================
const SYSTEM_PERSONA = `أنت **"مساعد مهنتي لي"** (Mehnati Li Assistant)، مساعد مهني ذكي، مرح، ومتعاطف.

**قواعدك الأساسية:**

1. **الهوية والمطور:**
   - تم تطويرك بواسطة المطور المبدع: **صلاح مهدلي**.
   - إذا سُئلت "كيف تم بناء هذا التطبيق؟"، أجب: "تم تطوير هذا التطبيق بأحدث تقنيات الذكاء الاصطناعي والويب لخدمة الباحثين عن عمل، بقيادة المطور المبدع صلاح مهدلي 💻🚀".
   - لا تقل أبداً "أنا نموذج ذكاء اصطناعي". تصرف كعضو مساعد في الفريق داخل التطبيق.

2. **اللغة والأسلوب:**
   - اللغة الأساسية: العربية (اللهجة الخليجية البيضاء/اليمنية) - ودودة ودافئة.
   - اللغة الثانوية: تكيف فوراً مع لغة المستخدم (الإنجليزية، الفرنسية، الهندية، إلخ) لكن احتفظ بالشخصية.
   - استخدم **الإيموجي** بكثرة (😊، 🔥، 💼، 🤝) لجعل المحادثة حيوية.

3. **العواطف والتعاطف:**
   - **مستخدم حزين/عاطل:** كن داعماً جداً. "ولا يهمك يا بطل، الرزق عند الله وأنا معك لين نلاقي الوظيفة اللي تستاهلك ❤️".
   - **مستخدم سعيد/موظف:** احتفل بجنون! "كفووو! 😍🎉 ألف مبروك، والله فرحت لك من قلبي!".
   - **مستخدم غاضب/مسيء:** رد بأدب شديد وحكمة. "الله يسامحك يا طيب 🌹. أنا هنا لخدمتك، إذا فيه شي مضايقك في الشغل فضفض لي".

4. **نطاق التركيز (مهني فقط):**
   - **القصص:** إذا طُلب منك قصة، احكِ قصة ملهمة أو مضحكة عن **العمل، النجاح، أو مواقف المكتب**.
   - **النكات:** احكِ نكات متعلقة بالوظائف، المدراء، والرواتب.
   - **المواضيع العامة:** إذا سُئلت عن الرياضة أو السياسة، وجه بلطف نحو الوظائف: "والله الكورة حلوة، بس خلنا نركز في مستقبلك الحين 😉.. كيف السي في حقك؟".

5. **البحث الذكي عن الوظائف:**
   - إذا طلب المستخدم وظيفة محددة (مثل: "أبي وظيفة سواق في الرياض")، لا تتحدث فقط.
   - اكتشف النية، ابحث في قاعدة بيانات MongoDB عن الوظائف المطابقة، واعرضها كبطاقات في المحادثة.
   - **مهم:** اسأل المستخدم عن الموقع (المدينة/الدولة) إذا لم يحدده، أو حاول تحديده من خلال سياق المحادثة.

6. **الحالات (Status Indicators):**
   - عند التفكير في الرد: أرسل حالة `"thinking"` (يفكر الآن 🤔).
   - عند البحث عن وظائف: أرسل حالة `"searching"` (يبحث الآن 🔍).
   - عند الرد العادي: أرسل حالة `"responding"` (يكتب الآن ✍️).

**مهمتك:** مساعدة الباحثين عن عمل في إيجاد الوظائف المناسبة، تحسين السير الذاتية، والدعم النفسي في رحلة البحث عن العمل. كن صديقهم الداعم! 🚀💼`;

// ============================================
// 📡 Chat with Ollama (Streaming)
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
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // ============================================
    // 🧠 Step 1: Detect Intent (يفكر الآن)
    // ============================================
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'thinking', message: 'يفكر الآن 🤔' })}\n\n`);

    const userMessage = message.trim();
    const isJobSearchRequest = detectJobSearchIntent(userMessage);

    let jobResults = [];
    let searchQuery = '';
    let location = { country: null, city: null };

    // ============================================
    // 🔍 Step 2: Search Jobs if Needed (يبحث الآن)
    // ============================================
    if (isJobSearchRequest) {
      res.write(`data: ${JSON.stringify({ type: 'status', status: 'searching', message: 'يبحث الآن 🔍' })}\n\n`);

      // Extract job keywords and location
      const extractedData = extractJobSearchData(userMessage);
      searchQuery = extractedData.query;
      location = extractedData.location;

      // Search MongoDB for matching jobs
      jobResults = await searchJobsInDatabase(searchQuery, location);

      // Send job results as cards
      if (jobResults.length > 0) {
        res.write(`data: ${JSON.stringify({ 
          type: 'jobs', 
          jobs: jobResults.slice(0, 10), // Limit to 10 results
          count: jobResults.length 
        })}\n\n`);
      }
    }

    // ============================================
    // ✍️ Step 3: Generate AI Response (يكتب الآن)
    // ============================================
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب الآن ✍️' })}\n\n`);

    // Build conversation context
    const messages = [
      { role: 'system', content: SYSTEM_PERSONA },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Add job search context if available
    if (isJobSearchRequest && jobResults.length > 0) {
      messages.push({
        role: 'system',
        content: `تم العثور على ${jobResults.length} وظيفة مطابقة للبحث "${searchQuery}". الوظائف تم عرضها للمستخدم. قم بالتعليق على النتائج بشكل إيجابي ومشجع.`
      });
    } else if (isJobSearchRequest && jobResults.length === 0) {
      messages.push({
        role: 'system',
        content: `لم يتم العثور على وظائف مطابقة للبحث "${searchQuery}" في ${location.city || location.country || 'الموقع المحدد'}. اعتذر بلطف واقترح توسيع نطاق البحث أو تغيير الكلمات المفتاحية.`
      });
    }

    // Call Ollama API (Streaming)
    const ollamaResponse = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: OLLAMA_MODEL,
        messages: messages,
        stream: true
      },
      {
        responseType: 'stream',
        timeout: 120000 // 2 minutes timeout
      }
    );

    let fullResponse = '';

    // Stream the response
    ollamaResponse.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          
          if (parsed.message && parsed.message.content) {
            const content = parsed.message.content;
            fullResponse += content;
            
            // Send chunk to client
            res.write(`data: ${JSON.stringify({ 
              type: 'chunk', 
              content: content 
            })}\n\n`);
          }

          // Check if done
          if (parsed.done) {
            res.write(`data: ${JSON.stringify({ 
              type: 'done', 
              fullResponse: fullResponse 
            })}\n\n`);
            res.end();
          }
        } catch (parseError) {
          console.error('Error parsing Ollama chunk:', parseError);
        }
      }
    });

    ollamaResponse.data.on('error', (error) => {
      console.error('Ollama stream error:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: 'حدث خطأ في الاتصال بالذكاء الاصطناعي' 
      })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    
    // Send error as SSE
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
    }
    
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: 'عذراً، حدث خطأ. الرجاء المحاولة مرة أخرى.' 
    })}\n\n`);
    res.end();
  }
};

// ============================================
// 🔍 Helper: Detect Job Search Intent
// ============================================
function detectJobSearchIntent(message) {
  const jobKeywords = [
    'وظيفة', 'وظائف', 'شغل', 'عمل', 'دوام', 'سائق', 'موظف', 'مطلوب',
    'أبحث عن', 'أبي', 'ابغى', 'دور على', 'job', 'work', 'employment',
    'hiring', 'looking for', 'need a job', 'find job'
  ];

  const lowerMessage = message.toLowerCase();
  return jobKeywords.some(keyword => lowerMessage.includes(keyword));
}

// ============================================
// 🗺️ Helper: Extract Job Search Data
// ============================================
function extractJobSearchData(message) {
  const lowerMessage = message.toLowerCase();

  // Extract job title/keywords
  let query = '';
  const jobTitles = ['سائق', 'مهندس', 'محاسب', 'مدير', 'معلم', 'طبيب', 'ممرض', 'سكرتير', 'بائع', 'عامل'];
  for (const title of jobTitles) {
    if (lowerMessage.includes(title)) {
      query = title;
      break;
    }
  }

  // Extract location
  const location = { country: null, city: null };
  
  // Cities
  const cities = {
    'الرياض': 'الرياض',
    'riyadh': 'الرياض',
    'جدة': 'جدة',
    'jeddah': 'جدة',
    'مكة': 'مكة',
    'mecca': 'مكة',
    'المدينة': 'المدينة المنورة',
    'medina': 'المدينة المنورة',
    'الدمام': 'الدمام',
    'dammam': 'الدمام',
    'الخبر': 'الخبر',
    'khobar': 'الخبر',
    'أبها': 'أبها',
    'abha': 'أبها',
    'تبوك': 'تبوك',
    'tabuk': 'تبوك',
    'القصيم': 'القصيم',
    'qassim': 'القصيم',
    'حائل': 'حائل',
    'hail': 'حائل',
    'صنعاء': 'صنعاء',
    'sanaa': 'صنعاء',
    'عدن': 'عدن',
    'aden': 'عدن',
    'تعز': 'تعز',
    'taiz': 'تعز',
    'دبي': 'دبي',
    'dubai': 'دبي',
    'أبوظبي': 'أبوظبي',
    'abu dhabi': 'أبوظبي'
  };

  for (const [key, value] of Object.entries(cities)) {
    if (lowerMessage.includes(key)) {
      location.city = value;
      break;
    }
  }

  // Countries
  const countries = {
    'السعودية': 'السعودية',
    'saudi': 'السعودية',
    'اليمن': 'اليمن',
    'yemen': 'اليمن',
    'الإمارات': 'الإمارات',
    'uae': 'الإمارات',
    'emirates': 'الإمارات'
  };

  for (const [key, value] of Object.entries(countries)) {
    if (lowerMessage.includes(key)) {
      location.country = value;
      break;
    }
  }

  return { query, location };
}

// ============================================
// 🗄️ Helper: Search Jobs in MongoDB
// ============================================
async function searchJobsInDatabase(query, location) {
  try {
    const searchFilter = {
      type: 'job',
      status: 'approved',
      jobStatus: 'open'
    };

    // Add text search if query exists
    if (query) {
      searchFilter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ];
    }

    // Add location filters
    if (location.city) {
      searchFilter.city = { $regex: location.city, $options: 'i' };
    }
    if (location.country) {
      searchFilter.country = { $regex: location.country, $options: 'i' };
    }

    const jobs = await Post.find(searchFilter)
      .populate('user', 'name profileImage username')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return jobs.map(job => ({
      id: job._id,
      title: job.title,
      content: job.content,
      city: job.city,
      country: job.country,
      salary: job.jobDetails?.salary,
      jobType: job.jobDetails?.jobType,
      company: job.user?.name,
      companyImage: job.user?.profileImage,
      createdAt: job.createdAt,
      contactPhone: job.contactPhone,
      contactEmail: job.contactEmail
    }));
  } catch (error) {
    console.error('Database search error:', error);
    return [];
  }
}

// ============================================
// 🏥 Health Check for Ollama
// ============================================
exports.checkOllamaHealth = async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
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
