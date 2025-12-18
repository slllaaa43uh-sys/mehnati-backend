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
  markNotificationRead,
  deleteNotification,
  getSections,
  createSection,
  deleteSection
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Current user routes
router.get('/me', protect, getMe);
router.put('/me', protect, upload.avatar, updateMe);

// Notifications
router.get('/me/notifications', protect, getNotifications);
router.put('/me/notifications/:id/read', protect, markNotificationRead);
router.delete('/me/notifications/:id', protect, deleteNotification);

// Sections
router.get('/sections', protect, getSections);
router.post('/sections', protect, createSection);
router.delete('/sections/:sectionId', protect, deleteSection);

// Suggested users
router.get('/suggested', protect, getSuggestedUsers);

// User by ID
router.get('/:id', getUser);

module.exports = router;
