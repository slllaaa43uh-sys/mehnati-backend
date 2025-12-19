const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

// @desc    Get user by ID
// @route   GET /api/v1/users/:id
// @access  Public
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers', 'name avatar')
      .populate('following', 'name avatar');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Get posts count
    const postsCount = await Post.countDocuments({ user: user._id, status: 'approved' });
    const shortsCount = await Post.countDocuments({ user: user._id, isShort: true, status: 'approved' });

    res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        postsCount,
        shortsCount,
        followersCount: user.followers.length,
        followingCount: user.following.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/v1/users/me
// @access  Private
exports.updateMe = async (req, res, next) => {
  try {
    const allowedUpdates = ['name', 'bio', 'phone', 'country', 'city', 'avatar'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle avatar upload from Cloudinary
    if (req.file) {
      updates.avatar = req.file.path; // Cloudinary URL
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'تم تحديث الملف الشخصي',
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/v1/users/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('followers', 'name avatar')
      .populate('following', 'name avatar');

    const postsCount = await Post.countDocuments({ user: user._id, status: 'approved' });

    res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        postsCount,
        followersCount: user.followers.length,
        followingCount: user.following.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Follow/Unfollow user
// @route   POST /api/v1/follow/:id
// @access  Private
exports.toggleFollow = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكنك متابعة نفسك'
      });
    }

    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    const isFollowing = currentUser.following.includes(req.params.id);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== req.params.id
      );
      userToFollow.followers = userToFollow.followers.filter(
        id => id.toString() !== req.user.id
      );
    } else {
      // Follow
      currentUser.following.push(req.params.id);
      userToFollow.followers.push(req.user.id);

      // Create notification
      await Notification.create({
        recipient: userToFollow._id,
        sender: req.user.id,
        type: 'follow'
      });
    }

    await currentUser.save();
    await userToFollow.save();

    res.status(200).json({
      success: true,
      isFollowing: !isFollowing,
      message: isFollowing ? 'تم إلغاء المتابعة' : 'تمت المتابعة'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get follow status
// @route   GET /api/v1/follow/:id/status
// @access  Private
exports.getFollowStatus = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const isFollowing = currentUser.following.includes(req.params.id);

    res.status(200).json({
      success: true,
      isFollowing
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get suggested users
// @route   GET /api/v1/users/suggested
// @access  Private
exports.getSuggestedUsers = async (req, res, next) => {
  try {
    const { type, limit = 10 } = req.query;
    const currentUser = await User.findById(req.user.id);

    const query = {
      _id: { $nin: [...currentUser.following, req.user.id] },
      isActive: true
    };

    if (type === 'company') {
      query.accountType = 'company';
    } else if (type === 'person') {
      query.accountType = 'person';
    }

    const users = await User.find(query)
      .select('name avatar bio accountType followers')
      .limit(parseInt(limit))
      .sort({ 'followers.length': -1 });

    const suggested = users.map(user => ({
      id: user._id,
      _id: user._id,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      type: user.accountType,
      followersCount: user.followers.length
    }));

    res.status(200).json({
      success: true,
      suggested
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user notifications
// @route   GET /api/v1/users/me/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'name avatar')
      .populate('post', 'title content media displayPage isShort')
      .populate('short', 'title content media')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false
    });

    const total = await Notification.countDocuments({ recipient: req.user.id });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notifications count
// @route   GET /api/v1/users/me/notifications/unread-count
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
// @route   PUT /api/v1/users/me/notifications/:id/read
// @access  Private
exports.markNotificationRead = async (req, res, next) => {
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
      notification
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read (when clicking bell icon)
// @route   PUT /api/v1/users/me/notifications/read-all
// @access  Private
exports.markAllNotificationsRead = async (req, res, next) => {
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
// @route   DELETE /api/v1/users/me/notifications/:id
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

// @desc    Delete all notifications
// @route   DELETE /api/v1/users/me/notifications/all
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

// @desc    Get user sections
// @route   GET /api/v1/users/sections
// @access  Private
exports.getSections = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      sections: user.sections || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create/Update section
// @route   POST /api/v1/users/sections
// @access  Private
exports.createSection = async (req, res, next) => {
  try {
    const { title, items } = req.body;
    const user = await User.findById(req.user.id);

    user.sections.push({ title, items: items || [] });
    await user.save();

    res.status(201).json({
      success: true,
      sections: user.sections
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete section
// @route   DELETE /api/v1/users/sections/:sectionId
// @access  Private
exports.deleteSection = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    user.sections = user.sections.filter(
      s => s._id.toString() !== req.params.sectionId
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: 'تم حذف القسم'
    });
  } catch (error) {
    next(error);
  }
};
