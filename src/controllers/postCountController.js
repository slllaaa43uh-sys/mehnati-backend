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
    // DEBUG: Log all unique categories in jobs
    const allJobPosts = await Post.find({ displayPage: 'jobs', isShort: { $ne: true } })
      .select('title category');
    const uniqueCategories = [...new Set(allJobPosts.map(p => p.category).filter(c => c))];
    console.log('=== DEBUG: All unique job categories ===');
    console.log(uniqueCategories);
    console.log('Total jobs posts:', allJobPosts.length);
    console.log('=========================================');

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

    // Job categories with possible alternative names
    // Maps display name to possible database values
    // تم التحديث ليشمل التصنيفات الجديدة من الواجهة الأمامية
    const jobCategoryMappings = {
      // التصنيفات الأصلية
      'سائق خاص': ['سائق خاص', 'سائق'],
      'حارس أمن': ['حارس أمن', 'حارس'],
      'طباخ': ['طباخ'],
      'محاسب': ['محاسب'],
      'مهندس مدني': ['مهندس مدني', 'مهندس'],
      'طبيب/ممرض': ['طبيب/ممرض', 'طبيب', 'ممرض', 'طب وتمريض'],
      'نجار': ['نجار'],
      'كاتب محتوى': ['كاتب محتوى', 'كاتب', 'كتابة وترجمة'],
      'كهربائي': ['كهربائي'],
      'ميكانيكي': ['ميكانيكي'],
      'بائع / كاشير': ['بائع / كاشير', 'بائع', 'كاشير', 'مبيعات وتسويق'],
      'مبرمج': ['مبرمج', 'برمجة وتقنية'],
      'مصمم جرافيك': ['مصمم جرافيك', 'مصمم', 'تصميم وفنون'],
      'مترجم': ['مترجم'],
      'مدرس خصوصي': ['مدرس خصوصي', 'مدرس', 'تعليم وتدريب'],
      'مدير مشاريع': ['مدير مشاريع', 'مدير', 'إدارة ومحاسبة'],
      'خدمة عملاء': ['خدمة عملاء'],
      'مقدم طعام': ['مقدم طعام', 'سياحة وضيافة'],
      'توصيل': ['توصيل', 'خدمات لوجستية'],
      'حلاق / خياط': ['حلاق / خياط', 'حلاق', 'خياط'],
      'مزارع': ['مزارع'],
      'وظائف أخرى': ['وظائف أخرى', 'أخرى'],
      // التصنيفات الجديدة من الواجهة الأمامية
      'برمجة وتقنية': ['برمجة وتقنية', 'مبرمج', 'تقنية'],
      'هندسة ومقاولات': ['هندسة ومقاولات', 'مهندس', 'مقاولات'],
      'إدارة ومحاسبة': ['إدارة ومحاسبة', 'إدارة', 'محاسبة'],
      'مبيعات وتسويق': ['مبيعات وتسويق', 'مبيعات', 'تسويق'],
      'طب وتمريض': ['طب وتمريض', 'طبيب', 'ممرض'],
      'تعليم وتدريب': ['تعليم وتدريب', 'مدرس', 'تدريب'],
      'خدمات لوجستية': ['خدمات لوجستية', 'لوجستية', 'نقل'],
      'فنيين وحرفيين': ['فنيين وحرفيين', 'فني', 'حرفي'],
      'تصميم وفنون': ['تصميم وفنون', 'تصميم', 'فنون'],
      'كتابة وترجمة': ['كتابة وترجمة', 'كاتب', 'مترجم'],
      'سياحة وضيافة': ['سياحة وضيافة', 'سياحة', 'ضيافة', 'مطاعم'],
      'قانون ومحاماة': ['قانون ومحاماة', 'محامي', 'قانون'],
      'موارد بشرية': ['موارد بشرية', 'HR'],
      'علوم وبيانات': ['علوم وبيانات', 'بيانات', 'تحليل بيانات']
    };

    const jobCategoryCounts = {};
    for (const [displayName, possibleValues] of Object.entries(jobCategoryMappings)) {
      const seekerCount = await Post.countDocuments({
        displayPage: 'jobs',
        category: { $in: possibleValues },
        title: { $regex: 'ابحث عن وظيفة|أبحث عن وظيفة', $options: 'i' },
        isShort: { $ne: true }
      });
      const employerCount = await Post.countDocuments({
        displayPage: 'jobs',
        category: { $in: possibleValues },
        title: { $regex: 'ابحث عن موظفين|أبحث عن موظفين', $options: 'i' },
        isShort: { $ne: true }
      });
      jobCategoryCounts[displayName] = {
        seeker: seekerCount,
        employer: employerCount,
        total: seekerCount + employerCount
      };
    }

    // Get counts by haraj category
    // تم التحديث ليشمل التصنيفات الجديدة من الواجهة الأمامية
    const harajCategories = [
      // التصنيفات الأصلية
      'سيارات', 'عقارات', 'أجهزة منزلية', 'أثاث ومفروشات', 'جوالات',
      'لابتوبات وكمبيوتر', 'كاميرات وتصوير', 'ألعاب فيديو', 'ملابس وموضة',
      'ساعات ومجوهرات', 'حيوانات أليفة', 'طيور', 'معدات ثقيلة', 'قطع غيار',
      'تحف ومقتنيات', 'كتب ومجلات', 'أدوات رياضية', 'مستلزمات أطفال',
      'خيم وتخييم', 'أرقام مميزة', 'نقل عفش', 'أدوات أخرى',
      // التصنيفات الجديدة من الواجهة الأمامية
      'عقارات وأراضي', 'سيارات ومركبات', 'معدات ثقيلة وشاحنات',
      'أعمال وتجارة', 'مقاولات وبناء', 'أجهزة وإلكترونيات',
      'حقائب ومستلزمات', 'خدمات مهنية'
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
