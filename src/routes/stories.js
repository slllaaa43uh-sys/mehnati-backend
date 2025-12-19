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
router.get('/user/:userId', getUserStories);
router.post('/:id/view', protect, viewStory);
router.get('/:id/viewers', protect, getStoryViewers);
router.delete('/:id', protect, deleteStory);

module.exports = router;
