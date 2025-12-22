const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage configuration for posts media
const postStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // تحديد نوع الملف
    const isVideo = file.mimetype.startsWith('video/');
    
    // إعدادات أساسية
    const baseParams = {
      folder: 'mehnati/posts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi'],
      resource_type: 'auto'
    };
    
    // إضافة transformations للصور فقط (ليس للفيديو)
    if (!isVideo) {
      baseParams.transformation = [
        {
          width: 1080,
          crop: 'limit', // تصغير فقط إذا كانت أكبر من 1080px
          quality: 'auto:good', // جودة تلقائية جيدة (حوالي 80%)
          fetch_format: 'auto' // تحويل تلقائي إلى WebP للمتصفحات الداعمة
        }
      ];
    }
    
    return baseParams;
  }
});

// Storage configuration for user avatars
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mehnati/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
    transformation: [
      {
        width: 500,
        height: 500,
        crop: 'fill',
        gravity: 'face'
      }
    ]
  }
});

// Storage configuration for stories - OPTIMIZED: Added image transformations
const storyStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // تحديد نوع الملف
    const isVideo = file.mimetype.startsWith('video/');
    
    // إعدادات أساسية
    const baseParams = {
      folder: 'mehnati/stories',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'],
      resource_type: 'auto'
    };
    
    // إضافة transformations للصور فقط
    if (!isVideo) {
      baseParams.transformation = [
        {
          width: 1080,
          crop: 'limit',
          quality: 'auto:good',
          fetch_format: 'auto'
        }
      ];
    }
    
    return baseParams;
  }
});

// Storage configuration for video covers (shorts thumbnails)
const coverStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mehnati/covers',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
    transformation: [
      {
        width: 720,
        height: 1280,
        crop: 'fill',
        gravity: 'center',
        quality: 'auto:good'
      }
    ]
  }
});

module.exports = {
  cloudinary,
  postStorage,
  avatarStorage,
  storyStorage,
  coverStorage
};
