const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  sendNotificationToTopic,
  sendNotificationToDevice,
  subscribeToTopic,
  unsubscribeFromTopic
} = require('../services/fcmService');

/**
 * ============================================
 * FCM Routes - مسارات إدارة الإشعارات
 * ============================================
 */

/**
 * ============================================
 * TOPIC BUILDING HELPER
 * ============================================
 * يبني الـ topic الصحيح بناءً على البيانات المرسلة من الواجهة الأمامية
 * 
 * الواجهة الأمامية ترسل:
 * - topic: 'jobs' أو 'haraj' أو 'urgent-jobs' أو 'global-jobs'
 * - category: الاسم الإنجليزي (مثل 'driver', 'cars')
 * - subType: 'seeker' أو 'employer' (للوظائف فقط)
 * 
 * الواجهة الخلفية تحتاج:
 * - jobs_driver_seeker أو jobs_driver_employer
 * - haraj_cars
 * - urgent_jobs
 * - global_jobs
 */
const buildFullTopic = (topic, category, subType) => {
  console.log('🔧 buildFullTopic called:');
  console.log('   - topic:', topic);
  console.log('   - category:', category);
  console.log('   - subType:', subType);
  
  // Handle special topics directly
  if (topic === 'urgent-jobs' || topic === 'urgent_jobs') {
    console.log('   ➡️ Result: urgent_jobs');
    return 'urgent_jobs';
  }
  
  if (topic === 'global-jobs' || topic === 'global_jobs') {
    console.log('   ➡️ Result: global_jobs');
    return 'global_jobs';
  }
  
  // Handle jobs with category and subType
  if (topic === 'jobs' && category) {
    let fullTopic = `jobs_${category}`;
    if (subType && (subType === 'seeker' || subType === 'employer')) {
      fullTopic = `${fullTopic}_${subType}`;
    }
    console.log('   ➡️ Result:', fullTopic);
    return fullTopic;
  }
  
  // Handle haraj with category
  if (topic === 'haraj' && category) {
    const fullTopic = `haraj_${category}`;
    console.log('   ➡️ Result:', fullTopic);
    return fullTopic;
  }
  
  // Fallback: return topic as-is (will be processed by categoryToTopic in fcmService)
  console.log('   ➡️ Result (fallback):', topic);
  return topic;
};

/**
 * @route   POST /api/v1/fcm/send-to-topic
 * @desc    إرسال إشعار إلى Topic محدد
 * @access  Private (Admin only - يمكن إضافة middleware للتحقق)
 */
router.post('/send-to-topic', protect, async (req, res) => {
  try {
    const { topic, title, body, data } = req.body;

    if (!topic || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير topic و title و body'
      });
    }

    const result = await sendNotificationToTopic(topic, title, body, data);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'تم إرسال الإشعار بنجاح',
        data: result
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'فشل إرسال الإشعار',
        error: result.error
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'خطأ في إرسال الإشعار',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/fcm/send-to-device
 * @desc    إرسال إشعار إلى جهاز محدد
 * @access  Private
 */
router.post('/send-to-device', protect, async (req, res) => {
  try {
    const { deviceToken, title, body, data } = req.body;

    if (!deviceToken || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير deviceToken و title و body'
      });
    }

    const result = await sendNotificationToDevice(deviceToken, title, body, data);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'تم إرسال الإشعار بنجاح',
        data: result
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'فشل إرسال الإشعار',
        error: result.error
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'خطأ في إرسال الإشعار',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/fcm/subscribe
 * @desc    اشتراك جهاز في Topic
 * @access  Private
 * 
 * البيانات المتوقعة من الواجهة الأمامية:
 * {
 *   deviceToken: "...",
 *   topic: "jobs" | "haraj" | "urgent-jobs" | "global-jobs",
 *   category: "driver" | "cars" | ... (اختياري),
 *   subType: "seeker" | "employer" (اختياري، للوظائف فقط)
 * }
 */
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { deviceToken, topic, category, subType } = req.body;

    console.log('========================================');
    console.log('📥 FCM SUBSCRIBE REQUEST');
    console.log('========================================');
    console.log('📋 Request Body:');
    console.log('   - deviceToken:', deviceToken ? deviceToken.substring(0, 30) + '...' : 'MISSING');
    console.log('   - topic:', topic);
    console.log('   - category:', category || 'NOT PROVIDED');
    console.log('   - subType:', subType || 'NOT PROVIDED');

    if (!deviceToken || !topic) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير deviceToken و topic'
      });
    }

    // Build the full topic name
    const fullTopic = buildFullTopic(topic, category, subType);
    
    console.log('📤 Subscribing to full topic:', fullTopic);

    const result = await subscribeToTopic(deviceToken, fullTopic);

    console.log('📊 Subscribe Result:', result);
    console.log('========================================');

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `تم الاشتراك في ${fullTopic} بنجاح`,
        data: {
          ...result,
          requestedTopic: topic,
          category: category,
          subType: subType,
          fullTopic: fullTopic
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'فشل الاشتراك',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Subscribe Error:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الاشتراك',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/fcm/unsubscribe
 * @desc    إلغاء اشتراك جهاز من Topic
 * @access  Private
 * 
 * البيانات المتوقعة من الواجهة الأمامية:
 * {
 *   deviceToken: "...",
 *   topic: "jobs" | "haraj" | "urgent-jobs" | "global-jobs",
 *   category: "driver" | "cars" | ... (اختياري),
 *   subType: "seeker" | "employer" (اختياري، للوظائف فقط)
 * }
 */
router.post('/unsubscribe', protect, async (req, res) => {
  try {
    const { deviceToken, topic, category, subType } = req.body;

    console.log('========================================');
    console.log('📤 FCM UNSUBSCRIBE REQUEST');
    console.log('========================================');
    console.log('📋 Request Body:');
    console.log('   - deviceToken:', deviceToken ? deviceToken.substring(0, 30) + '...' : 'MISSING');
    console.log('   - topic:', topic);
    console.log('   - category:', category || 'NOT PROVIDED');
    console.log('   - subType:', subType || 'NOT PROVIDED');

    if (!deviceToken || !topic) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير deviceToken و topic'
      });
    }

    // Build the full topic name
    const fullTopic = buildFullTopic(topic, category, subType);
    
    console.log('📤 Unsubscribing from full topic:', fullTopic);

    const result = await unsubscribeFromTopic(deviceToken, fullTopic);

    console.log('📊 Unsubscribe Result:', result);
    console.log('========================================');

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `تم إلغاء الاشتراك من ${fullTopic} بنجاح`,
        data: {
          ...result,
          requestedTopic: topic,
          category: category,
          subType: subType,
          fullTopic: fullTopic
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'فشل إلغاء الاشتراك',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Unsubscribe Error:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في إلغاء الاشتراك',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/fcm/subscribe-multiple
 * @desc    اشتراك جهاز في عدة Topics
 * @access  Private
 */
router.post('/subscribe-multiple', protect, async (req, res) => {
  try {
    const { deviceToken, topics } = req.body;

    if (!deviceToken || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير deviceToken ومصفوفة topics'
      });
    }

    const results = await Promise.allSettled(
      topics.map(topic => subscribeToTopic(deviceToken, topic))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    return res.status(200).json({
      success: true,
      message: `تم الاشتراك في ${successful} من ${results.length} مواضيع`,
      data: {
        total: results.length,
        successful,
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'خطأ في الاشتراك المتعدد',
      error: error.message
    });
  }
});

module.exports = router;
