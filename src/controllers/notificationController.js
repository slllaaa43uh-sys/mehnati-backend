const Notification = require('../models/Notification');

// @desc    Get user notifications
// @route   GET /api/v1/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { recipient: req.user.id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'name avatar')
      .populate('post', 'content media displayPage isShort')
      .populate('story', 'text media')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      notifications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notifications count
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

// @desc    Mark notification as read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديد الإشعار كمقروء',
      notification
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read (when clicking bell icon)
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

// @desc    Delete notification
// @route   DELETE /api/v1/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم حذف الإشعار'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete all notifications
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

// @desc    Delete multiple notifications
// @route   DELETE /api/v1/notifications/bulk
// @access  Private
exports.deleteBulkNotifications = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير قائمة معرفات الإشعارات'
      });
    }

    const result = await Notification.deleteMany({
      _id: { $in: ids },
      recipient: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'تم حذف الإشعارات المحددة',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to create notification (used by other controllers)
// Types: like, comment, reply, comment_like, reply_like, repost, follow, mention, share, story_view
exports.createNotification = async (data) => {
  try {
    // Don't create notification if sender is recipient
    if (data.sender.toString() === data.recipient.toString()) {
      return null;
    }

    // Check for duplicate notification within last 5 minutes to prevent spam
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingNotification = await Notification.findOne({
      recipient: data.recipient,
      sender: data.sender,
      type: data.type,
      post: data.post,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (existingNotification) {
      return existingNotification;
    }

    const notification = await Notification.create(data);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Helper function to delete notifications when action is undone (unlike, uncomment, etc.)
exports.deleteNotificationByAction = async (data) => {
  try {
    await Notification.deleteOne({
      recipient: data.recipient,
      sender: data.sender,
      type: data.type,
      post: data.post
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};
