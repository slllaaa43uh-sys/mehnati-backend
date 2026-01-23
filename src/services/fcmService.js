const { getFirebaseAdmin, isFirebaseReady } = require('../config/firebase');
const User = require('../models/User');
const { 
  logInfo, 
  logSuccess, 
  logError, 
  logWarning,
  logNotificationSent, 
  logSubscription 
} = require('./notificationLogger');

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
  'عام': 'general',
  
  // ============ URGENT JOBS TOPIC ============
  'urgent-jobs': 'urgent_jobs',
  'urgent_jobs': 'urgent_jobs',
  
  // ============ GLOBAL JOBS TOPIC ============
  'global-jobs': 'global_jobs',
  'global_jobs': 'global_jobs',
  
  // ============ ENGLISH CATEGORY NAMES (from Frontend) ============
  // Jobs - English names sent from frontend
  'jobs_driver': 'jobs_driver',
  'jobs_driver_seeker': 'jobs_driver_seeker',
  'jobs_driver_employer': 'jobs_driver_employer',
  'jobs_security': 'jobs_security',
  'jobs_security_seeker': 'jobs_security_seeker',
  'jobs_security_employer': 'jobs_security_employer',
  'jobs_chef': 'jobs_cook',
  'jobs_chef_seeker': 'jobs_cook_seeker',
  'jobs_chef_employer': 'jobs_cook_employer',
  'jobs_cook': 'jobs_cook',
  'jobs_cook_seeker': 'jobs_cook_seeker',
  'jobs_cook_employer': 'jobs_cook_employer',
  'jobs_accountant': 'jobs_accountant',
  'jobs_accountant_seeker': 'jobs_accountant_seeker',
  'jobs_accountant_employer': 'jobs_accountant_employer',
  'jobs_engineer': 'jobs_engineer',
  'jobs_engineer_seeker': 'jobs_engineer_seeker',
  'jobs_engineer_employer': 'jobs_engineer_employer',
  'jobs_medical': 'jobs_medical',
  'jobs_medical_seeker': 'jobs_medical_seeker',
  'jobs_medical_employer': 'jobs_medical_employer',
  'jobs_carpenter': 'jobs_carpenter',
  'jobs_carpenter_seeker': 'jobs_carpenter_seeker',
  'jobs_carpenter_employer': 'jobs_carpenter_employer',
  'jobs_writer': 'jobs_writer',
  'jobs_writer_seeker': 'jobs_writer_seeker',
  'jobs_writer_employer': 'jobs_writer_employer',
  'jobs_electrician': 'jobs_electrician',
  'jobs_electrician_seeker': 'jobs_electrician_seeker',
  'jobs_electrician_employer': 'jobs_electrician_employer',
  'jobs_mechanic': 'jobs_mechanic',
  'jobs_mechanic_seeker': 'jobs_mechanic_seeker',
  'jobs_mechanic_employer': 'jobs_mechanic_employer',
  'jobs_sales': 'jobs_sales',
  'jobs_sales_seeker': 'jobs_sales_seeker',
  'jobs_sales_employer': 'jobs_sales_employer',
  'jobs_developer': 'jobs_programmer',
  'jobs_developer_seeker': 'jobs_programmer_seeker',
  'jobs_developer_employer': 'jobs_programmer_employer',
  'jobs_programmer': 'jobs_programmer',
  'jobs_programmer_seeker': 'jobs_programmer_seeker',
  'jobs_programmer_employer': 'jobs_programmer_employer',
  'jobs_designer': 'jobs_designer',
  'jobs_designer_seeker': 'jobs_designer_seeker',
  'jobs_designer_employer': 'jobs_designer_employer',
  'jobs_translator': 'jobs_translator',
  'jobs_translator_seeker': 'jobs_translator_seeker',
  'jobs_translator_employer': 'jobs_translator_employer',
  'jobs_tutor': 'jobs_teacher',
  'jobs_tutor_seeker': 'jobs_teacher_seeker',
  'jobs_tutor_employer': 'jobs_teacher_employer',
  'jobs_teacher': 'jobs_teacher',
  'jobs_teacher_seeker': 'jobs_teacher_seeker',
  'jobs_teacher_employer': 'jobs_teacher_employer',
  'jobs_manager': 'jobs_manager',
  'jobs_manager_seeker': 'jobs_manager_seeker',
  'jobs_manager_employer': 'jobs_manager_employer',
  'jobs_support': 'jobs_support',
  'jobs_support_seeker': 'jobs_support_seeker',
  'jobs_support_employer': 'jobs_support_employer',
  'jobs_waiter': 'jobs_waiter',
  'jobs_waiter_seeker': 'jobs_waiter_seeker',
  'jobs_waiter_employer': 'jobs_waiter_employer',
  'jobs_delivery': 'jobs_delivery',
  'jobs_delivery_seeker': 'jobs_delivery_seeker',
  'jobs_delivery_employer': 'jobs_delivery_employer',
  'jobs_tailor': 'jobs_barber',
  'jobs_tailor_seeker': 'jobs_barber_seeker',
  'jobs_tailor_employer': 'jobs_barber_employer',
  'jobs_barber': 'jobs_barber',
  'jobs_barber_seeker': 'jobs_barber_seeker',
  'jobs_barber_employer': 'jobs_barber_employer',
  'jobs_farmer': 'jobs_farmer',
  'jobs_farmer_seeker': 'jobs_farmer_seeker',
  'jobs_farmer_employer': 'jobs_farmer_employer',
  'jobs_other_jobs': 'jobs_other',
  'jobs_other_jobs_seeker': 'jobs_other_seeker',
  'jobs_other_jobs_employer': 'jobs_other_employer',
  'jobs_other': 'jobs_other',
  'jobs_other_seeker': 'jobs_other_seeker',
  'jobs_other_employer': 'jobs_other_employer',
  
  // Haraj - English names sent from frontend
  'haraj_cars': 'haraj_cars',
  'haraj_real_estate': 'haraj_realestate',
  'haraj_appliances': 'haraj_appliances',
  'haraj_furniture': 'haraj_furniture',
  'haraj_mobiles': 'haraj_phones',
  'haraj_computers': 'haraj_computers',
  'haraj_cameras': 'haraj_cameras',
  'haraj_video_games': 'haraj_games',
  'haraj_fashion': 'haraj_fashion',
  'haraj_jewelry': 'haraj_jewelry',
  'haraj_pets': 'haraj_pets',
  'haraj_birds': 'haraj_birds',
  'haraj_heavy_equipment': 'haraj_equipment',
  'haraj_spare_parts': 'haraj_parts',
  'haraj_antiques': 'haraj_antiques',
  'haraj_books': 'haraj_books',
  'haraj_sports': 'haraj_sports',
  'haraj_kids': 'haraj_kids',
  'haraj_camping': 'haraj_camping',
  'haraj_vip_numbers': 'haraj_numbers',
  'haraj_moving': 'haraj_moving',
  'haraj_other_haraj': 'haraj_other',
  'haraj_other': 'haraj_other'
};

/**
 * ============================================
 * CATEGORY TO CHANNEL MAPPING FOR ANDROID DEEP LINKING
 * ============================================
 * Maps category names to Android notification channel names
 * All values are in English, lowercase, safe for Android Intent extras
 */
const CATEGORY_TO_CHANNEL_MAP = {
  // ============ JOB CHANNELS ============
  'سائق خاص': 'jobs_driver',
  'driver': 'jobs_driver',
  'حارس أمن': 'jobs_security',
  'security': 'jobs_security',
  'طباخ': 'jobs_cook',
  'cook': 'jobs_cook',
  'نجار': 'jobs_carpenter',
  'carpenter': 'jobs_carpenter',
  'كهربائي': 'jobs_electrician',
  'electrician': 'jobs_electrician',
  'plumber': 'jobs_plumber',
  'سباك': 'jobs_plumber',
  'cleaner': 'jobs_cleaner',
  'عامل نظافة': 'jobs_cleaner',
  'محاسب': 'jobs_accountant',
  'accountant': 'jobs_accountant',
  'مهندس مدني': 'jobs_engineer',
  'engineer': 'jobs_engineer',
  'طبيب/ممرض': 'jobs_medical',
  'medical': 'jobs_medical',
  'كاتب محتوى': 'jobs_writer',
  'writer': 'jobs_writer',
  'ميكانيكي': 'jobs_mechanic',
  'mechanic': 'jobs_mechanic',
  'بائع / كاشير': 'jobs_sales',
  'sales': 'jobs_sales',
  'مبرمج': 'jobs_programmer',
  'programmer': 'jobs_programmer',
  'مصمم جرافيك': 'jobs_designer',
  'designer': 'jobs_designer',
  'مترجم': 'jobs_translator',
  'translator': 'jobs_translator',
  'مدرس خصوصي': 'jobs_teacher',
  'teacher': 'jobs_teacher',
  'مدير مشاريع': 'jobs_manager',
  'manager': 'jobs_manager',
  'خدمة عملاء': 'jobs_support',
  'support': 'jobs_support',
  'مقدم طعام': 'jobs_waiter',
  'waiter': 'jobs_waiter',
  'توصيل': 'jobs_delivery',
  'delivery': 'jobs_delivery',
  'حلاق / خياط': 'jobs_barber',
  'barber': 'jobs_barber',
  'مزارع': 'jobs_farmer',
  'farmer': 'jobs_farmer',
  'وظائف أخرى': 'jobs_other',
  'jobs_other': 'jobs_other',
  
  // ============ MARKET (HARAJ) CHANNELS ============
  'سيارات': 'market_cars',
  'cars': 'market_cars',
  'trucks': 'market_trucks',
  'شاحنات': 'market_trucks',
  'electronics': 'market_electronics',
  'إلكترونيات': 'market_electronics',
  'أجهزة منزلية': 'market_electronics',
  'أثاث ومفروشات': 'market_furniture',
  'furniture': 'market_furniture',
  'جوالات': 'market_mobile',
  'mobile': 'market_mobile',
  'عقارات': 'market_real_estate',
  'real_estate': 'market_real_estate',
  'services': 'market_services',
  'خدمات': 'market_services',
  'لابتوبات وكمبيوتر': 'market_electronics',
  'كاميرات وتصوير': 'market_electronics',
  'ألعاب فيديو': 'market_electronics',
  'ملابس وموضة': 'market_fashion',
  'ساعات ومجوهرات': 'market_jewelry',
  'حيوانات أليفة': 'market_pets',
  'طيور': 'market_pets',
  'معدات ثقيلة': 'market_equipment',
  'قطع غيار': 'market_parts',
  'تحف ومقتنيات': 'market_antiques',
  'كتب ومجلات': 'market_books',
  'أدوات رياضية': 'market_sports',
  'مستلزمات أطفال': 'market_kids',
  'خيم وتخييم': 'market_camping',
  'أرقام مميزة': 'market_numbers',
  'نقل عفش': 'market_services',
  'أدوات أخرى': 'market_other',
  
  // ============ GENERAL CONTENT CHANNELS ============
  'post': 'general_posts',
  'story': 'general_stories',
  'video': 'general_videos',
  'shorts': 'general_shorts',
  'general': 'general_posts',
  
  // ============ URGENT JOBS CHANNEL ============
  'urgent-jobs': 'urgent_jobs',
  'urgent_jobs': 'urgent_jobs',
  'urgent': 'urgent_jobs'
};

/**
 * ============================================
 * HELPER FUNCTION: Get Deep Link Data for Android
 * ============================================
 * Generates structured data payload for Android native deep linking
 * All values are in English, lowercase, safe for Android Intent extras
 * 
 * @param {object} options - Options for generating deep link data
 * @param {string} options.type - Main content type (job, market, post, story, video, shorts)
 * @param {string} options.category - Category name (Arabic or English)
 * @param {string} options.itemId - Unique identifier of the item
 * @param {string} options.displayPage - Display page type
 * @returns {object} - Structured data for Android deep linking
 */
const getDeepLinkData = (options = {}) => {
  const { type, category, itemId, displayPage } = options;
  
  // Determine the main content type
  let contentType = 'post';
  if (displayPage === 'urgent') {
    contentType = 'urgent_job';
  } else if (displayPage === 'jobs' || type === 'job' || (category && CATEGORY_TO_TOPIC_MAP[category]?.startsWith('jobs_'))) {
    contentType = 'job';
  } else if (displayPage === 'haraj' || type === 'market' || (category && CATEGORY_TO_TOPIC_MAP[category]?.startsWith('haraj_'))) {
    contentType = 'market';
  } else if (type === 'story' || displayPage === 'stories') {
    contentType = 'story';
  } else if (type === 'video' || displayPage === 'videos') {
    contentType = 'video';
  } else if (type === 'shorts' || displayPage === 'shorts') {
    contentType = 'shorts';
  } else if (type === 'post' || displayPage === 'home') {
    contentType = 'post';
  }
  
  // Get English category name (lowercase)
  let englishCategory = 'general';
  if (category) {
    // Check if category is in the topic map
    const topicName = CATEGORY_TO_TOPIC_MAP[category];
    if (topicName) {
      // Extract category from topic name (e.g., 'jobs_driver' -> 'driver')
      const parts = topicName.split('_');
      if (parts.length > 1) {
        englishCategory = parts.slice(1).join('_');
      } else {
        englishCategory = topicName;
      }
    } else {
      // If not in map, convert to safe English string
      englishCategory = category
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      if (!englishCategory) {
        englishCategory = 'general';
      }
    }
  }
  
  // Get Android notification channel
  let channel = CATEGORY_TO_CHANNEL_MAP[category] || CATEGORY_TO_CHANNEL_MAP[englishCategory] || (displayPage === 'urgent' ? 'urgent_jobs' : null);
  if (!channel) {
    // Generate channel based on content type
    if (contentType === 'urgent_job') {
      channel = 'urgent_jobs';
    } else if (contentType === 'job') {
      channel = 'jobs_other';
    } else if (contentType === 'market') {
      channel = 'market_other';
    } else if (contentType === 'story') {
      channel = 'general_stories';
    } else if (contentType === 'video') {
      channel = 'general_videos';
    } else if (contentType === 'shorts') {
      channel = 'general_shorts';
    } else {
      channel = 'general_posts';
    }
  }
  
  return {
    type: contentType,
    category: englishCategory,
    itemId: String(itemId || ''),
    channel: channel
  };
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
    logInfo('FCM_TOPIC_SEND', 'Starting notification send to topic', {
      topic,
      title,
      bodyPreview: body.substring(0, 50)
    });
    
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
      const errorMsg = 'Firebase غير جاهز. لن يتم إرسال الإشعار.';
      logError('FCM_TOPIC_SEND', errorMsg, { topic });
      console.error('❌', errorMsg);
      console.log('💡 تأكد من إضافة إعدادات Firebase في متغيرات البيئة أو ملف firebase-service-account.json');
      console.log('========================================');
      return { success: false, error: 'Firebase not initialized' };
    }

    // التحقق من البيانات المطلوبة
    if (!topic || !title || !body) {
      const errorMsg = 'Missing required parameters';
      logError('FCM_TOPIC_SEND', errorMsg, {
        hasTopic: !!topic,
        hasTitle: !!title,
        hasBody: !!body
      });
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
    
    // استخراج بيانات المستخدم للإشعار (مثل واتساب)
    const userAvatar = data.userAvatar || null;
    const userInitial = data.userInitial || '';
    const userName = data.userName || '';
    const url = data.url || '';
    
    // Generate deep link data for Android
    const deepLinkData = getDeepLinkData({
      type: data.type || 'post',
      category: data.category || topic,
      itemId: data.postId || data.itemId || '',
      displayPage: data.displayPage || 'home'
    });
    
    console.log('🔗 Deep Link Data:', JSON.stringify(deepLinkData, null, 2));
    
    // ============================================
    // إنشاء رسالة الإشعار - محدثة للتوافق مع Android
    // ============================================
    // ملاحظة: يجب أن يتطابق channelId مع القناة المنشأة في التطبيق
    // الواجهة الأمامية تستخدم: mehnati_pro_channel_v7
    // يمكن أيضاً استخدام: mehnati_notifications (حسب إعدادات التطبيق)
    // ============================================
    const message = {
      notification: {
        title: title,
        body: body,
        // إضافة الصورة إلى الإشعار (مثل يوتيوب)
        ...(postImage && { imageUrl: postImage })
      },
      data: {
        // Existing data fields (converted to strings)
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        timestamp: new Date().toISOString(),
        topic: cleanTopic,
        originalTopic: topic,
        // Android deep linking data (all lowercase English)
        type: deepLinkData.type,
        category: deepLinkData.category,
        itemId: deepLinkData.itemId,
        channel: deepLinkData.channel,
        // رابط مباشر للانتقال (Deep Link URL)
        url: url,
        // بيانات صورة المستخدم للإشعار (مثل واتساب)
        userAvatar: userAvatar || '',
        userInitial: userInitial,
        userName: userName,
        // بيانات الصوت والقناة للتطبيق (للتوافق مع data-only messages)
        sound: 'notify',
        android_channel_id: 'mehnati_notifications'
      },
      topic: cleanTopic,
      // ============================================
      // إعدادات Android - محدثة
      // ============================================
      android: {
        priority: 'high',
        notification: {
          // القناة الأساسية - يجب أن تتطابق مع التطبيق
          channelId: 'mehnati_notifications',
          // الصوت المخصص - بدون امتداد .mp3
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
            sound: 'notify.mp3',
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
    console.log('   - User Avatar:', userAvatar || 'NONE');
    console.log('   - User Initial:', userInitial || 'NONE');
    console.log('   - User Name:', userName || 'NONE');
    console.log('   - URL:', url || 'NONE');
    console.log('   - Android Channel ID:', message.android.notification.channelId);
    console.log('   - Sound:', message.android.notification.sound);

    console.log('📦 Message Payload:');
    console.log(JSON.stringify(message, null, 2));

    console.log('🚀 Attempting to send notification to topic:', cleanTopic);
    console.log('⏳ Sending...');

    // إرسال الإشعار
    const response = await admin.messaging().send(message);

    // تسجيل النجاح
    logNotificationSent('topic', cleanTopic, title, body, { 
      success: true, 
      messageId: response 
    });
    
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
    // تسجيل الخطأ
    logNotificationSent('topic', topic, title, body, { 
      success: false, 
      error: error.message 
    });
    
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
    logInfo('FCM_DEVICE_SEND', 'Starting notification send to device', {
      tokenPreview: deviceToken ? deviceToken.substring(0, 20) + '...' : 'MISSING',
      title,
      bodyPreview: body.substring(0, 50)
    });
    
    console.log('========================================');
    console.log('🔔 FCM DEVICE NOTIFICATION DEBUG - START');
    console.log('========================================');
    console.log('📋 Input Parameters:');
    console.log('   - Device Token:', deviceToken ? deviceToken.substring(0, 20) + '...' : 'MISSING');
    console.log('   - Title:', title);
    console.log('   - Body:', body);
    
    if (!isFirebaseReady()) {
      const errorMsg = 'Firebase غير جاهز. لن يتم إرسال الإشعار.';
      logError('FCM_DEVICE_SEND', errorMsg, { deviceToken: deviceToken?.substring(0, 20) });
      console.error('❌', errorMsg);
      return { success: false, error: 'Firebase not initialized' };
    }

    if (!deviceToken || !title || !body) {
      const errorMsg = 'Missing required parameters';
      logError('FCM_DEVICE_SEND', errorMsg, {
        hasToken: !!deviceToken,
        hasTitle: !!title,
        hasBody: !!body
      });
      console.error('❌ Missing required parameters');
      throw new Error('يجب توفير deviceToken و title و body');
    }

    const admin = getFirebaseAdmin();

    // استخراج صورة المنشور للإشعارات الغنية
    const postImage = data.postImage || null;
    
    // استخراج بيانات المستخدم للإشعار (مثل واتساب)
    const userAvatar = data.userAvatar || null;
    const userInitial = data.userInitial || '';
    const userName = data.userName || '';
    const url = data.url || '';
    
    // Generate deep link data for Android
    const deepLinkData = getDeepLinkData({
      type: data.type || 'post',
      category: data.category || 'general',
      itemId: data.postId || data.itemId || '',
      displayPage: data.displayPage || 'home'
    });
    
    console.log('🔗 Deep Link Data:', JSON.stringify(deepLinkData, null, 2));
    
    // ============================================
    // إنشاء رسالة الإشعار - محدثة للتوافق مع Android
    // ============================================
    const message = {
      notification: {
        title: title,
        body: body,
        // إضافة الصورة إلى الإشعار (مثل يوتيوب)
        ...(postImage && { imageUrl: postImage })
      },
      data: {
        // Existing data fields (converted to strings)
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        timestamp: new Date().toISOString(),
        // Android deep linking data (all lowercase English)
        type: deepLinkData.type,
        category: deepLinkData.category,
        itemId: deepLinkData.itemId,
        channel: deepLinkData.channel,
        // رابط مباشر للانتقال (Deep Link URL)
        url: url,
        // بيانات صورة المستخدم للإشعار (مثل واتساب)
        userAvatar: userAvatar || '',
        userInitial: userInitial,
        userName: userName,
        // بيانات الصوت والقناة للتطبيق
        sound: 'notify',
        android_channel_id: 'mehnati_notifications'
      },
      token: deviceToken,
      // ============================================
      // إعدادات Android - محدثة
      // ============================================
      android: {
        priority: 'high',
        notification: {
          // القناة الأساسية - يجب أن تتطابق مع التطبيق
          channelId: 'mehnati_notifications',
          // الصوت المخصص - بدون امتداد .mp3
          sound: 'notify',
          priority: 'high',
          clickAction: 'FCM_PLUGIN_ACTIVITY',
          defaultVibrateTimings: true,
          // إضافة الصورة للإشعارات الغنية على Android
          ...(postImage && { imageUrl: postImage })
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'notify.mp3',
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

    console.log('   - Android Channel ID:', message.android.notification.channelId);
    console.log('   - Sound:', message.android.notification.sound);
    console.log('🚀 Attempting to send notification to device...');
    
    const response = await admin.messaging().send(message);

    // تسجيل النجاح
    logNotificationSent('device', deviceToken.substring(0, 20) + '...', title, body, { 
      success: true, 
      messageId: response 
    });
    
    console.log('✅ Notification sent successfully! Response:', response);
    console.log('========================================');

    return {
      success: true,
      messageId: response
    };

  } catch (error) {
    // تسجيل الخطأ
    logNotificationSent('device', deviceToken?.substring(0, 20) + '...', title, body, { 
      success: false, 
      error: error.message 
    });
    
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
    // URGENT JOBS: Send to urgent_jobs topic directly
    // ============================================
    // If displayPage is 'urgent', send to urgent_jobs topic regardless of category
    // This ensures urgent job posts go to a separate notification channel
    // ============================================
    const displayPage = additionalData.displayPage || 'home';
    
    if (displayPage === 'urgent') {
      targetTopic = 'urgent_jobs';
      console.log('   🚨 URGENT JOB DETECTED!');
      console.log('   📤 Sending to URGENT JOBS channel: urgent_jobs');
      console.log('   📝 Original category was:', category);
    }
    // ============================================
    // JOBS: Determine the specific topic
    // ============================================
    else if (topic.startsWith('jobs_') && topic !== 'jobs_all') {
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
    logInfo('FCM_SUBSCRIBE', 'Starting topic subscription', {
      tokenPreview: deviceToken ? deviceToken.substring(0, 30) + '...' : 'MISSING',
      topic
    });
    
    console.log('========================================');
    console.log('🔔 SUBSCRIBE TO TOPIC DEBUG - START');
    console.log('========================================');
    console.log('📋 Input:');
    console.log('   - Device Token:', deviceToken ? deviceToken.substring(0, 30) + '...' : 'MISSING');
    console.log('   - Original Topic:', topic);
    
    if (!isFirebaseReady()) {
      const errorMsg = 'Firebase not ready';
      logError('FCM_SUBSCRIBE', errorMsg, { topic });
      console.error('❌', errorMsg);
      return { success: false, error: 'Firebase not initialized' };
    }

    const admin = getFirebaseAdmin();
    
    // Convert topic using the mapping
    const cleanTopic = categoryToTopic(topic);

    console.log(`📥 Subscribing device to topic: ${topic} -> ${cleanTopic}`);

    const response = await admin.messaging().subscribeToTopic(deviceToken, cleanTopic);

    const result = {
      success: response.successCount > 0,
      topic: cleanTopic,
      originalTopic: topic,
      response
    };
    
    // تسجيل النتيجة
    logSubscription('subscribe', deviceToken, cleanTopic, result);

    console.log(`✅ تم اشتراك الجهاز في Topic: ${cleanTopic}`);
    console.log(`📊 Success count: ${response.successCount}, Failure count: ${response.failureCount}`);
    
    if (response.failureCount > 0 && response.errors) {
      console.error('❌ Subscription errors:', response.errors);
      logError('FCM_SUBSCRIBE', 'Subscription had failures', {
        topic: cleanTopic,
        errors: response.errors
      });
    }
    
    console.log('========================================');

    return result;

  } catch (error) {
    logSubscription('subscribe', deviceToken, topic, { 
      success: false, 
      error: error.message 
    });
    
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
  getDeepLinkData,
  CATEGORY_TO_TOPIC_MAP,
  CATEGORY_TO_CHANNEL_MAP
};
