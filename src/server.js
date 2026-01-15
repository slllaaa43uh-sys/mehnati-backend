const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// تفعيل garbage collector للتحكم اليدوي في الذاكرة
// يجب تشغيل الخادم بـ: node --expose-gc src/server.js
if (global.gc) {
  console.log('✅ Garbage Collector متاح للتحكم اليدوي');
} else {
  console.log('⚠️ لتفعيل التحكم اليدوي في الذاكرة، شغّل الخادم بـ: node --expose-gc src/server.js');
}

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { setupCronJob } = require('./cron/recommendationCron');
const { setupFeaturedCron } = require('./cron/featuredCron');
const { initializeB2 } = require('./services/storageService');
const { initializeFirebase } = require('./config/firebase');
const { initializeSocket } = require('./config/socket');

// Route files
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const followRoutes = require('./routes/follow');
const storyRoutes = require('./routes/stories');
const reportRoutes = require('./routes/reports');
const uploadRoutes = require('./routes/upload');
const notificationRoutes = require('./routes/notifications');
const shareRoutes = require('./routes/share');
const fcmRoutes = require('./routes/fcm');
const paymentRoutes = require('./routes/payment');
const locationRoutes = require('./routes/location');

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Initialize Backblaze B2 connection
initializeB2().catch(err => {
  console.error('❤️ فشل الاتصال بـ Backblaze B2:', err.message);
});

// Initialize Firebase Admin SDK for FCM
initializeFirebase();

// Setup recommendation cron job (updates scores every 120 minutes to reduce memory usage)
// تم زيادة الفترة من 60 إلى 120 دقيقة لتقليل استهلاك الذاكرة
setupCronJob(120);

// Setup featured posts cron job (runs every hour)
setupFeaturedCron();

// مراقبة استخدام الذاكرة - محسنة للكشف المبكر عن الاستنزاف
const logMemoryUsage = () => {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  const externalMB = Math.round(used.external / 1024 / 1024);
  
  console.log(`📊 استخدام الذاكرة: RSS=${rssMB}MB, Heap=${heapUsedMB}/${heapTotalMB}MB, External=${externalMB}MB`);
  
  // تحذير إذا تجاوزت الذاكرة 250MB (تم تقليلها من 400MB)
  if (used.heapUsed > 250 * 1024 * 1024) {
    console.warn('⚠️ تحذير: استخدام الذاكرة مرتفع!');
    if (global.gc) {
      console.log('🧹 تشغيل Garbage Collector...');
      global.gc();
      // تسجيل الذاكرة بعد التنظيف
      const afterGC = process.memoryUsage();
      console.log(`✅ بعد التنظيف: Heap=${Math.round(afterGC.heapUsed / 1024 / 1024)}MB`);
    }
  }
  
  // تحذير حرج إذا تجاوزت 400MB
  if (used.heapUsed > 400 * 1024 * 1024) {
    console.error('🚨 تحذير حرج: استخدام الذاكرة مرتفع جداً!');
  }
};

// تسجيل استخدام الذاكرة كل 3 دقائق (تم تقليلها من 5 دقائق)
setInterval(logMemoryUsage, 3 * 60 * 1000);
logMemoryUsage(); // تسجيل فوري عند البدء

// ============================================
// 🔧 إصلاح مشكلة CORS - الحل الشامل
// ============================================

// قائمة الـ Origins المسموح بها (يمكن إضافة المزيد حسب الحاجة)
const allowedOrigins = [
  // الإنتاج
  "https://mihnt.netlify.app",
  "https://mehnati-api.xyz",
  "https://www.mehnati-api.xyz",
  
  // التطوير المحلي
  "http://localhost",
  "https://localhost",
  "http://localhost:3000",
  "https://localhost:3000",
  "http://localhost:5000",
  "https://localhost:5000",
  "http://localhost:8080",
  "https://localhost:8080",
  "http://localhost:8100",
  "https://localhost:8100",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8100",
  
  // تطبيقات الموبايل (Capacitor/Ionic/Cordova)
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost", // Android WebView
  "https://localhost", // iOS WebView
  
  // Android WebView origins
  "file://",
  
  // إضافة أي origins إضافية من متغيرات البيئة
  process.env.FRONTEND_URL,
  process.env.MOBILE_APP_URL
].filter(Boolean); // إزالة القيم الفارغة

// إعدادات CORS المحسنة والشاملة
const corsOptions = {
  origin: function (origin, callback) {
    // ✅ السماح بالطلبات بدون origin
    // هذا يشمل: تطبيقات الموبايل الأصلية، curl، Postman، طلبات الخادم
    if (!origin) {
      console.log('✅ CORS: طلب بدون origin (موبايل/API) - مسموح');
      return callback(null, true);
    }
    
    // ✅ السماح بـ file:// protocol (Android WebView)
    if (origin.startsWith('file://')) {
      console.log('✅ CORS: طلب من file:// protocol - مسموح');
      return callback(null, true);
    }
    
    // ✅ السماح بـ capacitor:// و ionic:// protocols
    if (origin.startsWith('capacitor://') || origin.startsWith('ionic://')) {
      console.log(`✅ CORS: طلب من ${origin} - مسموح`);
      return callback(null, true);
    }
    
    // ✅ السماح بـ data: و blob: protocols
    if (origin.startsWith('data:') || origin.startsWith('blob:')) {
      console.log(`✅ CORS: طلب من ${origin.substring(0, 10)}... - مسموح`);
      return callback(null, true);
    }
    
    // ✅ التحقق من القائمة المسموح بها
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: طلب من origin مسموح: ${origin}`);
      return callback(null, true);
    }
    
    // ✅ السماح بجميع الـ subdomains لـ localhost في بيئة التطوير
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        console.log(`✅ CORS: طلب تطوير من: ${origin} - مسموح`);
        return callback(null, true);
      }
    }
    
    // ⚠️ تسجيل الأصول المرفوضة للتصحيح
    console.warn(`⚠️ CORS: طلب مرفوض من origin غير مسموح: ${origin}`);
    console.warn(`   للسماح بهذا الـ origin، أضفه إلى قائمة allowedOrigins`);
    
    // ❌ رفض الطلب
    callback(new Error(`Origin ${origin} غير مسموح به - CORS Policy`));
  },
  
  // السماح بإرسال الـ cookies والـ credentials
  credentials: true,
  
  // الطرق HTTP المسموح بها
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  
  // الـ Headers المسموح بها في الطلبات
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-CSRF-Token',
    'X-API-Key',
    'Cache-Control',
    'Pragma'
  ],
  
  // الـ Headers التي يمكن للعميل قراءتها من الاستجابة
  exposedHeaders: [
    'Content-Length',
    'X-JSON-Response',
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining'
  ],
  
  // مدة تخزين نتائج preflight (24 ساعة)
  maxAge: 86400,
  
  // عدم تمرير طلبات OPTIONS للـ handlers التالية
  preflightContinue: false,
  
  // رمز الاستجابة لطلبات OPTIONS الناجحة
  optionsSuccessStatus: 204
};

// ============================================
// تطبيق Middleware بالترتيب الصحيح
// ============================================

// 1️⃣ معالج طلبات OPTIONS (preflight) - يجب أن يكون أولاً
app.use((req, res, next) => {
  // إضافة headers الأساسية لجميع الطلبات
  const origin = req.headers.origin;
  
  // تحديد الـ origin المسموح به
  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (
    allowedOrigins.includes(origin) ||
    origin.startsWith('file://') ||
    origin.startsWith('capacitor://') ||
    origin.startsWith('ionic://') ||
    (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1')))
  ) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, X-CSRF-Token, X-API-Key, Cache-Control, Pragma');
  res.header('Access-Control-Expose-Headers', 'Content-Length, X-JSON-Response, X-Request-Id');
  res.header('Access-Control-Max-Age', '86400');
  
  // معالجة طلبات OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    console.log(`✅ Preflight request handled for: ${req.path}`);
    return res.status(204).send();
  }
  
  next();
});

// 2️⃣ تطبيق CORS middleware
app.use(cors(corsOptions));

// 3️⃣ Helmet - تكوين محسن مع السماح بتحميل الوسائط
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.backblazeb2.com",
        "https://f*.backblazeb2.com",
        // دعم الروابط القديمة من Cloudinary للتوافق
        "https://res.cloudinary.com",
        "https://*.cloudinary.com"
      ],
      mediaSrc: [
        "'self'",
        "blob:",
        "https://*.backblazeb2.com",
        "https://f*.backblazeb2.com",
        // دعم الروابط القديمة من Cloudinary للتوافق
        "https://res.cloudinary.com",
        "https://*.cloudinary.com"
      ],
      connectSrc: [
        "'self'",
        "https://*.backblazeb2.com",
        "https://api.backblazeb2.com",
        // دعم الروابط القديمة من Cloudinary للتوافق
        "https://res.cloudinary.com",
        "https://*.cloudinary.com"
      ],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// 4️⃣ باقي الـ Middleware
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Static files (assets - default images)
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/follow', followRoutes);
app.use('/api/v1/stories', storyRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/fcm', fcmRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/location', locationRoutes);

// Share pages (Open Graph for social media)
// تعطيل CSP لصفحات المشاركة للسماح بعرض الوسائط بشكل صحيح
app.use('/share', (req, res, next) => {
  // إزالة Content-Security-Policy لصفحات المشاركة
  res.removeHeader('Content-Security-Policy');
  next();
}, shareRoutes);

// Password Reset Page - صفحة إعادة تعيين كلمة المرور
// تعطيل CSP للسماح بتشغيل JavaScript في الصفحة
app.get('/reset-password/:token', (req, res) => {
  res.removeHeader('Content-Security-Policy');
  res.sendFile(path.join(__dirname, '../public/reset-password/index.html'));
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'مرحباً بك في API مهنتي لي 🚀',
    version: '2.0.1',
    storage: 'Backblaze B2 with compression',
    cors: 'Fixed and optimized',
    endpoints: {
      auth: '/api/v1/auth',
      posts: '/api/v1/posts',
      users: '/api/v1/users',
      follow: '/api/v1/follow',
      stories: '/api/v1/stories',
      reports: '/api/v1/reports',
      upload: '/api/v1/upload',
      notifications: '/api/v1/notifications',
      fcm: '/api/v1/fcm',
      location: '/api/v1/location'
    }
  });
});

// Health check for deployment
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `المسار ${req.originalUrl} غير موجود`
  });
});

// Error handler - مع معالجة أخطاء CORS
app.use((err, req, res, next) => {
  // معالجة أخطاء CORS بشكل خاص
  if (err.message && err.message.includes('CORS')) {
    console.error('❌ CORS Error:', err.message);
    return res.status(403).json({
      success: false,
      message: 'خطأ في سياسة CORS - Origin غير مسموح به',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // تمرير الأخطاء الأخرى للـ error handler الأصلي
  next(err);
});

// Error handler الأصلي
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  // Initialize Socket.IO after server starts
  initializeSocket(server);
  
  // زيادة مهلة الخادم إلى 5 دقائق (300 ثانية) لدعم رفع الملفات على الشبكات البطيئة
  server.timeout = 300000; // 5 minutes
  server.keepAliveTimeout = 300000; // 5 minutes
  server.headersTimeout = 310000; // 5 minutes + 10 seconds
  console.log(`
╔════════════════════════════════════════════════════╗
║     🚀 مهنتي لي API Server v2.0.1                  ║
║     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║
║     🌐 Port: ${PORT}                                  ║
║     📦 Environment: ${process.env.NODE_ENV || 'development'}                   ║
║     💾 Storage: Backblaze B2 with compression      ║
║     ✅ CORS: Fixed and optimized                   ║
║     ✅ Server is running...                        ║
╚════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`❌ Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;
