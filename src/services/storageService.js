const { uploadFile, deleteFile, initializeB2, getAuthData } = require('../config/backblaze');
const { compressFile, compressImage, generateVideoThumbnail } = require('./compressionService');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * خدمة التخزين الموحدة
 * تجمع بين ضغط الملفات ورفعها إلى Backblaze B2
 */

// أنواع المجلدات
const FOLDERS = {
  POSTS: 'mehnati/posts',
  AVATARS: 'mehnati/avatars',
  STORIES: 'mehnati/stories',
  COVERS: 'mehnati/covers',
  THUMBNAILS: 'mehnati/thumbnails'
};

/**
 * توليد اسم ملف فريد
 * @param {string} originalName - الاسم الأصلي
 * @param {string} extension - الامتداد الجديد
 * @returns {string}
 */
const generateFileName = (folder, originalName, extension) => {
  const timestamp = Date.now();
  const uniqueId = uuidv4().split('-')[0];
  const safeName = originalName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  return `${folder}/${timestamp}_${uniqueId}_${safeName}.${extension}`;
};

/**
 * رفع صورة مع الضغط
 * @param {Buffer} buffer - بيانات الصورة
 * @param {string} originalName - الاسم الأصلي
 * @param {string} mimeType - نوع الملف
 * @param {Object} options - خيارات إضافية
 * @returns {Promise<Object>}
 */
const uploadImage = async (buffer, originalName, mimeType, options = {}) => {
  try {
    const { folder = FOLDERS.POSTS, isAvatar = false, isStory = false } = options;
    
    // ضغط الصورة
    const compressed = await compressFile(buffer, mimeType, { isAvatar, isStory });
    
    // تحديد الامتداد بناءً على التنسيق
    const extension = compressed.contentType.split('/')[1];
    const fileName = generateFileName(folder, originalName, extension);
    
    // رفع إلى Backblaze B2
    const uploadResult = await uploadFile(
      compressed.buffer,
      fileName,
      compressed.contentType
    );
    
    return {
      success: true,
      file: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName,
        fileType: 'image',
        contentType: compressed.contentType,
        originalSize: compressed.info.originalSize,
        compressedSize: compressed.info.compressedSize,
        compressionRatio: compressed.info.compressionRatio
      }
    };
  } catch (error) {
    console.error('❌ خطأ في رفع الصورة:', error.message);
    throw error;
  }
};

/**
 * رفع فيديو مع الضغط
 * @param {Buffer} buffer - بيانات الفيديو
 * @param {string} originalName - الاسم الأصلي
 * @param {string} mimeType - نوع الملف
 * @param {Object} options - خيارات إضافية
 * @returns {Promise<Object>}
 */
const uploadVideo = async (buffer, originalName, mimeType, options = {}) => {
  try {
    const { folder = FOLDERS.POSTS, generateThumbnail = true } = options;
    
    // ضغط الفيديو
    const compressed = await compressFile(buffer, mimeType);
    
    // توليد اسم الملف
    const fileName = generateFileName(folder, originalName, 'mp4');
    
    // رفع الفيديو إلى Backblaze B2
    const uploadResult = await uploadFile(
      compressed.buffer,
      fileName,
      'video/mp4'
    );
    
    let thumbnailResult = null;
    
    // إنشاء صورة مصغرة إذا طُلب
    if (generateThumbnail) {
      try {
        const thumbnailBuffer = await generateVideoThumbnail(buffer);
        const thumbnailFileName = generateFileName(FOLDERS.THUMBNAILS, originalName, 'webp');
        
        thumbnailResult = await uploadFile(
          thumbnailBuffer,
          thumbnailFileName,
          'image/webp'
        );
      } catch (thumbError) {
        console.warn('⚠️ فشل إنشاء الصورة المصغرة:', thumbError.message);
      }
    }
    
    return {
      success: true,
      file: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName,
        fileType: 'video',
        contentType: 'video/mp4',
        originalSize: compressed.info.originalSize,
        compressedSize: compressed.info.compressedSize,
        compressionRatio: compressed.info.compressionRatio,
        thumbnail: thumbnailResult ? {
          url: thumbnailResult.url,
          fileId: thumbnailResult.fileId
        } : null
      }
    };
  } catch (error) {
    console.error('❌ خطأ في رفع الفيديو:', error.message);
    throw error;
  }
};

/**
 * رفع ملف تلقائياً (صورة أو فيديو)
 * @param {Buffer} buffer - بيانات الملف
 * @param {string} originalName - الاسم الأصلي
 * @param {string} mimeType - نوع الملف
 * @param {Object} options - خيارات إضافية
 * @returns {Promise<Object>}
 */
const uploadMedia = async (buffer, originalName, mimeType, options = {}) => {
  const isVideo = mimeType.startsWith('video/');
  
  if (isVideo) {
    return uploadVideo(buffer, originalName, mimeType, options);
  } else {
    return uploadImage(buffer, originalName, mimeType, options);
  }
};

/**
 * رفع صورة الملف الشخصي (Avatar)
 * @param {Buffer} buffer - بيانات الصورة
 * @param {string} originalName - الاسم الأصلي
 * @param {string} mimeType - نوع الملف
 * @returns {Promise<Object>}
 */
const uploadAvatar = async (buffer, originalName, mimeType) => {
  return uploadImage(buffer, originalName, mimeType, {
    folder: FOLDERS.AVATARS,
    isAvatar: true
  });
};

/**
 * رفع وسائط القصة
 * @param {Buffer} buffer - بيانات الملف
 * @param {string} originalName - الاسم الأصلي
 * @param {string} mimeType - نوع الملف
 * @returns {Promise<Object>}
 */
const uploadStoryMedia = async (buffer, originalName, mimeType) => {
  const isVideo = mimeType.startsWith('video/');
  
  if (isVideo) {
    return uploadVideo(buffer, originalName, mimeType, {
      folder: FOLDERS.STORIES,
      generateThumbnail: false
    });
  } else {
    return uploadImage(buffer, originalName, mimeType, {
      folder: FOLDERS.STORIES,
      isStory: true
    });
  }
};

/**
 * رفع غلاف الفيديو
 * @param {Buffer} buffer - بيانات الصورة
 * @param {string} originalName - الاسم الأصلي
 * @param {string} mimeType - نوع الملف
 * @returns {Promise<Object>}
 */
const uploadCover = async (buffer, originalName, mimeType) => {
  return uploadImage(buffer, originalName, mimeType, {
    folder: FOLDERS.COVERS
  });
};

/**
 * حذف ملف من التخزين
 * @param {string} fileId - معرف الملف
 * @param {string} fileName - اسم الملف
 * @returns {Promise<boolean>}
 */
const deleteMedia = async (fileId, fileName) => {
  try {
    await deleteFile(fileId, fileName);
    return true;
  } catch (error) {
    console.error('❌ خطأ في حذف الملف:', error.message);
    throw error;
  }
};

/**
 * رفع ملفات متعددة
 * @param {Array} files - مصفوفة الملفات
 * @param {Object} options - خيارات إضافية
 * @returns {Promise<Array>}
 */
const uploadMultipleMedia = async (files, options = {}) => {
  const results = [];
  
  for (const file of files) {
    try {
      const result = await uploadMedia(
        file.buffer,
        file.originalname,
        file.mimetype,
        options
      );
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        originalName: file.originalname
      });
    }
  }
  
  return results;
};

module.exports = {
  uploadImage,
  uploadVideo,
  uploadMedia,
  uploadAvatar,
  uploadStoryMedia,
  uploadCover,
  deleteMedia,
  uploadMultipleMedia,
  FOLDERS,
  initializeB2
};
