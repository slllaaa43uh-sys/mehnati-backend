const Report = require('../models/Report');
const Post = require('../models/Post');
const User = require('../models/User');
const Story = require('../models/Story');

// Helper: detect if a text contains a timestamp-like pattern
const containsTimestamp = (text) => {
  const s = (text || '').toString();
  // Match common patterns: YYYY-MM-DD, HH:MM, epoch-like 10-13 digit numbers
  return /(\d{4}-\d{2}-\d{2})/.test(s) || /(\d{2}:\d{2})/.test(s) || /(\d{10,13})/.test(s);
};

// @desc    Create report
// @route   POST /api/v1/reports
// @access  Private
exports.createReport = async (req, res, next) => {
  try {
    const { reportType, targetId, reason, details, media } = req.body;

    // Check for duplicate report (allow if reason differs or contains timestamp)
    const existingReport = await Report.findOne({
      reporter: req.user.id,
      reportType,
      targetId,
      status: { $in: ['pending', 'reviewed'] }
    });

    if (existingReport) {
      const sameReason = existingReport.reason && reason && existingReport.reason.trim() === reason.trim();
      const hasTs = containsTimestamp(reason) || !!req.body.timestamp;
      if (sameReason && !hasTs) {
        return res.status(429).json({
          success: false,
          message: 'تم إرسال بلاغ سابقًا، الرجاء الانتظار'
        });
      }
      // else proceed to create a new report (different reason or includes timestamp)
    }

    // Get target user info based on report type
    let targetUser = null;
    let targetUserName = null;
    let contentSnapshot = null;

    if (reportType === 'post' || reportType === 'video') {
      const post = await Post.findById(targetId).populate('user', 'name');
      if (post) {
        targetUser = post.user._id;
        targetUserName = post.user.name;
        contentSnapshot = post.content ? post.content.substring(0, 500) : null;
      }
    } else if (reportType === 'story') {
      const story = await Story.findById(targetId).populate('user', 'name');
      if (story) {
        targetUser = story.user._id;
        targetUserName = story.user.name;
        contentSnapshot = story.text ? story.text.substring(0, 500) : null;
      }
    } else if (reportType === 'user') {
      const user = await User.findById(targetId);
      if (user) {
        targetUser = user._id;
        targetUserName = user.name;
      }
    } else if (reportType === 'comment' || reportType === 'reply') {
      // For comments/replies, we need to find the post first
      // The targetId should be the comment/reply ID
      // We'll search in all posts for this comment
      const post = await Post.findOne({
        $or: [
          { 'comments._id': targetId },
          { 'comments.replies._id': targetId }
        ]
      }).populate('user', 'name');
      
      if (post) {
        // Find the comment or reply
        let foundComment = post.comments.find(c => c._id.toString() === targetId);
        if (foundComment) {
          const commentUser = await User.findById(foundComment.user);
          if (commentUser) {
            targetUser = commentUser._id;
            targetUserName = commentUser.name;
            contentSnapshot = foundComment.text ? foundComment.text.substring(0, 500) : null;
          }
        } else {
          // Search in replies
          for (const comment of post.comments) {
            const foundReply = comment.replies.find(r => r._id.toString() === targetId);
            if (foundReply) {
              const replyUser = await User.findById(foundReply.user);
              if (replyUser) {
                targetUser = replyUser._id;
                targetUserName = replyUser.name;
                contentSnapshot = foundReply.text ? foundReply.text.substring(0, 500) : null;
              }
              break;
            }
          }
        }
      }
    }

    const report = await Report.create({
      reporter: req.user.id,
      reportType,
      targetId,
      targetUser,
      targetUserName,
      contentSnapshot,
      reason,
      details,
      media: media || []
    });

    // Populate reporter info
    await report.populate('reporter', 'name avatar');
    await report.populate('targetUser', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'تم إرسال البلاغ بنجاح. سيتم مراجعته قريباً',
      report
    });
  } catch (error) {
    console.error('Report creation error:', error);
    next(error);
  }
};

// @desc    Report a post directly
// @route   POST /api/v1/reports/post/:postId
// @access  Private
exports.reportPost = async (req, res, next) => {
  try {
    const { reason, details } = req.body;
    const postId = req.params.postId;

    // Find the post
    const post = await Post.findById(postId).populate('user', 'name');
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    // Check for duplicate report (allow if reason differs or contains timestamp)
    const existingReport = await Report.findOne({
      reporter: req.user.id,
      reportType: 'post',
      targetId: postId,
      status: { $in: ['pending', 'reviewed'] }
    });

    if (existingReport) {
      const sameReason = existingReport.reason && reason && existingReport.reason.trim() === reason.trim();
      const hasTs = containsTimestamp(reason) || !!req.body.timestamp;
      if (sameReason && !hasTs) {
        return res.status(429).json({
          success: false,
          message: 'تم إرسال بلاغ سابقًا، الرجاء الانتظار'
        });
      }
      // else proceed (different reason or includes timestamp)
    }

    const report = await Report.create({
      reporter: req.user.id,
      reportType: 'post',
      targetId: postId,
      targetUser: post.user._id,
      targetUserName: post.user.name,
      contentSnapshot: post.content ? post.content.substring(0, 500) : null,
      reason,
      details
    });

    await report.populate('reporter', 'name avatar');
    await report.populate('targetUser', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'تم إرسال البلاغ بنجاح. سيتم مراجعته قريباً',
      report
    });
  } catch (error) {
    console.error('Report post error:', error);
    next(error);
  }
};

// @desc    Get user's reports
// @route   GET /api/v1/reports/my
// @access  Private
exports.getMyReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ reporter: req.user.id })
      .populate('targetUser', 'name avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reports (Admin)
// @route   GET /api/v1/reports
// @access  Private (Admin)
exports.getAllReports = async (req, res, next) => {
  try {
    const { status, reportType, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (reportType) query.reportType = reportType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await Report.find(query)
      .populate('reporter', 'name avatar')
      .populate('targetUser', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Report.countDocuments(query);

    res.status(200).json({
      success: true,
      count: reports.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      reports
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update report status (Admin)
// @route   PUT /api/v1/reports/:id
// @access  Private (Admin)
exports.updateReportStatus = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'البلاغ غير موجود'
      });
    }

    report.status = status;
    if (adminNotes) report.adminNotes = adminNotes;
    if (status === 'resolved' || status === 'dismissed') {
      report.resolvedAt = new Date();
      report.resolvedBy = req.user.id;
    }

    await report.save();
    await report.populate('reporter', 'name avatar');
    await report.populate('targetUser', 'name avatar');

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة البلاغ',
      report
    });
  } catch (error) {
    next(error);
  }
};
