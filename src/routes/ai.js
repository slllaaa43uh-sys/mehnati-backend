const express = require('express');
const router = express.Router();
const { chatWithAI, checkOllamaHealth, generateCV, improveCV } = require('../controllers/aiController');
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

// ============================================
// 📝 AI CV Generation Routes
// ============================================

// @route   POST /api/v1/ai/cv/generate
// @desc    Generate CV using AI
// @access  Protected
router.post('/cv/generate', protect, generateCV);

// @route   POST /api/v1/ai/cv/improve
// @desc    Improve existing CV using AI
// @access  Protected
router.post('/cv/improve', protect, improveCV);

module.exports = router;
