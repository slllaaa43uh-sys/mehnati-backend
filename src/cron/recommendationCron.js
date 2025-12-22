/**
 * ============================================
 * المهمة المجدولة لتحديث تقييمات الفيديوهات
 * ============================================
 * 
 * هذا الملف يحتوي على المهمة المجدولة التي تقوم بتحديث
 * تقييمات جميع الفيديوهات بشكل دوري.
 * 
 * الاستخدام:
 * - يتم استدعاء هذه الدالة من server.js
 * - يمكن تشغيلها كل 30 دقيقة أو ساعة
 */

const { updateAllScoresCronJob, getTrendingShorts } = require('../services/recommendationService');

/**
 * تشغيل مهمة تحديث التقييمات
 */
const runScoreUpdate = async () => {
  console.log('[Cron] Starting recommendation scores update...');
  try {
    const result = await updateAllScoresCronJob();
    console.log(`[Cron] Completed: Updated ${result.updated}/${result.total} shorts`);
  } catch (error) {
    console.error('[Cron] Error updating scores:', error);
  }
};

/**
 * إعداد المهمة المجدولة
 * @param {number} intervalMinutes - الفاصل الزمني بالدقائق (افتراضي: 30)
 */
const setupCronJob = (intervalMinutes = 30) => {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  // تشغيل فوري عند بدء الخادم
  console.log('[Cron] Running initial score update...');
  runScoreUpdate();
  
  // تشغيل دوري
  setInterval(runScoreUpdate, intervalMs);
  console.log(`[Cron] Scheduled score updates every ${intervalMinutes} minutes`);
};

module.exports = { setupCronJob, runScoreUpdate };
