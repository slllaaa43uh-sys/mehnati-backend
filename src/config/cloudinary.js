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
  params: {
    folder: 'mehnati/posts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi'],
    resource_type: 'auto', // Automatically detect image or video
    transformation: [
      {
        quality: 'auto',
        fetch_format: 'auto'
      }
    ]
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
        gravity: 'face',
        quality: 'auto',
        fetch_format: 'auto'
      }
    ]
  }
});

// Storage configuration for stories
const storyStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mehnati/stories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'],
    resource_type: 'auto',
    transformation: [
      {
        quality: 'auto',
        fetch_format: 'auto'
      }
    ]
  }
});

module.exports = {
  cloudinary,
  postStorage,
  avatarStorage,
  storyStorage
};
