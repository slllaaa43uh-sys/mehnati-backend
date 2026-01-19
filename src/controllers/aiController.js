const axios = require('axios');
const Post = require('../models/Post');
const ExternalJob = require('../models/ExternalJob');

/*
  تحسين المطابقة الدلالية لردود LOCAL_RESPONSES:
  - تبسيط اللغة العربية (إزالة التشكيل، تطبيع الألف والياء، ...)
  - بناء فهرس محلي (مجموعات كلمات وثنائيات) عند الإقلاع
  - حساب درجة تشابه دلالي بسيطة (Dice / bigram) بين سؤال المستخدم وكل مدخل
  - اختيار أفضل مدخل إذا تجاوز عتبة، وإعادة صياغة خفيفة قبل الإرجاع
  - إذا لم يكن هناك تطابق واضح، نرجع fallback أو نستخدم Ollama كـ fallback (خياري)
  - باقي سياسات الحظر والردود الثابتة محفوظة
*/

// ============================================
// إعدادات Ollama
// ============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';
const USE_MODEL_SELECTION = (process.env.USE_MODEL_SELECTION || 'false') === 'true'; // خيار ثانوي لاستخدام النموذج للاختيار الدلالي عند غموض
const MODEL_SELECTION_TIMEOUT = 10000; // ms

console.log('🔧 [INIT] Ollama Configuration:');
console.log(`   Base URL: ${OLLAMA_BASE_URL}`);
console.log(`   Model: ${OLLAMA_MODEL}`);
console.log(`   Model-based topic selection: ${USE_MODEL_SELECTION}`);

// ============================================
// السياسات والردود الثابتة
// ============================================
const SYSTEM_PROMPT = `أنت مساعد ذكي مهني لتطبيق "مهنتي لي". اللغة: العربية الفصحى. التزم بالسياسات الممنوعة.`;
const POLICY_BLOCK_REPLY = 'هذه الميزة غير متوفرة حاليًا، وسيتم إضافتها قريبًا في تحديث قادم.';
const CREATOR_REPLY = 'تم تطويري بواسطة فريق الأمل – فريق تطبيق مهنتي لي.';
const LIMITED_REPLY = 'ليس لدي أي معلومة في هذا المجال حالياً. تطويري محدود الآن وسيتم تحديثي في المستقبل.';

// ============================================
// LOCAL_RESPONSES - الردود المضمّنة (قابلة للتعديل)
// ============================================
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
    answer: `ميزة تمييز الإعلان تساعد على زيادة ظهور إعلانك أمام المهتمين بسرعة، وتحسّن فرص التفاعل، وتبرز إعلانك في الصفحة لتلفت الانتباه.`
  },
  {
    name: 'كيفية إنشاء منشور',
    keywords: ['كيفية إنشاء منشور', 'كيف أنشئ منشور', 'انشاء منشور', 'كيف انشر منشور', 'بماذا تفكر'],
    answer: `لإنشاء منشور، اضغط على الحاوية الموجودة في الأعلى والمكتوب فيها 'بماذا تفكر؟'. أدخل نصك، ثم اختر نوع التصنيف المناسب للمنشور، وأخيرًا اضغط على زر النشر لإرسال المنشور.`
  },
  {
    name: 'الوظائف العالمية - سبب ظهور اللغة الإنجليزية',
    keywords: ['الوظائف العالمية', 'لماذا تظهر الوظائف بالانجليزية', 'وظائف باللغة الإنجليزية', 'global jobs', 'وظائف عالمية'],
    answer: `تظهر بعض الوظائف باللغة الإنجليزية لأن المصدر الأصلي لها باللغة الإنجليزية. يمكنك استخدام ميزة الترجمة في التطبيق لعرضها بالعربية عندما تتوفر.`
  },
  {
    name: 'صفحة الوظائف المستعجلة',
    keywords: ['صفحة الوظائف المستعجلة', 'ما هي صفحة الوظائف المستعجلة', 'ماذا تقدم صفحة الوظائف المستعجلة', 'الوظائف المستعجلة'],
    answer: `صفحة الوظائف المستعجلة تعرض فرصاً فورية بعقود مؤقتة أو دفع يومي؛ الهدف سرعة الوصول والتواصل المباشر مع أصحاب العمل.`
  },
  {
    name: 'النصب والاحتيال - أمن التطبيق',
    keywords: ['نصب', 'احتيال', 'هل هناك نصب', 'هل الوظائف مزيفة', 'وظائف مزيفة'],
    answer: `اطمئن، التطبيق يوفر وظائف حقيقية لكن تجنب دفع أي مبالغ، وتحقق من هوية المعلن، واستخدم قنوات التطبيق الرسمية فقط.`
  },
  {
    name: 'كيفية تسجيل الخروج',
    keywords: ['كيفية تسجيل الخروج', 'كيف اسجل الخروج', 'تسجيل الخروج', 'logout'],
    answer: `1) ادخل إلى الإعدادات. 2) اضغط على الحساب (اسمك/بريدك). 3) افتح الملف الشخصي. 4) اضغط على أيقونة ثلاث النقاط ⋮ في الزاوية العليا. 5) اختر 'تسجيل الخروج'.`
  }
];

// ============================================
// أنماط الكشف عن طلبات ممنوعة / خاصة
// ============================================
const JOB_REQUEST_PATTERNS = [
  /\b(اب?حث|ابغى|اريد|أريد|عايز|أحتاج|أبغى|دورلي|دور لي|دلني)\b.*\b(وظيف(ة|ات)?|عمل|شغل|وظا?ئف)\b/i,
  /\b(ابحث عن موظف|أبحث عن موظفين|توظيف)\b/i,
  /\b(وظيفة\s+سائق|سائق\s+في|سائق\s+بال?)\b/i
];

const CREATOR_PATTERNS = [
  /\bمن\s+طورك\b/i,
  /\bمن\s+صنعك\b/i,
  /\bمن\s+انشأك\b/i
];

const JOB_MOOD_PATTERNS = [
  /\bوظيفة\s+على\s+مزاجي\b/i,
  /\bوظيفة\s+عشوائية\b/i
];

const APP_INSTRUCTION_PATTERNS = [
  /زر\s*\(\+\)/i,
  /\bبم تفكر\b/i,
  /\bانشئ منشور\b/i,
  /\bانشر\b/i,
  /\bإنشاء منشور\b/i
];

// ============================================
// أدوات تطبيع اللغة العربية (بسيطة)
// ============================================
function removeDiacritics(text) {
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '');
}
function normalizeAlefYaaTa(text) {
  return text
    .replace(/[أإآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه');
}
function normalizeText(t) {
  if (!t) return '';
  let s = String(t);
  s = s.replace(/[\u2000-\u206F]|[^\w\s\u0600-\u06FF]/g, ' '); // إزالة علامات ترقيم غير العربية والإنجليزية
  s = removeDiacritics(s);
  s = normalizeAlefYaaTa(s);
  s = s.toLowerCase();
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
const ARABIC_STOPWORDS = new Set([
  // قائمة مختصرة شائعة - يمكن توسيعها
  'في','من','على','و','يا','هل','مع','عن','إلى','الى','ما','لم','لا','هذا','هذه','ذلك','ذلكم','قد','ثم','أن','أو','لكم','لك','عن','بعض','كل','هو','هي'
]);

function tokenize(text) {
  if (!text) return [];
  const n = normalizeText(text);
  if (!n) return [];
  return n.split(' ').filter(tok => tok && !ARABIC_STOPWORDS.has(tok));
}
function makeBigrams(tokens) {
  const bigrams = new Set();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(tokens[i] + ' ' + tokens[i + 1]);
  }
  return bigrams;
}

// ============================================
// بناء الفهرس المحلي عند الإقلاع
// ============================================
const LOCAL_INDEX = []; // كل عنصر: { entry, tokenSet, bigramSet, tokenCount, bigramCount }
function buildLocalIndex() {
  for (const entry of LOCAL_RESPONSES) {
    const text = [entry.name || '', ...(entry.keywords || []), entry.answer || ''].join(' ');
    const tokens = tokenize(text);
    const tokenSet = new Set(tokens);
    const bigramSet = makeBigrams(tokens);
    LOCAL_INDEX.push({
      entry,
      tokenSet,
      bigramSet,
      tokenCount: tokenSet.size || 1,
      bigramCount: bigramSet.size || 1
    });
  }
  console.log(`✅ Local index built (${LOCAL_INDEX.length} entries).`);
}
buildLocalIndex();

// ============================================
// مقاييس التشابه البسيطة (Dice coefficient)
// ============================================
function diceCoefficient(setA, setB, countA, countB) {
  if (!setA || !setB) return 0;
  let common = 0;
  for (const v of setA) if (setB.has(v)) common++;
  return (2 * common) / (countA + countB);
}

function semanticScoreForEntry(userTokens, userBigrams, idxEntry) {
  const tokenDice = diceCoefficient(new Set(userTokens), idxEntry.tokenSet, userTokens.length || 1, idxEntry.tokenCount);
  const bigramDice = diceCoefficient(userBigrams, idxEntry.bigramSet, userBigrams.size || 1, idxEntry.bigramCount);
  // وزن أكبر للكلمات المفردة، لكن ثنائية تساعد في السياق
  const alpha = 0.65;
  return alpha * tokenDice + (1 - alpha) * bigramDice;
}

// ============================================
// البحث عن أفضل مدخل دلالي
// ============================================
async function findBestLocalEntrySemantic(userMessage) {
  const tokens = tokenize(userMessage);
  const tokenSet = new Set(tokens);
  const bigrams = makeBigrams(tokens);

  let best = null;
  let bestScore = 0;
  for (const idxEntry of LOCAL_INDEX) {
    const score = semanticScoreForEntry(tokens, bigrams, idxEntry);
    // console.log('score', idxEntry.entry.name, score.toFixed(3));
    if (score > bestScore) {
      bestScore = score;
      best = idxEntry.entry;
    }
  }

  // عتبات قابلة للتعديل:
  // إذا الدرجة أعلى من 0.20 نأخذها مباشرة.
  if (bestScore >= 0.20) return { entry: best, score: bestScore };

  // إذا ضعيفة لكن النموذج مفعل، نطلب من النموذج اختيار الموضوع الأفضل (اختياري)
  if (USE_MODEL_SELECTION) {
    try {
      const modelChoice = await askModelToSelectTopic(userMessage);
      if (modelChoice) {
        const found = LOCAL_RESPONSES.find(e => normalizeText(e.name) === normalizeText(modelChoice) || (e.keywords || []).some(k => normalizeText(k) === normalizeText(modelChoice)));
        if (found) return { entry: found, score: 0.18 };
      }
    } catch (e) {
      console.error('Model selection failed:', e.message);
    }
  }

  // إذا وصلنا هنا: لا تطابق كافٍ
  return { entry: null, score: bestScore };
}

// ============================================
// إعادة صياغة آمنة (مقدمة + مقتطف مختصر) - لا نسخ حرفي
// ============================================
function rephraseEntryForUser(entry, userMessage) {
  if (!entry) return null;
  const lines = (entry.answer || '').split('\n').map(s => s.trim()).filter(Boolean);
  const firstSentences = lines.slice(0, 3).join(' ');
  // مقدمة تربط السؤال بموضوع القاعدة
  const intro = `بناءً على سؤالك عن "${entry.name}"، إليك توضيح موجز:`;
  // تركيب نهائي مختصر وبسيط
  let body = firstSentences;
  // قص زائد إن لزم
  const result = `${intro}\n${body}`;
  return result.length > 1000 ? result.slice(0, 1000) + '...' : result;
}

// ============================================
// (اختياري) استخدم النموذج لطلب اختيار الموضوع الأفضل
// - نرسل قائمة أسماء المواضيع الفرعية فقط ونطلب من النموذج طابق واحد
// - هذه الوظيفة مفيدة فقط إن تم تفعيل USE_MODEL_SELECTION=true
// ============================================
async function askModelToSelectTopic(userMessage) {
  const topicNames = LOCAL_RESPONSES.map(r => r.name).slice(0, 40); // تحديد عدد معقول
  const system = `أنت مساعد مصنّف. لديك قائمة مواضيع خدمة المستخدم التالية (أجب باسم الموضوع الأنسب فقط أو "NONE" إذا لا يوجد تطابق):\n${topicNames.join('\n')}\n\nقواعد:\n- اقرأ سؤال المستخدم حرفيًا.\n- اختر أفضل موضوع واحد من القائمة يتطابق مع قصد المستخدم.\n- أجب فقط باسم الموضوع كما يظهر بالقائمة أو اكتب NONE.`;
  const user = `السؤال: ${userMessage}`;
  try {
    const resp = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: false,
        options: { temperature: 0.0, num_predict: 200 }
      },
      { timeout: MODEL_SELECTION_TIMEOUT, headers: { 'Content-Type': 'application/json' } }
    );
    // بعض إصدارات Ollama ترجع النص في resp.data; تأكد من البنية:
    if (resp && resp.data) {
      const out = (resp.data || {}).response || resp.data;
      // حاول استخلاص نص واضح
      const text = typeof out === 'string' ? out.trim() : (out?.[0]?.content || '');
      if (!text) return null;
      const cleaned = text.split('\n').map(l => l.trim()).find(Boolean);
      if (!cleaned) return null;
      if (cleaned.toUpperCase() === 'NONE') return null;
      return cleaned;
    }
  } catch (err) {
    console.error('askModelToSelectTopic error:', err.message);
    return null;
  }
  return null;
}

// ============================================
// دوال كشف الأنواع الخاصة (سياسات)
// ============================================
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
// Handler الرئيسي للمحادثة
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    let { message, conversationHistory } = req.body;
    console.log('📨 AI chat:', message);

    if (!message || !String(message).trim()) {
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

    // 1) سياسات: منع طلبات وظائف حقيقية
    if (isForbiddenRequest(userMessage)) {
      console.log('❌ Policy block - job request');
      const blocked = POLICY_BLOCK_REPLY;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: blocked }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: blocked, source: 'policy_block' }) + '\n\n');
      res.end();
      return;
    }

    // 2) سؤال عن المطور؟
    if (isCreatorQuestion(userMessage)) {
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: CREATOR_REPLY }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: CREATOR_REPLY, source: 'creator' }) + '\n\n');
      res.end();
      return;
    }

    // 3) "وظيفة على مزاجه" -> مثال تدريبي
    if (isJobMoodRequest(userMessage)) {
      const example = `مثال تدريبي لوظيفة (غير حقيقية): • سائق توصيل - الرياض. المهام: توصيل طرود، الالتزام بالمواعيد. نصيحة: جهز سيرة بسيطة ورقم للتواصل.`;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: example }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: example, source: 'job_mood' }) + '\n\n');
      res.end();
      return;
    }

    // 4) محاولة المطابقة الدلالية المحلية أولاً
    const { entry: bestEntry, score } = await findBestLocalEntrySemantic(userMessage);
    if (bestEntry) {
      console.log(`✅ Local semantic match: ${bestEntry.name} (score=${score.toFixed(3)})`);
      const rephrased = rephraseEntryForUser(bestEntry, userMessage) || bestEntry.answer || LIMITED_REPLY;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: rephrased }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: rephrased, source: 'local_semantic' }) + '\n\n');
      res.end();
      return;
    }

    // 5) إذا لم يوجد تطابق محلي كافٍ -> تحقق إذا السائل طالب تعليمات واجهة (نرجع LIMITED_REPLY)
    if (isAppInstruction(userMessage)) {
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: LIMITED_REPLY }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: LIMITED_REPLY, source: 'app_instruction' }) + '\n\n');
      res.end();
      return;
    }

    // 6) لم نجد تطابق محلي - نرجع ردًا عامًا ودودًا يشرح الخيارات، أو نستخدم Ollama كـ fallback إن أردنا
    const fallback = `لم أجد تطابقًا دقيقًا في المعلومات المتاحة. وضّح سؤالك أو جرّب صياغة أخرى؛ أستطيع إرشادك خطوة بخطوة أو تقديم نصيحة مهنية قريبة من سؤالك.`;
    res.write('data: ' + JSON.stringify({ type: 'chunk', content: fallback }) + '\n\n');
    res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: fallback, source: 'fallback' }) + '\n\n');
    res.end();
    return;

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
      localResponsesCount: LOCAL_RESPONSES.length,
      policiesActive: true,
      status: '✅ جاهز'
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({ success: false, message: 'غير متاح', error: error.message });
  }
};
