const express = require('express');
const router = express.Router();
const {
  fetchJobs,
  getCategories,
  getSupportedCountries,
  translateJobText
} = require('../services/externalJobsService');
const { getSupportedLanguages } = require('../services/translationService');

// Middleware للحصول على معلومات المستخدم (اختياري)
const { optionalAuth } = require('../middleware/auth');

/**
 * @desc    البحث عن الوظائف الخارجية مع دعم دولة المستخدم والترجمة
 * @route   GET /api/v1/external-jobs
 * @access  Public
 * @query   country - رمز الدولة (sa, ae, gb, us, de, etc.)
 * @query   category - تصنيف الوظيفة
 * @query   what - كلمات البحث
 * @query   where - الموقع/المدينة
 * @query   page - رقم الصفحة
 * @query   results_per_page - عدد النتائج في الصفحة
 * @query   sort_by - ترتيب النتائج (date, salary, relevance)
 * @query   salary_min - الحد الأدنى للراتب
 * @query   salary_max - الحد الأقصى للراتب
 * @query   contract_type - نوع العقد (permanent, contract)
 * @query   full_time - دوام كامل (1) أو جزئي (0)
 * @query   lang - اللغة المستهدفة للترجمة (ar, en, ur, hi, etc.)
 * 
 * @note    إذا كان المستخدم مسجل دخول، يتم استخدام دولته تلقائياً
 *          الترجمة تتم تلقائياً للغة المحددة (ar افتراضياً)
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      country,
      category,
      what,
      where,
      page,
      results_per_page,
      sort_by,
      salary_min,
      salary_max,
      contract_type,
      full_time,
      lang
    } = req.query;

    // الحصول على دولة المستخدم من الحساب (إذا كان مسجل دخول)
    const userCountry = req.query.user_country || req.headers['x-user-country'] || (req.user?.country) || null;
    
    // الحصول على اللغة المستهدفة
    const targetLang = lang || req.headers['x-target-lang'] || req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'ar';

    const result = await fetchJobs({
      country,
      userCountry,
      category,
      what,
      where,
      page: parseInt(page) || 1,
      results_per_page: parseInt(results_per_page) || 20,
      sort_by,
      salary_min: salary_min ? parseInt(salary_min) : undefined,
      salary_max: salary_max ? parseInt(salary_max) : undefined,
      contract_type,
      full_time: full_time !== undefined ? full_time === '1' || full_time === 'true' : undefined,
      lang: targetLang
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[ExternalJobs] Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'حدث خطأ أثناء جلب الوظائف'
    });
  }
});

/**
 * @desc    جلب الوظائف حسب دولة المستخدم المسجل
 * @route   GET /api/v1/external-jobs/for-me
 * @access  Public (يفضل أن يكون المستخدم مسجل دخول)
 * @query   user_country - دولة المستخدم (إذا لم يكن مسجل دخول)
 * @query   lang - اللغة المستهدفة للترجمة
 */
router.get('/for-me', async (req, res, next) => {
  try {
    const {
      category,
      what,
      where,
      page,
      results_per_page,
      lang
    } = req.query;

    const userCountry = req.query.user_country || req.headers['x-user-country'] || (req.user?.country) || null;
    const targetLang = lang || req.headers['x-target-lang'] || 'ar';

    if (!userCountry) {
      const result = await fetchJobs({
        country: 'sa',
        category,
        what,
        where,
        page: parseInt(page) || 1,
        results_per_page: parseInt(results_per_page) || 20,
        sort_by: 'date',
        lang: targetLang
      });
      
      return res.status(200).json({
        ...result,
        note: 'تم جلب الوظائف من السعودية كافتراضي. حدد دولتك للحصول على نتائج أفضل.'
      });
    }

    const result = await fetchJobs({
      userCountry,
      category,
      what,
      where,
      page: parseInt(page) || 1,
      results_per_page: parseInt(results_per_page) || 20,
      sort_by: 'date',
      lang: targetLang
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[ExternalJobs] Error in for-me:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'حدث خطأ أثناء جلب الوظائف'
    });
  }
});

/**
 * @desc    ترجمة نص وظيفة
 * @route   POST /api/v1/external-jobs/translate
 * @access  Public
 * @body    text - النص المراد ترجمته
 * @body    targetLang - اللغة المستهدفة
 * @body    sourceLang - اللغة المصدر (اختياري، auto افتراضياً)
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang = 'ar', sourceLang = 'auto' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'النص مطلوب للترجمة'
      });
    }

    const translatedText = await translateJobText(text, targetLang, sourceLang);

    res.status(200).json({
      success: true,
      original: text,
      translated: translatedText,
      sourceLang,
      targetLang
    });
  } catch (error) {
    console.error('[ExternalJobs] Translation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل في الترجمة'
    });
  }
});

/**
 * @desc    جلب التصنيفات المتاحة (مع الترجمة العربية)
 * @route   GET /api/v1/external-jobs/categories
 * @access  Public
 */
router.get('/categories', (req, res) => {
  const result = getCategories();
  res.status(200).json(result);
});

/**
 * @desc    جلب الدول المدعومة (مرتبة حسب الأولوية - الخليج أولاً)
 * @route   GET /api/v1/external-jobs/countries
 * @access  Public
 */
router.get('/countries', (req, res) => {
  const result = getSupportedCountries();
  res.status(200).json(result);
});

/**
 * @desc    جلب اللغات المدعومة للترجمة
 * @route   GET /api/v1/external-jobs/languages
 * @access  Public
 */
router.get('/languages', (req, res) => {
  const languages = getSupportedLanguages();
  res.status(200).json({
    success: true,
    languages
  });
});

module.exports = router;
