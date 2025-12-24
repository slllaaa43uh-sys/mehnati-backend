const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getMe, 
  logout,
  forgotPassword,
  resetPassword,
  verifyResetToken
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

// Password reset routes
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.get('/verifyresettoken/:resettoken', verifyResetToken);

module.exports = router;
