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
    fileId: String, // Backblaze B2 file ID for deletion
    fileName: String, // Backblaze B2 file name
    type: {
      type: String,
      enum: ['image', 'video']
    }
  },
  // ميزات تعديل القصص (نصوص، ملصقات، فلاتر، تكبير/تصغير)
  overlays: [{
    id: Number,
    type: {
      type: String,
      enum: ['text', 'sticker']
    },
    content: String,
    x: Number,
    y: Number,
    scale: Number,
    color: String
  }],
  filter: {
    type: String,
    default: 'none'
  },
  mediaScale: {
    type: Number,
    default: 1
  },
  objectFit: {
    type: String,
    enum: ['contain', 'cover'],
    default: 'contain'
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
  // بيانات القص للفيديو
  trimStart: {
    type: Number,
    default: 0
  },
  trimEnd: {
    type: Number,
    default: 0
  },
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
