const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'like',           // إعجاب بمنشور
      'comment',        // تعليق على منشور
      'reply',          // رد على تعليق
      'comment_like',   // إعجاب بتعليق
      'reply_like',     // إعجاب برد
      'repost',         // إعادة نشر منشور
      'follow',         // متابعة
      'mention',        // إشارة
      'share',          // مشاركة
      'story_view'      // مشاهدة قصة
    ],
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  short: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  story: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story'
  },
  comment: {
    text: String,
    commentId: mongoose.Schema.Types.ObjectId
  },
  // نص الإشعار المخصص
  message: {
    type: String,
    default: null
  },
  // بيانات إضافية للعرض
  metadata: {
    postContent: String,      // جزء من محتوى المنشور
    commentText: String,      // نص التعليق
    replyText: String         // نص الرد
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
