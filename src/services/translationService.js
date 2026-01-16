/**
 * ============================================
 * خدمة الترجمة المجانية - Free Translation Service
 * ============================================
 * 
 * تستخدم مكتبة @vitalets/google-translate-api
 * مجانية 100% بدون API Key
 */

const { translate } = require('@vitalets/google-translate-api');

// كاش للترجمات لتجنب تكرار الطلبات
const translationCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ساعة

// اللغات المدعومة
const SUPPORTED_LANGUAGES = {
  'ar': 'العربية',
  'en': 'English',
  'zh': '中文',
  'ur': 'اردو',
  'hi': 'हिन्दी',
  'ne': 'नेपाली',
  'bn': 'বাংলা',
  'tr': 'Türkçe',
  'ru': 'Русский',
  'am': 'አማርኛ',
  'so': 'Soomaali',
  'fr': 'Français',
  'sw': 'Kiswahili',
  'es': 'Español',
  'it': 'Italiano',
  'pt': 'Português',
  'ja': '日本語',
  'ko': '한국어',
  'fa': 'فارسی',
  'de': 'Deutsch',
  'nl': 'Nederlands',
  'pl': 'Polski',
  'id': 'Bahasa Indonesia',
  'ms': 'Bahasa Melayu',
  'th': 'ไทย',
  'vi': 'Tiếng Việt',
  'tl': 'Filipino'
};

/**
 * إنشاء مفتاح الكاش
 */
const getCacheKey = (text, targetLang, sourceLang = 'auto') => {
  return `${sourceLang}:${targetLang}:${text.substring(0, 100)}`;
};

/**
 * تنظيف الكاش القديم
 */
const cleanCache = () => {
  if (translationCache.size > CACHE_MAX_SIZE) {
    const now = Date.now();
    for (const [key, value] of translationCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        translationCache.delete(key);
      }
    }
    if (translationCache.size > CACHE_MAX_SIZE * 0.8) {
      const entries = Array.from(translationCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, Math.floor(entries.length / 2));
      toDelete.forEach(([key]) => translationCache.delete(key));
    }
  }
};

/**
 * ترجمة نص باستخدام Google Translate المجاني
 * @param {string} text - النص المراد ترجمته
 * @param {string} targetLang - اللغة المستهدفة
 * @param {string} sourceLang - اللغة المصدر (auto للكشف التلقائي)
 * @returns {Promise<string>} - النص المترجم
 */
const translateText = async (text, targetLang = 'ar', sourceLang = 'auto') => {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // إذا كانت اللغة المصدر = اللغة المستهدفة، لا حاجة للترجمة
  if (sourceLang === targetLang) {
    return text;
  }

  // التحقق من الكاش
  const cacheKey = getCacheKey(text, targetLang, sourceLang);
  if (translationCache.has(cacheKey)) {
    const cached = translationCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Translation] Cache hit for:', text.substring(0, 30));
      return cached.translation;
    }
  }

  try {
    console.log('[Translation] Translating to', targetLang, ':', text.substring(0, 50));
    
    const options = {
      to: targetLang
    };
    
    // إضافة اللغة المصدر إذا لم تكن auto
    if (sourceLang && sourceLang !== 'auto') {
      options.from = sourceLang;
    }

    const result = await translate(text, options);

    if (result && result.text) {
      // حفظ في الكاش
      cleanCache();
      translationCache.set(cacheKey, {
        translation: result.text,
        timestamp: Date.now()
      });
      
      console.log('[Translation] Success:', result.text.substring(0, 50));
      return result.text;
    }

    return text;
  } catch (error) {
    console.error('[TranslationService] Error:', error.message);
    return text; // إرجاع النص الأصلي عند الخطأ
  }
};

/**
 * ترجمة نصوص متعددة دفعة واحدة
 * @param {Array<string>} texts - مصفوفة النصوص
 * @param {string} targetLang - اللغة المستهدفة
 * @param {string} sourceLang - اللغة المصدر
 * @returns {Promise<Array<string>>} - مصفوفة النصوص المترجمة
 */
const translateBatch = async (texts, targetLang = 'ar', sourceLang = 'auto') => {
  // ترجمة بالتتابع لتجنب الحظر
  const results = [];
  for (const text of texts) {
    const translated = await translateText(text, targetLang, sourceLang);
    results.push(translated);
    // تأخير صغير بين الطلبات لتجنب الحظر
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
};

/**
 * ترجمة كائن الوظيفة بالكامل
 * @param {Object} job - كائن الوظيفة
 * @param {string} targetLang - اللغة المستهدفة
 * @returns {Promise<Object>} - الوظيفة مع الترجمات
 */
const translateJob = async (job, targetLang = 'ar') => {
  try {
    // إذا كانت اللغة المستهدفة إنجليزية، لا حاجة للترجمة
    if (targetLang === 'en') {
      return job;
    }

    // استخراج النصوص للترجمة
    const titleEn = typeof job.title === 'string' ? job.title : (job.title?.en || job.title?.display || '');
    const descEn = typeof job.description === 'string' ? job.description : (job.description?.en || job.description?.display || '');

    // ترجمة العنوان والوصف
    const [translatedTitle, translatedDesc] = await translateBatch(
      [titleEn, descEn.substring(0, 500)],
      targetLang,
      'en'
    );

    // تحديث الكائن
    if (typeof job.title === 'object') {
      job.title[targetLang] = translatedTitle;
      job.title.display = translatedTitle;
    } else {
      job.title = {
        en: titleEn,
        [targetLang]: translatedTitle,
        display: translatedTitle
      };
    }

    if (typeof job.description === 'object') {
      job.description[targetLang] = translatedDesc;
      job.description.display = translatedDesc;
    } else {
      job.description = {
        en: descEn,
        [targetLang]: translatedDesc,
        display: translatedDesc
      };
    }

    return job;
  } catch (error) {
    console.error('[TranslationService] Error translating job:', error.message);
    return job;
  }
};

/**
 * ترجمة قائمة وظائف
 * @param {Array<Object>} jobs - قائمة الوظائف
 * @param {string} targetLang - اللغة المستهدفة
 * @returns {Promise<Array<Object>>} - الوظائف مع الترجمات
 */
const translateJobs = async (jobs, targetLang = 'ar') => {
  if (targetLang === 'en') {
    return jobs;
  }

  const results = [];
  for (const job of jobs) {
    const translated = await translateJob(job, targetLang);
    results.push(translated);
  }

  return results;
};

/**
 * الحصول على اللغات المدعومة
 */
const getSupportedLanguages = () => {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code,
    name
  }));
};

/**
 * التحقق من دعم اللغة
 */
const isLanguageSupported = (langCode) => {
  return SUPPORTED_LANGUAGES.hasOwnProperty(langCode);
};

module.exports = {
  translateText,
  translateBatch,
  translateJob,
  translateJobs,
  getSupportedLanguages,
  isLanguageSupported,
  SUPPORTED_LANGUAGES
};
