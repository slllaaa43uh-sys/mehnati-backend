const Notification = require('../models/Notification');

/**
 * ============================================
 * نقاط نهاية الإشعارات
 * ============================================
 * 
 * أنواع الإشعارات المدعومة:
 * 
 * للمنشورات العادية:
 * - like: أعجب بمنشورك
 * - comment: علق على منشورك
 * - reply: رد على تعليقك
 * - comment_like: أعجب بتعليقك
 * - reply_like: أعجب بردك
 * - repost: أعاد نشر منشورك
 * - follow: تابعك
 * 
 * للشورتس (الفيديوهات القصيرة):
 * - short_like: أعجب بفيديوهك
 * - short_comment: علق على فيديوهك
 * - short_reply: رد على تعليقك (في الشورتس)
 * - short_comment_like: أعجب بتعليقك (في الشورتس)
 * - short_reply_like: أعجب بردك (في الشورتس)
 * - short_repost: أعاد نشر فيديوهك
 */

// @desc    جلب جميع الإشعارات
// @route   GET /api/v1/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'name avatar')
      .populate('post', 'content media displayPage isShort attractiveTitle coverImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // تحويل الإشعارات لتضمين بيانات إضافية للواجهة الأمامية
    const formattedNotifications = notifications.map(notif => {
      const notification = notif.toObject();
      
      // إضافة معلومات الشورتس إذا كان الإشعار متعلق بشورتس
      if (notification.post && notification.post.isShort) {
        const videoMedia = notification.post.media?.find(m => m.type === 'video') || notification.post.media?.[0];
        notification.short = {
          _id: notification.post._id,
          thumbnail: videoMedia?.thumbnail || notification.post.coverImage?.url || null,
          title: notification.post.attractiveTitle || notification.post.content?.substring(0, 50) || null
        };
      }
      
      return notification;
    });

    const total = await Notification.countDocuments({ recipient: req.user.id });
    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      notifications: formattedNotifications,
      unreadCount,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    جلب عدد الإشعارات غير المقروءة (للعداد على أيقونة الجرس)
// @route   GET /api/v1/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    تحديد إشعار واحد كمقروء
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديد الإشعار كمقروء',
      notification
    });
  } catch (error) {
    next(error);
  }
};

// @desc    تحديد جميع الإشعارات كمقروءة (عند الضغط على أيقونة الجرس)
// @route   PUT /api/v1/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'تم تحديد جميع الإشعارات كمقروءة',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    حذف إشعار واحد
// @route   DELETE /api/v1/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم حذف الإشعار'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    حذف جميع الإشعارات
// @route   DELETE /api/v1/notifications/all
// @access  Private
exports.deleteAllNotifications = async (req, res, next) => {
  try {
    const result = await Notification.deleteMany({ recipient: req.user.id });

    res.status(200).json({
      success: true,
      message: 'تم حذف جميع الإشعارات',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * دوال مساعدة لإنشاء الإشعارات
 * ============================================
 */

// دالة إنشاء إشعار (تُستخدم من المتحكمات الأخرى)
exports.createNotification = async (data) => {
  try {
    // لا تنشئ إشعار إذا كان المرسل هو المستلم
    if (data.sender.toString() === data.recipient.toString()) {
      return null;
    }

    const notification = await Notification.create(data);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};
