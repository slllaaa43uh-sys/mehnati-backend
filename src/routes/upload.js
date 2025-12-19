const express = require('express');
const router = express.Router();
const {
  uploadMultiple,
  uploadSingle,
  deleteFile
} = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected (require authentication)
// Note: Frontend sends files as 'files' field
const multer = require('multer');
const { postStorage } = require('../config/cloudinary');
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

router.post('/multiple', protect, filesUpload, uploadMultiple);
router.post('/single', protect, upload.single, uploadSingle);
router.delete('/:publicId', protect, deleteFile);

module.exports = router;
