const express = require('express');
const router = express.Router();
const {
  createStory,
  getStoriesFeed,
  getUserStories,
  viewStory,
  deleteStory,
  getStoryViewers
} = require('../controllers/storyController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', protect, upload.storyMedia, createStory);
router.get('/feed', protect, getStoriesFeed);
// FIXED: Added protect middleware to ensure only authenticated users can view stories
// and added following check in controller
router.get('/user/:userId', protect, getUserStories);
router.post('/:id/view', protect, viewStory);
router.get('/:id/viewers', protect, getStoryViewers);
router.delete('/:id', protect, deleteStory);

module.exports = router;
