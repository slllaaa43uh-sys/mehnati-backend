const mongoose = require('mongoose');

/**
 * ============================================
 * نموذج الإشعارات
 * ============================================
 * 
 * أنواع الإشعارات للمنشورات العادية:
 * - like: أعجب بمنشورك
 * - comment: علق على منشورك
 * - reply: رد على تعليقك
 * - comment_like: أعجب بتعليقك
 * - reply_like: أعجب بردك
 * - repost: أعاد نشر منشورك
 * - follow: تابعك
 * 
 * أنواع الإشعارات للشورتس (الفيديوهات القصيرة):
 * - short_like: أعجب بفيديوهك
 * - short_comment: علق على فيديوهك
 * - short_reply: رد على تعليقك (في الشورتس)
 * - short_comment_like: أعجب بتعليقك (في الشورتس)
 * - short_reply_like: أعجب بردك (في الشورتس)
 * - short_repost: أعاد نشر فيديوهك
 */

const notificationSchema = new mongoose.Schema({
  // المستلم (صاحب الإشعار)
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // المرسل (من قام بالفعل)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // نوع الإشعار
  type: {
    type: String,
    enum: [
      // إشعارات المنشورات العادية
      'like',           // أعجب بمنشورك
      'comment',        // علق على منشورك
      'reply',          // رد على تعليقك
      'comment_like',   // أعجب بتعليقك
      'reply_like',     // أعجب بردك
      'repost',         // أعاد نشر منشورك
      'follow',         // تابعك
      // إشعارات الشورتس (الفيديوهات القصيرة)
      'short_like',         // أعجب بفيديوهك
      'short_comment',      // علق على فيديوهك
      'short_reply',        // رد على تعليقك (في الشورتس)
      'short_comment_like', // أعجب بتعليقك (في الشورتس)
      'short_reply_like',   // أعجب بردك (في الشورتس)
      'short_repost'        // أعاد نشر فيديوهك
    ],
    required: true
  },
  // المنشور المرتبط (للمنشورات العادية والشورتس)
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  // معلومات التعليق (للإشعارات المتعلقة بالتعليقات)
  comment: {
    commentId: mongoose.Schema.Types.ObjectId,
    text: String
  },
  // معلومات الرد (للإشعارات المتعلقة بالردود)
  reply: {
    replyId: mongoose.Schema.Types.ObjectId,
    commentId: mongoose.Schema.Types.ObjectId,
    text: String
  },
  // بيانات إضافية للعرض
  metadata: {
    postContent: String,      // جزء من محتوى المنشور
    commentText: String,      // نص التعليق
    replyText: String,        // نص الرد
    displayPage: String,      // صفحة العرض (home, jobs, haraj)
    // بيانات الشورتس
    shortTitle: String,       // عنوان الفيديو القصير
    shortThumbnail: String,   // صورة مصغرة للفيديو
    isShort: Boolean          // هل هو شورتس
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

// فهارس لتحسين الأداء
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
