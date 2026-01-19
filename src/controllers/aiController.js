const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');
const { KNOWLEDGE_BASE, findAnswer } = require('../data/knowledgeBase');

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
- التزم بالسياسات الممنوعة والمحظورات (لا بحث عن وظائف حقيقية، لا اقتراح موظفين، لا كتابة أكواد، لا إنشاء صور/فيديو).
- ردودك تكون واضحة ومختصرة ومهنية.
- إذا سئلت "من طورك؟" رد: "تم تطويري ب��اسطة فريق الأمل – فريق تطبيق مهنتي لي."`;

// ============================================
// ⚠️ سياسات - كلمات ومطابقات
// ============================================
const POLICY_BLOCK_REPLY = 'هذه الميزة غير متوفرة حاليًا، وسيتم إضافتها قريبًا في تحديث قادم.';
const CREATOR_REPLY = 'تم تطويري بواسطة فريق الأمل – فريق تطبيق مهنتي لي.';

// كلمات/عبارات محظورة أو تشير لطلب وظيفة/توظيف
const JOB_REQUEST_PATTERNS = [
  /\b(اب?حث|ابغى|اريد|أريد|عايز|أحتاج|أبغى|دورلي|دور لي|دلني)\b.*\b(وظيف(ة|ات)?|عمل|شغل|وظا?ئف)\b/i,
  /\b(وظيف(ة|ات)?|توظيف|ابحث عن موظف|أبحث عن موظفين|توظيف موظفين)\b/i,
  /\b(وظيفة\s+سائق|سائق\s+في|سائق\s+بال?|سواق)\b/i
];

const CREATOR_PATTERNS = [
  /\bمن\s+طورك\b/i,
  /\bمن\s+صنعك\b/i,
  /\bمن\s+طورني\b/i,
  /\bمن\s+انشأك\b/i
];

const JOB_MOOD_PATTERNS = [
  /\bوظيفة\s+على\s+مزاجي\b/i,
  /\bوظيفة\s+عشوائية\b/i,
  /\brandom\s+job\b/i
];

function normalizeText(t) {
  if (!t) return '';
  return t.normalize('NFKC').toLowerCase();
}

function isForbiddenRequest(question) {
  if (!question) return false;
  const q = normalizeText(question);
  for (const re of JOB_REQUEST_PATTERNS) {
    if (re.test(q)) return true;
  }
  return false;
}

function isCreatorQuestion(question) {
  if (!question) return false;
  const q = normalizeText(question);
  for (const re of CREATOR_PATTERNS) {
    if (re.test(q)) return true;
  }
  return false;
}

function isJobMoodRequest(question) {
  if (!question) return false;
  const q = normalizeText(question);
  for (const re of JOB_MOOD_PATTERNS) {
    if (re.test(q)) return true;
  }
  return false;
}

// ============================================
// ✂️ اختصار الردود - نجعلها تعليمات قصيرة
// ============================================
function conciseReply(fullText, maxLines = 6) {
  if (!fullText) return '';
  // انفصل على الأسطر، خذ أول N أسطر غير فارغة
  const lines = fullText.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return fullText.slice(0, 400);
  const selected = lines.slice(0, maxLines);
  let result = selected.join('\n');
  // إذا كان هناك المزيد، ضف نقطتين
  if (lines.length > maxLines) result += '\n...';
  // ضمان عدم طول مفرط
  if (result.length > 600) return result.slice(0, 600) + '...';
  return result;
}

// ============================================
// 🚫 منع اللغة الصينية (سريع)
function isChinese(text) {
  if (!text) return false;
  const chineseRegex = /[\u4E00-\u9FFF]/g;
  return chineseRegex.test(text);
}

// ============================================
// 📡 Chat with AI - المنطق الرئيسي
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    console.log('════════════════ AI-CHAT ═══════════════');
    console.log('📨 New chat request');
    console.log('════════════════════════════════════════');

    let { message, conversationHistory } = req.body;
    console.log('📝 Message:', message);

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    // تحضير الذاكرة
    if (!conversationHistory) conversationHistory = [];
    if (!Array.isArray(conversationHistory)) conversationHistory = [];
    conversationHistory = conversationHistory.filter(m => m && m.role && m.content && String(m.content).trim());

    const userMessage = String(message).trim();

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 1) تحقق السياسات المحظورة أولاً
    if (isForbiddenRequest(userMessage)) {
      console.log('❌ Policy block detected - job request');
      const blocked = POLICY_BLOCK_REPLY;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: blocked }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: blocked, source: 'policy_block' }) + '\n\n');
      res.end();
      return;
    }

    // 1.b) إذا كان طلب "وظيفة على مزاجه" - لا تعطي وظيفة حقيقية بل مثال تدريبي
    if (isJobMoodRequest(userMessage)) {
      console.log('ℹ️ Job-mood request - return virtual example');
      const example = `مثال تدريبي لوظيفة (غير حقيقية):
• المسمى: سائق توصيل - نموذج تدريبي
• المدينة: الرياض
• المهام: توصيل طرود داخل المدينة، الالتزام بالمواعيد
نصيحة: جهّز سيرة بسيطة (الهاتف، الخبرة، رخصة قيادة).`;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: example }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: example, source: 'job_mood' }) + '\n\n');
      res.end();
      return;
    }

    // 2) سؤال عن الصانع / المطور؟
    if (isCreatorQuestion(userMessage)) {
      console.log('✅ Creator question');
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: CREATOR_REPLY }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: CREATOR_REPLY, source: 'creator' }) + '\n\n');
      res.end();
      return;
    }

    // 3) البحث السريع في Knowledge Base (الأولوية)
    console.log('🔎 Searching KB for matches...');
    const kbAnswer = findAnswer(userMessage);
    if (kbAnswer) {
      console.log('✅ KB matched. Returning concise instruction.');
      const short = conciseReply(kbAnswer, 6);
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: short }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: short, source: 'knowledge_base' }) + '\n\n');
      res.end();
      return;
    }

    // 4) لم يتم العثور في KB -> استخدم Ollama مع ذاكرة السياق
    console.log('⚠️ KB not found -> falling back to Ollama');

    // أرسل حالة كتابة
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');

    // بناء الرسائل المرسلة إلى Ollama
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (let i = Math.max(0, conversationHistory.length - 8); i < conversationHistory.length; i++) {
      const m = conversationHistory[i];
      if (m && m.content && m.role) messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content });
    }
    messages.push({ role: 'user', content: userMessage });

    console.log('🔗 Connecting to Ollama (stream)... messages count:', messages.length);

    try {
      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
          model: OLLAMA_MODEL,
          messages,
          stream: true,
          options: {
            temperature: 0.4,
            num_predict: 400,
            top_p: 0.9,
            top_k: 40
          }
        },
        {
          responseType: 'stream',
          timeout: 120000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      let fullText = '';

      response.data.on('data', chunk => {
        const lines = String(chunk).split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message && data.message.content) {
              let content = data.message.content;
              if (isChinese(content)) {
                console.log('❌ Chinese output blocked');
                continue;
              }
              fullText += content;
              res.write('data: ' + JSON.stringify({ type: 'chunk', content }) + '\n\n');
            }
            if (data.done) {
              // قبل ال��نهاء: اختصر الرد ليكون تعليمات قصيرة
              const short = conciseReply(fullText, 6) || POLICY_BLOCK_REPLY;
              // حفظ في الذاكرة (العميل مسؤول عن إرسال المحادثة لاحقاً)
              res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: short, source: 'ollama' }) + '\n\n');
              res.end();
            }
          } catch (e) {
            // تجاهل السطور المكسورة
            console.error('Parse stream chunk error:', e.message);
          }
        }
      });

      response.data.on('error', err => {
        console.error('Stream error:', err.message);
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
    console.error('Chat handler error:', error.message);
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
      knowledgeBaseLoaded: true,
      topicsCount: Object.keys(KNOWLEDGE_BASE || {}).length,
      policiesActive: true,
      status: '✅ جاهز'
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({
      success: false,
      message: 'غير متاح',
      error: error.message
    });
  }
};
