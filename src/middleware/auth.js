const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
exports.protect = async (req, res, next) => {
  let token;

  // Check for token in header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'غير مصرح لك بالوصول. يرجى تسجيل الدخول'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب معطل'
      });
    }

    // Update last seen
    await User.updateOne(
      { _id: req.user._id },
      { $set: { lastSeen: new Date() } }
    );

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'جلسة غير صالحة. يرجى تسجيل الدخول مرة أخرى'
    });
  }
};

// Optional authentication - doesn't require but attaches user if token exists
exports.optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    } catch (error) {
      // Token invalid, continue without user
      req.user = null;
    }
  }

  next();
};
