/**
 * 🔍 Frontend Video Upload Debugging Guide
 * دليل التصحيح لمشكلة رفع الفيديو في الواجهة الأمامية
 */

// ========================================
// الخطوة 1: تفعيل وضع التصحيح في Console
// ========================================

// انسخ هذا الكود وشغله في Browser Console (F12)
// Copy this code and run it in Browser Console (F12)

const DEBUG_VIDEO_UPLOAD = true;

// ========================================
// الخطوة 2: فحص FormData قبل الإرسال
// ========================================

// ❌ الطريقة الخاطئة:
function wrongWayToUploadVideo(videoFile) {
  const formData = {
    file: videoFile,
    content: 'محتوى المنشور'
  };
  // ❌ هذا object عادي، ليس FormData
  // الخادم سيستقبل JSON بدلاً من multipart
}

// ✅ الطريقة الصحيحة:
function correctWayToUploadVideo(videoFile) {
  const formData = new FormData();
  formData.append('file', videoFile);
  formData.append('content', 'محتوى المنشور');
  
  // ✅ تحقق من محتويات FormData
  console.log('📦 FormData Contents:');
  for (const [key, value] of formData.entries()) {
    if (key === 'file') {
      console.log(`  ${key}: File { 
        name: "${value.name}", 
        size: ${value.size} bytes, 
        type: "${value.type}" 
      }`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }
  
  return formData;
}

// ========================================
// الخطوة 3: Debugging Checklist
// ========================================

const videoUploadDebugChecklist = {
  
  // 1. تحقق من اختيار الملف
  checkFileSelection: (file) => {
    console.group('📁 File Selection Check');
    console.log('File exists:', !!file);
    console.log('File name:', file?.name);
    console.log('File size:', file?.size, 'bytes', `(${(file?.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log('File type:', file?.type);
    console.log('Is video:', file?.type.startsWith('video'));
    console.groupEnd();
  },

  // 2. تحقق من حجم الملف
  checkFileSize: (file, maxSizeMB = 50) => {
    console.group('📊 File Size Check');
    const maxBytes = maxSizeMB * 1024 * 1024;
    const isValid = file.size <= maxBytes;
    console.log(`Max allowed: ${maxSizeMB}MB (${maxBytes} bytes)`);
    console.log(`Actual size: ${(file.size / 1024 / 1024).toFixed(2)}MB (${file.size} bytes)`);
    console.log('Size valid:', isValid ? '✅ Yes' : '❌ No');
    console.groupEnd();
    return isValid;
  },

  // 3. تحقق من نوع الملف
  checkFileType: (file) => {
    console.group('🎬 File Type Check');
    const allowedVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/mpeg'
    ];
    const allowedImageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    
    const isVideo = allowedVideoTypes.includes(file.type);
    const isImage = allowedImageTypes.includes(file.type);
    
    console.log('File MIME type:', file.type);
    console.log('Is supported video:', isVideo ? '✅' : '❌');
    console.log('Is supported image:', isImage ? '✅' : '❌');
    console.log('Overall valid:', (isVideo || isImage) ? '✅ Yes' : '❌ No');
    console.groupEnd();
    
    return isVideo || isImage;
  },

  // 4. تحقق من FormData
  checkFormData: (formData) => {
    console.group('📦 FormData Check');
    console.log('Is FormData:', formData instanceof FormData);
    console.log('Entries:');
    
    let hasFile = false;
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  ✅ ${key}: File (name: ${value.name}, type: ${value.type})`);
        hasFile = true;
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    console.log('Has file:', hasFile ? '✅ Yes' : '❌ No');
    console.groupEnd();
    
    return hasFile;
  },

  // 5. تحقق من الطلب قبل الإرسال
  checkRequestBeforeSending: (method, url, headers, body) => {
    console.group('🔗 Request Check');
    console.log('Method:', method);
    console.log('URL:', url);
    console.log('Headers:', headers);
    console.log('Body type:', body instanceof FormData ? '✅ FormData' : typeof body);
    
    if (body instanceof FormData) {
      let fileCount = 0;
      for (const [key, value] of body.entries()) {
        if (value instanceof File) fileCount++;
      }
      console.log('Files in body:', fileCount);
    }
    
    console.groupEnd();
  },

  // 6. تحقق من استجابة الخادم
  checkResponse: (response, data) => {
    console.group('📨 Response Check');
    console.log('Status code:', response.status);
    console.log('Success:', data.success);
    console.log('Message:', data.message);
    
    if (data.success && data.file) {
      console.log('✅ Upload successful!');
      console.log('File URL:', data.file.filePath);
      console.log('File type:', data.file.fileType);
      console.log('Thumbnail:', data.file.thumbnail);
    } else if (data.errors) {
      console.log('❌ Errors:', data.errors);
    }
    
    console.groupEnd();
  }
};

// ========================================
// الخطوة 4: استخدم Debugging في الكود الحقيقي
// ========================================

async function uploadVideoWithDebugging(videoFile, contentText) {
  try {
    if (!videoFile) {
      console.error('❌ No file provided!');
      return null;
    }

    // 1️⃣ تحقق من الملف
    console.log('========================================');
    console.log('🔍 بدء عملية التصحيح الشاملة');
    console.log('========================================');
    videoUploadDebugChecklist.checkFileSelection(videoFile);
    videoUploadDebugChecklist.checkFileSize(videoFile, 100); // زيادة الحد الأقصى إلى 100MB
    const isValidType = videoUploadDebugChecklist.checkFileType(videoFile);

    if (!isValidType) {
      console.error('❌ Invalid file type!');
      return null;
    }

    // 2️⃣ أنشئ FormData
    const formData = new FormData();
    formData.append('file', videoFile); // اسم الحقل الصحيح
    if (contentText) {
      formData.append('content', contentText);
    }

    // 3️⃣ تحقق من FormData - فحص دقيق
    const isValidForm = videoUploadDebugChecklist.checkFormData(formData);
    if (!isValidForm) {
      console.error('❌ FormData is invalid - no file found!');
      return null;
    }

    // 4️⃣ تحقق من الـ API URL
    const API_BASE = window.location.origin; // استخدم الـ origin الحالي
    const uploadUrl = `${API_BASE}/api/v1/upload/single`;
    
    console.log('🌐 API Configuration:');
    console.log('  API Base:', API_BASE);
    console.log('  Upload URL:', uploadUrl);

    // 5️⃣ تحقق من Token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ No authentication token found!');
      console.log('⚠️ User might not be logged in');
      return null;
    }
    console.log('✅ Token found:', token.substring(0, 20) + '...');

    // 6️⃣ أنشئ Headers
    const headers = {
      'Authorization': `Bearer ${token}`
      // ⚠️ لا تضيف Content-Type - Browser سيضيفها تلقائياً
    };

    videoUploadDebugChecklist.checkRequestBeforeSending(
      'POST',
      uploadUrl,
      headers,
      formData
    );

    // 7️⃣ أرسل الطلب
    console.log('🚀 Sending request...');
    console.time('Upload Time');
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: headers, // بدون Content-Type
      body: formData
    });

    console.timeEnd('Upload Time');

    // 8️⃣ تحقق من الاستجابة
    console.log('\n📨 استجابة الخادم:');
    console.log('  Status Code:', response.status);
    console.log('  Status Text:', response.statusText);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error('❌ Failed to parse response as JSON');
      console.error('Response text:', await response.text());
      return null;
    }

    videoUploadDebugChecklist.checkResponse(response, data);

    if (!response.ok || !data.success) {
      const errorMsg = data.message || data.error || 'فشل في رفع الملف';
      throw new Error(errorMsg);
    }

    console.log('\n✅ تم رفع الملف بنجاح!');
    console.log('========================================\n');
    
    return data.file;

  } catch (error) {
    console.error('\n❌ خطأ أثناء الرفع:');
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    console.log('========================================\n');
    throw error;
  }
}

// ========================================
// الخطوة 5: اختبر في Browser
// ========================================

/**
 * خطوات الاختبار:
 * 
 * 1. افتح DevTools (F12)
 * 2. اذهب إلى Console tab
 * 3. انسخ هذا الكود كاملاً
 * 4. في الموقع، اختر فيديو
 * 5. في Console، اكتب:
 *    
 *    const videoInput = document.querySelector('input[type="file"]');
 *    const file = videoInput.files[0];
 *    uploadVideoWithDebugging(file, 'محتوى النص');
 * 
 * 6. شاهد الـ output في Console
 * 7. اذهب إلى Network tab وشاهد الطلب
 * 8. تحقق من Payload - هل الملف مرسول؟
 */

// ========================================
// الخطوة 6: Network Tab Inspection
// ========================================

/**
 * في DevTools Network Tab:
 * 
 * 1. فتح Network tab
 * 2. اختر فيديو وأرسله
 * 3. ابحث عن الطلب POST `/api/v1/upload/single`
 * 4. انقر عليه
 * 5. اذهب للـ Payload tab
 * 6. تحقق من:
 *    ✅ هل تشاهد `form-data`?
 *    ✅ هل يوجد حقل `file` مع الملف؟
 *    ✅ ما اسم الملف والحجم؟
 * 
 * إذا رأيت:
 * ❌ `{}` (object فارغ) → الملف لم يُرسل
 * ❌ `content: "text only"` بدون file → نسيت إضافة الملف
 * ✅ `file: (binary)` مع الحجم → الملف مرسول بشكل صحيح
 */

// ========================================
// الخطوة 7: Common Mistakes (الأخطاء الشائعة)
// ========================================

const commonMistakes = {
  
  mistake1: {
    description: 'استخدام object بدلاً من FormData',
    ❌: `
      const data = { file: videoFile, content: 'text' };
      fetch('/api/v1/upload/single', { 
        body: JSON.stringify(data)  // ❌ خطأ
      });
    `,
    ✅: `
      const formData = new FormData();
      formData.append('file', videoFile);
      fetch('/api/v1/upload/single', { 
        body: formData  // ✅ صحيح
      });
    `
  },

  mistake2: {
    description: 'نسيان إضافة الملف في FormData',
    ❌: `
      const formData = new FormData();
      formData.append('content', contentText);
      // نسيان: formData.append('file', videoFile);
    `,
    ✅: `
      const formData = new FormData();
      formData.append('file', videoFile);  // ✅ أضف الملف
      formData.append('content', contentText);
    `
  },

  mistake3: {
    description: 'إضافة Content-Type للـ headers',
    ❌: `
      fetch('/api/v1/upload/single', {
        headers: {
          'Content-Type': 'multipart/form-data'  // ❌ لا تضيفها
        },
        body: formData
      });
    `,
    ✅: `
      fetch('/api/v1/upload/single', {
        headers: {
          'Authorization': 'Bearer token'
          // Browser سيضيف Content-Type تلقائياً
        },
        body: formData
      });
    `
  },

  mistake4: {
    description: 'استخدام اسم حقل غير صحيح',
    ❌: `
      formData.append('video', videoFile);  // ❌ اسم خاطئ
      formData.append('media', videoFile);  // ❌ قد يكون خاطئ أيضاً
    `,
    ✅: `
      formData.append('file', videoFile);  // ✅ الاسم الصحيح
    `
  }
};

// ========================================
// الخطوة 8: فحص MediaFileObjects (الجزء الحرج!)
// ========================================

/**
 * 🔴 هذا هو الفحص الأهم!
 * تحقق من mediaFileObjects في الواجهة الأمامية
 */
function debugMediaFileObjects(mediaFileObjects) {
  console.group('🎬 mediaFileObjects Analysis (الجزء الحرج!)');
  
  console.log('Type:', Array.isArray(mediaFileObjects) ? '✅ Array' : '❌ Not Array');
  console.log('Length:', mediaFileObjects?.length || 0);
  console.log('Is empty:', mediaFileObjects?.length === 0 ? '❌ YES (المشكلة!)' : '✅ No');
  
  if (!mediaFileObjects || mediaFileObjects.length === 0) {
    console.error('❌❌❌ mediaFileObjects فارغة!');
    console.error('⚠️ هذا هو سبب المشكلة!');
    console.groupEnd();
    return false;
  }
  
  console.log('\n📋 محتويات mediaFileObjects:');
  mediaFileObjects.forEach((file, index) => {
    console.group(`  [${index}] ${file.name}`);
    console.log('  instanceof File:', file instanceof File ? '✅' : '❌');
    console.log('  name:', file.name);
    console.log('  size:', `${(file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('  type:', file.type);
    console.log('  lastModified:', new Date(file.lastModified));
    console.groupEnd();
  });
  
  console.groupEnd();
  return true;
}

/**
 * فحص rawMedia عند إرسال المشاركة
 */
function debugRawMedia(rawMedia) {
  console.group('📦 rawMedia Analysis');
  
  console.log('Type:', Array.isArray(rawMedia) ? '✅ Array' : '❌ Not Array');
  console.log('Length:', rawMedia?.length || 0);
  
  if (!rawMedia || rawMedia.length === 0) {
    console.error('❌ rawMedia فارغة - لن يتم رفع أي ملفات!');
    console.groupEnd();
    return false;
  }
  
  rawMedia.forEach((file, index) => {
    if (file instanceof File) {
      console.log(`✅ [${index}] Valid File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.error(`❌ [${index}] NOT a File object:`, typeof file, file);
    }
  });
  
  console.groupEnd();
  return rawMedia.every(f => f instanceof File);
}

/**
 * فحص شامل لعملية الرفع بأكملها
 */
async function comprehensiveUploadTest(mediaFileObjects, textContent) {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🔍 فحص شامل لعملية رفع الوسائط      ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 1. فحص mediaFileObjects
  console.log('📍 الخطوة 1: فحص mediaFileObjects');
  if (!debugMediaFileObjects(mediaFileObjects)) {
    console.error('⛔ توقف: mediaFileObjects فارغة!');
    return;
  }

  // 2. رفع كل ملف على حدة
  console.log('\n\n📍 الخطوة 2: رفع الملفات الواحد تلو الآخر');
  const uploadedFiles = [];
  
  for (let i = 0; i < mediaFileObjects.length; i++) {
    const file = mediaFileObjects[i];
    console.log(`\n⏳ رفع الملف [${i + 1}/${mediaFileObjects.length}]: ${file.name}`);
    
    try {
      const uploadedFile = await uploadVideoWithDebugging(file, null);
      if (uploadedFile) {
        uploadedFiles.push(uploadedFile);
        console.log(`✅ تم رفع: ${file.name}`);
      } else {
        console.error(`❌ فشل رفع: ${file.name}`);
      }
    } catch (err) {
      console.error(`❌ خطأ في رفع ${file.name}:`, err.message);
    }
  }

  // 3. عرض النتائج
  console.log('\n\n📍 الخطوة 3: ملخص النتائج');
  console.log(`تم رفع ${uploadedFiles.length} من ${mediaFileObjects.length} ملفات`);
  
  if (uploadedFiles.length === mediaFileObjects.length) {
    console.log('✅ تم رفع جميع الملفات بنجاح!');
    console.log('\nملفات الـ URL المرفوعة:');
    uploadedFiles.forEach((file, i) => {
      console.log(`  [${i}] URL: ${file.filePath}`);
      console.log(`       Type: ${file.fileType}`);
    });
  } else {
    console.error(`❌ فشل رفع ${mediaFileObjects.length - uploadedFiles.length} ملفات`);
  }

  // 4. إنشاء payload النهائي
  if (uploadedFiles.length > 0) {
    console.log('\n\n📍 الخطوة 4: Payload النهائي للمشاركة');
    const finalPayload = {
      content: textContent || 'محتوى المشاركة',
      media: uploadedFiles.map(f => ({
        url: f.filePath,
        type: f.fileType
      }))
    };
    console.log('Payload:', JSON.stringify(finalPayload, null, 2));
  }

  console.log('\n╚════════════════════════════════════════╝\n');
}

// ========================================
// الخطوة 9: اختبر الآن
// ========================================

console.log('🔍 Video Upload Debugging Guide - Enhanced Version');
console.log('استخدم debugMediaFileObjects() لفحص الملفات');
console.log('استخدم debugRawMedia() لفحص rawMedia');
console.log('استخدم comprehensiveUploadTest() للفحص الشامل');
console.log('استخدم uploadVideoWithDebugging() للاختبار');
