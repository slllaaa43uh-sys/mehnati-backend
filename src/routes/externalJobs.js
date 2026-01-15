const express = require('express');
const router = express.Router();
const {
  fetchJobs,
  getCategories,
  getSupportedCountries
} = require('../services/externalJobsService');

/**
 * @desc    البحث عن الوظائف الخارجية
 * @route   GET /api/v1/external-jobs
 * @access  Public
 * @query   country - رمز الدولة (gb, us, de, etc.)
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

    const result = await fetchJobs({
      country,
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
 * @desc    جلب التصنيفات المتاحة
 * @route   GET /api/v1/external-jobs/categories
 * @access  Public
 */
router.get('/categories', (req, res) => {
  const result = getCategories();
  res.status(200).json(result);
});

/**
 * @desc    جلب الدول المدعومة
 * @route   GET /api/v1/external-jobs/countries
 * @access  Public
 */
router.get('/countries', (req, res) => {
  const result = getSupportedCountries();
  res.status(200).json(result);
});

module.exports = router;
