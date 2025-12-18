const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');

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
        url: file.path, // Cloudinary URL
        publicId: file.filename, // Cloudinary public ID for deletion
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

    // Populate user data
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

    // Build query
    const query = { status: 'approved' };

    if (type) query.type = type;
    if (category) query.category = category;
    if (scope) query.scope = scope;
    if (country) query.country = country;
    if (city && city !== 'كل المدن') query.city = city;
    if (displayPage) query.displayPage = { $in: [displayPage, 'all'] };
    if (isShort !== undefined) query.isShort = isShort === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (userId) query.user = userId;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const posts = await Post.find(query)
      .populate('user', 'name avatar isVerified')
      .populate('reactions.user', 'name avatar')
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
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
      .populate('comments.replies.user', 'name avatar');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    // Increment views
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

    // Check ownership
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل هذا المنشور'
      });
    }

    // Update fields
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

    // Check ownership
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

    // Check if already reacted
    const existingReaction = post.reactions.find(
      r => r.user.toString() === req.user.id
    );

    if (existingReaction) {
      // Remove reaction (unlike)
      post.reactions = post.reactions.filter(
        r => r.user.toString() !== req.user.id
      );
    } else {
      // Add reaction
      post.reactions.push({ user: req.user.id, type });

      // Create notification (if not own post)
      if (post.user.toString() !== req.user.id) {
        await Notification.create({
          recipient: post.user,
          sender: req.user.id,
          type: 'like',
          post: post._id
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

    // Create notification
    if (post.user.toString() !== req.user.id) {
      await Notification.create({
        recipient: post.user,
        sender: req.user.id,
        type: 'comment',
        post: post._id,
        comment: { text: text.trim() }
      });
    }

    // Populate the new comment
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
