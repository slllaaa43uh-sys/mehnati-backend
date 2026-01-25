const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { uploadAvatar } = require('../services/storageService');
const crypto = require('crypto');
const sendEmail = require('../config/email');

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

    // Calculate total likes on all user's posts
    const userPosts = await Post.find({ user: user._id, status: 'approved' });
    let totalLikes = 0;
    userPosts.forEach(post => {
      totalLikes += post.reactions ? post.reactions.length : 0;
    });

    res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        postsCount,
        shortsCount,
        totalLikes,
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
    const allowedUpdates = ['name', 'bio', 'phone', 'country', 'city', 'avatar', 'website'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle avatar upload with compression to Backblaze B2
    if (req.file) {
      const uploadResult = await uploadAvatar(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      updates.avatar = uploadResult.file.url;
      console.log('Avatar uploaded with compression:', uploadResult.file.compressionRatio + '% saved');
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

    // Calculate total likes on all user's posts
    const userPosts = await Post.find({ user: user._id, status: 'approved' });
    let totalLikes = 0;
    userPosts.forEach(post => {
      totalLikes += post.reactions ? post.reactions.length : 0;
    });

    res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        postsCount,
        totalLikes,
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


// @desc    Get total likes count for user
// @route   GET /api/v1/users/:id/total-likes
// @access  Public
exports.getTotalLikes = async (req, res, next) => {
  try {
    const userId = req.params.id === 'me' ? req.user?.id : req.params.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'معرف المستخدم مطلوب'
      });
    }

    // حساب مجموع الإعجابات على جميع منشورات المستخدم
    const posts = await Post.find({ user: userId, status: 'approved' });
    
    let totalLikes = 0;
    posts.forEach(post => {
      totalLikes += post.reactions ? post.reactions.length : 0;
    });

    res.status(200).json({
      success: true,
      totalLikes
    });
  } catch (error) {
    next(error);
  }
};

// أيقونة التطبيق للبريد الإلكتروني
const getAppLogoSVG = () => `
<img src="https://mehnati-backend.onrender.com/assets/app-logo.jpg" alt="مهنتي لي" style="width: 80px; height: 80px; border-radius: 18px; object-fit: cover;">
`;

// قالب البريد الإلكتروني
const getEmailTemplate = (title, subtitle, userName, content, footerText) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; text-align: center;">
      <div style="display: inline-block; margin-bottom: 15px;">
        ${getAppLogoSVG()}
      </div>
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${title}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">${subtitle}</p>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">مرحباً ${userName}،</h2>
      ${content}
    </div>
    <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} مهنتي لي. جميع الحقوق محفوظة.
      </p>
      ${footerText ? `<p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0 0;">${footerText}</p>` : ''}
    </div>
  </div>
</body>
</html>
`;

// @desc    Request account deletion (send verification code)
// @route   POST /api/v1/users/me/account/request-delete
// @access  Private
exports.requestDeleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Generate delete account verification code
    const verificationCode = user.getDeleteAccountCode();
    await user.save({ validateBeforeSave: false });

    // Email content for delete account verification
    const emailContent = `
      <p style="color: #6b7280; line-height: 1.8; margin: 0 0 25px 0;">
        لقد طلبت حذف حسابك في مهنتي لي. استخدم الرمز التالي لتأكيد حذف حسابك:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; padding: 20px 40px; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
          ${verificationCode}
        </div>
      </div>
      <p style="color: #ef4444; font-size: 14px; line-height: 1.6; margin: 25px 0 15px 0; font-weight: bold;">
        ⚠️ تحذير: حذف الحساب عملية لا يمكن التراجع عنها!
      </p>
      <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 0;">
        هذا الرمز صالح لمدة 10 دقائق فقط. إذا لم تطلب حذف حسابك، يمكنك تجاهل هذا البريد.
      </p>
    `;

    const htmlMessage = getEmailTemplate(
      'مهنتي لي',
      'تأكيد حذف الحساب',
      user.name,
      emailContent,
      'إذا لم تطلب هذا الإجراء، يرجى تجاهل هذا البريد وتأمين حسابك.'
    );

    try {
      await sendEmail({
        email: user.email,
        subject: 'رمز تأكيد حذف الحساب - مهنتي لي',
        html: htmlMessage
      });

      res.status(200).json({
        success: true,
        message: 'Verification code sent'
      });
    } catch (err) {
      console.error('Email error:', err);
      // Clear the code if email fails
      user.deleteAccountCode = undefined;
      user.deleteAccountCodeExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'فشل في إرسال رمز التحقق. يرجى المحاولة لاحقاً'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account and all associated data (with OTP verification)
// @route   DELETE /api/v1/users/me/account
// @access  Private
exports.deleteAccount = async (req, res, next) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    // Validate code is provided
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق مطلوب'
      });
    }

    // Hash the provided code
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    // Find user with matching code and not expired
    const user = await User.findOne({
      _id: userId,
      deleteAccountCode: hashedCode,
      deleteAccountCodeExpire: { $gt: Date.now() }
    }).select('+deleteAccountCode +deleteAccountCodeExpire');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح أو منتهي الصلاحية'
      });
    }

    const Story = require('../models/Story');
    const Report = require('../models/Report');

    // 1. حذف جميع منشورات المستخدم
    await Post.deleteMany({ user: userId });

    // 2. حذف جميع القصص
    await Story.deleteMany({ user: userId });

    // 3. حذف جميع الإشعارات (المرسلة والمستلمة)
    await Notification.deleteMany({
      $or: [
        { recipient: userId },
        { sender: userId }
      ]
    });

    // 4. حذف جميع البلاغات المرسلة من المستخدم
    await Report.deleteMany({ reporter: userId });

    // 5. حذف تعليقات المستخدم من جميع المنشورات
    await Post.updateMany(
      {},
      { $pull: { comments: { user: userId } } }
    );

    // 6. حذف ردود المستخدم من جميع التعليقات
    await Post.updateMany(
      {},
      { $pull: { 'comments.$[].replies': { user: userId } } }
    );

    // 7. حذف إعجابات المستخدم من جميع المنشورات
    await Post.updateMany(
      {},
      { $pull: { reactions: { user: userId } } }
    );

    // 8. حذف إعجابات المستخدم من التعليقات
    await Post.updateMany(
      {},
      { $pull: { 'comments.$[].likes': { user: userId } } }
    );

    // 9. إزالة المستخدم من قوائم المتابعين والمتابَعين
    await User.updateMany(
      {},
      { 
        $pull: { 
          followers: userId,
          following: userId 
        } 
      }
    );

    // 10. حذف مشاهدات المستخدم من القصص
    await Story.updateMany(
      {},
      { $pull: { views: { user: userId } } }
    );

    // 11. تعطيل الحساب وحذف رمز التحقق
    await User.findByIdAndUpdate(userId, {
      isActive: false,
      isDeleted: true,
      deletedAt: new Date(),
      email: `deleted_${userId}_${Date.now()}@deleted.com`,
      password: 'DELETED_ACCOUNT_' + Date.now(),
      deleteAccountCode: undefined,
      deleteAccountCodeExpire: undefined
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save FCM Token for push notifications
// @route   POST /api/v1/users/fcm-token
// @access  Private
exports.saveFcmToken = async (req, res, next) => {
  try {
    const { fcmToken, deviceId, platform } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM Token مطلوب'
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Check if token already exists for this user
    const existingTokenIndex = user.fcmTokens.findIndex(t => t.token === fcmToken);

    if (existingTokenIndex !== -1) {
      // Update lastUsed timestamp
      user.fcmTokens[existingTokenIndex].lastUsed = new Date();
    } else {
      // Add new token (limit to 5 devices per user)
      if (user.fcmTokens.length >= 5) {
        // Remove oldest token
        user.fcmTokens.sort((a, b) => new Date(a.lastUsed) - new Date(b.lastUsed));
        user.fcmTokens.shift();
      }

      user.fcmTokens.push({
        token: fcmToken,
        deviceId: deviceId || null,
        platform: platform || 'android',
        createdAt: new Date(),
        lastUsed: new Date()
      });
    }

    await user.save();

    console.log(`✅ FCM Token saved for user ${user._id}`);

    res.status(200).json({
      success: true,
      message: 'تم حفظ FCM Token بنجاح'
    });
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    next(error);
  }
};

// @desc    Remove FCM Token (on logout)
// @route   DELETE /api/v1/users/fcm-token
// @access  Private
exports.removeFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM Token مطلوب'
      });
    }

    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { fcmTokens: { token: fcmToken } } }
    );

    console.log(`✅ FCM Token removed for user ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: 'تم إزالة FCM Token بنجاح'
    });
  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
    next(error);
  }
};


// ============================================
// دالة البحث عن المستخدمين
// ============================================

// @desc    Search users by name
// @route   GET /api/v1/users/search
// @access  Public
exports.searchUsers = async (req, res, next) => {
  try {
    const {
      q, // نص البحث
      page = 1,
      limit = 20
    } = req.query;

    // التحقق من وجود نص البحث
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال نص للبحث'
      });
    }

    const searchText = q.trim();

    // بناء استعلام البحث
    const query = {
      isActive: { $ne: false },
      isDeleted: { $ne: true },
      $or: [
        { name: { $regex: searchText, $options: 'i' } },
        { bio: { $regex: searchText, $options: 'i' } }
      ]
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('name avatar bio isVerified country city followersCount')
      .sort({ followersCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // إضافة عدد المنشورات لكل مستخدم
    const usersWithPostCount = await Promise.all(
      users.map(async (user) => {
        const postsCount = await Post.countDocuments({ 
          user: user._id, 
          status: 'approved' 
        });
        return {
          ...user,
          postsCount,
          followersCount: user.followersCount || 0
        };
      })
    );

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      query: searchText,
      count: usersWithPostCount.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      users: usersWithPostCount
    });
  } catch (error) {
    console.error('Search Users Error:', error);
    next(error);
  }
};
