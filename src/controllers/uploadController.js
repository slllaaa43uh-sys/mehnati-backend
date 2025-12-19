const cloudinary = require('cloudinary').v2;

// @desc    Upload multiple files
// @route   POST /api/v1/upload/multiple
// @access  Private
exports.uploadMultiple = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي ملفات'
      });
    }

    // Map uploaded files to response format
    const files = req.files.map(file => ({
      filePath: file.path, // Cloudinary URL
      publicId: file.filename, // Cloudinary public ID
      fileType: file.mimetype.startsWith('video') ? 'video' : 'image',
      originalName: file.originalname,
      size: file.size
    }));

    res.status(200).json({
      success: true,
      message: 'تم رفع الملفات بنجاح',
      files
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload single file
// @route   POST /api/v1/upload/single
// @access  Private
exports.uploadSingle = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي ملف'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم رفع الملف بنجاح',
      file: {
        filePath: req.file.path,
        publicId: req.file.filename,
        fileType: req.file.mimetype.startsWith('video') ? 'video' : 'image',
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete file from cloudinary
// @route   DELETE /api/v1/upload/:publicId
// @access  Private
exports.deleteFile = async (req, res, next) => {
  try {
    const { publicId } = req.params;
    const { resourceType = 'image' } = req.body; // 'image' or 'video'

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

    res.status(200).json({
      success: true,
      message: 'تم حذف الملف بنجاح'
    });
  } catch (error) {
    next(error);
  }
};
