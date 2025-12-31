const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  paytabsWebhook,
  promotePost,
  getPaymentLink,
  checkFreePromotionEligibility,
  getPromotionOptions
} = require('../controllers/paymentController');

// @route   POST /api/payment/webhook
// @desc    PayTabs webhook endpoint
// @access  Public (PayTabs only)
router.post('/webhook', paytabsWebhook);

// @route   POST /api/payment/promote/:postId
// @desc    Promote a post (free/paid)
// @access  Private
router.post('/promote/:postId', protect, promotePost);

// @route   POST /api/payment/get-payment-link
// @desc    Get payment link for promotion
// @access  Private
router.post('/get-payment-link', protect, getPaymentLink);

// @route   GET /api/payment/check-free-eligibility
// @desc    Check if user can use free promotion
// @access  Private
router.get('/check-free-eligibility', protect, checkFreePromotionEligibility);

// @route   GET /api/payment/promotion-options
// @desc    Get all promotion options (all free now)
// @access  Public
router.get('/promotion-options', getPromotionOptions);

module.exports = router;
