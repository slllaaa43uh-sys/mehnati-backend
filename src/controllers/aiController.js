const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

// ============================================
// NOTE:
// هذا الملف مُحدّث لِـ: عدم استخدام ملف قاعدة البيانات الخارجي.
// كل الردود السريعة الآن مضمنة داخل هذا الملف.
// ============================================

// ============================================
// 🤖 Ollama Configuration
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';

console.log('🔧 [INIT] Ollama Configuration:');
console.log(`   Base URL: ${OLLAMA_BASE_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);

// ============================================
// 🎭 System Prompt - السياسات العامة
// ============================================
const SYSTEM_PROMPT = `أنت مساعد ذكي مهني لتطبيق "مهنتي لي".
- اللغة: العربية فقط.
- التزم بالسياسات الممنوعة (لا بحث عن وظائف حقيقية، لا اقتراح موظفين، لا كتابة أكواد، لا إنشاء صور/فيديو).
- الردود واضحة ومختصرة ومهنية.
- إذا سئلت "من طورك؟" رد: "تم تطويري بواسطة فريق الأمل – فريق تطبيق مهنتي لي."`;

// ============================================
// ⚠️ الردود الثابتة داخل الكود (LOCAL KB)
// لا تستخدم src/data/knowledgeBase.js
// ============================================
const POLICY_BLOCK_REPLY = 'هذه الميزة غير متوفرة حاليًا، وسيتم إضافتها قريبًا في تحديث قادم.';
const CREATOR_REPLY = 'تم تطويري بواسطة فريق الأمل – فريق تطبيق مهنتي لي.';
const LIMITED_REPLY = 'ليس لدي أي معلومة في هذا المجال حالياً. تطويري محدود الآن وسيتم تحديثي في المستقبل.';

// ردود مضمّنة ومُختصرة مخصصة للمواضيع المهنية المسموح بها
const LOCAL_RESPONSES = [
  {
    name: 'سيرة ذاتية لسائق توصيل',
    keywords: ['سيرة ذاتية سائق', 'سيرة سائق', 'سيرة ذاتية لسائق', 'اكتب سيرة سائق', 'سيرة توصيل'],
    answer: `نموذج سيرة مختصر لسائق توصيل:
الاسم: [اسمك]
الهاتف: [رقم]
المدينة: الرياض
الملخص: سائق توصيل بخبرة [X] سنوات، التزام بالمواعيد وخبرة مع خرائط GPS.
المهارات: رخصة قيادة، انضباط، خدمة عملاء.`
  },
  {
    name: 'تحسين السيرة',
    keywords: ['تحسين السيرة', 'حسّن سيرتي', 'نصائح للسيرة', 'كيف أحسن السيرة'],
    answer: `نصائح سريعة:
1) اذكر خبرات قابلة للقياس.
2) استخدم كلمات واضحة (مثلاً: توصيل يومي، 50 طلب/يوم).
3) اجعل التنسيق بسيطاً وصفحة واحدة إن أمكن.`
  },
  {
    name: 'نصائح توظيف',
    keywords: ['نصائح توظيف', 'نصائح للمقابلة', 'مقابلة عمل', 'كيف استعد للمقابلة'],
    answer: `نصائح مختصرة:
- حضّر أمثلة عن خبراتك.
- كن دقيقاً بالمواعيد.
- احمل نسخة من السيرة والأوراق.`
  },
  {
    name: 'تمييز الإعلان',
    keywords: ['تمييز الاعلان', 'ما فائدة تمييز', 'فائدة تمييز الاعلان', 'تمييز الإعلان'],
    answer: `باختصار: التمييز يزيد من ظهور إعلانك ويضعه أعلى القوائم، يجذب انتباهًا أكثر وبالتالي زيادة التفاعلات.`
  },
  {
    name: 'قصص مهنية',
    keywords: ['قصة مهنية', 'قصة نجاح', 'قصة عمل', 'قصة عن الاجتهاد'],
    answer: `قصة قصيرة: بدأ شخص بعمل بسيط، عمل بانتظام، طوّر مهاراته وحصل على فرصة أفضل بسبب التزامه. الدرس: الاستمرارية تثمر.`
  },
  {
    name: 'تطوير التطبيق',
    keywords: ['تطوير التطبيق', 'تحديث التطبيق', 'هل سيتم تطوير التطبيق'],
    answer: `نعم، ا��تطبيق في تطور مستمر وسيتم إضافة ميزات تدريجيًا في التحديثات القادمة.`
  },
  // جديد: تعليمات "كيفية إنشاء منشور" كما طلبت (فصحى مختصرة)
  {
    name: 'كيفية إنشاء منشور',
    keywords: ['كيفية إنشاء منشور', 'كيف أنشئ منشور', 'انشاء منشور', 'كيفية إنشاء منشور؟', 'كيف انشر منشور'],
    answer: `لإنشاء منشور، اضغط على الحاوية الموجودة في الأعلى والمكتوب فيها 'بماذا تفكر؟'. أدخل نصك، ثم اختر نوع التصنيف المناسب للمنشور، وأخيرًا اضغط على زر النشر لإرسال المنشور.`
  }
];

// ============================================
// تعابير لاكتشاف طلبات الوظائف/التوظيف/السؤال عن المطوّر
// ============================================
const JOB_REQUEST_PATTERNS = [
  /\b(اب?حث|ابغى|اريد|أريد|عايز|أحتاج|أبغى|دورلي|دور لي|دلني)\b.*\b(وظيف(ة|ات)?|عمل|شغل|وظا?ئف)\b/i,
  /\b(وظيف(ة|ات)?|توظيف|ابحث عن موظف|أبحث عن موظفين|توظيف موظفين)\b/i,
  /\b(وظيفة\s+سائق|سائق\s+في|سائق\s+بال?|سواق)\b/i
];

const CREATOR_PATTERNS = [
  /\bمن\s+طورك\b/i,
  /\bمن\s+صنعك\b/i,
  /\bمن\s+انشأك\b/i
];

const JOB_MOOD_PATTERNS = [
  /\bوظيفة\s+على\s+مزاجي\b/i,
  /\bوظيفة\s+عش��ائية\b/i,
  /\brandom\s+job\b/i
];

// ============================================
// مواضيع واجهة التطبيق (تعليمات UI) — نريد أن نُجيب عليها ب LIMITED_REPLY
// لكن سيتم التحقق من LOCAL_RESPONSES أولاً لتفادي حجب التعليمات التي أضفناها.
// ============================================
const APP_INSTRUCTION_PATTERNS = [
  /زر\s*\(\+\)/i,
  /\bبم تفكر\b/i,
  /\bانشئ منشور\b/i,
  /\bانشر\b/i,
  /\bإنشاء منشور\b/i,
  /\bكيفية تسجيل الدخول\b/i,
  /\bكيفية تسجيل الخروج\b/i,
  /\bكيفية إضافة قصة\b/i
];

function normalizeText(t) {
  if (!t) return '';
  return String(t).normalize('NFKC').toLowerCase();
}

function isForbiddenRequest(question) {
  if (!question) return false;
  const q = normalizeText(question);
  for (const re of JOB_REQUEST_PATTERNS) if (re.test(q)) return true;
  return false;
}

function isCreatorQuestion(question) {
  if (!question) return false;
  const q = normalizeText(question);
  for (const re of CREATOR_PATTERNS) if (re.test(q)) return true;
  return false;
}

function isJobMoodRequest(question) {
  if (!question) return false;
  const q = normalizeText(question);
  for (const re of JOB_MOOD_PATTERNS) if (re.test(q)) return true;
  return false;
}

function isAppInstruction(question) {
  if (!question) return false;
  const q = normalizeText(question);
  for (const re of APP_INSTRUCTION_PATTERNS) if (re.test(q)) return true;
  return false;
}

function isChinese(text) {
  if (!text) return false;
  return /[\u4E00-\u9FFF]/.test(text);
}

// ============================================
// بحث محلي مبسّط ضمن LOCAL_RESPONSES
// ============================================
function findLocalAnswer(question) {
  if (!question) return null;
  const q = normalizeText(question);
  for (const entry of LOCAL_RESPONSES) {
    // تحقق في العنوان أو الكلمات المفتاحية
    if (entry.name && q.includes(entry.name.toLowerCase())) return entry.answer;
    for (const kw of entry.keywords || []) {
      if (!kw) continue;
      if (q.includes(String(kw).toLowerCase())) return entry.answer;
    }
  }
  return null;
}

// ============================================
// اختصار الردود
// ============================================
function conciseReply(fullText, maxLines = 6) {
  if (!fullText) return '';
  const lines = fullText.split('\n').map(s => s.trim()).filter(Boolean);
  const selected = lines.slice(0, maxLines);
  let result = selected.join('\n');
  if (lines.length > maxLines) result += '\n...';
  if (result.length > 800) return result.slice(0, 800) + '...';
  return result;
}

// ============================================
// 📡 Main chat handler
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    let { message, conversationHistory } = req.body;
    console.log('�� AI chat:', message);

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    if (!conversationHistory) conversationHistory = [];
    if (!Array.isArray(conversationHistory)) conversationHistory = [];
    conversationHistory = conversationHistory.filter(m => m && m.role && m.content && String(m.content).trim());

    const userMessage = String(message).trim();

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 1) تحقق المحظورات (طلبات وظائف حقيقية)
    if (isForbiddenRequest(userMessage)) {
      const blocked = POLICY_BLOCK_REPLY;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: blocked }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: blocked, source: 'policy_block' }) + '\n\n');
      res.end();
      return;
    }

    // 2) وظيفة على مزاجه -> مثال تدريبي
    if (isJobMoodRequest(userMessage)) {
      const example = `مثال تدريبي لوظيفة (غير حقيقية):
• المسمى: سائق توصيل - مثال تدريبي
• المدينة: الرياض
• المهام: توصيل طرود داخل المدينة، الالتزام بالمواعيد
نصيحة: جهّز سيرة بسيطة (الهاتف، الخبرة، رخصة قيادة).`;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: example }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: example, source: 'job_mood' }) + '\n\n');
      res.end();
      return;
    }

    // 3) سؤال عن المطور
    if (isCreatorQuestion(userMessage)) {
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: CREATOR_REPLY }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: CREATOR_REPLY, source: 'creator' }) + '\n\n');
      res.end();
      return;
    }

    // 4) جرب البحث المحلي داخل الكود (LOCAL_RESPONSES) أولاً
    const local = findLocalAnswer(userMessage);
    if (local) {
      const short = conciseReply(local, 6);
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: short }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: short, source: 'local_kb' }) + '\n\n');
      res.end();
      return;
    }

    // 5) إذا السائل يسأل عن تعليمات الواجهة -> نرجع LIMITED_REPLY كما طلبت
    if (isAppInstruction(userMessage)) {
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: LIMITED_REPLY }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: LIMITED_REPLY, source: 'app_instruction' }) + '\n\n');
      res.end();
      return;
    }

    // 6) لا يوجد شيء محلي - استخدم Ollama كـ fallback مع نفس السياسات
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (let i = Math.max(0, conversationHistory.length - 8); i < conversationHistory.length; i++) {
      const m = conversationHistory[i];
      if (m && m.content && m.role) messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content });
    }
    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        { model: OLLAMA_MODEL, messages, stream: true, options: { temperature: 0.4, num_predict: 300, top_p: 0.9, top_k: 40 } },
        { responseType: 'stream', timeout: 120000, headers: { 'Content-Type': 'application/json' } }
      );

      let fullText = '';

      response.data.on('data', chunk => {
        const lines = String(chunk).split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message && data.message.content) {
              let content = data.message.content;
              if (isChinese(content)) continue;
              fullText += content;
              res.write('data: ' + JSON.stringify({ type: 'chunk', content }) + '\n\n');
            }
            if (data.done) {
              const lowerFull = normalizeText(fullText || '');
              // إذا الناتج يبدو كتعليمات واجهة، رجّع LIMITED_REPLY
              for (const re of APP_INSTRUCTION_PATTERNS) {
                if (re.test(lowerFull)) {
                  res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: LIMITED_REPLY, source: 'policy_limited' }) + '\n\n');
                  res.end();
                  return;
                }
              }
              const short = conciseReply(fullText, 6) || LIMITED_REPLY;
              res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: short, source: 'ollama' }) + '\n\n');
              res.end();
            }
          } catch (e) {
            console.error('stream parse error:', e.message);
          }
        }
      });

      response.data.on('error', err => {
        console.error('stream error:', err.message);
        const errMsg = 'حدث خطأ في الاتصال بخدمة الذكاء الاصطناعي';
        res.write('data: ' + JSON.stringify({ type: 'error', message: errMsg }) + '\n\n');
        res.end();
      });
    } catch (err) {
      console.error('Ollama error:', err.message);
      const errMsg = 'الخدمة غير متاحة حالياً. جرّب لاحقاً.';
      res.write('data: ' + JSON.stringify({ type: 'error', message: errMsg, error: err.message }) + '\n\n');
      res.end();
    }
  } catch (error) {
    console.error('chat handler error:', error.message);
    if (!res.headersSent) res.setHeader('Content-Type', 'text/event-stream');
    const errMsg = 'حدث خطأ غير متوقع';
    res.write('data: ' + JSON.stringify({ type: 'error', message: errMsg, error: error.message }) + '\n\n');
    res.end();
  }
};

// ============================================
// Health check
// ============================================
exports.checkOllamaHealth = async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    res.json({
      success: true,
      message: 'Ollama running',
      model: OLLAMA_MODEL,
      localResponsesCount: LOCAL_RESPONSES.length,
      policiesActive: true,
      status: '✅ جاهز'
    });
  } catch (error) {
    console.error('health check failed:', error.message);
    res.status(503).json({ success: false, message: 'غير متاح', error: error.message });
  }
};
