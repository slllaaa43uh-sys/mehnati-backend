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
  addReply,
  likeComment,
  likeReply,
  deleteComment,
  deleteReply,
  getShortsForYou,
  getShortsFriends,
  getUserPosts,
  repostPost,
  undoRepost
} = require('../controllers/postController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', optionalAuth, getPosts);
router.get('/shorts/for-you', optionalAuth, getShortsForYou);
router.get('/shorts/friends', protect, getShortsFriends);
router.get('/user/:userId', optionalAuth, getUserPosts);
router.get('/:id', optionalAuth, getPost);

// Protected routes
router.post('/', protect, upload.media, createPost);
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/react', protect, reactToPost);
router.post('/:id/comments', protect, addComment);
router.post('/:id/comments/:commentId/replies', protect, addReply);
router.post('/:id/comments/:commentId/like', protect, likeComment);
router.post('/:id/comments/:commentId/replies/:replyId/like', protect, likeReply);
router.delete('/:id/comments/:commentId', protect, deleteComment);
router.delete('/:id/comments/:commentId/replies/:replyId', protect, deleteReply);

// Repost routes
router.post('/:id/repost', protect, repostPost);
router.delete('/:id/repost', protect, undoRepost);

module.exports = router;
