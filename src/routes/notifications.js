const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  deleteBulkNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Get notifications with pagination
router.get('/', getNotifications);

// Get unread count (for bell icon badge)
router.get('/unread-count', getUnreadCount);

// Mark all as read (when clicking bell icon)
router.put('/read-all', markAllAsRead);

// Mark single notification as read
router.put('/:id/read', markAsRead);

// Delete all notifications
router.delete('/all', deleteAllNotifications);

// Delete multiple notifications (bulk)
router.delete('/bulk', deleteBulkNotifications);

// Delete single notification
router.delete('/:id', deleteNotification);

module.exports = router;
