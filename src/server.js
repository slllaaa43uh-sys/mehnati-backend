const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Route files
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const followRoutes = require('./routes/follow');
const storyRoutes = require('./routes/stories');
const reportRoutes = require('./routes/reports');
const uploadRoutes = require('./routes/upload');

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: '*', // في الإنتاج، حدد النطاقات المسموح بها
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/follow', followRoutes);
app.use('/api/v1/stories', storyRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/upload', uploadRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'مرحباً بك في API مهنتي لي 🚀',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      posts: '/api/v1/posts',
      users: '/api/v1/users',
      follow: '/api/v1/follow',
      stories: '/api/v1/stories',
      reports: '/api/v1/reports',
      upload: '/api/v1/upload'
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
  console.log(`
╔════════════════════════════════════════════╗
║     🚀 مهنتي لي API Server                 ║
║     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║     🌐 Port: ${PORT}                          ║
║     📦 Environment: ${process.env.NODE_ENV || 'development'}           ║
║     ✅ Server is running...                ║
╚════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`❌ Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;
