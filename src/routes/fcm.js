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
 */
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { deviceToken, topic } = req.body;

    if (!deviceToken || !topic) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير deviceToken و topic'
      });
    }

    const result = await subscribeToTopic(deviceToken, topic);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `تم الاشتراك في ${topic} بنجاح`,
        data: result
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'فشل الاشتراك',
        error: result.error
      });
    }
  } catch (error) {
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
 */
router.post('/unsubscribe', protect, async (req, res) => {
  try {
    const { deviceToken, topic } = req.body;

    if (!deviceToken || !topic) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير deviceToken و topic'
      });
    }

    const result = await unsubscribeFromTopic(deviceToken, topic);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `تم إلغاء الاشتراك من ${topic} بنجاح`,
        data: result
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'فشل إلغاء الاشتراك',
        error: result.error
      });
    }
  } catch (error) {
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
