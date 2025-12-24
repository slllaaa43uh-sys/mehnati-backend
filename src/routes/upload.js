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

// All routes are protected (require authentication)

// رفع ملفات متعددة (صور وفيديوهات) مع الضغط
router.post('/multiple', protect, upload.multiple, uploadMultiple);

// رفع ملف واحد مع الضغط
router.post('/single', protect, upload.single, uploadSingle);

// رفع صورة الملف الشخصي مع الضغط
router.post('/avatar', protect, upload.avatar, uploadAvatarImage);

// رفع وسائط القصة مع الضغط
router.post('/story', protect, upload.storyMedia, uploadStory);

// رفع غلاف الفيديو مع الضغط
router.post('/cover', protect, upload.cover, uploadCoverImage);

// حذف ملف من Backblaze B2
router.delete('/:fileId', protect, deleteFile);

module.exports = router;
