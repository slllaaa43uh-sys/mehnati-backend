const express = require('express');
const router = express.Router();
const { chatWithAI, checkOllamaHealth } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// ============================================
// 🤖 AI Chat Routes
// ============================================

// @route   POST /api/v1/ai/chat
// @desc    Chat with AI Assistant (Streaming)
// @access  Protected
router.post('/chat', protect, chatWithAI);

// @route   GET /api/v1/ai/health
// @desc    Check Ollama health status
// @access  Public
router.get('/health', checkOllamaHealth);

module.exports = router;
