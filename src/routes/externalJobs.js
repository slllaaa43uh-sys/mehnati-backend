/**
 * ============================================
 * Routes الوظائف الخارجية - JSearch API
 * ============================================
 * 
 * التحديث الجديد: جلب الوظائف مباشرة من JSearch API
 * عند كل طلب وتخزينها في قاعدة البيانات تلقائياً
 */

const express = require('express');
const router = express.Router();
const {
  getJobs,
  getJobsLive,
  getJobById,
  recordClick,
  getStats,
  fetchAndSaveJobs,
  clearCache,
  refreshJobMedia,
  refreshAllJobsMedia,
  fixJobsWithoutMedia
} = require('../services/externalJobsService');
const { runManually } = require('../cron/externalJobsCron');

/**
 * @desc    جلب الوظائف الخارجية مباشرة من JSearch API
 * @route   GET /api/v1/external-jobs
 * @access  Public
 * @query   page - رقم الصفحة (افتراضي: 1)
 * @query   limit - عدد النتائج (افتراضي: 10)
 * @query   search - استعلام البحث (افتراضي: jobs in Saudi Arabia)
 * 
 * 🚀 الجديد: يجلب الوظائف مباشرة من JSearch API ويخزنها في قاعدة البيانات
 */
router.get('/', async (req, res) => {
  try {
    // استخدام الدالة الجديدة التي تجلب مباشرة من JSearch
    const result = await getJobsLive({
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      search: req.query.search || 'jobs in Saudi Arabia'
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الوظائف',
      jobs: []
    });
  }
});

/**
 * @desc    جلب الوظائف من قاعدة البيانات فقط (بدون JSearch)
 * @route   GET /api/v1/external-jobs/db
 * @access  Public
 * @query   page - رقم الصفحة
 * @query   limit - عدد النتائج
 * @query   country - الدولة
 * @query   city - المدينة
 * @query   employmentType - نوع التوظيف
 * @query   isRemote - عمل عن بعد
 * @query   search - بحث نصي
 */
router.get('/db', async (req, res) => {
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
      message: 'حدث خطأ أثناء جلب الوظائف من قاعدة البيانات'
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
 * @desc    مسح الكاش
 * @route   POST /api/v1/external-jobs/admin/clear-cache
 * @access  Public (يفضل حمايته لاحقاً)
 */
router.post('/admin/clear-cache', async (req, res) => {
  try {
    clearCache();
    res.status(200).json({
      success: true,
      message: 'تم مسح الكاش بنجاح'
    });
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
    
    res.status(202).json({
      success: true,
      message: 'تم بدء جلب الوظائف في الخلفية'
    });

    await fetchAndSaveJobs(query);
    
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
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

/**
 * @desc    تحديث وسائط وظيفة واحدة
 * @route   POST /api/v1/external-jobs/:jobId/refresh-media
 * @access  Public (يفضل حمايته لاحقاً)
 */
router.post('/:jobId/refresh-media', async (req, res) => {
  try {
    const result = await refreshJobMedia(req.params.jobId);
    res.status(200).json(result);
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث الوسائط'
    });
  }
});

/**
 * @desc    تحديث وسائط جميع الوظائف (لإصلاح الصور المفقودة)
 * @route   POST /api/v1/external-jobs/admin/refresh-all-media
 * @access  Public (يفضل حمايته لاحقاً)
 */
router.post('/admin/refresh-all-media', async (req, res) => {
  try {
    res.status(202).json({
      success: true,
      message: 'تم بدء تحديث الوسائط في الخلفية'
    });

    await refreshAllJobsMedia();
    
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
  }
});

/**
 * @desc    إصلاح الوظائف التي لا تحتوي على صور
 * @route   POST /api/v1/external-jobs/admin/fix-missing-media
 * @access  Public (يفضل حمايته لاحقاً)
 */
router.post('/admin/fix-missing-media', async (req, res) => {
  try {
    console.log('[ExternalJobs Route] Starting fix for jobs without media...');
    
    res.status(202).json({
      success: true,
      message: 'تم بدء إصلاح الوظائف بدون صور في الخلفية'
    });

    const result = await fixJobsWithoutMedia();
    console.log('[ExternalJobs Route] Fix result:', result);
    
  } catch (error) {
    console.error('[ExternalJobs Route] Error:', error.message);
  }
});

module.exports = router;
