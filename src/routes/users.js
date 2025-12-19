const express = require('express');
const router = express.Router();
const {
  getUser,
  updateMe,
  getMe,
  toggleFollow,
  getFollowStatus,
  getSuggestedUsers,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  getSections,
  createSection,
  deleteSection,
  getTotalLikes,
  deleteAccount
} = require('../controllers/userController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Current user routes
router.get('/me', protect, getMe);
router.put('/me', protect, upload.avatar, updateMe);
router.delete('/me/account', protect, deleteAccount);

// Notifications - Order matters! More specific routes first
router.get('/me/notifications/unread-count', protect, getUnreadCount);
router.put('/me/notifications/read-all', protect, markAllNotificationsRead);
router.delete('/me/notifications/all', protect, deleteAllNotifications);
router.get('/me/notifications', protect, getNotifications);
router.put('/me/notifications/:id/read', protect, markNotificationRead);
router.delete('/me/notifications/:id', protect, deleteNotification);

// Sections
router.get('/sections', protect, getSections);
router.post('/sections', protect, createSection);
router.delete('/sections/:sectionId', protect, deleteSection);

// Suggested users
router.get('/suggested', protect, getSuggestedUsers);

// Total likes for user
router.get('/:id/total-likes', optionalAuth, getTotalLikes);

// User by ID
router.get('/:id', getUser);

module.exports = router;
