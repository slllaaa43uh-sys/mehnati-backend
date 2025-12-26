const { getFirebaseAdmin, isFirebaseReady } = require('../config/firebase');

/**
 * ============================================
 * Firebase Cloud Messaging (FCM) Service
 * ============================================
 * هذا الملف يحتوي على دوال إرسال الإشعارات عبر FCM
 * يدعم إرسال الإشعارات إلى:
 * - Topics (مواضيع محددة مثل drivers، doctors)
 * - Device Tokens (أجهزة محددة)
 * - Multiple Topics (عدة مواضيع في نفس الوقت)
 */

/**
 * إرسال إشعار إلى Topic محدد
 * @param {string} topic - اسم الـ Topic (مثل: drivers، doctors، jobs، haraj)
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 * @param {object} data - بيانات إضافية (اختياري)
 * @returns {Promise<object>} - نتيجة الإرسال
 */
const sendNotificationToTopic = async (topic, title, body, data = {}) => {
  try {
    // التحقق من جاهزية Firebase
    if (!isFirebaseReady()) {
      console.warn('⚠️ Firebase غير جاهز. لن يتم إرسال الإشعار.');
      return { success: false, error: 'Firebase not initialized' };
    }

    // التحقق من البيانات المطلوبة
    if (!topic || !title || !body) {
      throw new Error('يجب توفير topic و title و body');
    }

    const admin = getFirebaseAdmin();

    // تنظيف اسم الـ Topic (إزالة المسافات والأحرف الخاصة)
    const cleanTopic = topic.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    // إنشاء رسالة الإشعار
    const message = {
      notification: {
        title: title,
        body: body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        topic: cleanTopic
      },
      topic: cleanTopic,
      // إعدادات Android
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'mehnati_notifications',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      // إعدادات iOS
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // إرسال الإشعار
    const response = await admin.messaging().send(message);

    console.log('✅ تم إرسال الإشعار بنجاح إلى Topic:', cleanTopic);
    console.log('📱 Response:', response);

    return {
      success: true,
      messageId: response,
      topic: cleanTopic
    };

  } catch (error) {
    console.error('❌ خطأ في إرسال الإشعار إلى Topic:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * إرسال إشعار إلى عدة Topics في نفس الوقت
 * @param {string[]} topics - مصفوفة أسماء الـ Topics
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 * @param {object} data - بيانات إضافية (اختياري)
 * @returns {Promise<object>} - نتائج الإرسال
 */
const sendNotificationToMultipleTopics = async (topics, title, body, data = {}) => {
  try {
    if (!Array.isArray(topics) || topics.length === 0) {
      throw new Error('يجب توفير مصفوفة topics غير فارغة');
    }

    const results = await Promise.allSettled(
      topics.map(topic => sendNotificationToTopic(topic, title, body, data))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`📊 نتائج الإرسال: ${successful} نجح، ${failed} فشل`);

    return {
      success: true,
      total: results.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };

  } catch (error) {
    console.error('❌ خطأ في إرسال الإشعارات إلى Topics متعددة:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * إرسال إشعار إلى جهاز محدد عبر Device Token
 * @param {string} deviceToken - رمز الجهاز (FCM Token)
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 * @param {object} data - بيانات إضافية (اختياري)
 * @returns {Promise<object>} - نتيجة الإرسال
 */
const sendNotificationToDevice = async (deviceToken, title, body, data = {}) => {
  try {
    if (!isFirebaseReady()) {
      console.warn('⚠️ Firebase غير جاهز. لن يتم إرسال الإشعار.');
      return { success: false, error: 'Firebase not initialized' };
    }

    if (!deviceToken || !title || !body) {
      throw new Error('يجب توفير deviceToken و title و body');
    }

    const admin = getFirebaseAdmin();

    const message = {
      notification: {
        title: title,
        body: body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      token: deviceToken,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'mehnati_notifications',
          priority: 'high'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);

    console.log('✅ تم إرسال الإشعار بنجاح إلى الجهاز');

    return {
      success: true,
      messageId: response
    };

  } catch (error) {
    console.error('❌ خطأ في إرسال الإشعار إلى الجهاز:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * إرسال إشعار بناءً على تصنيف المنشور/الوظيفة
 * هذه الدالة تحدد تلقائياً الـ Topic المناسب بناءً على category
 * @param {string} category - تصنيف المنشور (مثل: drivers، doctors، jobs، haraj)
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 * @param {object} additionalData - بيانات إضافية (اختياري)
 * @returns {Promise<object>} - نتيجة الإرسال
 */
const sendNotificationByCategory = async (category, title, body, additionalData = {}) => {
  try {
    // تحويل category إلى topic name
    // يمكنك تخصيص هذا التحويل حسب احتياجاتك
    const topicMap = {
      'drivers': 'drivers',
      'سائقين': 'drivers',
      'doctors': 'doctors',
      'أطباء': 'doctors',
      'engineers': 'engineers',
      'مهندسين': 'engineers',
      'teachers': 'teachers',
      'معلمين': 'teachers',
      'jobs': 'jobs',
      'وظائف': 'jobs',
      'haraj': 'haraj',
      'حراج': 'haraj',
      'general': 'general',
      'عام': 'general'
    };

    const topic = topicMap[category] || 'general';

    return await sendNotificationToTopic(topic, title, body, {
      category,
      ...additionalData
    });

  } catch (error) {
    console.error('❌ خطأ في إرسال الإشعار حسب التصنيف:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * اشتراك جهاز في Topic
 * @param {string} deviceToken - رمز الجهاز
 * @param {string} topic - اسم الـ Topic
 * @returns {Promise<object>} - نتيجة الاشتراك
 */
const subscribeToTopic = async (deviceToken, topic) => {
  try {
    if (!isFirebaseReady()) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const admin = getFirebaseAdmin();
    const cleanTopic = topic.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    const response = await admin.messaging().subscribeToTopic(deviceToken, cleanTopic);

    console.log(`✅ تم اشتراك الجهاز في Topic: ${cleanTopic}`);

    return {
      success: true,
      topic: cleanTopic,
      response
    };

  } catch (error) {
    console.error('❌ خطأ في الاشتراك في Topic:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * إلغاء اشتراك جهاز من Topic
 * @param {string} deviceToken - رمز الجهاز
 * @param {string} topic - اسم الـ Topic
 * @returns {Promise<object>} - نتيجة إلغاء الاشتراك
 */
const unsubscribeFromTopic = async (deviceToken, topic) => {
  try {
    if (!isFirebaseReady()) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const admin = getFirebaseAdmin();
    const cleanTopic = topic.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    const response = await admin.messaging().unsubscribeFromTopic(deviceToken, cleanTopic);

    console.log(`✅ تم إلغاء اشتراك الجهاز من Topic: ${cleanTopic}`);

    return {
      success: true,
      topic: cleanTopic,
      response
    };

  } catch (error) {
    console.error('❌ خطأ في إلغاء الاشتراك من Topic:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendNotificationToTopic,
  sendNotificationToMultipleTopics,
  sendNotificationToDevice,
  sendNotificationByCategory,
  subscribeToTopic,
  unsubscribeFromTopic
};
