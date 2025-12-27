const cron = require('node-cron');
const Post = require('../models/Post');

// Cron job to remove featured status from expired posts
// Runs every hour
const setupFeaturedCron = () => {
  cron.schedule('0 * * * *', async () => {
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
            featuredType: null
          }
        }
      );

      console.log(`✅ Removed featured status from ${result.modifiedCount} posts`);

    } catch (error) {
      console.error('❌ Featured Cron Error:', error);
    }
  });

  console.log('✅ Featured posts cron job initialized (runs every hour)');
};

module.exports = { setupFeaturedCron };
