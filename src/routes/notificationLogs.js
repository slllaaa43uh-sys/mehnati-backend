const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  getRecentLogs, 
  getErrorLogs, 
  cleanOldLogs 
} = require('../services/notificationLogger');

/**
 * ============================================
 * Notification Logs Routes
 * ============================================
 * مسارات لعرض سجلات الإشعارات وتشخيص المشاكل
 */

/**
 * @route   GET /api/v1/notification-logs
 * @desc    جلب آخر السجلات
 * @access  Private (يفضل تقييده للمشرفين)
 */
router.get('/', protect, async (req, res) => {
  try {
    const { count = 100, errors_only = false } = req.query;
    
    let logs;
    if (errors_only === 'true') {
      logs = getErrorLogs(parseInt(count));
    } else {
      logs = getRecentLogs(parseInt(count));
    }
    
    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب السجلات',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/notification-logs/errors
 * @desc    جلب سجلات الأخطاء فقط
 * @access  Private
 */
router.get('/errors', protect, async (req, res) => {
  try {
    const { count = 50 } = req.query;
    const logs = getErrorLogs(parseInt(count));
    
    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب سجلات الأخطاء',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/notification-logs/clean
 * @desc    مسح السجلات القديمة
 * @access  Private (Admin only)
 */
router.post('/clean', protect, async (req, res) => {
  try {
    cleanOldLogs();
    
    res.status(200).json({
      success: true,
      message: 'تم مسح السجلات القديمة بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في مسح السجلات',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/notification-logs/stats
 * @desc    إحصائيات الإشعارات
 * @access  Private
 */
router.get('/stats', protect, async (req, res) => {
  try {
    const logs = getRecentLogs(1000);
    
    const stats = {
      total: logs.length,
      byLevel: {
        INFO: 0,
        SUCCESS: 0,
        WARN: 0,
        ERROR: 0
      },
      byCategory: {},
      last24Hours: {
        total: 0,
        errors: 0,
        success: 0
      }
    };
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    logs.forEach(log => {
      // Count by level
      if (stats.byLevel[log.level] !== undefined) {
        stats.byLevel[log.level]++;
      }
      
      // Count by category
      if (log.category) {
        stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      }
      
      // Count last 24 hours
      if (new Date(log.timestamp) > oneDayAgo) {
        stats.last24Hours.total++;
        if (log.level === 'ERROR') stats.last24Hours.errors++;
        if (log.level === 'SUCCESS') stats.last24Hours.success++;
      }
    });
    
    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإحصائيات',
      error: error.message
    });
  }
});

module.exports = router;
