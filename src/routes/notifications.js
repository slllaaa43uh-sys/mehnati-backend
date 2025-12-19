const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// جميع المسارات محمية
router.use(protect);

/**
 * ============================================
 * نقاط نهاية الإشعارات الجديدة
 * ============================================
 * 
 * GET    /api/v1/notifications              - جلب جميع الإشعارات
 * GET    /api/v1/notifications/unread-count - جلب عدد الإشعارات غير المقروءة
 * PUT    /api/v1/notifications/read-all     - تحديد جميع الإشعارات كمقروءة
 * PUT    /api/v1/notifications/:id/read     - تحديد إشعار واحد كمقروء
 * DELETE /api/v1/notifications/all          - حذف جميع الإشعارات
 * DELETE /api/v1/notifications/:id          - حذف إشعار واحد
 */

// جلب الإشعارات
router.get('/', getNotifications);

// جلب عدد الإشعارات غير المقروءة (للعداد)
router.get('/unread-count', getUnreadCount);

// تحديد جميع الإشعارات كمقروءة
router.put('/read-all', markAllAsRead);

// تحديد إشعار واحد كمقروء
router.put('/:id/read', markAsRead);

// حذف جميع الإشعارات
router.delete('/all', deleteAllNotifications);

// حذف إشعار واحد
router.delete('/:id', deleteNotification);

module.exports = router;
