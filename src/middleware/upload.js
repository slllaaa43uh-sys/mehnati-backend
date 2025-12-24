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
const postUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max for videos
  }
});

// Upload configuration for avatars
const avatarUpload = multer({
  storage: memoryStorage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max for avatars (سيتم ضغطها)
  }
});

// Upload configuration for stories
const storyUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max for stories
  }
});

// Upload configuration for video covers
const coverUpload = multer({
  storage: memoryStorage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max for covers
  }
});

// Export different upload configurations
module.exports = {
  single: postUpload.single('file'),
  multiple: postUpload.array('files', 10), // Max 10 files
  avatar: avatarUpload.single('avatar'),
  media: postUpload.array('media', 10), // Max 10 files
  storyMedia: storyUpload.single('media'),
  cover: coverUpload.single('cover'),
  // Combined upload for shorts (video + cover)
  shortsMedia: postUpload.fields([
    { name: 'media', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
  ])
};
