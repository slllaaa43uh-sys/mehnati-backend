const express = require('express');
const router = express.Router();
const {
  createReport,
  reportPost,
  getMyReports,
  getAllReports,
  updateReportStatus
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

// Protected routes
router.post('/', protect, createReport);
router.post('/post/:postId', protect, reportPost);
router.get('/my', protect, getMyReports);

// Admin routes (you may want to add admin middleware)
router.get('/', protect, getAllReports);
router.put('/:id', protect, updateReportStatus);

module.exports = router;
