const multer = require('multer');

// استخدام Memory Storage بدلاً من Cloudinary Storage
// الملفات ستُحفظ في الذاكرة ثم تُضغط وتُرفع إلى Backblaze B2
const memoryStorage = multer.memoryStorage();

// Enhanced file filter with better video support
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  // Check for images
  if (allowedImageTypes.includes(file.mimetype)) {
    return cb(null, true);
  }
  
  // Enhanced video check - support various video formats and codecs
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

// Image only filter for avatars and covers
const imageOnlyFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. الأنواع المدعومة: صور (JPEG, PNG, WebP)'), false);
  }
};

// Upload configurations for posts (images and videos)
// تقليل الحد الأقصى للفيديو من 100MB إلى 50MB لتوفير الذاكرة
const postUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max for videos (تم تقليله من 100MB)
    files: 5 // حد أقصى 5 ملفات في الطلب الواحد
  }
});

// Upload configuration for avatars
const avatarUpload = multer({
  storage: memoryStorage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for avatars (تم تقليله من 10MB)
    files: 1
  }
});

// Upload configuration for stories
// تقليل الحد الأقصى للقصص من 50MB إلى 30MB
const storyUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB max for stories (تم تقليله من 50MB)
    files: 1
  }
});

// Upload configuration for video covers
const coverUpload = multer({
  storage: memoryStorage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for covers (تم تقليله من 10MB)
    files: 1
  }
});

// Export different upload configurations
module.exports = {
  single: postUpload.single('file'),
  multiple: postUpload.array('files', 5), // Max 5 files (تم تقليله من 10)
  avatar: avatarUpload.single('avatar'),
  media: postUpload.array('media', 5), // Max 5 files (تم تقليله من 10)
  storyMedia: storyUpload.single('file'),
  cover: coverUpload.single('cover')
};
