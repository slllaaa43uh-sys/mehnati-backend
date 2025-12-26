const admin = require('firebase-admin');
const path = require('path');

/**
 * ============================================
 * Firebase Admin SDK Configuration
 * ============================================
 * هذا الملف مسؤول عن تهيئة Firebase Admin SDK
 * لإرسال الإشعارات عبر FCM (Firebase Cloud Messaging)
 * 
 * يدعم طريقتين للإعداد:
 * 1. ملف Service Account JSON (للتطوير المحلي)
 * 2. متغيرات البيئة (للخوادم الإنتاجية) - الطريقة الموصى بها
 */

let firebaseInitialized = false;

/**
 * تهيئة Firebase Admin SDK
 * يتم استدعاء هذه الدالة مرة واحدة عند بدء السيرفر
 */
const initializeFirebase = () => {
  try {
    // التحقق من عدم تهيئة Firebase مسبقاً
    if (firebaseInitialized) {
      console.log('✅ Firebase Admin SDK مهيأ مسبقاً');
      return true;
    }

    let credential;

    // ============================================
    // الطريقة 1: استخدام متغيرات البيئة (للخوادم الإنتاجية)
    // ============================================
    if (process.env.FIREBASE_PROJECT_ID && 
        process.env.FIREBASE_PRIVATE_KEY && 
        process.env.FIREBASE_CLIENT_EMAIL) {
      
      console.log('🔐 استخدام إعدادات Firebase من متغيرات البيئة...');
      
      // تحويل \n إلى أسطر جديدة حقيقية في المفتاح الخاص
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      });

      console.log('✅ تم تحميل إعدادات Firebase من متغيرات البيئة');
      console.log(`📱 Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
    }
    // ============================================
    // الطريقة 2: استخدام ملف JSON (للتطوير المحلي)
    // ============================================
    else {
      console.log('📄 محاولة تحميل ملف firebase-service-account.json...');
      
      const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
      
      try {
        const serviceAccount = require(serviceAccountPath);
        credential = admin.credential.cert(serviceAccount);
        
        console.log('✅ تم تحميل ملف firebase-service-account.json');
        console.log(`📱 Project ID: ${serviceAccount.project_id}`);
      } catch (error) {
        console.warn('⚠️ لم يتم العثور على إعدادات Firebase');
        console.warn('⚠️ يرجى إضافة أحد الخيارات التالية:');
        console.warn('   1. ملف firebase-service-account.json في المجلد الرئيسي');
        console.warn('   2. متغيرات البيئة: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
        console.warn('⚠️ سيتم تعطيل خدمة FCM حتى إضافة الإعدادات');
        return false;
      }
    }

    // تهيئة Firebase Admin SDK
    admin.initializeApp({
      credential: credential
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK تم تهيئته بنجاح');
    console.log('📬 خدمة FCM جاهزة لإرسال الإشعارات');
    return true;

  } catch (error) {
    console.error('❌ خطأ في تهيئة Firebase Admin SDK:', error.message);
    console.error('💡 تأكد من صحة الإعدادات وأن المفتاح الخاص صحيح');
    return false;
  }
};

/**
 * الحصول على Firebase Admin instance
 */
const getFirebaseAdmin = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase Admin SDK غير مهيأ. يرجى استدعاء initializeFirebase() أولاً');
  }
  return admin;
};

/**
 * التحقق من حالة Firebase
 */
const isFirebaseReady = () => {
  return firebaseInitialized;
};

module.exports = {
  initializeFirebase,
  getFirebaseAdmin,
  isFirebaseReady
};
