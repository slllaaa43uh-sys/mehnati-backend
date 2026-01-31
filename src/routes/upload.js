const express = require('express');
const router = express.Router();
const {
  uploadMultiple,
  uploadSingle,
  uploadAvatarImage,
  uploadStory,
  uploadCoverImage,
  deleteFile,
  uploadVideoChunk,
  completeVideoUpload
} = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Middleware لزيادة مهلة الطلب إلى 5 دقائق لرفع الملفات (للشبكات البطيئة)
const extendTimeout = (req, res, next) => {
  // 5 دقائق = 300000 مللي ثانية
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
};

// Multer error handler middleware
const handleMulterErrors = (err, req, res, next) => {
  console.error('\n========================================');
  console.error('🚫 MULTER ERROR');
  console.error('========================================');
  console.error('Error name:', err.name);
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  console.error('Field:', err.field);
  console.error('File:', req.file ? req.file.originalname : 'N/A');
  console.error('Files:', req.files ? req.files.length : 'N/A');
  console.error('========================================\n');
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'حجم الملف كبير جداً. الحد الأقصى: 50MB',
      error: 'FILE_TOO_LARGE',
      maxSize: '50MB'
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'عدد الملفات كبير جداً. الحد الأقصى: 5 ملفات',
      error: 'TOO_MANY_FILES'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'حقل الملف غير متوقع',
      error: 'UNEXPECTED_FIELD',
      field: err.field
    });
  }
  
  // Other multer errors
  return res.status(400).json({
    success: false,
    message: err.message || 'خطأ في رفع الملف',
    error: err.code || 'UPLOAD_ERROR'
  });
};

// All routes are protected (require authentication)

// رفع ملفات متعددة (صور وفيديوهات) مع الضغط
router.post('/multiple', protect, extendTimeout, upload.multiple, handleMulterErrors, uploadMultiple);

// رفع ملف واحد مع الضغط
router.post('/single', protect, extendTimeout, upload.single, handleMulterErrors, uploadSingle);

// رفع صورة الملف الشخصي مع الضغط
router.post('/avatar', protect, extendTimeout, upload.avatar, handleMulterErrors, uploadAvatarImage);

// رفع وسائط القصة مع الضغط
router.post('/story', protect, extendTimeout, upload.storyMedia, handleMulterErrors, uploadStory);

// رفع غلاف الفيديو مع الضغط
router.post('/cover', protect, extendTimeout, upload.cover, handleMulterErrors, uploadCoverImage);

// حذف ملف من Backblaze B2
router.delete('/:fileId', protect, deleteFile);


// رفع جزء من فيديو (chunk)
router.post('/video/chunk', protect, extendTimeout, upload.chunk, handleMulterErrors, uploadVideoChunk);

// إكمال رفع الفيديو وتجميع الأجزاء
router.post('/video/complete', protect, extendTimeout, completeVideoUpload);

module.exports = router;
