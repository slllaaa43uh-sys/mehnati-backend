const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// تفعيل garbage collector للتحكم اليدوي في الذاكرة
if (global.gc) {
  console.log('✅ Garbage Collector متاح للتحكم اليدوي');
} else {
  console.log('⚠️ لتفعيل التحكم اليدوي في الذاكرة، شغّل الخادم بـ: node --expose-gc src/server.js');
}

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { setupCronJob } = require('./cron/recommendationCron');
const { setupFeaturedCron } = require('./cron/featuredCron');
const { startExternalJobsCron } = require('./cron/externalJobsCron');
const { startGlobalJobsNotificationCron } = require('./cron/globalJobsNotificationCron');
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
const externalJobsRoutes = require('./routes/externalJobs');
const aiRoutes = require('./routes/ai');
const notificationLogsRoutes = require('./routes/notificationLogs');
const testNotificationRoutes = require('./routes/testNotification');

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

// Setup cron jobs
setupCronJob(120);
setupFeaturedCron();
startExternalJobsCron(); // External Jobs Cron - every 6 hours
startGlobalJobsNotificationCron(); // Global Jobs Daily Notification - 9 AM Riyadh

// مراقبة استخدام الذاكرة
const logMemoryUsage = () => {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  
  console.log(`📊 استخدام الذاكرة: RSS=${rssMB}MB, Heap=${heapUsedMB}/${heapTotalMB}MB`);
  
  if (used.heapUsed > 250 * 1024 * 1024) {
    console.warn('⚠️ تحذير: استخدام الذاكرة مرتفع!');
    if (global.gc) {
      console.log('🧹 تشغيل Garbage Collector...');
      global.gc();
    }
  }
};

setInterval(logMemoryUsage, 3 * 60 * 1000);
logMemoryUsage();

// Normalize duplicate /api prefix (e.g., /api/api/v1/* → /api/v1/*)
app.use((req, res, next) => {
  if (req.url.startsWith('/api/api/')) {
    req.url = req.url.replace(/^\/api\/api\//, '/api/');
  }
  next();
});

// ============================================
// 🔓 CORS الإعداد الصحيح: OPTIONS → cors() → helmet()
// ============================================
// 1) OPTIONS middleware أولاً (يعكس Origin ويسمح بالـ headers/methods)
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const isDev = (process.env.NODE_ENV !== 'production');
  const allowedEnv = (process.env.ALLOWED_ORIGINS || process.env.WEB_APP_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

  const isMobileOrigin = origin.startsWith('capacitor://') || origin.startsWith('ionic://') || origin.startsWith('file://');
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
  const allow = (
    !origin ||
    isMobileOrigin ||
    (isDev && isLocalhost) ||
    allowedEnv.length === 0 ||
    allowedEnv.includes(origin)
  );

  if (allow && origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Expose-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// 2) ثم cors() بإعدادات ديناميكية للأصل والـ credentials/headers/methods
const corsOptions = {
  origin: (origin, callback) => {
    const isDev = (process.env.NODE_ENV !== 'production');
    const allowedEnv = (process.env.ALLOWED_ORIGINS || process.env.WEB_APP_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin) return callback(null, true);
    if (origin.startsWith('file://') || origin.startsWith('capacitor://') || origin.startsWith('ionic://')) return callback(null, true);
    if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return callback(null, true);
    if (allowedEnv.length === 0) return callback(null, true);
    if (allowedEnv.includes(origin)) return callback(null, true);
    console.warn(`⚠️ CORS: طلب مرفوض من: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};
app.use(cors(corsOptions));

// 3) Helmet بعد cors()
// Helmet مع تعطيل القيود
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
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
app.use('/api/v1/external-jobs', externalJobsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/notification-logs', notificationLogsRoutes);
app.use('/api/v1/test-notification', testNotificationRoutes);

// Share pages
app.use('/share', shareRoutes);

// Password Reset Page
app.get('/reset-password/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/reset-password/index.html'));
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'مرحباً بك في API مهنتي لي 🚀',
    version: '2.2.0',
    storage: 'Backblaze B2 with compression',
    cors: 'Open for all origins',
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
      location: '/api/v1/location',
      externalJobs: '/api/v1/external-jobs',
      ai: '/api/v1/ai'
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
  initializeSocket(server);
  
  server.timeout = 300000;
  server.keepAliveTimeout = 300000;
  server.headersTimeout = 310000;
  
  console.log(`
╔════════════════════════════════════════════════════╗
║     🚀 مهنتي لي API Server v2.2.0                  ║
║     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║
║     🌐 Port: ${PORT}                                  ║
║     📦 Environment: ${process.env.NODE_ENV || 'development'}                   ║
║     💾 Storage: Backblaze B2                       ║
║     🔓 CORS: Open for all origins                  ║
║     🌍 External Jobs: JSearch API (RapidAPI)       ║
║     ✅ Server is running...                        ║
╚════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`❌ Error: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
