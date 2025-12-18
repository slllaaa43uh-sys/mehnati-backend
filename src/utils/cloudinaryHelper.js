const { cloudinary } = require('../config/cloudinary');

/**
 * حذف ملف من Cloudinary باستخدام public_id
 * @param {string} publicId - معرف الملف في Cloudinary
 * @param {string} resourceType - نوع الملف (image أو video)
 * @returns {Promise<Object>} - نتيجة عملية الحذف
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('خطأ في حذف الملف من Cloudinary:', error);
    throw error;
  }
};

/**
 * حذف عدة ملفات من Cloudinary
 * @param {Array} publicIds - مصفوفة من معرفات الملفات
 * @param {string} resourceType - نوع الملفات
 * @returns {Promise<Object>} - نتيجة عملية الحذف
 */
const deleteMultipleFromCloudinary = async (publicIds, resourceType = 'image') => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('خطأ في حذف الملفات من Cloudinary:', error);
    throw error;
  }
};

/**
 * استخراج public_id من رابط Cloudinary
 * @param {string} url - رابط الملف في Cloudinary
 * @returns {string} - public_id
 */
const extractPublicId = (url) => {
  try {
    // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;
    
    // Get everything after 'upload/v{version}/'
    const pathParts = parts.slice(uploadIndex + 2);
    const fullPath = pathParts.join('/');
    
    // Remove file extension
    return fullPath.replace(/\.[^/.]+$/, '');
  } catch (error) {
    console.error('خطأ في استخراج public_id:', error);
    return null;
  }
};

module.exports = {
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
  extractPublicId
};
