const socketIO = require('socket.io');

let io;

// قائمة الـ Origins المسموح بها لـ Socket.IO
const allowedOrigins = [
  // الإنتاج
  "https://mihnt.netlify.app",
  "https://mehnati-api.xyz",
  "https://www.mehnati-api.xyz",
  
  // التطوير المحلي
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
  
  // تطبيقات الموبايل
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
  
  // إضافة من متغيرات البيئة
  process.env.FRONTEND_URL,
  process.env.MOBILE_APP_URL
].filter(Boolean);

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      // دالة للتحقق من الـ origin
      origin: function (origin, callback) {
        // السماح بالطلبات بدون origin (تطبيقات الموبايل)
        if (!origin) {
          return callback(null, true);
        }
        
        // السماح بـ file:// و capacitor:// و ionic://
        if (origin.startsWith('file://') || 
            origin.startsWith('capacitor://') || 
            origin.startsWith('ionic://')) {
          return callback(null, true);
        }
        
        // التحقق من القائمة المسموح بها
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // السماح بـ localhost في بيئة التطوير
        if (process.env.NODE_ENV !== 'production') {
          if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
          }
        }
        
        // رفض الباقي
        console.warn(`⚠️ Socket.IO CORS: طلب مرفوض من: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    transports: ['websocket', 'polling'],
    // إعدادات إضافية للاستقرار
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowUpgrades: true
  });

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // Join user to their personal room for targeted notifications
    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their room`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log('❌ Client disconnected:', socket.id, 'Reason:', reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  });

  console.log('✅ Socket.IO initialized with CORS fix');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };
