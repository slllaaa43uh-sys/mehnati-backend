const cron = require('node-cron');
const Post = require('../models/Post');

// Cron job to remove featured status from expired posts
// Runs every 5 minutes for more accurate expiry handling
const setupFeaturedCron = () => {
  // تشغيل كل 5 دقائق بدلاً من كل ساعة لضمان إزالة التمييز في الوقت المناسب
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🕐 Running featured posts expiry check...');

      const now = new Date();

      // Find all featured posts that have expired
      const expiredPosts = await Post.find({
        isFeatured: true,
        featuredExpiry: { $lte: now }
      });

      if (expiredPosts.length === 0) {
        console.log('✅ No expired featured posts found');
        return;
      }

      // Update all expired posts
      const result = await Post.updateMany(
        {
          isFeatured: true,
          featuredExpiry: { $lte: now }
        },
        {
          $set: {
            isFeatured: false,
            featuredType: null,
            featuredUntil: null
          }
        }
      );

      console.log(`✅ Removed featured status from ${result.modifiedCount} posts`);

    } catch (error) {
      console.error('❌ Featured Cron Error:', error);
    }
  });

  console.log('✅ Featured posts cron job initialized (runs every 5 minutes)');
};

/**
 * دالة مساعدة للتحقق من صلاحية التمييز في الوقت الفعلي
 * تُستخدم عند جلب المنشورات للتأكد من أن التمييز لا يزال ساري المفعول
 * @param {Object} post - كائن المنشور
 * @returns {Object} - المنشور مع تحديث حالة التمييز إذا انتهت صلاحيته
 */
const checkFeaturedExpiry = (post) => {
  if (!post) return post;
  
  const now = new Date();
  
  // التحقق من انتهاء صلاحية التمييز
  if (post.isFeatured && post.featuredExpiry && new Date(post.featuredExpiry) <= now) {
    // تحديث الحقول محلياً (سيتم تحديثها في قاعدة البيانات بواسطة الـ Cron)
    post.isFeatured = false;
    post.featuredType = null;
    post.featuredUntil = null;
  }
  
  return post;
};

/**
 * دالة للتحقق من صلاحية التمييز لمصفوفة من المنشورات
 * @param {Array} posts - مصفوفة المنشورات
 * @returns {Array} - المنشورات مع تحديث حالة التمييز
 */
const checkFeaturedExpiryBatch = (posts) => {
  if (!Array.isArray(posts)) return posts;
  return posts.map(post => checkFeaturedExpiry(post));
};

/**
 * دالة لتحديث المنشورات المنتهية الصلاحية في قاعدة البيانات فوراً
 * تُستخدم عند الحاجة لتحديث فوري بدلاً من انتظار الـ Cron
 * @returns {Object} - نتيجة التحديث
 */
const updateExpiredFeaturedPosts = async () => {
  try {
    const now = new Date();
    
    const result = await Post.updateMany(
      {
        isFeatured: true,
        featuredExpiry: { $lte: now }
      },
      {
        $set: {
          isFeatured: false,
          featuredType: null,
          featuredUntil: null
        }
      }
    );
    
    return {
      success: true,
      modifiedCount: result.modifiedCount
    };
  } catch (error) {
    console.error('❌ Error updating expired featured posts:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { 
  setupFeaturedCron, 
  checkFeaturedExpiry, 
  checkFeaturedExpiryBatch,
  updateExpiredFeaturedPosts 
};
