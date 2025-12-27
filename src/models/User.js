const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
    maxlength: [50, 'الاسم يجب أن لا يتجاوز 50 حرف']
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'البريد الإلكتروني غير صالح']
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'],
    select: false
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'النبذة يجب أن لا تتجاوز 500 حرف'],
    default: ''
  },
  website: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  country: {
    type: String,
    default: null
  },
  city: {
    type: String,
    default: null
  },
  accountType: {
    type: String,
    enum: ['person', 'company'],
    default: 'person'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // حقول التحقق من البريد الإلكتروني
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationCode: {
    type: String,
    select: false
  },
  emailVerificationExpire: {
    type: Date,
    select: false
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sections: [{
    title: String,
    items: [{
      type: { type: String, enum: ['post', 'short'] },
      id: mongoose.Schema.Types.ObjectId
    }]
  }],
  notificationSettings: {
    likes: { type: Boolean, default: true },
    comments: { type: Boolean, default: true },
    follows: { type: Boolean, default: true },
    messages: { type: Boolean, default: true }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  interestProfile: {
    interactedCategories: { type: Map, of: Number, default: {} },
    interactedCreators: { type: Map, of: Number, default: {} },
    fullyWatchedVideos: [mongoose.Schema.Types.ObjectId],
    skippedVideos: [mongoose.Schema.Types.ObjectId],
    hiddenCreators: [mongoose.Schema.Types.ObjectId]
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  lastFreePromotionUsed: {
    type: Date,
    default: null
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true
});

// Encrypt password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password reset token
userSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (30 minutes)
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

  return resetToken;
};

// Generate email verification code (6 digits)
userSchema.methods.getEmailVerificationCode = function() {
  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash code and set to emailVerificationCode field
  this.emailVerificationCode = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');

  // Set expire (10 minutes)
  this.emailVerificationExpire = Date.now() + 10 * 60 * 1000;

  return code;
};

module.exports = mongoose.model('User', userSchema);
