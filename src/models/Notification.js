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
      'story_view',     // مشاهدة قصة
      // أنواع الشورتس (لا تُستخدم حالياً)
      'short_like',
      'short_comment',
      'short_reply',
      'short_comment_like',
      'short_reply_like'
    ],
    required: true
  },
  // المنشور المرتبط
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  // الشورت المرتبط (للفيديوهات القصيرة)
  short: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  // القصة المرتبطة
  story: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story'
  },
  // معلومات التعليق
  comment: {
    text: String,
    commentId: mongoose.Schema.Types.ObjectId
  },
  // معلومات الرد
  reply: {
    text: String,
    replyId: mongoose.Schema.Types.ObjectId,
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
    replyText: String,        // نص الرد
    displayPage: String       // صفحة عرض المنشور (home, jobs, haraj)
  },
  // حالة القراءة
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

// Indexes for better query performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ sender: 1, recipient: 1, type: 1, post: 1 }); // للتحقق من التكرار

module.exports = mongoose.model('Notification', notificationSchema);
