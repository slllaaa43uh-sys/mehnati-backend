const axios = require('axios');
// في حال كنت تحتاج استخدام الموديلات مستقبلاً
const Post = require('../models/Post'); 

// ============================================
// 🤖 إعدادات Ollama (السيرفر الداخلي)
// ============================================
// نستخدم 127.0.0.1 لضمان الاتصال الداخلي السريع
const OLLAMA_BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.LLM_MODEL || 'qwen2.5:7b-instruct';

console.log('🔧 [INIT] AI Configuration (Ollama):');
console.log(`   Target: ${OLLAMA_BASE_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);

// ============================================
// 📚 قاعدة المعرفة الشاملة (Knowledge Base)
// ============================================
const APP_KNOWLEDGE = `
# دليل تطبيق مهنتي لي الشامل

## نبذة
تطبيق "مهنتي لي" هو منصة تواصل مهنية عربية تجمع بين التوظيف، التواصل الاجتماعي، والحراج.

## الميزات الرئيسية وطريقة الاستخدام:

1. **المنشورات والقصص:**
   - اضغط (+) لإنشاء منشور (وظيفة، حراج، أو عام).
   - القصص تختفي بعد 24 ساعة.

2. **الوظائف (Jobs):**
   - قسم "أبحث عن عمل" للأفراد.
   - قسم "أبحث عن موظفين" للشركات.
   - **القسم العالمي:** يعرض وظائف من مصادر دولية (نحن نوفر زر ترجمة لها).
   - **القسم المستعجل:** (الزر الأحمر) للتوظيف الفوري واليومي.

3. **الحراج (Haraj):**
   - بيع وشراء (سيارات، عقارات، أجهزة).

4. **السيرة الذاتية (CV):**
   - يوجد منشئ سيرة ذاتية ذكي يعطيك "بطاقة مهنية" مع QR Code.

5. **التمييز (Promotion):**
   - يمكنك تمييز إعلانك ليظهر في القمة.
   - يوجد تمييز **مجاني** لمدة 24 ساعة (مرة كل يوم).
   - يوجد تمييز مدفوع (أسبوعي/شهري).

## نصائح الأمان:
- لا تدفع أي مبالغ خارج التطبيق.
- تحقق من هوية المعلن.
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
// 🛡️ فلاتر الأمان (Regex)
// ============================================
function isCreatorQuestion(message) {
  return /من\s*(طورك|صنعك|برمجك|سواك)/i.test(message);
}

function isForbiddenRequest(message) {
  // منع طلبات البحث المباشر (لأن البوت للنصائح فقط حالياً)
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
    res.setHeader('X-Accel-Buffering', 'no'); // مهم لـ Nginx

    // 1️⃣ الردود السريعة (بدون ذكاء اصطناعي)
    if (isCreatorQuestion(userMessage)) {
      const reply = "تم تطويري بواسطة فريق الأمل - بقيادة المطور صلاح مهدلي 💻✨";
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

    // 2️⃣ تجهيز الرسائل لـ Ollama
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    
    // إضافة آخر 6 رسائل من المحادثة (للذاكرة)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-6).forEach(m => {
        if (m.content) messages.push({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content });
      });
    }
    
    messages.push({ role: 'user', content: userMessage });

    // إرسال حالة "يكتب..."
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'responding', message: 'يفكر... 🤔' })}\n\n`);

    // 3️⃣ الاتصال بـ Ollama (داخل السيرفر)
    try {
      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model: OLLAMA_MODEL,
          messages: messages,
          stream: true,
          options: { temperature: 0.3, num_predict: 600 } // تقليل العشوائية
        },
        { responseType: 'stream' }
      );

      let fullText = "";

      response.data.on('data', chunk => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message && json.message.content) {
              const content = json.message.content;
              fullText += content;
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: content })}\n\n`);
            }
            if (json.done) {
              res.write(`data: ${JSON.stringify({ type: 'done', fullResponse: fullText })}\n\n`);
              res.end();
            }
          } catch (e) { }
        }
      });

      response.data.on('error', err => {
        console.error('Ollama Stream Error:', err.message);
        res.end();
      });

    } catch (ollamaError) {
      console.error('Ollama Connection Error:', ollamaError.message);
      const errReply = "عذراً، خدمة الذكاء الاصطناعي مشغولة حالياً (Ollama Error). يرجى المحاولة لاحقاً.";
      res.write(`data: ${JSON.stringify({ type: 'error', message: errReply })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Chat Handler Error:', error);
    res.status(500).end();
  }
};

// ============================================
// فحص حالة النظام (Health Check)
// ============================================
exports.checkOllamaHealth = async (req, res) => {
  try {
    // نتأكد أن Ollama شغال
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 3000 });
    res.json({
      success: true,
      message: 'Ollama is Online',
      model: OLLAMA_MODEL,
      status: '✅ جاهز'
    });
  } catch (error) {
    console.error('Health Check Failed:', error.message);
    res.status(503).json({ success: false, message: 'Ollama is Offline', error: error.message });
  }
};
