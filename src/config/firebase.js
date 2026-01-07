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
    // Check environment variables
    // ============================================
    console.log('📋 Checking Firebase Environment Variables:');
    console.log('   - FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✓ SET (' + process.env.FIREBASE_PROJECT_ID + ')' : '✗ NOT SET');
    console.log('   - FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✓ SET (' + process.env.FIREBASE_CLIENT_EMAIL + ')' : '✗ NOT SET');
    console.log('   - FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✓ SET (length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ' chars)' : '✗ NOT SET');

    // ============================================
    // الطريقة 1: استخدام متغيرات البيئة (للخوادم الإنتاجية)
    // ============================================
    if (process.env.FIREBASE_PROJECT_ID && 
        process.env.FIREBASE_PRIVATE_KEY && 
        process.env.FIREBASE_CLIENT_EMAIL) {
      
      console.log('🔐 استخدام إعدادات Firebase من متغيرات البيئة...');
      
      // تحويل \n إلى أسطر جديدة حقيقية في المفتاح الخاص
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      console.log('🔑 Private Key Processing:');
      console.log('   - Original length:', process.env.FIREBASE_PRIVATE_KEY.length);
      console.log('   - Processed length:', privateKey.length);
      console.log('   - Starts with "-----BEGIN PRIVATE KEY-----":', privateKey.startsWith('-----BEGIN PRIVATE KEY-----') ? '✓ YES' : '✗ NO');
      console.log('   - Ends with "-----END PRIVATE KEY-----":', privateKey.trim().endsWith('-----END PRIVATE KEY-----\n') || privateKey.trim().endsWith('-----END PRIVATE KEY-----') ? '✓ YES' : '✗ NO');
      
      try {
        credential = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        });
        console.log('✅ تم إنشاء credential من متغيرات البيئة');
      } catch (certError) {
        console.error('❌ Error creating credential from env vars:', certError.message);
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
      console.log('📄 محاولة تحميل ملف firebase-service-account.json...');
      
      const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
      
      console.log('📂 Service Account Path:', serviceAccountPath);
      console.log('📂 File exists:', fs.existsSync(serviceAccountPath) ? '✓ YES' : '✗ NO');
      
      try {
        const serviceAccount = require(serviceAccountPath);
        
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
      } catch (error) {
        console.error('========================================');
        console.error('❌ FIREBASE CONFIGURATION ERROR');
        console.error('========================================');
        console.error('⚠️ لم يتم العثور على إعدادات Firebase');
        console.error('⚠️ Error:', error.message);
        console.error('');
        console.error('⚠️ يرجى إضافة أحد الخيارات التالية:');
        console.error('   1. ملف firebase-service-account.json في المجلد الرئيسي');
        console.error('      Path:', serviceAccountPath);
        console.error('   2. متغيرات البيئة:');
        console.error('      - FIREBASE_PROJECT_ID');
        console.error('      - FIREBASE_PRIVATE_KEY');
        console.error('      - FIREBASE_CLIENT_EMAIL');
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
    console.error('💡 تأكد من صحة الإعدادات وأن المفتاح الخاص صحيح');
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
