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
  getUserPosts,
  repostPost,
  undoRepost,
  hidePost,
  unhidePost,
  updateJobStatus,
  incrementShortView,
  searchPosts,
  getSearchSuggestions
} = require('../controllers/postController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getPostCounts } = require('../controllers/postCountController');

// Middleware لزيادة مهلة الطلب إلى 5 دقائق لرفع الملفات (للشبكات البطيئة)
const extendTimeout = (req, res, next) => {
  // 5 دقائق = 300000 مللي ثانية
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
};

// Public routes
router.get('/', optionalAuth, getPosts);

// Search routes (must be before /:id to avoid conflicts)
router.get('/search', optionalAuth, searchPosts);
router.get('/search/suggestions', getSearchSuggestions);

// Post counts for badges (must be before /:id)
router.get('/counts', getPostCounts);

// User posts
router.get('/user/:userId', optionalAuth, getUserPosts);

// Single post (must be after specific routes)
router.get('/:id', optionalAuth, getPost);

// Protected routes
router.post('/', protect, extendTimeout, upload.media, createPost);
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

// View tracking route
router.post('/:id/view', optionalAuth, incrementShortView);

module.exports = router;
