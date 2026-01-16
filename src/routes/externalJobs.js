const express = require('express');
const router = express.Router();
const {
  fetchJobs,
  getCategories,
  getSupportedCountries
} = require('../services/externalJobsService');

// Middleware للحصول على معلومات المستخدم (اختياري)
const { optionalAuth } = require('../middleware/auth');

/**
 * @desc    البحث عن الوظائف الخارجية مع دعم دولة المستخدم
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
 * 
 * @note    إذا كان المستخدم مسجل دخول، يتم استخدام دولته تلقائياً
 *          إذا لم تكن الدولة مدعومة، يتم جلب وظائف مختلطة
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
      full_time
    } = req.query;

    // الحصول على دولة المستخدم من الحساب (إذا كان مسجل دخول)
    // يمكن تمريرها من الـ Frontend أيضاً عبر header أو query
    const userCountry = req.query.user_country || req.headers['x-user-country'] || (req.user?.country) || null;

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
      full_time: full_time !== undefined ? full_time === '1' || full_time === 'true' : undefined
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
 * 
 * @note    هذا الـ endpoint مخصص لعرض الوظائف المناسبة للمستخدم
 *          يجلب الوظائف من دولته أولاً، وإذا لم تتوفر يجلب مختلط
 */
router.get('/for-me', async (req, res, next) => {
  try {
    const {
      category,
      what,
      where,
      page,
      results_per_page
    } = req.query;

    // الحصول على دولة المستخدم
    const userCountry = req.query.user_country || req.headers['x-user-country'] || (req.user?.country) || null;

    if (!userCountry) {
      // إذا لم يتم تحديد الدولة، نجلب من دول الخليج افتراضياً
      const result = await fetchJobs({
        country: 'sa', // السعودية كافتراضي
        category,
        what,
        where,
        page: parseInt(page) || 1,
        results_per_page: parseInt(results_per_page) || 20,
        sort_by: 'date'
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
      sort_by: 'date'
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

module.exports = router;
