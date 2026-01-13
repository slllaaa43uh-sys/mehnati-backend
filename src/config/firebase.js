const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * ============================================
 * Firebase Admin SDK Configuration
 * ============================================
 * هذا الملف مسؤول عن تهيئة Firebase Admin SDK
 * لإرسال الإشعارات عبر FCM (Firebase Cloud Messaging)
 * 
 * يدعم طريقتين للإعداد:
 * 1. متغيرات البيئة (للخوادم الإنتاجية) - الطريقة الموصى بها
 * 2. ملف Service Account JSON (للتطوير المحلي)
 */

let firebaseInitialized = false;

/**
 * معالجة المفتاح الخاص من متغيرات البيئة
 * يدعم عدة صيغ للمفتاح الخاص
 */
const processPrivateKey = (privateKey) => {
  if (!privateKey) return null;
  
  let processedKey = privateKey;
  
  // إزالة علامات التنصيص إذا كانت موجودة في البداية والنهاية
  if ((processedKey.startsWith('"') && processedKey.endsWith('"')) ||
      (processedKey.startsWith("'") && processedKey.endsWith("'"))) {
    processedKey = processedKey.slice(1, -1);
  }
  
  // تحويل \\n إلى \n (في حالة الـ escape المزدوج)
  processedKey = processedKey.replace(/\\\\n/g, '\n');
  
  // تحويل \n النصية إلى أسطر جديدة حقيقية
  processedKey = processedKey.replace(/\\n/g, '\n');
  
  // التأكد من وجود سطر جديد في نهاية المفتاح
  if (!processedKey.endsWith('\n')) {
    processedKey = processedKey + '\n';
  }
  
  return processedKey;
};

/**
 * محاولة تحليل المفتاح كـ JSON (في حالة تمرير كائن JSON كامل)
 */
const tryParseAsJSON = (value) => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (e) {
    // ليس JSON، نتجاهل الخطأ
  }
  return null;
};

/**
 * تهيئة Firebase Admin SDK
 * يتم استدعاء هذه الدالة مرة واحدة عند بدء السيرفر
 */
const initializeFirebase = () => {
  try {
    console.log('========================================');
    console.log('🔥 FIREBASE INITIALIZATION DEBUG - START');
    console.log('========================================');
    
    // التحقق من عدم تهيئة Firebase مسبقاً
    if (firebaseInitialized) {
      console.log('✅ Firebase Admin SDK مهيأ مسبقاً');
      return true;
    }

    let credential;

    // ============================================
    // طباعة معلومات التشخيص
    // ============================================
    console.log('📋 Checking Firebase Environment Variables:');
    console.log('   - FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✓ SET (' + process.env.FIREBASE_PROJECT_ID + ')' : '✗ NOT SET');
    console.log('   - FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✓ SET (' + process.env.FIREBASE_CLIENT_EMAIL + ')' : '✗ NOT SET');
    console.log('   - FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✓ SET (length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ' chars)' : '✗ NOT SET');
    
    // طباعة مسار ملف .env للتشخيص
    console.log('📂 Current Working Directory:', process.cwd());
    console.log('📂 __dirname:', __dirname);

    // ============================================
    // الطريقة 1: استخدام متغيرات البيئة (للخوادم الإنتاجية)
    // ============================================
    if (process.env.FIREBASE_PROJECT_ID && 
        process.env.FIREBASE_PRIVATE_KEY && 
        process.env.FIREBASE_CLIENT_EMAIL) {
      
      console.log('🔐 استخدام إعدادات Firebase من متغيرات البيئة...');
      
      // معالجة المفتاح الخاص
      const privateKey = processPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      
      console.log('🔑 Private Key Processing:');
      console.log('   - Original length:', process.env.FIREBASE_PRIVATE_KEY.length);
      console.log('   - Processed length:', privateKey ? privateKey.length : 0);
      console.log('   - Starts with "-----BEGIN PRIVATE KEY-----":', privateKey && privateKey.startsWith('-----BEGIN PRIVATE KEY-----') ? '✓ YES' : '✗ NO');
      console.log('   - Ends with "-----END PRIVATE KEY-----":', privateKey && (privateKey.trim().endsWith('-----END PRIVATE KEY-----\n') || privateKey.trim().endsWith('-----END PRIVATE KEY-----')) ? '✓ YES' : '✗ NO');
      
      // طباعة أول 50 حرف للتشخيص (بدون كشف المفتاح الكامل)
      if (privateKey) {
        console.log('   - First 50 chars:', privateKey.substring(0, 50) + '...');
      }
      
      try {
        credential = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        });
        console.log('✅ تم إنشاء credential من متغيرات البيئة');
      } catch (certError) {
        console.error('❌ Error creating credential from env vars:', certError.message);
        console.error('   - Error Code:', certError.code || 'N/A');
        throw certError;
      }

      console.log('✅ تم تحميل إعدادات Firebase من متغيرات البيئة');
      console.log(`📱 Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
      console.log(`📧 Client Email: ${process.env.FIREBASE_CLIENT_EMAIL}`);
    }
    // ============================================
    // الطريقة 2: استخدام ملف JSON (للتطوير المحلي)
    // ============================================
    else {
      console.log('📄 متغيرات البيئة غير مكتملة، محاولة تحميل ملف firebase-service-account.json...');
      
      // محاولة عدة مسارات للملف
      const possiblePaths = [
        path.join(process.cwd(), 'firebase-service-account.json'),
        path.join(__dirname, '../../firebase-service-account.json'),
        path.join(__dirname, '../firebase-service-account.json'),
        '/root/mehnati-backend/firebase-service-account.json'
      ];
      
      let serviceAccount = null;
      let foundPath = null;
      
      for (const filePath of possiblePaths) {
        console.log(`📂 Checking path: ${filePath} - ${fs.existsSync(filePath) ? '✓ EXISTS' : '✗ NOT FOUND'}`);
        if (fs.existsSync(filePath)) {
          try {
            serviceAccount = require(filePath);
            foundPath = filePath;
            break;
          } catch (e) {
            console.log(`   ⚠️ Found but failed to load: ${e.message}`);
          }
        }
      }
      
      if (serviceAccount) {
        console.log(`✅ تم العثور على الملف في: ${foundPath}`);
        console.log('📋 Service Account File Contents:');
        console.log('   - type:', serviceAccount.type);
        console.log('   - project_id:', serviceAccount.project_id);
        console.log('   - private_key_id:', serviceAccount.private_key_id ? serviceAccount.private_key_id.substring(0, 10) + '...' : 'MISSING');
        console.log('   - client_email:', serviceAccount.client_email);
        console.log('   - client_id:', serviceAccount.client_id);
        console.log('   - private_key exists:', serviceAccount.private_key ? '✓ YES (length: ' + serviceAccount.private_key.length + ')' : '✗ NO');
        
        credential = admin.credential.cert(serviceAccount);
        
        console.log('✅ تم تحميل ملف firebase-service-account.json');
        console.log(`📱 Project ID: ${serviceAccount.project_id}`);
      } else {
        console.error('========================================');
        console.error('❌ FIREBASE CONFIGURATION ERROR');
        console.error('========================================');
        console.error('⚠️ لم يتم العثور على إعدادات Firebase');
        console.error('');
        console.error('⚠️ يرجى إضافة أحد الخيارات التالية:');
        console.error('');
        console.error('   الخيار 1: متغيرات البيئة في ملف .env:');
        console.error('   ─────────────────────────────────────');
        console.error('   FIREBASE_PROJECT_ID=your-project-id');
        console.error('   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com');
        console.error('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_KEY_HERE\\n-----END PRIVATE KEY-----\\n"');
        console.error('');
        console.error('   الخيار 2: ملف firebase-service-account.json');
        console.error('   ─────────────────────────────────────────────');
        console.error('   ضع الملف في أحد المسارات التالية:');
        possiblePaths.forEach(p => console.error(`   - ${p}`));
        console.error('');
        console.error('⚠️ سيتم تعطيل خدمة FCM حتى إضافة الإعدادات');
        console.error('========================================');
        return false;
      }
    }

    // تهيئة Firebase Admin SDK
    console.log('🚀 Initializing Firebase Admin SDK...');
    
    admin.initializeApp({
      credential: credential
    });

    firebaseInitialized = true;
    console.log('========================================');
    console.log('✅ Firebase Admin SDK تم تهيئته بنجاح');
    console.log('📬 خدمة FCM جاهزة لإرسال الإشعارات');
    console.log('========================================');
    console.log('🔥 FIREBASE INITIALIZATION DEBUG - END (SUCCESS)');
    console.log('========================================');
    return true;

  } catch (error) {
    console.error('========================================');
    console.error('❌ FIREBASE INITIALIZATION FAILED');
    console.error('========================================');
    console.error('❌ خطأ في تهيئة Firebase Admin SDK:', error.message);
    console.error('📋 Error Details:');
    console.error('   - Code:', error.code || 'N/A');
    console.error('   - Stack:', error.stack);
    console.error('');
    console.error('💡 نصائح لحل المشكلة:');
    console.error('   1. تأكد من أن FIREBASE_PRIVATE_KEY محاط بعلامات تنصيص مزدوجة');
    console.error('   2. تأكد من أن \\n موجودة بين أجزاء المفتاح');
    console.error('   3. تأكد من نسخ المفتاح كاملاً من ملف JSON');
    console.error('========================================');
    return false;
  }
};

/**
 * الحصول على Firebase Admin instance
 */
const getFirebaseAdmin = () => {
  if (!firebaseInitialized) {
    console.error('❌ getFirebaseAdmin called but Firebase is not initialized!');
    throw new Error('Firebase Admin SDK غير مهيأ. يرجى استدعاء initializeFirebase() أولاً');
  }
  return admin;
};

/**
 * التحقق من حالة Firebase
 */
const isFirebaseReady = () => {
  console.log('🔍 isFirebaseReady check:', firebaseInitialized ? '✓ READY' : '✗ NOT READY');
  return firebaseInitialized;
};

module.exports = {
  initializeFirebase,
  getFirebaseAdmin,
  isFirebaseReady
};
