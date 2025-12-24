const {
  uploadMedia,
  uploadAvatar,
  uploadStoryMedia,
  uploadCover,
  deleteMedia,
  uploadMultipleMedia
} = require('../services/storageService');

// @desc    Upload multiple files with compression
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

    // رفع الملفات مع الضغط
    const results = await uploadMultipleMedia(req.files);
    
    // فصل النتائج الناجحة والفاشلة
    const successfulUploads = results.filter(r => r.success);
    const failedUploads = results.filter(r => !r.success);

    // تنسيق الملفات للاستجابة
    const files = successfulUploads.map(result => ({
      filePath: result.file.url,
      fileId: result.file.fileId,
      fileName: result.file.fileName,
      fileType: result.file.fileType,
      originalSize: result.file.originalSize,
      compressedSize: result.file.compressedSize,
      compressionRatio: result.file.compressionRatio,
      thumbnail: result.file.thumbnail || null
    }));

    res.status(200).json({
      success: true,
      message: 'تم رفع الملفات بنجاح',
      files,
      failed: failedUploads.length > 0 ? failedUploads : undefined,
      stats: {
        total: req.files.length,
        successful: successfulUploads.length,
        failed: failedUploads.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload single file with compression
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

    // رفع الملف مع الضغط
    const result = await uploadMedia(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(200).json({
      success: true,
      message: 'تم رفع الملف بنجاح',
      file: {
        filePath: result.file.url,
        fileId: result.file.fileId,
        fileName: result.file.fileName,
        fileType: result.file.fileType,
        originalSize: result.file.originalSize,
        compressedSize: result.file.compressedSize,
        compressionRatio: result.file.compressionRatio,
        thumbnail: result.file.thumbnail || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload avatar image with compression
// @route   POST /api/v1/upload/avatar
// @access  Private
exports.uploadAvatarImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع صورة الملف الشخصي'
      });
    }

    // رفع صورة الملف الشخصي مع الضغط
    const result = await uploadAvatar(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(200).json({
      success: true,
      message: 'تم رفع صورة الملف الشخصي بنجاح',
      avatar: {
        url: result.file.url,
        fileId: result.file.fileId,
        compressionRatio: result.file.compressionRatio
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload story media with compression
// @route   POST /api/v1/upload/story
// @access  Private
exports.uploadStory = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع وسائط القصة'
      });
    }

    // رفع وسائط القصة مع الضغط
    const result = await uploadStoryMedia(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(200).json({
      success: true,
      message: 'تم رفع وسائط القصة بنجاح',
      media: {
        url: result.file.url,
        fileId: result.file.fileId,
        fileType: result.file.fileType,
        compressionRatio: result.file.compressionRatio
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload video cover image with compression
// @route   POST /api/v1/upload/cover
// @access  Private
exports.uploadCoverImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع صورة الغلاف'
      });
    }

    // رفع غلاف الفيديو مع الضغط
    const result = await uploadCover(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(200).json({
      success: true,
      message: 'تم رفع غلاف الفيديو بنجاح',
      cover: {
        url: result.file.url,
        fileId: result.file.fileId,
        compressionRatio: result.file.compressionRatio
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete file from Backblaze B2
// @route   DELETE /api/v1/upload/:fileId
// @access  Private
exports.deleteFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { fileName } = req.body;

    if (!fileId || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'يجب توفير معرف الملف واسمه'
      });
    }

    await deleteMedia(fileId, fileName);

    res.status(200).json({
      success: true,
      message: 'تم حذف الملف بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// للتوافق مع الكود القديم
exports.uploadCover = exports.uploadCoverImage;
