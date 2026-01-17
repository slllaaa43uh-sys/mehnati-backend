/**
 * ============================================
 * Cron Job للوظائف الخارجية
 * ============================================
 * 
 * يعمل كل 6 ساعات لجلب الوظائف من JSearch API
 * وحفظها في MongoDB مع صور/فيديوهات من Pixabay
 */

const cron = require('node-cron');
const { fetchAndSaveJobs, cleanupOldJobs, getStats } = require('../services/externalJobsService');

// متغير لتتبع حالة التشغيل
let isRunning = false;

/**
 * دالة جلب الوظائف
 */
const fetchExternalJobs = async () => {
  if (isRunning) {
    console.log('[ExternalJobsCron] Job fetch already in progress, skipping...');
    return;
  }

  isRunning = true;
  console.log('[ExternalJobsCron] Starting scheduled job fetch at', new Date().toISOString());

  try {
    // جلب الوظائف من عدة استعلامات
    const queries = [
      'وظائف في السعودية',
      'jobs in Saudi Arabia',
      'وظائف في الرياض',
      'وظائف في جدة'
    ];

    let totalNew = 0;
    let totalUpdated = 0;

    for (const query of queries) {
      try {
        console.log(`[ExternalJobsCron] Fetching: ${query}`);
        const result = await fetchAndSaveJobs(query);
        totalNew += result.newJobs || 0;
        totalUpdated += result.updatedJobs || 0;
        
        // تأخير بين الاستعلامات
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (queryError) {
        console.error(`[ExternalJobsCron] Error with query "${query}":`, queryError.message);
      }
    }

    // تنظيف الوظائف القديمة
    const cleanupResult = await cleanupOldJobs();

    // إحصائيات
    const stats = await getStats();

    console.log('[ExternalJobsCron] Completed:', {
      newJobs: totalNew,
      updatedJobs: totalUpdated,
      deletedOld: cleanupResult.deletedCount,
      totalActive: stats.stats?.active,
      videoRatio: stats.stats?.videoRatio
    });

  } catch (error) {
    console.error('[ExternalJobsCron] Error:', error.message);
  } finally {
    isRunning = false;
  }
};

/**
 * بدء Cron Job
 * يعمل كل 6 ساعات: 0:00, 6:00, 12:00, 18:00
 */
const startExternalJobsCron = () => {
  // كل 6 ساعات
  cron.schedule('0 */6 * * *', fetchExternalJobs, {
    scheduled: true,
    timezone: 'Asia/Riyadh'
  });

  console.log('[ExternalJobsCron] Scheduled to run every 6 hours (Riyadh timezone)');

  // تشغيل فوري عند بدء الخادم (بعد 30 ثانية)
  setTimeout(() => {
    console.log('[ExternalJobsCron] Running initial fetch...');
    fetchExternalJobs();
  }, 30000);
};

/**
 * تشغيل يدوي (للاختبار)
 */
const runManually = async () => {
  console.log('[ExternalJobsCron] Manual run triggered');
  await fetchExternalJobs();
};

module.exports = {
  startExternalJobsCron,
  runManually
};
