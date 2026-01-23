/**
 * ============================================
 * Notification Logger Service
 * ============================================
 * خدمة تسجيل الأخطاء والأحداث للإشعارات
 * تساعد في تتبع وتشخيص مشاكل الإشعارات
 */

const fs = require('fs');
const path = require('path');

// مسار ملف السجل
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'notifications.log');

// التأكد من وجود مجلد السجلات
const ensureLogDir = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log('📁 Created logs directory:', LOG_DIR);
  }
};

/**
 * تنسيق التاريخ والوقت
 */
const formatTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

/**
 * كتابة سجل إلى الملف
 */
const writeLog = (level, category, message, data = {}) => {
  ensureLogDir();
  
  const logEntry = {
    timestamp: formatTimestamp(),
    level,
    category,
    message,
    data
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  // كتابة إلى الملف
  fs.appendFileSync(LOG_FILE, logLine);
  
  // طباعة في الكونسول أيضاً
  const emoji = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'SUCCESS' ? '✅' : 'ℹ️';
  console.log(`${emoji} [${category}] ${message}`);
  if (Object.keys(data).length > 0) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
};

/**
 * سجل معلومات
 */
const logInfo = (category, message, data = {}) => {
  writeLog('INFO', category, message, data);
};

/**
 * سجل نجاح
 */
const logSuccess = (category, message, data = {}) => {
  writeLog('SUCCESS', category, message, data);
};

/**
 * سجل تحذير
 */
const logWarning = (category, message, data = {}) => {
  writeLog('WARN', category, message, data);
};

/**
 * سجل خطأ
 */
const logError = (category, message, data = {}) => {
  writeLog('ERROR', category, message, data);
};

/**
 * سجل إرسال إشعار
 */
const logNotificationSent = (type, recipient, title, body, result) => {
  const category = 'FCM_SEND';
  const message = result.success 
    ? `Notification sent successfully to ${type}`
    : `Failed to send notification to ${type}`;
  
  const data = {
    type, // 'topic' or 'device'
    recipient: type === 'device' ? recipient.substring(0, 30) + '...' : recipient,
    title,
    body: body.substring(0, 100),
    success: result.success,
    messageId: result.messageId || null,
    error: result.error || null
  };
  
  if (result.success) {
    logSuccess(category, message, data);
  } else {
    logError(category, message, data);
  }
};

/**
 * سجل اشتراك في Topic
 */
const logSubscription = (action, deviceToken, topic, result) => {
  const category = action === 'subscribe' ? 'FCM_SUBSCRIBE' : 'FCM_UNSUBSCRIBE';
  const message = result.success 
    ? `Device ${action}d to topic: ${topic}`
    : `Failed to ${action} device to topic: ${topic}`;
  
  const data = {
    deviceToken: deviceToken.substring(0, 30) + '...',
    topic,
    success: result.success,
    error: result.error || null
  };
  
  if (result.success) {
    logSuccess(category, message, data);
  } else {
    logError(category, message, data);
  }
};

/**
 * سجل حفظ FCM Token
 */
const logTokenSaved = (userId, platform, isNew) => {
  const category = 'FCM_TOKEN';
  const message = isNew 
    ? `New FCM token saved for user`
    : `FCM token updated for user`;
  
  logInfo(category, message, {
    userId,
    platform,
    isNew
  });
};

/**
 * سجل تهيئة Firebase
 */
const logFirebaseInit = (success, error = null) => {
  const category = 'FIREBASE_INIT';
  
  if (success) {
    logSuccess(category, 'Firebase Admin SDK initialized successfully');
  } else {
    logError(category, 'Firebase Admin SDK initialization failed', { error });
  }
};

/**
 * قراءة آخر السجلات
 */
const getRecentLogs = (count = 100) => {
  ensureLogDir();
  
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }
  
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = content.trim().split('\n');
  const recentLines = lines.slice(-count);
  
  return recentLines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return { raw: line };
    }
  });
};

/**
 * قراءة سجلات الأخطاء فقط
 */
const getErrorLogs = (count = 50) => {
  const logs = getRecentLogs(500);
  return logs.filter(log => log.level === 'ERROR').slice(-count);
};

/**
 * مسح السجلات القديمة (أكثر من 7 أيام)
 */
const cleanOldLogs = () => {
  ensureLogDir();
  
  if (!fs.existsSync(LOG_FILE)) {
    return;
  }
  
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = content.trim().split('\n');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const recentLines = lines.filter(line => {
    try {
      const log = JSON.parse(line);
      return new Date(log.timestamp) > sevenDaysAgo;
    } catch (e) {
      return false;
    }
  });
  
  fs.writeFileSync(LOG_FILE, recentLines.join('\n') + '\n');
  console.log(`🧹 Cleaned old logs. Remaining: ${recentLines.length} entries`);
};

module.exports = {
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logNotificationSent,
  logSubscription,
  logTokenSaved,
  logFirebaseInit,
  getRecentLogs,
  getErrorLogs,
  cleanOldLogs
};
