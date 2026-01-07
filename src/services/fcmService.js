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
 * ============================================
 * CATEGORY TO TOPIC MAPPING
 * ============================================
 * Maps Arabic category names to English topic names
 * This ensures consistency between frontend and backend
 */
const CATEGORY_TO_TOPIC_MAP = {
  // ============ HARAJ CATEGORIES ============
  'سيارات': 'haraj_cars',
  'عقارات': 'haraj_realestate',
  'أجهزة منزلية': 'haraj_appliances',
  'أثاث ومفروشات': 'haraj_furniture',
  'جوالات': 'haraj_phones',
  'لابتوبات وكمبيوتر': 'haraj_computers',
  'كاميرات وتصوير': 'haraj_cameras',
  'ألعاب فيديو': 'haraj_games',
  'ملابس وموضة': 'haraj_fashion',
  'ساعات ومجوهرات': 'haraj_jewelry',
  'حيوانات أليفة': 'haraj_pets',
  'طيور': 'haraj_birds',
  'معدات ثقيلة': 'haraj_equipment',
  'قطع غيار': 'haraj_parts',
  'تحف ومقتنيات': 'haraj_antiques',
  'كتب ومجلات': 'haraj_books',
  'أدوات رياضية': 'haraj_sports',
  'مستلزمات أطفال': 'haraj_kids',
  'خيم وتخييم': 'haraj_camping',
  'أرقام مميزة': 'haraj_numbers',
  'نقل عفش': 'haraj_moving',
  'أدوات أخرى': 'haraj_other',
  
  // ============ JOB CATEGORIES ============
  'سائق خاص': 'jobs_driver',
  'حارس أمن': 'jobs_security',
  'طباخ': 'jobs_cook',
  'محاسب': 'jobs_accountant',
  'مهندس مدني': 'jobs_engineer',
  'طبيب/ممرض': 'jobs_medical',
  'نجار': 'jobs_carpenter',
  'كاتب محتوى': 'jobs_writer',
  'كهربائي': 'jobs_electrician',
  'ميكانيكي': 'jobs_mechanic',
  'بائع / كاشير': 'jobs_sales',
  'مبرمج': 'jobs_programmer',
  'مصمم جرافيك': 'jobs_designer',
  'مترجم': 'jobs_translator',
  'مدرس خصوصي': 'jobs_teacher',
  'مدير مشاريع': 'jobs_manager',
  'خدمة عملاء': 'jobs_support',
  'مقدم طعام': 'jobs_waiter',
  'توصيل': 'jobs_delivery',
  'حلاق / خياط': 'jobs_barber',
  'مزارع': 'jobs_farmer',
  'وظائف أخرى': 'jobs_other',
  
  // ============ GENERAL TOPICS ============
  'jobs': 'jobs_all',
  'haraj': 'haraj_all',
  'general': 'general',
  'عام': 'general'
};

/**
 * Convert Arabic category name to English topic name
 * @param {string} category - Arabic category name
 * @param {string} type - Optional type (seeker/employer for jobs)
 * @returns {string} - English topic name
 */
const categoryToTopic = (category, type = null) => {
  // First check if it's already in the map
  let baseTopic = CATEGORY_TO_TOPIC_MAP[category];
  
  if (!baseTopic) {
    // If not found, create a safe topic name
    // Remove spaces and special characters, keep only alphanumeric and underscores
    baseTopic = category
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\u0600-\u06FF]/g, '') // Keep Arabic letters
      .replace(/[\u0600-\u06FF]+/g, match => {
        // Convert Arabic to transliterated version or use hash
        return Buffer.from(match).toString('hex').substring(0, 8);
      });
  }
  
  // Add type suffix for jobs if provided
  if (type && (type === 'seeker' || type === 'employer')) {
    return `${baseTopic}_${type}`;
  }
  
  return baseTopic;
};

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

    // Convert topic using the mapping
    const cleanTopic = categoryToTopic(topic);

    console.log(`📤 Sending notification to topic: ${topic} -> ${cleanTopic}`);

    // إنشاء رسالة الإشعار
    const message = {
      notification: {
        title: title,
        body: body
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        timestamp: new Date().toISOString(),
        topic: cleanTopic,
        originalTopic: topic
      },
      topic: cleanTopic,
      // إعدادات Android
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'fcm_default_channel',
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
      topic: cleanTopic,
      originalTopic: topic
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
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        timestamp: new Date().toISOString()
      },
      token: deviceToken,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'fcm_default_channel',
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
 * @param {string} category - تصنيف المنشور (مثل: سائق خاص، جوالات)
 * @param {string} title - عنوان الإشعار
 * @param {string} body - نص الإشعار
 * @param {object} additionalData - بيانات إضافية (اختياري)
 * @returns {Promise<object>} - نتيجة الإرسال
 */
const sendNotificationByCategory = async (category, title, body, additionalData = {}) => {
  try {
    // Get the topic name from category
    const topic = categoryToTopic(category);
    
    console.log(`📤 sendNotificationByCategory: ${category} -> ${topic}`);

    // Also send to the general topic for this section
    const topics = [topic];
    
    // If it's a job category, also send to jobs_all
    if (topic.startsWith('jobs_') && topic !== 'jobs_all') {
      topics.push('jobs_all');
    }
    
    // If it's a haraj category, also send to haraj_all
    if (topic.startsWith('haraj_') && topic !== 'haraj_all') {
      topics.push('haraj_all');
    }

    // Send to all relevant topics
    const results = await Promise.allSettled(
      topics.map(t => sendNotificationToTopic(t, title, body, {
        category,
        ...additionalData
      }))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    return {
      success: successful > 0,
      topics,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };

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
    
    // Convert topic using the mapping
    const cleanTopic = categoryToTopic(topic);

    console.log(`📥 Subscribing device to topic: ${topic} -> ${cleanTopic}`);

    const response = await admin.messaging().subscribeToTopic(deviceToken, cleanTopic);

    console.log(`✅ تم اشتراك الجهاز في Topic: ${cleanTopic}`);
    console.log(`📊 Success count: ${response.successCount}, Failure count: ${response.failureCount}`);

    return {
      success: response.successCount > 0,
      topic: cleanTopic,
      originalTopic: topic,
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
    
    // Convert topic using the mapping
    const cleanTopic = categoryToTopic(topic);

    console.log(`📤 Unsubscribing device from topic: ${topic} -> ${cleanTopic}`);

    const response = await admin.messaging().unsubscribeFromTopic(deviceToken, cleanTopic);

    console.log(`✅ تم إلغاء اشتراك الجهاز من Topic: ${cleanTopic}`);

    return {
      success: response.successCount > 0,
      topic: cleanTopic,
      originalTopic: topic,
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

// Export the category mapping for use in frontend
const getCategoryTopicMap = () => CATEGORY_TO_TOPIC_MAP;

module.exports = {
  sendNotificationToTopic,
  sendNotificationToMultipleTopics,
  sendNotificationToDevice,
  sendNotificationByCategory,
  subscribeToTopic,
  unsubscribeFromTopic,
  categoryToTopic,
  getCategoryTopicMap,
  CATEGORY_TO_TOPIC_MAP
};
