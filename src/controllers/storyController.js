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
      // Cloudinary returns the URL in req.file.path
      media = {
        url: req.file.path,
        publicId: req.file.filename,
        type: req.file.mimetype.startsWith('video') ? 'video' : 'image'
      };
      
      // Debug log
      console.log('Story media uploaded:', {
        url: media.url,
        type: media.type,
        publicId: media.publicId
      });
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
    console.error('Error creating story:', error);
    next(error);
  }
};

// @desc    Get all stories feed (PUBLIC - for everyone)
// @route   GET /api/v1/stories/feed
// @access  Private (needs token to know current user)
exports.getStoriesFeed = async (req, res, next) => {
  try {
    // Get ALL stories from last 24 hours (for EVERYONE)
    const stories = await Story.find({
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    console.log(`Found ${stories.length} stories in feed`);

    // Group stories by user
    const groupedStories = {};
    stories.forEach(story => {
      const userId = story.user._id.toString();
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          user: story.user,
          stories: [],
          hasUnseen: false,
          isUser: req.user ? userId === req.user.id : false
        };
      }
      groupedStories[userId].stories.push(story);
      
      // Check if story is unseen
      if (req.user) {
        const hasViewed = story.views.some(
          v => v.user && v.user.toString() === req.user.id
        );
        if (!hasViewed && userId !== req.user.id) {
          groupedStories[userId].hasUnseen = true;
        }
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
      count: stories.length,
      storyGroups
    });
  } catch (error) {
    console.error('Error fetching stories feed:', error);
    next(error);
  }
};

// @desc    Get ALL stories (PUBLIC endpoint - no auth required)
// @route   GET /api/v1/stories/all
// @access  Public
exports.getAllStories = async (req, res, next) => {
  try {
    // Get ALL stories from last 24 hours
    const stories = await Story.find({
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    console.log(`Found ${stories.length} total stories`);

    // Group stories by user
    const groupedStories = {};
    stories.forEach(story => {
      const userId = story.user._id.toString();
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          user: story.user,
          stories: [],
          hasUnseen: true,
          isUser: false
        };
      }
      groupedStories[userId].stories.push(story);
    });

    const storyGroups = Object.values(groupedStories);

    res.status(200).json({
      success: true,
      count: stories.length,
      storyGroups
    });
  } catch (error) {
    console.error('Error fetching all stories:', error);
    next(error);
  }
};

// @desc    Get user stories
// @route   GET /api/v1/stories/user/:userId
// @access  Public - للجميع
exports.getUserStories = async (req, res, next) => {
  try {
    const stories = await Story.find({
      user: req.params.userId,
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    console.log(`Found ${stories.length} stories for user ${req.params.userId}`);

    res.status(200).json({
      success: true,
      count: stories.length,
      stories
    });
  } catch (error) {
    console.error('Error fetching user stories:', error);
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
