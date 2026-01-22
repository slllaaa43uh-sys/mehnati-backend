const cron = require('node-cron');
const Post = require('../models/Post');

/**
 * ============================================
 * Cron Job لإزالة التمييز من الإعلانات المنتهية
 * ============================================
 * 
 * التحديث: إضافة سجلات تشخيصية مفصلة
 * وإصلاح مشكلة عدم إزالة التمييز
 */

// متغير لتتبع حالة الـ Cron
let cronJobActive = false;
let lastRunTime = null;
let totalRemovedCount = 0;

// Cron job to remove featured status from expired posts
// Runs every 5 minutes for more accurate expiry handling
const setupFeaturedCron = () => {
  console.log('========================================');
  console.log('🔧 FEATURED CRON SETUP - STARTING');
  console.log('========================================');
  
  // تشغيل كل 5 دقائق
  const cronJob = cron.schedule('*/5 * * * *', async () => {
    try {
      const startTime = new Date();
      console.log('========================================');
      console.log('🕐 FEATURED CRON JOB - RUNNING');
      console.log('========================================');
      console.log('⏰ Start Time:', startTime.toISOString());
      console.log('📊 Previous Total Removed:', totalRemovedCount);

      const now = new Date();

      // البحث عن جميع الإعلانات المميزة المنتهية
      // نبحث في كلا الحقلين: featuredExpiry و featuredUntil
      const expiredPosts = await Post.find({
        isFeatured: true,
        $or: [
          { featuredExpiry: { $lte: now } },
          { featuredUntil: { $lte: now } }
        ]
      }).select('_id title isFeatured featuredExpiry featuredUntil featuredType createdAt');

      console.log('📋 Query Results:');
      console.log('   - Current Time:', now.toISOString());
      console.log('   - Expired Posts Found:', expiredPosts.length);

      if (expiredPosts.length === 0) {
        console.log('✅ No expired featured posts found');
        lastRunTime = new Date();
        console.log('========================================');
        return;
      }

      // طباعة تفاصيل الإعلانات المنتهية
      console.log('📝 Expired Posts Details:');
      expiredPosts.forEach((post, index) => {
        console.log(`   ${index + 1}. ID: ${post._id}`);
        console.log(`      Title: ${post.title?.substring(0, 50) || 'N/A'}...`);
        console.log(`      Featured Type: ${post.featuredType || 'N/A'}`);
        console.log(`      Featured Expiry: ${post.featuredExpiry?.toISOString() || 'NULL'}`);
        console.log(`      Featured Until: ${post.featuredUntil?.toISOString() || 'NULL'}`);
      });

      // تحديث جميع الإعلانات المنتهية
      const result = await Post.updateMany(
        {
          isFeatured: true,
          $or: [
            { featuredExpiry: { $lte: now } },
            { featuredUntil: { $lte: now } }
          ]
        },
        {
          $set: {
            isFeatured: false,
            featuredType: null,
            featuredUntil: null,
            featuredExpiry: null
          }
        }
      );

      totalRemovedCount += result.modifiedCount;
      lastRunTime = new Date();

      console.log('========================================');
      console.log('📊 UPDATE RESULTS:');
      console.log('   - Matched:', result.matchedCount);
      console.log('   - Modified:', result.modifiedCount);
      console.log('   - Total Removed (Session):', totalRemovedCount);
      console.log('✅ Removed featured status from', result.modifiedCount, 'posts');
      console.log('========================================');

    } catch (error) {
      console.error('========================================');
      console.error('❌ FEATURED CRON ERROR:');
      console.error('   - Message:', error.message);
      console.error('   - Stack:', error.stack);
      console.error('========================================');
    }
  });

  cronJobActive = true;
  console.log('✅ Featured posts cron job initialized (runs every 5 minutes)');
  console.log('========================================');
  
  // تشغيل فوري عند بدء الخادم للتأكد من إزالة أي إعلانات منتهية
  console.log('🚀 Running initial featured expiry check...');
  runFeaturedExpiryCheck();
  
  return cronJob;
};

/**
 * دالة للتشغيل الفوري (تُستخدم عند بدء الخادم)
 */
const runFeaturedExpiryCheck = async () => {
  try {
    console.log('========================================');
    console.log('🔄 IMMEDIATE FEATURED EXPIRY CHECK');
    console.log('========================================');
    
    const now = new Date();
    
    // البحث عن الإعلانات المنتهية
    const expiredPosts = await Post.find({
      isFeatured: true,
      $or: [
        { featuredExpiry: { $lte: now } },
        { featuredUntil: { $lte: now } }
      ]
    });
    
    console.log('📋 Found', expiredPosts.length, 'expired featured posts');
    
    if (expiredPosts.length > 0) {
      const result = await Post.updateMany(
        {
          isFeatured: true,
          $or: [
            { featuredExpiry: { $lte: now } },
            { featuredUntil: { $lte: now } }
          ]
        },
        {
          $set: {
            isFeatured: false,
            featuredType: null,
            featuredUntil: null,
            featuredExpiry: null
          }
        }
      );
      
      console.log('✅ Removed featured status from', result.modifiedCount, 'posts');
    }
    
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ Immediate check error:', error.message);
  }
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
  
  // التحقق من انتهاء صلاحية التمييز (نتحقق من كلا الحقلين)
  const expiryDate = post.featuredExpiry || post.featuredUntil;
  
  if (post.isFeatured && expiryDate && new Date(expiryDate) <= now) {
    // تحديث الحقول محلياً
    post.isFeatured = false;
    post.featuredType = null;
    post.featuredUntil = null;
    post.featuredExpiry = null;
    
    // تحديث في قاعدة البيانات بشكل غير متزامن
    Post.updateOne(
      { _id: post._id },
      {
        $set: {
          isFeatured: false,
          featuredType: null,
          featuredUntil: null,
          featuredExpiry: null
        }
      }
    ).exec().catch(err => {
      console.error('❌ Error updating expired featured post:', err.message);
    });
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
    console.log('========================================');
    console.log('🔄 MANUAL FEATURED EXPIRY UPDATE');
    console.log('========================================');
    
    const now = new Date();
    
    // البحث أولاً لمعرفة عدد الإعلانات المنتهية
    const expiredCount = await Post.countDocuments({
      isFeatured: true,
      $or: [
        { featuredExpiry: { $lte: now } },
        { featuredUntil: { $lte: now } }
      ]
    });
    
    console.log('📋 Found', expiredCount, 'expired featured posts');
    
    if (expiredCount === 0) {
      return {
        success: true,
        modifiedCount: 0,
        message: 'No expired featured posts found'
      };
    }
    
    const result = await Post.updateMany(
      {
        isFeatured: true,
        $or: [
          { featuredExpiry: { $lte: now } },
          { featuredUntil: { $lte: now } }
        ]
      },
      {
        $set: {
          isFeatured: false,
          featuredType: null,
          featuredUntil: null,
          featuredExpiry: null
        }
      }
    );
    
    console.log('✅ Updated', result.modifiedCount, 'posts');
    console.log('========================================');
    
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

/**
 * دالة للحصول على حالة الـ Cron Job
 */
const getCronStatus = () => {
  return {
    active: cronJobActive,
    lastRunTime: lastRunTime,
    totalRemovedCount: totalRemovedCount
  };
};

module.exports = { 
  setupFeaturedCron, 
  checkFeaturedExpiry, 
  checkFeaturedExpiryBatch,
  updateExpiredFeaturedPosts,
  runFeaturedExpiryCheck,
  getCronStatus
};
