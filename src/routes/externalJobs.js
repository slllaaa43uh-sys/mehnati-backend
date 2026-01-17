/**
 * ============================================
 * Routes الوظائف الخارجية - JSearch API
 * ============================================
 */

const express = require('express');
const router = express.Router();
const {
  getJobs,
  getJobById,
  recordClick,
  getStats,
  fetchAndSaveJobs
} = require('../services/externalJobsService');
const { runManually } = require('../cron/externalJobsCron');

/**
 * @desc    جلب الوظائف الخارجية من قاعدة البيانات
 * @route   GET /api/v1/external-jobs
 * @access  Public
 * @query   page - رقم الصفحة (افتراضي: 1)
 * @query   limit - عدد النتائج (افتراضي: 20)
 * @query   country - الدولة
 * @query   city - المدينة
 * @query   employmentType - نوع التوظيف (FULLTIME, PARTTIME, etc.)
 * @query   isRemote - عمل عن بعد (true/false)
 * @query   search - بحث نصي
 */
router.get('/', async (req, res) => {
  try {
    const result = await getJobs({
      page: req.query.page,
      limit: req.query.limit,
      country: req.query.country,
      city: req.query.city,
      employmentType: req.query.employmentType,
      isRemote: req.query.isRemote,
      search: req.query.search
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الوظائف'
    });
  }
});

/**
 * @desc    جلب وظيفة واحدة بالمعرف
 * @route   GET /api/v1/external-jobs/:jobId
 * @access  Public
 */
router.get('/:jobId', async (req, res) => {
  try {
    const result = await getJobById(req.params.jobId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الوظيفة'
    });
  }
});

/**
 * @desc    تسجيل نقرة على رابط التقديم
 * @route   POST /api/v1/external-jobs/:jobId/click
 * @access  Public
 */
router.post('/:jobId/click', async (req, res) => {
  try {
    const result = await recordClick(req.params.jobId);
    res.status(200).json(result);
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ'
    });
  }
});

/**
 * @desc    إحصائيات الوظائف
 * @route   GET /api/v1/external-jobs/admin/stats
 * @access  Public (يفضل حمايته لاحقاً)
 */
router.get('/admin/stats', async (req, res) => {
  try {
    const result = await getStats();
    res.status(200).json(result);
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ'
    });
  }
});

/**
 * @desc    تشغيل جلب الوظائف يدوياً (للاختبار)
 * @route   POST /api/v1/external-jobs/admin/fetch
 * @access  Public (يفضل حمايته لاحقاً)
 */
router.post('/admin/fetch', async (req, res) => {
  try {
    const query = req.body.query || 'وظائف في السعودية';
    
    // تشغيل في الخلفية
    res.status(202).json({
      success: true,
      message: 'تم بدء جلب الوظائف في الخلفية'
    });

    // تشغيل الجلب
    await fetchAndSaveJobs(query);
    
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
    // لا نرسل رد لأننا أرسلنا 202 بالفعل
  }
});

/**
 * @desc    تشغيل Cron يدوياً
 * @route   POST /api/v1/external-jobs/admin/run-cron
 * @access  Public (يفضل حمايته لاحقاً)
 */
router.post('/admin/run-cron', async (req, res) => {
  try {
    res.status(202).json({
      success: true,
      message: 'تم بدء Cron Job في الخلفية'
    });

    await runManually();
    
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
  }
});

module.exports = router;
