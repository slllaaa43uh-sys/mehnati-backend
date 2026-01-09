const Post = require('../models/Post');

/**
 * ============================================
 * Get Post Counts by Category
 * ============================================
 * Returns the count of posts for jobs and haraj sections
 */

// @desc    Get post counts for badges
// @route   GET /api/v1/posts/counts
// @access  Public
exports.getPostCounts = async (req, res) => {
  try {
    // Get counts for jobs section - using regex for better matching
    const jobsSeekerCount = await Post.countDocuments({
      displayPage: 'jobs',
      title: { $regex: 'ابحث عن وظيفة|أبحث عن وظيفة', $options: 'i' },
      isShort: { $ne: true }
    });

    const jobsEmployerCount = await Post.countDocuments({
      displayPage: 'jobs',
      title: { $regex: 'ابحث عن موظفين|أبحث عن موظفين', $options: 'i' },
      isShort: { $ne: true }
    });

    // Get total jobs count
    const jobsTotalCount = await Post.countDocuments({
      displayPage: 'jobs',
      isShort: { $ne: true }
    });

    // Get total haraj count
    const harajTotalCount = await Post.countDocuments({
      displayPage: 'haraj',
      isShort: { $ne: true }
    });

    // Get counts by job category
    const jobCategories = [
      'سائق خاص', 'حارس أمن', 'طباخ', 'محاسب', 'مهندس مدني',
      'طبيب/ممرض', 'نجار', 'كاتب محتوى', 'كهربائي', 'ميكانيكي',
      'بائع / كاشير', 'مبرمج', 'مصمم جرافيك', 'مترجم', 'مدرس خصوصي',
      'مدير مشاريع', 'خدمة عملاء', 'مقدم طعام', 'توصيل', 'حلاق / خياط',
      'مزارع', 'وظائف أخرى'
    ];

    const jobCategoryCounts = {};
    for (const category of jobCategories) {
      const seekerCount = await Post.countDocuments({
        displayPage: 'jobs',
        category: category,
        title: { $regex: 'ابحث عن وظيفة|أبحث عن وظيفة', $options: 'i' },
        isShort: { $ne: true }
      });
      const employerCount = await Post.countDocuments({
        displayPage: 'jobs',
        category: category,
        title: { $regex: 'ابحث عن موظفين|أبحث عن موظفين', $options: 'i' },
        isShort: { $ne: true }
      });
      jobCategoryCounts[category] = {
        seeker: seekerCount,
        employer: employerCount,
        total: seekerCount + employerCount
      };
    }

    // Get counts by haraj category
    const harajCategories = [
      'سيارات', 'عقارات', 'أجهزة منزلية', 'أثاث ومفروشات', 'جوالات',
      'لابتوبات وكمبيوتر', 'كاميرات وتصوير', 'ألعاب فيديو', 'ملابس وموضة',
      'ساعات ومجوهرات', 'حيوانات أليفة', 'طيور', 'معدات ثقيلة', 'قطع غيار',
      'تحف ومقتنيات', 'كتب ومجلات', 'أدوات رياضية', 'مستلزمات أطفال',
      'خيم وتخييم', 'أرقام مميزة', 'نقل عفش', 'أدوات أخرى'
    ];

    const harajCategoryCounts = {};
    for (const category of harajCategories) {
      const count = await Post.countDocuments({
        displayPage: 'haraj',
        category: category,
        isShort: { $ne: true }
      });
      harajCategoryCounts[category] = count;
    }

    res.status(200).json({
      success: true,
      data: {
        jobs: {
          total: jobsTotalCount,
          seeker: jobsSeekerCount,
          employer: jobsEmployerCount,
          categories: jobCategoryCounts
        },
        haraj: {
          total: harajTotalCount,
          categories: harajCategoryCounts
        }
      }
    });

  } catch (error) {
    console.error('Error getting post counts:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب عدد المنشورات'
    });
  }
};
