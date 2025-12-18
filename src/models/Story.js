const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    maxlength: [500, 'النص يجب أن لا يتجاوز 500 حرف']
  },
  backgroundColor: {
    type: String,
    default: '#1a1a2e'
  },
  media: {
    url: String,
    publicId: String, // Cloudinary public ID for deletion
    type: {
      type: String,
      enum: ['image', 'video']
    }
  },
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // القصة تنتهي بعد 24 ساعة
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

// Index for expiration
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Story', storySchema);
