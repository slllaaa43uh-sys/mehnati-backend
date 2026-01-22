/**
 * ============================================
 * Cron Job لإشعارات الوظائف العالمية اليومية
 * ============================================
 * 
 * يعمل مرة واحدة يومياً لإرسال إشعار للمستخدمين
 * إذا كانت هناك وظائف جديدة من المواقع الخارجية
 */

const cron = require('node-cron');
const ExternalJob = require('../models/ExternalJob');
const User = require('../models/User');
const { sendNotificationToDevice } = require('../services/fcmService');

// متغير لتتبع حالة التشغيل
let isRunning = false;

/**
 * جلب الوظائف الجديدة (آخر 24 ساعة)
 */
const getNewJobsCount = async () => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const count = await ExternalJob.countDocuments({
      isActive: true,
      createdAt: { $gte: yesterday }
    });

    return count;
  } catch (error) {
    console.error('[GlobalJobsNotification] Error counting new jobs:', error.message);
    return 0;
  }
};

/**
 * جلب عينة من الوظائف الجديدة للإشعار
 */
const getSampleJobs = async (limit = 3) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const jobs = await ExternalJob.find({
      isActive: true,
      createdAt: { $gte: yesterday }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return jobs;
  } catch (error) {
    console.error('[GlobalJobsNotification] Error fetching sample jobs:', error.message);
    return [];
  }
};

/**
 * إرسال إشعارات الوظائف العالمية للمستخدمين
 */
const sendGlobalJobsNotifications = async () => {
  if (isRunning) {
    console.log('[GlobalJobsNotification] Already running, skipping...');
    return;
  }

  isRunning = true;
  console.log('[GlobalJobsNotification] Starting daily notification at', new Date().toISOString());

  try {
    // 1. التحقق من وجود وظائف جديدة
    const newJobsCount = await getNewJobsCount();
    
    if (newJobsCount === 0) {
      console.log('[GlobalJobsNotification] No new jobs found, skipping notifications');
      isRunning = false;
      return;
    }

    console.log(`[GlobalJobsNotification] Found ${newJobsCount} new jobs`);

    // 2. جلب عينة من الوظائف للإشعار
    const sampleJobs = await getSampleJobs(3);
    
    // 3. إعداد محتوى الإشعار
    let notificationTitle = '🌍 وظائف عالمية جديدة';
    let notificationBody = '';
    let notificationImage = null;

    if (sampleJobs.length > 0) {
      const firstJob = sampleJobs[0];
      
      // استخدام صورة أو شعار الوظيفة الأولى
      if (firstJob.media && firstJob.media.url) {
        notificationImage = firstJob.media.url;
      } else if (firstJob.employer && firstJob.employer.logo) {
        notificationImage = firstJob.employer.logo;
      }

      // بناء نص الإشعار
      if (newJobsCount === 1) {
        notificationBody = `وظيفة جديدة: ${firstJob.title}`;
      } else {
        notificationBody = `${newJobsCount} وظيفة جديدة متاحة! منها: ${firstJob.title}`;
      }
    } else {
      notificationBody = `${newJobsCount} وظيفة جديدة متاحة الآن!`;
    }

    // 4. جلب المستخدمين الذين لديهم FCM tokens
    const users = await User.find({
      'fcmTokens.0': { $exists: true }, // لديهم على الأقل token واحد
      'settings.globalJobsNotifications': { $ne: false } // لم يعطلوا الإشعارات
    }).select('fcmTokens name').lean();

    console.log(`[GlobalJobsNotification] Found ${users.length} users with FCM tokens`);

    // 5. إرسال الإشعارات
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      for (const tokenObj of user.fcmTokens) {
        try {
          const result = await sendNotificationToDevice(
            tokenObj.token,
            notificationTitle,
            notificationBody,
            {
              type: 'global_jobs',
              displayPage: 'global-jobs',
              jobsCount: String(newJobsCount),
              postImage: notificationImage || '',
              // بيانات للتنقل في التطبيق
              url: '/global-jobs',
              channel: 'global_jobs'
            }
          );

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`[GlobalJobsNotification] Error sending to user ${user._id}:`, err.message);
        }
      }
    }

    console.log('[GlobalJobsNotification] Completed:', {
      totalUsers: users.length,
      successCount,
      failCount,
      newJobsCount
    });

  } catch (error) {
    console.error('[GlobalJobsNotification] Error:', error.message);
  } finally {
    isRunning = false;
  }
};

/**
 * بدء Cron Job
 * يعمل يومياً الساعة 9 صباحاً بتوقيت الرياض
 */
const startGlobalJobsNotificationCron = () => {
  // كل يوم الساعة 9 صباحاً
  cron.schedule('0 9 * * *', sendGlobalJobsNotifications, {
    scheduled: true,
    timezone: 'Asia/Riyadh'
  });

  console.log('[GlobalJobsNotification] Scheduled to run daily at 9:00 AM (Riyadh timezone)');
};

/**
 * تشغيل يدوي (للاختبار)
 */
const runManually = async () => {
  console.log('[GlobalJobsNotification] Manual run triggered');
  await sendGlobalJobsNotifications();
};

module.exports = {
  startGlobalJobsNotificationCron,
  runManually,
  sendGlobalJobsNotifications
};
