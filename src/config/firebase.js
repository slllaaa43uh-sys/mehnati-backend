const admin = require('firebase-admin');
const path = require('path');

/**
 * ============================================
 * Firebase Admin SDK Configuration
 * ============================================
 * هذا الملف مسؤول عن تهيئة Firebase Admin SDK
 * لإرسال الإشعارات عبر FCM (Firebase Cloud Messaging)
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

    // التحقق من وجود ملف Service Account Key
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    
    // محاولة تحميل ملف Service Account
    let serviceAccount;
    try {
      serviceAccount = require(serviceAccountPath);
    } catch (error) {
      console.warn('⚠️ لم يتم العثور على ملف firebase-service-account.json');
      console.warn('⚠️ يرجى إضافة الملف في المسار: /mehnati-backend/firebase-service-account.json');
      console.warn('⚠️ سيتم تعطيل خدمة FCM حتى إضافة الملف');
      return false;
    }

    // تهيئة Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK تم تهيئته بنجاح');
    console.log(`📱 Project ID: ${serviceAccount.project_id}`);
    return true;

  } catch (error) {
    console.error('❌ خطأ في تهيئة Firebase Admin SDK:', error.message);
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
