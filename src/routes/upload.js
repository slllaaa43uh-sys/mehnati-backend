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

// Enhanced file filter with better video support
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  // Check for images
  if (allowedImageTypes.includes(file.mimetype)) {
    return cb(null, true);
  }
  
  // Enhanced video check - support various video formats and codecs
  // Some browsers send mimetype with codecs like 'video/webm;codecs=vp8,opus'
  const mimeType = file.mimetype.toLowerCase();
  const isVideo = mimeType.startsWith('video/') || 
                  mimeType.includes('video/mp4') ||
                  mimeType.includes('video/webm') ||
                  mimeType.includes('video/quicktime') ||
                  mimeType.includes('video/x-msvideo') ||
                  mimeType.includes('video/mpeg') ||
                  mimeType.includes('video/ogg') ||
                  mimeType.includes('video/3gpp') ||
                  mimeType.includes('video/x-matroska');
  
  // Also check file extension as fallback
  const fileName = file.originalname.toLowerCase();
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.mpeg', '.mpg', '.3gp', '.ogg'];
  const hasVideoExtension = videoExtensions.some(ext => fileName.endsWith(ext));
  
  if (isVideo || hasVideoExtension) {
    return cb(null, true);
  }
  
  // Log rejected file for debugging
  console.log('Rejected file:', { 
    mimetype: file.mimetype, 
    originalname: file.originalname,
    fieldname: file.fieldname 
  });
  
  cb(new Error('نوع الملف غير مدعوم. الأنواع المدعومة: صور (JPEG, PNG, GIF, WebP) وفيديو (MP4, WebM, MOV, AVI)'), false);
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
