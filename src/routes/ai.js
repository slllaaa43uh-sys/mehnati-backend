const express = require('express');
const router = express.Router();
const { chatWithAI, checkOllamaHealth } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// ============================================
// 🤖 AI Chat Routes
// ============================================

// @route   POST /api/v1/ai/chat
// @desc    Chat with AI Assistant (Streaming) - يدعم إنشاء السيرة الذاتية
// @access  Protected
router.post('/chat', protect, chatWithAI);

// @route   GET /api/v1/ai/health
// @desc    Check AI health status
// @access  Public
router.get('/health', checkOllamaHealth);

module.exports = router;
