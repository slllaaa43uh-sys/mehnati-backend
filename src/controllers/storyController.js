const Story = require('../models/Story');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Create story
// @route   POST /api/v1/stories
// @access  Private
exports.createStory = async (req, res, next) => {
  try {
    const { text, backgroundColor } = req.body;

    let media = null;
    if (req.file) {
      media = {
        url: req.file.path, // Cloudinary URL
        publicId: req.file.filename, // Cloudinary public ID
        type: req.file.mimetype.startsWith('video') ? 'video' : 'image'
      };
    }

    const story = await Story.create({
      user: req.user.id,
      text,
      backgroundColor: backgroundColor || '#1a1a2e',
      media
    });

    await story.populate('user', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'تم نشر القصة',
      story
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stories feed (from followed users)
// @route   GET /api/v1/stories/feed
// @access  Private
exports.getStoriesFeed = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const following = [...currentUser.following, req.user.id]; // Include own stories

    // Get stories from last 24 hours
    const stories = await Story.find({
      user: { $in: following },
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    // Group stories by user
    const groupedStories = {};
    stories.forEach(story => {
      const userId = story.user._id.toString();
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          user: story.user,
          stories: [],
          hasUnseen: false,
          isUser: userId === req.user.id
        };
      }
      groupedStories[userId].stories.push(story);
      
      // Check if story is unseen
      const hasViewed = story.views.some(
        v => v.user && v.user.toString() === req.user.id
      );
      if (!hasViewed && userId !== req.user.id) {
        groupedStories[userId].hasUnseen = true;
      }
    });

    // Convert to array and sort (user's stories first, then unseen, then seen)
    const storyGroups = Object.values(groupedStories).sort((a, b) => {
      if (a.isUser) return -1;
      if (b.isUser) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return 0;
    });

    res.status(200).json({
      success: true,
      storyGroups
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user stories
// @route   GET /api/v1/stories/user/:userId
// @access  Public
exports.getUserStories = async (req, res, next) => {
  try {
    const stories = await Story.find({
      user: req.params.userId,
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      stories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    View story
// @route   POST /api/v1/stories/:id/view
// @access  Private
exports.viewStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'القصة غير موجودة'
      });
    }

    // Check if already viewed
    const alreadyViewed = story.views.some(
      v => v.user && v.user.toString() === req.user.id
    );

    if (!alreadyViewed) {
      story.views.push({ user: req.user.id });
      await story.save();

      // Create notification for story owner
      if (story.user.toString() !== req.user.id) {
        await Notification.create({
          recipient: story.user,
          sender: req.user.id,
          type: 'story_view',
          story: story._id
        });
      }
    }

    res.status(200).json({
      success: true,
      viewsCount: story.views.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete story
// @route   DELETE /api/v1/stories/:id
// @access  Private
exports.deleteStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'القصة غير موجودة'
      });
    }

    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بحذف هذه القصة'
      });
    }

    await story.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم حذف القصة'
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Get story viewers
// @route   GET /api/v1/stories/:id/viewers
// @access  Private (only story owner)
exports.getStoryViewers = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate('views.user', 'name avatar');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'القصة غير موجودة'
      });
    }

    // Only story owner can see viewers
    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بمشاهدة قائمة المشاهدين'
      });
    }

    res.status(200).json({
      success: true,
      viewsCount: story.views.length,
      viewers: story.views.map(v => ({
        user: v.user,
        viewedAt: v.viewedAt
      }))
    });
  } catch (error) {
    next(error);
  }
};
