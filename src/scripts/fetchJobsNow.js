/**
 * ============================================
 * سكريبت لتشغيل جلب الوظائف الخارجية فوراً
 * ============================================
 * 
 * يقوم بجلب الوظائف من JSearch API وحفظها في MongoDB
 * يُستخدم لملء قاعدة البيانات عند بدء التشغيل
 * 
 * الاستخدام:
 * node src/scripts/fetchJobsNow.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { fetchAndSaveJobs, getStats } = require('../services/externalJobsService');

// الاتصال بقاعدة البيانات
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

// دالة رئيسية لجلب الوظائف
const main = async () => {
  console.log('🚀 بدء جلب الوظائف الخارجية...\n');
  
  await connectDB();

  // استعلامات متعددة لجلب وظائف متنوعة
  const queries = [
    'وظائف في السعودية',
    'jobs in Saudi Arabia',
    'وظائف في الرياض',
    'وظائف في جدة',
    'jobs in Dubai',
    'jobs in UAE',
    'remote jobs Middle East'
  ];

  let totalNew = 0;
  let totalUpdated = 0;

  for (const query of queries) {
    try {
      console.log(`\n📥 جلب: "${query}"`);
      const result = await fetchAndSaveJobs(query);
      
      totalNew += result.newJobs || 0;
      totalUpdated += result.updatedJobs || 0;
      
      console.log(`   ✅ ${result.newJobs} وظيفة جديدة | ${result.updatedJobs} محدثة`);
      
      // تأخير بسيط بين الاستعلامات لتجنب حد الطلبات
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`   ❌ خطأ في "${query}":`, error.message);
    }
  }

  // عرض الإحصائيات النهائية
  console.log('\n' + '='.repeat(50));
  console.log('📊 النتائج النهائية:');
  console.log('='.repeat(50));
  console.log(`✨ وظائف جديدة: ${totalNew}`);
  console.log(`🔄 وظائف محدثة: ${totalUpdated}`);
  console.log(`📦 المجموع: ${totalNew + totalUpdated}`);

  // جلب إحصائيات قاعدة البيانات
  const stats = await getStats();
  if (stats.success) {
    console.log('\n📈 إحصائيات قاعدة البيانات:');
    console.log(`   - إجمالي الوظائف: ${stats.stats.total}`);
    console.log(`   - الوظائف النشطة: ${stats.stats.active}`);
    console.log(`   - مع فيديو: ${stats.stats.withVideo}`);
    console.log(`   - مع صورة: ${stats.stats.withImage}`);
    console.log(`   - نسبة الفيديو: ${stats.stats.videoRatio}`);
  }

  console.log('\n✅ تم الانتهاء بنجاح!\n');
  
  process.exit(0);
};

// تشغيل السكريبت
main().catch(error => {
  console.error('❌ خطأ فادح:', error);
  process.exit(1);
});
