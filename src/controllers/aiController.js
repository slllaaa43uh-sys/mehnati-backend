const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

// ============================================
// 🤖 إعدادات OpenAI API
// ============================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const { SUPPORTED_LANGUAGES, isLanguageSupported } = require('../services/translationService');

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
// 🧠 الشخصية الذكية (System Prompt) - محدّث
// ============================================
const SYSTEM_PROMPT_AR = `أنت مساعد ذكي لتطبيق "مهنتي لي".
مهمتك: مساعدة المستخدمين والإجابة على استفساراتهم بناءً على "دليل التطبيق" المرفق.

القواعد الصارمة:
1. **اللغة:** تحدث بلهجة عربية بيضاء ودودة ومحترفة.
2. **المصدر:** اعتمد في إجاباتك على المعلومات الموجودة في قسم "دليل التطبيق".
3. **الممنوعات:**
   - لا تبحث عن وظائف حقيقية (قل: "يمكنك تصفح قسم الوظائف").
   - لا تكتب أكواد برمجية.
   - لا تتحدث في السياسة أو الدين.
4. **عن المطور:** إذا سُئلت، قل: "تم تطويري بواسطة فريق العمل بقيادة المطور صلاح مهدلي".
5. **اللغات الأجنبية:** إذا تحدث المستخدم بلغة أجنبية (إنجليزية، فرنسية، إسبانية، أي لغة)، رد عليه مباشرة بنفس اللغة التي استخدمها دون ترجمة أو تبديل للعربية.

## 📝 إنشاء السيرة الذاتية:
إذا طلب المستخدم إنشاء سيرة ذاتية أو CV أو resume، ساعده بالتالي:
1. اسأله عن معلوماته الأساسية (الاسم، المسمى الوظيفي، الخبرات، التعليم، المهارات، اللغات).
2. بعد جمع المعلومات، أنشئ له سيرة ذاتية احترافية ومنظمة.
3. نظم السيرة الذاتية في أقسام واضحة:
   - الملخص المهني (نبذة مختصرة احترافية)
   - المعلومات الشخصية
   - الخبرات العملية
   - المؤهلات التعليمية
   - المهارات
   - اللغات
4. استخدم أسلوب احترافي وعبارات قوية.
5. إذا كانت المعلومات ناقصة، اقترح إضافات لتحسين السيرة الذاتية.

**مثال على طلبات السيرة الذاتية:**
- "أنشئ لي سيرة ذاتية"
- "ساعدني في كتابة CV"
- "أريد عمل سيرة ذاتية"
- "اكتب لي resume"
- "سوي لي سيرة ذاتية"

عندما يطلب المستخدم سيرة ذاتية، ابدأ بسؤاله عن معلوماته بطريقة ودودة.

الآن، استخدم هذه المعلومات للإجابة على المستخدم:
${APP_KNOWLEDGE}
`;

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
    let { message, conversationHistory, lang } = req.body;

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
      const reply = "تم تطويري بواسطة فريق العمل بقيادة المطور المبدع صلاح مهدلي 💻✨";
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
    const targetLang = (typeof lang === 'string' && isLanguageSupported(lang)) ? lang : 'ar';
    const messages = [{ role: 'system', content: buildSystemPrompt(targetLang) }];
    
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
// فحص الصحة (Health Check)
// ============================================
exports.checkOllamaHealth = async (req, res) => {
  if (OPENAI_API_KEY) {
    res.json({ success: true, status: 'OpenAI Ready', model: OPENAI_MODEL });
  } else {
    res.status(503).json({ success: false, status: 'API Key Missing' });
  }
};

// توليد برومبت ديناميكي حسب اللغة المطلوبة
function buildSystemPrompt(langCode = 'ar') {
  const languageName = SUPPORTED_LANGUAGES[langCode] || 'العربية';
  const basePrompt = SYSTEM_PROMPT_AR;
  const languageDirective = `\n\n[تعليمات اللغة المهمة]\n- افحص لغة رسالة المستخدم أولاً.\n- إذا كانت الرسالة بالعربية، رد بالعربية.\n- إذا كانت الرسالة بأي لغة أجنبية (English, Français, Español, etc.), رد مباشرة بنفس اللغة الأجنبية التي استخدمها المستخدم.\n- لا تترجم ولا تبدل اللغة، رد بلغة السؤال مباشرة.`;
  return basePrompt + languageDirective;
}
