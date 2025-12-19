const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * ============================================
 * دالة مساعدة لإنشاء الإشعارات
 * ============================================
 */
const createNotification = async (data) => {
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

// @desc    Create new post
// @route   POST /api/v1/posts
// @access  Private
exports.createPost = async (req, res, next) => {
  try {
    const {
      title,
      content,
      type,
      category,
      scope,
      country,
      city,
      location,
      contactEmail,
      contactPhone,
      contactMethods,
      isFeatured,
      displayPage,
      isShort,
      price,
      currency,
      jobDetails
    } = req.body;

    // Handle media files from Cloudinary
    let media = [];
    if (req.files && req.files.length > 0) {
      media = req.files.map(file => ({
        url: file.path,
        publicId: file.filename,
        type: file.mimetype.startsWith('video') ? 'video' : 'image'
      }));
    }

    // Parse media from body if sent as JSON string
    if (req.body.media) {
      try {
        const parsedMedia = typeof req.body.media === 'string' 
          ? JSON.parse(req.body.media) 
          : req.body.media;
        if (Array.isArray(parsedMedia)) {
          media = [...media, ...parsedMedia];
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Validate: Must have either content or media
    if ((!content || content.trim() === '') && media.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة محتوى نصي أو صور/فيديو'
      });
    }

    const post = await Post.create({
      user: req.user.id,
      title,
      content,
      media,
      type: type || 'general',
      category,
      scope: scope || 'global',
      country: scope === 'local' ? country : null,
      city: scope === 'local' ? city : null,
      location,
      contactEmail,
      contactPhone,
      contactMethods: contactMethods ? (Array.isArray(contactMethods) ? contactMethods : [contactMethods]) : [],
      isFeatured: isFeatured || false,
      displayPage: displayPage || 'home',
      isShort: isShort || false,
      price,
      currency,
      jobDetails
    });

    await post.populate('user', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'تم نشر المنشور بنجاح',
      post
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all posts (with filters)
// @route   GET /api/v1/posts
// @access  Public
exports.getPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      scope,
      country,
      city,
      displayPage,
      isShort,
      isFeatured,
      userId
    } = req.query;

    const query = { status: 'approved' };

    // تضمين المنشورات المعاد نشرها مع المنشورات العادية
    if (type) {
      query.type = { $in: [type, 'repost'] };
    }
    if (category) query.category = category;
    if (scope) query.scope = scope;
    if (country) query.country = country;
    if (city && city !== 'كل المدن') query.city = city;
    if (displayPage) query.displayPage = { $in: [displayPage, 'all'] };
    if (isShort !== undefined) query.isShort = isShort === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (userId) query.user = userId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find(query)
      .populate('user', 'name avatar isVerified')
      .populate('reactions.user', 'name avatar')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'user',
          select: 'name avatar isVerified'
        }
      })
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: posts.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      posts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single post
// @route   GET /api/v1/posts/:id
// @access  Public
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar bio isVerified followersCount')
      .populate('reactions.user', 'name avatar')
      .populate('comments.user', 'name avatar')
      .populate('comments.replies.user', 'name avatar')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'user',
          select: 'name avatar isVerified'
        }
      });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    post.views += 1;
    await post.save();

    res.status(200).json({
      success: true,
      post
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update post
// @route   PUT /api/v1/posts/:id
// @access  Private
exports.updatePost = async (req, res, next) => {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل هذا المنشور'
      });
    }

    const allowedUpdates = [
      'title', 'content', 'category', 'scope', 'country', 'city',
      'location', 'contactEmail', 'contactPhone', 'contactMethods',
      'isFeatured', 'displayPage', 'price', 'currency', 'jobDetails'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        post[field] = req.body[field];
      }
    });

    await post.save();
    await post.populate('user', 'name avatar');

    res.status(200).json({
      success: true,
      message: 'تم تحديث المنشور بنجاح',
      post
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post
// @route   DELETE /api/v1/posts/:id
// @access  Private
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بحذف هذا المنشور'
      });
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم حذف المنشور بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * الإعجاب بالمنشور - إشعار: أعجب بمنشورك
 * ============================================
 */
// @desc    Like/Unlike post
// @route   POST /api/v1/posts/:id/react
// @access  Private
exports.reactToPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    const { type = 'like' } = req.body;

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const existingReaction = post.reactions.find(
      r => r.user.toString() === req.user.id
    );

    if (existingReaction) {
      // إلغاء الإعجاب
      post.reactions = post.reactions.filter(
        r => r.user.toString() !== req.user.id
      );
    } else {
      // إضافة إعجاب
      post.reactions.push({ user: req.user.id, type });

      // إنشاء إشعار: أعجب بمنشورك (فقط للمنشورات العادية، ليس الشورتس)
      if (!post.isShort) {
        await createNotification({
          recipient: post.user,
          sender: req.user.id,
          type: 'like',
          post: post._id,
          metadata: {
            postContent: post.content ? post.content.substring(0, 100) : null,
            displayPage: post.displayPage
          }
        });
      }
    }

    await post.save();

    res.status(200).json({
      success: true,
      isLiked: !existingReaction,
      likesCount: post.reactions.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * التعليق على المنشور - إشعار: علق على منشورك
 * ============================================
 */
// @desc    Add comment to post
// @route   POST /api/v1/posts/:id/comments
// @access  Private
exports.addComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    const { text } = req.body;

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'نص التعليق مطلوب'
      });
    }

    const comment = {
      user: req.user.id,
      text: text.trim()
    };

    post.comments.push(comment);
    await post.save();

    const newComment = post.comments[post.comments.length - 1];

    // إنشاء إشعار: علق على منشورك (فقط للمنشورات العادية، ليس الشورتس)
    if (!post.isShort) {
      await createNotification({
        recipient: post.user,
        sender: req.user.id,
        type: 'comment',
        post: post._id,
        comment: {
          commentId: newComment._id,
          text: text.trim()
        },
        metadata: {
          commentText: text.trim().substring(0, 100),
          postContent: post.content ? post.content.substring(0, 50) : null,
          displayPage: post.displayPage
        }
      });
    }

    await post.populate('comments.user', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'تم إضافة التعليق',
      comment: post.comments[post.comments.length - 1]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * الرد على التعليق - إشعار: رد على تعليقك
 * ============================================
 */
// @desc    Add reply to comment
// @route   POST /api/v1/posts/:id/comments/:commentId/replies
// @access  Private
exports.addReply = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'نص الرد مطلوب'
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    const reply = {
      user: req.user.id,
      text: text.trim(),
      likes: []
    };

    comment.replies.push(reply);
    await post.save();

    const newReply = comment.replies[comment.replies.length - 1];

    // إنشاء إشعار: رد على تعليقك (فقط للمنشورات العادية، ليس الشورتس)
    if (!post.isShort) {
      await createNotification({
        recipient: comment.user,
        sender: req.user.id,
        type: 'reply',
        post: post._id,
        comment: {
          commentId: comment._id,
          text: comment.text
        },
        reply: {
          replyId: newReply._id,
          commentId: comment._id,
          text: text.trim()
        },
        metadata: {
          replyText: text.trim().substring(0, 100),
          commentText: comment.text ? comment.text.substring(0, 50) : null,
          displayPage: post.displayPage
        }
      });
    }

    await post.populate('comments.replies.user', 'name avatar');

    const updatedComment = post.comments.id(commentId);
    const populatedReply = updatedComment.replies[updatedComment.replies.length - 1];

    res.status(201).json({
      success: true,
      message: 'تم إضافة الرد',
      reply: populatedReply
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * الإعجاب بالتعليق - إشعار: أعجب بتعليقك
 * ============================================
 */
// @desc    Like/Unlike comment
// @route   POST /api/v1/posts/:id/comments/:commentId/like
// @access  Private
exports.likeComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    if (!comment.likes) {
      comment.likes = [];
    }

    const existingLike = comment.likes.find(
      like => like.user.toString() === req.user.id
    );

    if (existingLike) {
      // إلغاء الإعجاب
      comment.likes = comment.likes.filter(
        like => like.user.toString() !== req.user.id
      );
    } else {
      // إضافة إعجاب
      comment.likes.push({ user: req.user.id });

      // إنشاء إشعار: أعجب بتعليقك (فقط للمنشورات العادية، ليس الشورتس)
      if (!post.isShort) {
        await createNotification({
          recipient: comment.user,
          sender: req.user.id,
          type: 'comment_like',
          post: post._id,
          comment: {
            commentId: comment._id,
            text: comment.text
          },
          metadata: {
            commentText: comment.text ? comment.text.substring(0, 100) : null,
            displayPage: post.displayPage
          }
        });
      }
    }

    await post.save();

    res.status(200).json({
      success: true,
      isLiked: !existingLike,
      likesCount: comment.likes.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * الإعجاب بالرد - إشعار: أعجب بردك
 * ============================================
 */
// @desc    Like/Unlike reply
// @route   POST /api/v1/posts/:id/comments/:commentId/replies/:replyId/like
// @access  Private
exports.likeReply = async (req, res, next) => {
  try {
    const { id, commentId, replyId } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'الرد غير موجود'
      });
    }

    if (!reply.likes) {
      reply.likes = [];
    }

    const existingLike = reply.likes.find(
      like => like.user.toString() === req.user.id
    );

    if (existingLike) {
      // إلغاء الإعجاب
      reply.likes = reply.likes.filter(
        like => like.user.toString() !== req.user.id
      );
    } else {
      // إضافة إعجاب
      reply.likes.push({ user: req.user.id });

      // إنشاء إشعار: أعجب بردك (فقط للمنشورات العادية، ليس الشورتس)
      if (!post.isShort) {
        await createNotification({
          recipient: reply.user,
          sender: req.user.id,
          type: 'reply_like',
          post: post._id,
          comment: {
            commentId: comment._id,
            text: comment.text
          },
          reply: {
            replyId: reply._id,
            commentId: comment._id,
            text: reply.text
          },
          metadata: {
            replyText: reply.text ? reply.text.substring(0, 100) : null,
            displayPage: post.displayPage
          }
        });
      }
    }

    await post.save();

    res.status(200).json({
      success: true,
      isLiked: !existingLike,
      likesCount: reply.likes.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * إعادة النشر - إشعار: أعاد نشر منشورك
 * ============================================
 */
// @desc    Repost a post
// @route   POST /api/v1/posts/:id/repost
// @access  Private
exports.repostPost = async (req, res, next) => {
  try {
    const { content } = req.body;
    const originalPostId = req.params.id;

    const originalPost = await Post.findById(originalPostId)
      .populate('user', 'name avatar');

    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: 'المنشور الأصلي غير موجود'
      });
    }

    // لا تسمح بإعادة نشر الشورتس
    if (originalPost.isShort) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إعادة نشر الفيديوهات القصيرة'
      });
    }

    const existingRepost = await Post.findOne({
      user: req.user.id,
      originalPost: originalPostId,
      isRepost: true
    });

    if (existingRepost) {
      return res.status(400).json({
        success: false,
        message: 'لقد قمت بإعادة نشر هذا المنشور مسبقاً'
      });
    }

    const repost = await Post.create({
      user: req.user.id,
      content: content || '',
      type: 'repost',
      isRepost: true,
      originalPost: originalPostId,
      displayPage: originalPost.displayPage,
      status: 'approved'
    });

    originalPost.repostsCount = (originalPost.repostsCount || 0) + 1;
    await originalPost.save();

    await repost.populate('user', 'name avatar');
    await repost.populate({
      path: 'originalPost',
      populate: {
        path: 'user',
        select: 'name avatar'
      }
    });

    // إنشاء إشعار: أعاد نشر منشورك
    // التأكد من أن المستلم هو صاحب المنشور الأصلي
    const recipientId = originalPost.user._id || originalPost.user;
    if (recipientId) {
      await createNotification({
        recipient: recipientId,
        sender: req.user.id,
        type: 'repost',
        post: originalPost._id,
        metadata: {
          postContent: originalPost.content ? originalPost.content.substring(0, 100) : null,
          displayPage: originalPost.displayPage
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'تمت إعادة النشر بنجاح',
      post: repost
    });
  } catch (error) {
    console.error('Repost error:', error);
    next(error);
  }
};

// @desc    Undo repost (delete repost)
// @route   DELETE /api/v1/posts/:id/repost
// @access  Private
exports.undoRepost = async (req, res, next) => {
  try {
    const originalPostId = req.params.id;

    const repost = await Post.findOne({
      user: req.user.id,
      originalPost: originalPostId,
      isRepost: true
    });

    if (!repost) {
      return res.status(404).json({
        success: false,
        message: 'لم تقم بإعادة نشر هذا المنشور'
      });
    }

    const originalPost = await Post.findById(originalPostId);
    if (originalPost) {
      originalPost.repostsCount = Math.max(0, (originalPost.repostsCount || 1) - 1);
      await originalPost.save();
    }

    await repost.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم إلغاء إعادة النشر'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/v1/posts/:id/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    if (comment.user.toString() !== req.user.id && post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بحذف هذا التعليق'
      });
    }

    comment.deleteOne();
    await post.save();

    res.status(200).json({
      success: true,
      message: 'تم حذف التعليق بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete reply
// @route   DELETE /api/v1/posts/:id/comments/:commentId/replies/:replyId
// @access  Private
exports.deleteReply = async (req, res, next) => {
  try {
    const { id, commentId, replyId } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'الرد غير موجود'
      });
    }

    if (reply.user.toString() !== req.user.id && 
        comment.user.toString() !== req.user.id && 
        post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بحذف هذا الرد'
      });
    }

    reply.deleteOne();
    await post.save();

    res.status(200).json({
      success: true,
      message: 'تم حذف الرد بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get shorts (for you feed)
// @route   GET /api/v1/posts/shorts/for-you
// @access  Public
exports.getShortsForYou = async (req, res, next) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const shorts = await Post.find({ isShort: true, status: 'approved' })
      .populate('user', 'name avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: shorts.length,
      shorts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get shorts from friends
// @route   GET /api/v1/posts/shorts/friends
// @access  Private
exports.getShortsFriends = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const user = await User.findById(req.user.id);
    const following = user.following;

    const shorts = await Post.find({
      isShort: true,
      status: 'approved',
      user: { $in: following }
    })
      .populate('user', 'name avatar isVerified')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: shorts.length,
      shorts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user posts
// @route   GET /api/v1/posts/user/:userId
// @access  Public
exports.getUserPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isShort } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { user: req.params.userId, status: 'approved' };
    if (isShort !== undefined) query.isShort = isShort === 'true';

    const posts = await Post.find(query)
      .populate('user', 'name avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: posts.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      posts
    });
  } catch (error) {
    next(error);
  }
};
