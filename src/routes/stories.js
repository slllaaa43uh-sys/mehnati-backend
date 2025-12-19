const express = require('express');
const router = express.Router();
const {
  createStory,
  getStoriesFeed,
  getAllStories,
  getUserStories,
  viewStory,
  deleteStory,
  getStoryViewers
} = require('../controllers/storyController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes - للجميع بدون تسجيل دخول
router.get('/all', getAllStories); // NEW: Get all stories without auth
router.get('/user/:userId', getUserStories); // Get specific user's stories

// Protected routes - تحتاج تسجيل دخول
router.post('/', protect, upload.storyMedia, createStory);
router.get('/feed', protect, getStoriesFeed);
router.post('/:id/view', protect, viewStory);
router.get('/:id/viewers', protect, getStoryViewers);
router.delete('/:id', protect, deleteStory);

module.exports = router;
