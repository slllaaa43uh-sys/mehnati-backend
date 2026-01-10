const { getFirebaseAdmin, isFirebaseReady } = require('../config/firebase');

const User = require('../models/User');

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
    console.log('========================================');
    console.log('🔔 FCM NOTIFICATION DEBUG - START');
    console.log('========================================');
    console.log('📋 Input Parameters:');
    console.log('   - Original Topic:', topic);
    console.log('   - Title:', title);
    console.log('   - Body:', body);
    console.log('   - Data:', JSON.stringify(data, null, 2));
    
    // التحقق من جاهزية Firebase
    const firebaseReady = isFirebaseReady();
    console.log('🔥 Firebase Ready Status:', firebaseReady);
    
    if (!firebaseReady) {
      console.error('❌ Firebase غير جاهز. لن يتم إرسال الإشعار.');
      console.log('💡 تأكد من إضافة إعدادات Firebase في متغيرات البيئة أو ملف firebase-service-account.json');
      console.log('========================================');
      return { success: false, error: 'Firebase not initialized' };
    }

    // التحقق من البيانات المطلوبة
    if (!topic || !title || !body) {
      console.error('❌ Missing required parameters:');
      console.error('   - topic:', topic ? '✓' : '✗ MISSING');
      console.error('   - title:', title ? '✓' : '✗ MISSING');
      console.error('   - body:', body ? '✓' : '✗ MISSING');
      throw new Error('يجب توفير topic و title و body');
    }

    const admin = getFirebaseAdmin();
    console.log('✅ Firebase Admin instance obtained');

    // Convert topic using the mapping
    const cleanTopic = categoryToTopic(topic);
    console.log('🏷️ Topic Conversion:');
    console.log('   - Original:', topic);
    console.log('   - Converted:', cleanTopic);
    console.log('   - Topic exists in map:', CATEGORY_TO_TOPIC_MAP[topic] ? 'YES' : 'NO (generated)');

    // استخراج صورة المنشور للإشعارات الغنية (مثل يوتيوب)
    const postImage = data.postImage || null;
    
    // إنشاء رسالة الإشعار
    const message = {
      notification: {
        title: title,
        body: body,
        // إضافة الصورة إلى الإشعار (مثل يوتيوب)
        ...(postImage && { imageUrl: postImage })
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
      // إعدادات Android - مطابقة لقناة التطبيق مع دعم الصور
      android: {
        priority: 'high',
        notification: {
          channelId: 'mehnati_pro_channel_v7',
          sound: 'notify',
          priority: 'high',
          clickAction: 'FCM_PLUGIN_ACTIVITY',
          defaultVibrateTimings: true,
          // إضافة الصورة للإشعارات الغنية على Android
          ...(postImage && { imageUrl: postImage })
        }
      },
      // إعدادات iOS مع دعم الصور
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1 // لدعم الإشعارات الغنية على iOS
          }
        },
        fcm_options: {
          // إضافة الصورة للإشعارات الغنية على iOS
          ...(postImage && { image: postImage })
        }
      }
    };
    
    console.log('   - Post Image in notification:', postImage || 'NONE');

    console.log('📦 Message Payload:');
    console.log(JSON.stringify(message, null, 2));

    console.log('🚀 Attempting to send notification to topic:', cleanTopic);
    console.log('⏳ Sending...');

    // إرسال الإشعار
    const response = await admin.messaging().send(message);

    console.log('✅ Notification sent successfully! Response:', response);
    console.log('📱 Message ID:', response);
    console.log('========================================');
    console.log('🔔 FCM NOTIFICATION DEBUG - END (SUCCESS)');
    console.log('========================================');

    return {
      success: true,
      messageId: response,
      topic: cleanTopic,
      originalTopic: topic
    };

  } catch (error) {
    console.error('========================================');
    console.error('❌ Error sending notification:', error);
    console.error('========================================');
    console.error('📋 Error Details:');
    console.error('   - Message:', error.message);
    console.error('   - Code:', error.code || 'N/A');
    console.error('   - Stack:', error.stack);
    if (error.errorInfo) {
      console.error('   - Error Info:', JSON.stringify(error.errorInfo, null, 2));
    }
    console.error('========================================');
    console.error('🔔 FCM NOTIFICATION DEBUG - END (FAILED)');
    console.error('========================================');
    
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
    console.log('📤 sendNotificationToMultipleTopics called');
    console.log('   - Topics:', topics);
    
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
    console.log('========================================');
    console.log('🔔 FCM DEVICE NOTIFICATION DEBUG - START');
    console.log('========================================');
    console.log('📋 Input Parameters:');
    console.log('   - Device Token:', deviceToken ? deviceToken.substring(0, 20) + '...' : 'MISSING');
    console.log('   - Title:', title);
    console.log('   - Body:', body);
    
    if (!isFirebaseReady()) {
      console.error('❌ Firebase غير جاهز. لن يتم إرسال الإشعار.');
      return { success: false, error: 'Firebase not initialized' };
    }

    if (!deviceToken || !title || !body) {
      console.error('❌ Missing required parameters');
      throw new Error('يجب توفير deviceToken و title و body');
    }

    const admin = getFirebaseAdmin();

    // استخراج صورة المنشور للإشعارات الغنية
    const postImage = data.postImage || null;
    
    const message = {
      notification: {
        title: title,
        body: body,
        // إضافة الصورة إلى الإشعار (مثل يوتيوب)
        ...(postImage && { imageUrl: postImage })
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        timestamp: new Date().toISOString()
      },
      token: deviceToken,
      // إعدادات Android - مطابقة لقناة التطبيق مع دعم الصور
      android: {
        priority: 'high',
        notification: {
          channelId: 'mehnati_pro_channel_v7',
          sound: 'notify',
          priority: 'high',
          clickAction: 'FCM_PLUGIN_ACTIVITY',
          // إضافة الصورة للإشعارات الغنية على Android
          ...(postImage && { imageUrl: postImage })
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1 // لدعم الإشعارات الغنية على iOS
          }
        },
        fcm_options: {
          // إضافة الصورة للإشعارات الغنية على iOS
          ...(postImage && { image: postImage })
        }
      }
    };

    console.log('🚀 Attempting to send notification to device...');
    const response = await admin.messaging().send(message);

    console.log('✅ Notification sent successfully! Response:', response);
    console.log('========================================');

    return {
      success: true,
      messageId: response
    };

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    console.error('   - Message:', error.message);
    console.error('   - Code:', error.code || 'N/A');
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
 * @param {object} additionalData - بيانات إضافية (اختياري) - يمكن أن يحتوي على postTitle لتحديد نوع الوظيفة
 * @param {string} additionalData.creatorId - معرف صاحب المنشور لاستثنائه من الإشعار
 * @returns {Promise<object>} - نتيجة الإرسال
 */
const sendNotificationByCategory = async (category, title, body, additionalData = {}) => {
  try {
    console.log('========================================');
    console.log('🔔 sendNotificationByCategory DEBUG - START');
    console.log('========================================');
    console.log('📋 Input:');
    console.log('   - Category:', category);
    console.log('   - Title:', title);
    console.log('   - Body:', body);
    console.log('   - Additional Data:', JSON.stringify(additionalData, null, 2));
    console.log('   - Creator ID to exclude:', additionalData.creatorId || 'NONE');
    
    // Get the topic name from category
    const topic = categoryToTopic(category);
    
    console.log(`📤 Category to Topic: ${category} -> ${topic}`);

    // ============================================
    // SEND TO ONLY ONE TOPIC (most specific)
    // ============================================
    // To avoid multiple notifications, we send to only ONE topic
    // Users subscribe to the most specific topic they want
    // ============================================
    
    let targetTopic = topic;
    
    // ============================================
    // JOBS: Determine the specific topic
    // ============================================
    if (topic.startsWith('jobs_') && topic !== 'jobs_all') {
      // Determine job type from post title
      const postTitle = additionalData.postTitle || '';
      
      // Check if seeker (looking for job) or employer (looking for employees)
      if (postTitle.includes('ابحث عن وظيفة') || postTitle.includes('أبحث عن وظيفة')) {
        // Person looking for job -> notify employers who want to hire
        targetTopic = `${topic}_employer`;
        console.log('   📌 Post is from JOB SEEKER -> Notifying EMPLOYERS');
        console.log(`   📤 Sending to: ${targetTopic}`);
      } else if (postTitle.includes('ابحث عن موظفين') || postTitle.includes('أبحث عن موظفين')) {
        // Company looking for employees -> notify job seekers
        targetTopic = `${topic}_seeker`;
        console.log('   📌 Post is from EMPLOYER -> Notifying JOB SEEKERS');
        console.log(`   📤 Sending to: ${targetTopic}`);
      } else {
        // Default: send to base topic
        console.log('   📌 Unknown job type -> Sending to base topic');
        console.log(`   📤 Sending to: ${targetTopic}`);
      }
    }
    // ============================================
    // HARAJ: Send to category topic only
    // ============================================
    else if (topic.startsWith('haraj_')) {
      console.log(`   📤 Haraj notification -> Sending to: ${targetTopic}`);
    }
    // ============================================
    // OTHER: Just send to the topic
    // ============================================
    else {
      console.log(`   📤 Other notification -> Sending to: ${targetTopic}`);
    }

    // Only one topic - no duplicates
    const uniqueTopics = [targetTopic];
    console.log('📋 Final Topic to send (SINGLE):', uniqueTopics);

    // ============================================
    // EXCLUDE CREATOR FROM NOTIFICATION
    // ============================================
    // If creatorId is provided, we need to:
    // 1. Get creator's FCM tokens
    // 2. Temporarily unsubscribe them from topics
    // 3. Send notifications
    // 4. Re-subscribe them
    // ============================================
    const creatorId = additionalData.creatorId;
    let creatorTokens = [];
    
    if (creatorId) {
      try {
        const creator = await User.findById(creatorId).select('fcmTokens');
        if (creator && creator.fcmTokens && creator.fcmTokens.length > 0) {
          creatorTokens = creator.fcmTokens.map(t => t.token);
          console.log(`🚫 Found ${creatorTokens.length} FCM tokens for creator to exclude`);
          
          // Unsubscribe creator from all topics temporarily
          const admin = getFirebaseAdmin();
          for (const topic of uniqueTopics) {
            try {
              await admin.messaging().unsubscribeFromTopic(creatorTokens, topic);
              console.log(`   ✔️ Temporarily unsubscribed creator from: ${topic}`);
            } catch (unsubErr) {
              console.warn(`   ⚠️ Could not unsubscribe from ${topic}:`, unsubErr.message);
            }
          }
        }
      } catch (userErr) {
        console.warn('⚠️ Could not fetch creator tokens:', userErr.message);
      }
    }

    // Send to all relevant topics
    const results = await Promise.allSettled(
      uniqueTopics.map(t => sendNotificationToTopic(t, title, body, {
        category,
        ...additionalData
      }))
    );

    // ============================================
    // RE-SUBSCRIBE CREATOR TO TOPICS
    // ============================================
    if (creatorId && creatorTokens.length > 0) {
      const admin = getFirebaseAdmin();
      for (const topic of uniqueTopics) {
        try {
          await admin.messaging().subscribeToTopic(creatorTokens, topic);
          console.log(`   ✔️ Re-subscribed creator to: ${topic}`);
        } catch (resubErr) {
          console.warn(`   ⚠️ Could not re-subscribe to ${topic}:`, resubErr.message);
        }
      }
    }

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log('========================================');
    console.log('📊 sendNotificationByCategory Results:');
    console.log('   - Total:', results.length);
    console.log('   - Successful:', successful);
    console.log('   - Failed:', failed);
    console.log('   - Creator excluded:', creatorId ? 'YES' : 'NO');
    console.log('========================================');

    return {
      success: successful > 0,
      topics: uniqueTopics,
      creatorExcluded: !!creatorId,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };

  } catch (error) {
    console.error('❌ خطأ في إرسال الإشعار حسب التصنيف:', error.message);
    console.error('   - Stack:', error.stack);
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
    console.log('========================================');
    console.log('🔔 SUBSCRIBE TO TOPIC DEBUG - START');
    console.log('========================================');
    console.log('📋 Input:');
    console.log('   - Device Token:', deviceToken ? deviceToken.substring(0, 30) + '...' : 'MISSING');
    console.log('   - Original Topic:', topic);
    
    if (!isFirebaseReady()) {
      console.error('❌ Firebase not ready');
      return { success: false, error: 'Firebase not initialized' };
    }

    const admin = getFirebaseAdmin();
    
    // Convert topic using the mapping
    const cleanTopic = categoryToTopic(topic);

    console.log(`📥 Subscribing device to topic: ${topic} -> ${cleanTopic}`);

    const response = await admin.messaging().subscribeToTopic(deviceToken, cleanTopic);

    console.log(`✅ تم اشتراك الجهاز في Topic: ${cleanTopic}`);
    console.log(`📊 Success count: ${response.successCount}, Failure count: ${response.failureCount}`);
    
    if (response.failureCount > 0 && response.errors) {
      console.error('❌ Subscription errors:', response.errors);
    }
    
    console.log('========================================');

    return {
      success: response.successCount > 0,
      topic: cleanTopic,
      originalTopic: topic,
      response
    };

  } catch (error) {
    console.error('❌ خطأ في الاشتراك في Topic:', error.message);
    console.error('   - Code:', error.code || 'N/A');
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
    console.log('========================================');
    console.log('🔔 UNSUBSCRIBE FROM TOPIC DEBUG - START');
    console.log('========================================');
    
    if (!isFirebaseReady()) {
      return { success: false, error: 'Firebase not initialized' };
    }

    const admin = getFirebaseAdmin();
    
    // Convert topic using the mapping
    const cleanTopic = categoryToTopic(topic);

    console.log(`📤 Unsubscribing device from topic: ${topic} -> ${cleanTopic}`);

    const response = await admin.messaging().unsubscribeFromTopic(deviceToken, cleanTopic);

    console.log(`✅ تم إلغاء اشتراك الجهاز من Topic: ${cleanTopic}`);
    console.log('========================================');

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
