const express = require('express');
const router = express.Router();
const {
  uploadMultiple,
  uploadSingle,
  uploadCover,
  deleteFile
} = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected (require authentication)
// Note: Frontend sends files as 'files' field
const multer = require('multer');
const { postStorage, coverStorage } = require('../config/cloudinary');
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
  };
  const isImage = allowedTypes.image.includes(file.mimetype);
  const isVideo = allowedTypes.video.includes(file.mimetype);
  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم'), false);
  }
};
const filesUpload = multer({
  storage: postStorage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
}).array('files', 10);

// Cover image upload configuration
const coverImageUpload = multer({
  storage: coverStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. الأنواع المدعومة: صور (JPEG, PNG, WebP)'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max for covers
}).single('cover');

router.post('/multiple', protect, filesUpload, uploadMultiple);
router.post('/single', protect, upload.single, uploadSingle);
router.post('/cover', protect, coverImageUpload, uploadCover);
router.delete('/:publicId', protect, deleteFile);

module.exports = router;
