const express = require('express');
const router = express.Router();
const {
  uploadMultiple,
  uploadSingle,
  uploadAvatarImage,
  uploadStory,
  uploadCoverImage,
  deleteFile
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

// All routes are protected (require authentication)

// رفع ملفات متعددة (صور وفيديوهات) مع الضغط
router.post('/multiple', protect, extendTimeout, upload.multiple, uploadMultiple);

// رفع ملف واحد مع الضغط
router.post('/single', protect, extendTimeout, upload.single, uploadSingle);

// رفع صورة الملف الشخصي مع الضغط
router.post('/avatar', protect, extendTimeout, upload.avatar, uploadAvatarImage);

// رفع وسائط القصة مع الضغط
router.post('/story', protect, extendTimeout, upload.storyMedia, uploadStory);

// رفع غلاف الفيديو مع الضغط
router.post('/cover', protect, extendTimeout, upload.cover, uploadCoverImage);

// حذف ملف من Backblaze B2
router.delete('/:fileId', protect, deleteFile);

module.exports = router;
