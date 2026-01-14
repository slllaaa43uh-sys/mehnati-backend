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

// Setup recommendation cron job
setupCronJob(120);

// Setup featured posts cron job
setupFeaturedCron();

// مراقبة استخدام الذاكرة
const logMemoryUsage = () => {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  const externalMB = Math.round(used.external / 1024 / 1024);
  console.log(`📊 استخدام الذاكرة: RSS=${rssMB}MB, Heap=${heapUsedMB}/${heapTotalMB}MB, External=${externalMB}MB`);
};

setInterval(logMemoryUsage, 3 * 60 * 1000);
logMemoryUsage();

// ============================================================
// 🔥 تعديل CORS المطور - لفتح البوابة لتطبيق الجوال (معدل)
// ============================================================
const allowedOrigins = [
  "https://mihnt.netlify.app",
  "https://mihntyl.netlify.app",
  "https://mehnati-api.xyz",
  "https://localhost",
  "capacitor://localhost",
  "http://localhost"
];

const corsOptions = {
  origin: function (origin, callback) {
    // السماح للطلبات بدون مصدر (مثل التطبيق أو الكيرل) أو المصادر المسجلة
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('file://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
// معالجة طلبات الـ Preflight (النجمة الواحدة أضمن هنا)
app.options('*', cors(corsOptions));

// ============================================================
// 🛡️ تعديل HELMET - لضمان عدم ظهور صفحات بيضاء (معدل)
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // عطلناه لكي يسمح بعرض القوائم والمنشورات في الويب فيو
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

// Share pages - (موجودة كاملة كما في كودك)
app.use('/share', (req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
}, shareRoutes);

// Password Reset Page - (موجودة كاملة كما في كودك)
app.get('/reset-password/:token', (req, res) => {
  res.removeHeader('Content-Security-Policy');
  res.sendFile(path.join(__dirname, '../public/reset-password/index.html'));
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'مرحباً بك في API مهنتي لي 🚀 - السيرفر الألماني جاهز 100%',
    version: '2.0.1',
    storage: 'Backblaze B2'
  });
});

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
  console.log(`
╔════════════════════════════════════════════════════╗
║     🚀 مهنتي لي API Server v2.0.1                  ║
║     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║
║     🌐 Port: ${PORT}                                  ║
║     ✅ Server is running successfully!             ║
╚════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`❌ Error: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
