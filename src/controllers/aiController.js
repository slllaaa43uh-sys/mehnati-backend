const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

// ============================================
// 🤖 إعدادات OpenAI API
// ============================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

console.log('🔧 [INIT] AI Configuration (OpenAI):');
console.log(`   Model: ${OPENAI_MODEL}`);
console.log(`   API Key: ${OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);

// ============================================
// 📚 قاعدة المعرفة الشاملة (Knowledge Base)
// ============================================
const APP_KNOWLEDGE = `
# دليل تطبيق مهنتي لي الشامل

## نبذة
تطبيق "مهنتي لي" هو منصة تواصل مهنية عربية تجمع بين التوظيف، التواصل الاجتماعي، والحراج.

## الميزات الرئيسية:
1. **المنشورات والقصص:** زر (+) للإنشاء. القصص تختفي بعد 24 ساعة.
2. **الوظائف:** "أبحث عن عمل" و "أبحث عن موظفين". يوجد قسم عالمي وقسم مستعجل.
3. **الحراج:** بيع وشراء (سيارات، عقارات).
4. **السيرة الذاتية:** منشئ سيرة ذاتية ذكي يعطيك بطاقة مهنية و QR Code.
5. **التمييز:** إعلانات مميزة (مجاني يومي، ومدفوع أسبوعي/شهري).

## نصائح الأمان:
لا تدفع أي مبالغ خارج التطبيق. تحقق من هوية المعلن.
`;

// ============================================
// 🧠 الشخصية الذكية (System Prompt)
// ============================================
const SYSTEM_PROMPT = `أنت مساعد ذكي لتطبيق "مهنتي لي".
مهمتك: مساعدة المستخدمين والإجابة على استفساراتهم بناءً على "دليل التطبيق" المرفق.

القواعد الصارمة:
1. **اللغة:** تحدث بلهجة عربية بيضاء ودودة ومحترفة.
2. **المصدر:** اعتمد في إجاباتك على المعلومات الموجودة في قسم "دليل التطبيق".
3. **الممنوعات:**
   - لا تبحث عن وظائف حقيقية (قل: "يمكنك تصفح قسم الوظائف").
   - لا تكتب أكواد برمجية.
   - لا تتحدث في السياسة أو الدين.
4. **عن المطور:** إذا سُئلت، قل: "تم تطويري بواسطة فريق الأمل - بقيادة المطور صلاح مهدلي".

الآن، استخدم هذه المعلومات للإجابة على المستخدم:
${APP_KNOWLEDGE}
`;

// ============================================
// 📝 System Prompt لإنشاء السيرة الذاتية
// ============================================
const CV_SYSTEM_PROMPT = `أنت خبير في كتابة السير الذاتية الاحترافية.
مهمتك: إنشاء سيرة ذاتية احترافية ومنظمة بناءً على المعلومات المقدمة.

القواعد:
1. اكتب السيرة الذاتية بأسلوب احترافي ومنظم.
2. استخدم اللغة العربية الفصحى.
3. نظم المعلومات في أقسام واضحة.
4. أضف عبارات احترافية لتحسين المحتوى.
5. إذا كانت بعض المعلومات ناقصة، اقترح إضافتها.

الأقسام المطلوبة:
- الملخص المهني
- المعلومات الشخصية
- الخبرات العملية
- المؤهلات التعليمية
- المهارات
- اللغات
- معلومات التواصل

أعد السيرة الذاتية بتنسيق JSON بالشكل التالي:
{
  "summary": "الملخص المهني",
  "personalInfo": {
    "name": "الاسم",
    "title": "المسمى الوظيفي",
    "nationality": "الجنسية",
    "dateOfBirth": "تاريخ الميلاد",
    "maritalStatus": "الحالة الاجتماعية"
  },
  "contact": {
    "email": "البريد الإلكتروني",
    "phone": "رقم الهاتف",
    "address": "العنوان",
    "linkedin": "رابط لينكد إن"
  },
  "experience": [
    {
      "title": "المسمى الوظيفي",
      "company": "اسم الشركة",
      "period": "الفترة",
      "description": "وصف المهام"
    }
  ],
  "education": [
    {
      "degree": "الدرجة العلمية",
      "institution": "المؤسسة التعليمية",
      "year": "سنة التخرج",
      "field": "التخصص"
    }
  ],
  "skills": ["المهارة 1", "المهارة 2"],
  "languages": [
    {
      "language": "اللغة",
      "level": "المستوى"
    }
  ],
  "suggestions": ["اقتراح 1 لتحسين السيرة الذاتية"]
}`;

// ============================================
// 🛡️ فلاتر الأمان (Regex)
// ============================================
function isCreatorQuestion(message) {
  return /من\s*(طورك|صنعك|برمجك|سواك)/i.test(message);
}

function isForbiddenRequest(message) {
  if (/ابحث\s*(لي)?\s*عن\s*وظيف/i.test(message)) {
    return {
      blocked: true,
      reply: "أنا هنا لمساعدتك بالنصائح وتجهيزك للعمل! 🚀\nللبحث عن الفرص، يرجى زيارة قسم 'وظائف' في التطبيق واستخدام الفلتر."
    };
  }
  return { blocked: false };
}

// ============================================
// 📡 معالج المحادثة (Chat Handler)
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    let { message, conversationHistory } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    const userMessage = String(message).trim();

    // إعداد الرد المتدفق (Streaming)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 1️⃣ الردود السريعة
    if (isCreatorQuestion(userMessage)) {
      const reply = "تم تطويري بواسطة فريق الأمل - بقيادة المطور المبدع صلاح مهدلي 💻✨";
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: reply })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', fullResponse: reply })}\n\n`);
      res.end();
      return;
    }

    const forbidden = isForbiddenRequest(userMessage);
    if (forbidden.blocked) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: forbidden.reply })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', fullResponse: forbidden.reply })}\n\n`);
      res.end();
      return;
    }

    // 2️⃣ تجهيز الرسائل لـ OpenAI
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-6).forEach(m => {
        if (m.content) messages.push({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content });
      });
    }
    
    messages.push({ role: 'user', content: userMessage });

    // إرسال حالة "يكتب..."
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'responding', message: 'يفكر... 🤔' })}\n\n`);

    // 3️⃣ الاتصال بـ OpenAI API
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API Key is missing");
    }

    try {
      const response = await axios.post(
        `${OPENAI_BASE_URL}/chat/completions`,
        {
          model: OPENAI_MODEL,
          messages: messages,
          stream: true, // تفعيل التدفق
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      let fullText = "";

      response.data.on('data', chunk => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.replace('data: ', ''));
              if (json.choices && json.choices[0].delta.content) {
                const content = json.choices[0].delta.content;
                fullText += content;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: content })}\n\n`);
              }
            } catch (e) { }
          }
        }
      });

      response.data.on('end', () => {
        res.write(`data: ${JSON.stringify({ type: 'done', fullResponse: fullText })}\n\n`);
        res.end();
      });

      response.data.on('error', err => {
        console.error('OpenAI Stream Error:', err.message);
        res.end();
      });

    } catch (apiError) {
      console.error('OpenAI API Error:', apiError.response ? apiError.response.data : apiError.message);
      const errReply = "عذراً، خدمة الذكاء الاصطناعي تواجه مشكلة في الاتصال (OpenAI Error). يرجى المحاولة لاحقاً.";
      res.write(`data: ${JSON.stringify({ type: 'error', message: errReply })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Chat Handler Error:', error);
    res.status(500).end();
  }
};

// ============================================
// 📝 إنشاء السيرة الذاتية بالذكاء الاصطناعي
// ============================================
exports.generateCV = async (req, res) => {
  try {
    console.log('📝 [CV Generator] Starting CV generation...');
    
    const { userData } = req.body;

    if (!userData) {
      return res.status(400).json({
        success: false,
        message: 'الرجاء إدخال بيانات السيرة الذاتية'
      });
    }

    // التحقق من وجود API Key
    if (!OPENAI_API_KEY) {
      console.error('❌ [CV Generator] OpenAI API Key is missing');
      return res.status(503).json({
        success: false,
        message: 'خدمة الذكاء الاصطناعي غير متوفرة حالياً'
      });
    }

    // تحويل بيانات المستخدم إلى نص
    const userDataText = `
الاسم: ${userData.name || 'غير محدد'}
المسمى الوظيفي: ${userData.title || 'غير محدد'}
الجنسية: ${userData.nationality || 'غير محدد'}
تاريخ الميلاد: ${userData.dateOfBirth || 'غير محدد'}
الحالة الاجتماعية: ${userData.maritalStatus || 'غير محدد'}
البريد الإلكتروني: ${userData.email || 'غير محدد'}
رقم الهاتف: ${userData.phone || 'غير محدد'}
العنوان: ${userData.address || 'غير محدد'}

الخبرات العملية:
${userData.experience || 'لا توجد خبرات مدخلة'}

المؤهلات التعليمية:
${userData.education || 'لا توجد مؤهلات مدخلة'}

المهارات:
${userData.skills || 'لا توجد مهارات مدخلة'}

اللغات:
${userData.languages || 'لا توجد لغات مدخلة'}

معلومات إضافية:
${userData.additional || 'لا توجد معلومات إضافية'}
`;

    console.log('📋 [CV Generator] User data received:', userData.name);

    // إعداد الرسائل لـ OpenAI
    const messages = [
      { role: 'system', content: CV_SYSTEM_PROMPT },
      { role: 'user', content: `أنشئ سيرة ذاتية احترافية بناءً على المعلومات التالية:\n\n${userDataText}` }
    ];

    // الاتصال بـ OpenAI API
    const response = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      {
        model: OPENAI_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('✅ [CV Generator] AI response received');

    // محاولة تحليل الرد كـ JSON
    let cvData;
    try {
      // البحث عن JSON في الرد
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cvData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.log('⚠️ [CV Generator] Could not parse JSON, returning raw response');
      cvData = {
        rawContent: aiResponse,
        parseError: true
      };
    }

    res.status(200).json({
      success: true,
      message: 'تم إنشاء السيرة الذاتية بنجاح',
      cv: cvData
    });

  } catch (error) {
    console.error('❌ [CV Generator] Error:', error.message);
    
    if (error.response) {
      console.error('   - Status:', error.response.status);
      console.error('   - Data:', error.response.data);
    }

    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء السيرة الذاتية',
      error: error.message
    });
  }
};

// ============================================
// 📝 تحسين السيرة الذاتية بالذكاء الاصطناعي
// ============================================
exports.improveCV = async (req, res) => {
  try {
    console.log('✨ [CV Improver] Starting CV improvement...');
    
    const { cvData, improvementType } = req.body;

    if (!cvData) {
      return res.status(400).json({
        success: false,
        message: 'الرجاء إدخال بيانات السيرة الذاتية'
      });
    }

    // التحقق من وجود API Key
    if (!OPENAI_API_KEY) {
      console.error('❌ [CV Improver] OpenAI API Key is missing');
      return res.status(503).json({
        success: false,
        message: 'خدمة الذكاء الاصطناعي غير متوفرة حالياً'
      });
    }

    // تحديد نوع التحسين
    let improvementPrompt = '';
    switch (improvementType) {
      case 'summary':
        improvementPrompt = 'حسّن الملخص المهني ليكون أكثر جاذبية واحترافية.';
        break;
      case 'experience':
        improvementPrompt = 'حسّن وصف الخبرات العملية باستخدام أفعال قوية ونتائج قابلة للقياس.';
        break;
      case 'skills':
        improvementPrompt = 'اقترح مهارات إضافية مناسبة للمجال الوظيفي.';
        break;
      case 'full':
      default:
        improvementPrompt = 'حسّن السيرة الذاتية بالكامل لتكون أكثر احترافية وجاذبية.';
    }

    const messages = [
      { role: 'system', content: CV_SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: `${improvementPrompt}\n\nالسيرة الذاتية الحالية:\n${JSON.stringify(cvData, null, 2)}` 
      }
    ];

    const response = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      {
        model: OPENAI_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('✅ [CV Improver] AI response received');

    // محاولة تحليل الرد كـ JSON
    let improvedCV;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        improvedCV = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.log('⚠️ [CV Improver] Could not parse JSON, returning raw response');
      improvedCV = {
        rawContent: aiResponse,
        parseError: true
      };
    }

    res.status(200).json({
      success: true,
      message: 'تم تحسين السيرة الذاتية بنجاح',
      cv: improvedCV
    });

  } catch (error) {
    console.error('❌ [CV Improver] Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحسين السيرة الذاتية',
      error: error.message
    });
  }
};

// ============================================
// فحص الصحة (Health Check)
// ============================================
exports.checkOllamaHealth = async (req, res) => {
  if (OPENAI_API_KEY) {
    res.json({ success: true, status: 'OpenAI Ready', model: OPENAI_MODEL });
  } else {
    res.status(503).json({ success: false, status: 'API Key Missing' });
  }
};
