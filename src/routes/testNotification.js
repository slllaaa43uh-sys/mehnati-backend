const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  sendNotificationToTopic, 
  sendNotificationToDevice 
} = require('../services/fcmService');

/**
 * ============================================
 * Test Notification Routes
 * ============================================
 * مسارات لاختبار الإشعارات والتأكد من عملها
 */

/**
 * @route   POST /api/v1/test-notification/topic
 * @desc    اختبار إرسال إشعار إلى Topic
 * @access  Private
 */
router.post('/topic', protect, async (req, res) => {
  try {
    const { topic = 'jobs_driver', title, body } = req.body;
    
    const testTitle = title || 'اختبار الإشعارات 🔔';
    const testBody = body || 'هذا إشعار تجريبي للتأكد من عمل النظام';
    
    console.log('========================================');
    console.log('🧪 TEST NOTIFICATION - TOPIC');
    console.log('========================================');
    console.log('📋 Test Parameters:');
    console.log('   - Topic:', topic);
    console.log('   - Title:', testTitle);
    console.log('   - Body:', testBody);
    console.log('   - User ID:', req.user.id);
    
    const result = await sendNotificationToTopic(topic, testTitle, testBody, {
      type: 'test',
      testId: Date.now().toString(),
      userId: req.user.id
    });
    
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    console.log('========================================');
    
    res.status(200).json({
      success: result.success,
      message: result.success 
        ? 'تم إرسال الإشعار التجريبي بنجاح' 
        : 'فشل إرسال الإشعار التجريبي',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إرسال الإشعار التجريبي',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/test-notification/device
 * @desc    اختبار إرسال إشعار إلى جهاز محدد
 * @access  Private
 */
router.post('/device', protect, async (req, res) => {
  try {
    const { deviceToken, title, body } = req.body;
    
    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير deviceToken'
      });
    }
    
    const testTitle = title || 'اختبار الإشعارات 🔔';
    const testBody = body || 'هذا إشعار تجريبي للتأكد من عمل النظام';
    
    console.log('========================================');
    console.log('🧪 TEST NOTIFICATION - DEVICE');
    console.log('========================================');
    console.log('📋 Test Parameters:');
    console.log('   - Device Token:', deviceToken.substring(0, 30) + '...');
    console.log('   - Title:', testTitle);
    console.log('   - Body:', testBody);
    console.log('   - User ID:', req.user.id);
    
    const result = await sendNotificationToDevice(deviceToken, testTitle, testBody, {
      type: 'test',
      testId: Date.now().toString(),
      userId: req.user.id
    });
    
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    console.log('========================================');
    
    res.status(200).json({
      success: result.success,
      message: result.success 
        ? 'تم إرسال الإشعار التجريبي بنجاح' 
        : 'فشل إرسال الإشعار التجريبي',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إرسال الإشعار التجريبي',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/test-notification/status
 * @desc    التحقق من حالة نظام الإشعارات
 * @access  Private
 */
router.get('/status', protect, async (req, res) => {
  try {
    const { isFirebaseReady } = require('../config/firebase');
    const firebaseReady = isFirebaseReady();
    
    res.status(200).json({
      success: true,
      status: {
        firebaseReady,
        timestamp: new Date().toISOString()
      },
      message: firebaseReady 
        ? 'نظام الإشعارات جاهز ✅' 
        : 'نظام الإشعارات غير جاهز ❌'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في التحقق من حالة النظام',
      error: error.message
    });
  }
});

module.exports = router;
