const multer = require('multer');
const { postStorage, avatarStorage, storyStorage, coverStorage } = require('../config/cloudinary');

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
  };

  const isImage = allowedTypes.image.includes(file.mimetype);
  const isVideo = allowedTypes.video.includes(file.mimetype);

  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. الأنواع المدعومة: صور (JPEG, PNG, GIF, WebP) وفيديو (MP4, WebM)'), false);
  }
};

// Image only filter for covers
const imageOnlyFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. الأنواع المدعومة: صور (JPEG, PNG, WebP)'), false);
  }
};

// Upload configurations for posts
const postUpload = multer({
  storage: postStorage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max for videos
  }
});

// Upload configuration for avatars
const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. الأنواع المدعومة: صور (JPEG, PNG, WebP)'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max for avatars
  }
});

// Upload configuration for stories
const storyUpload = multer({
  storage: storyStorage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max for stories
  }
});

// Upload configuration for video covers
const coverUpload = multer({
  storage: coverStorage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max for covers
  }
});

// Export different upload configurations
module.exports = {
  single: postUpload.single('file'),
  avatar: avatarUpload.single('avatar'),
  media: postUpload.array('media', 10), // Max 10 files
  storyMedia: storyUpload.single('media'),
  cover: coverUpload.single('cover'), // Single cover image
  // Combined upload for shorts (video + cover)
  shortsMedia: postUpload.fields([
    { name: 'media', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
  ])
};
