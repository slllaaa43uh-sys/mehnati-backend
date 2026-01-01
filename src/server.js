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

// Setup recommendation cron job (updates scores every 60 minutes instead of 30 to reduce memory usage)
setupCronJob(60);

// Setup featured posts cron job (runs every hour)
setupFeaturedCron();

// مراقبة استخدام الذاكرة
const logMemoryUsage = () => {
  const used = process.memoryUsage();
  console.log(`📊 استخدام الذاكرة: RSS=${Math.round(used.rss / 1024 / 1024)}MB, Heap=${Math.round(used.heapUsed / 1024 / 1024)}/${Math.round(used.heapTotal / 1024 / 1024)}MB`);
  
  // تحذير إذا تجاوزت الذاكرة 400MB
  if (used.heapUsed > 400 * 1024 * 1024) {
    console.warn('⚠️ تحذير: استخدام الذاكرة مرتفع!');
    if (global.gc) {
      console.log('🧹 تشغيل Garbage Collector...');
      global.gc();
    }
  }
};

// تسجيل استخدام الذاكرة كل 5 دقائق
setInterval(logMemoryUsage, 5 * 60 * 1000);
logMemoryUsage(); // تسجيل فوري عند البدء

// Middleware - تكوين helmet مع السماح بتحميل الوسائط من Backblaze B2
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

// CORS configuration updated to allow Android WebView (file:// and null origins) and reflect origin
app.use(cors({
  origin: function(origin, callback){
    // Allow requests with no origin (e.g., local files in Android WebView report origin as null)
    // Also explicitly allow 'null' and file:// origins
    if (!origin || origin === 'null' || (typeof origin === 'string' && origin.startsWith('file://'))) {
      return callback(null, true);
    }
    // For other origins, reflect the origin (allow). If you want to restrict, add checks here.
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

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
    version: '2.0.0',
    storage: 'Backblaze B2 with compression',
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

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  // Initialize Socket.IO after server starts
  initializeSocket(server);
  console.log(`
╔════════════════════════════════════════════════════╗
║     🚀 مهنتي لي API Server v2.0                    ║
║     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║
║     🌐 Port: ${PORT}                                  ║
║     📦 Environment: ${process.env.NODE_ENV || 'development'}                   ║
║     💾 Storage: Backblaze B2 with compression      ║
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
