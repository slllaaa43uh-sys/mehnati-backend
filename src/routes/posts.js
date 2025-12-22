const express = require('express');
const router = express.Router();
const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  reactToPost,
  addComment,
  getComments,
  addReply,
  likeComment,
  likeReply,
  deleteComment,
  deleteReply,
  getShortsForYou,
  getShortsFriends,
  getUserPosts,
  repostPost,
  undoRepost,
  hidePost,
  unhidePost,
  updateJobStatus,
  // دوال الشورتس الجديدة
  getShortsByCategory,
  incrementShortView,
  getMyShorts,
  updateShortSettings
} = require('../controllers/postController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', optionalAuth, getPosts);

// Shorts routes (must be before /:id to avoid conflicts)
router.get('/shorts/for-you', optionalAuth, getShortsForYou);
router.get('/shorts/friends', protect, getShortsFriends);
router.get('/shorts/my', protect, getMyShorts);
router.get('/shorts/category/:category', optionalAuth, getShortsByCategory);

// User posts
router.get('/user/:userId', optionalAuth, getUserPosts);

// Single post (must be after specific routes)
router.get('/:id', optionalAuth, getPost);

// Protected routes
router.post('/', protect, upload.media, createPost);
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);

// Reactions and comments
router.post('/:id/react', protect, reactToPost);
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', protect, addComment);
router.post('/:id/comments/:commentId/replies', protect, addReply);
router.post('/:id/comments/:commentId/like', protect, likeComment);
router.post('/:id/comments/:commentId/replies/:replyId/like', protect, likeReply);
router.delete('/:id/comments/:commentId', protect, deleteComment);
router.delete('/:id/comments/:commentId/replies/:replyId', protect, deleteReply);

// Repost routes
router.post('/:id/repost', protect, repostPost);
router.delete('/:id/repost', protect, undoRepost);

// Hide post routes
router.post('/:id/hide', protect, hidePost);
router.delete('/:id/hide', protect, unhidePost);

// Job status route
router.put('/:id/job-status', protect, updateJobStatus);

// Shorts specific routes
router.post('/:id/view', optionalAuth, incrementShortView);
router.put('/:id/short-settings', protect, updateShortSettings);

// Route for shorts interactions
router.post("/shorts/:id/interaction", protect, postController.handleShortInteraction);

module.exports = router;
