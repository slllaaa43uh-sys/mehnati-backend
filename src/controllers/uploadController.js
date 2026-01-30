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

    console.log('========================================');
    console.log('📤 UPLOAD MULTIPLE - REQUEST RECEIVED');
    console.log('========================================');
    console.log('🪫 DISABLE_VIDEO_COMPRESSION:', process.env.DISABLE_VIDEO_COMPRESSION === 'true' ? 'ON' : 'OFF');
    console.log('🪫 DISABLE_IMAGE_COMPRESSION:', process.env.DISABLE_IMAGE_COMPRESSION === 'true' ? 'ON' : 'OFF');
    console.log('📦 Files Count:', req.files.length);
    req.files.forEach((f, i) => {
      console.log(`   [${i}] Name: ${f.originalname}, Type: ${f.mimetype}, Size: ${(f.size/1024/1024).toFixed(2)}MB, Field: ${f.fieldname}`);
    });

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
    console.error('========================================');
    console.error('❌ UPLOAD MULTIPLE - ERROR');
    console.error('========================================');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    next(error);
  }
};

// @desc    Upload single file with compression
// @route   POST /api/v1/upload/single
// @access  Private
exports.uploadSingle = async (req, res, next) => {
  try {
    console.log('========================================');
    console.log('📤 UPLOAD SINGLE - REQUEST RECEIVED');
    console.log('========================================');
    console.log('📋 Request Details:');
    console.log('   - User ID:', req.user?.id || 'N/A');
    console.log('   - File Present:', !!req.file);
    console.log('🪫 DISABLE_VIDEO_COMPRESSION:', process.env.DISABLE_VIDEO_COMPRESSION === 'true' ? 'ON' : 'OFF');
    console.log('🪫 DISABLE_IMAGE_COMPRESSION:', process.env.DISABLE_IMAGE_COMPRESSION === 'true' ? 'ON' : 'OFF');
    
    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي ملف'
      });
    }
    
    console.log('   - Original Name:', req.file.originalname);
    console.log('   - MIME Type:', req.file.mimetype);
    console.log('   - Size:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('   - Buffer Length:', req.file.buffer ? req.file.buffer.length : 'N/A');

    console.log('🚀 Starting upload process...');
    // رفع الملف مع الضغط
    const result = await uploadMedia(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    
    console.log('✅ Upload completed successfully');
    console.log('   - File URL:', result.file.url);
    console.log('   - File ID:', result.file.fileId);
    console.log('========================================');

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
    console.error('========================================');
    console.error('❌ UPLOAD SINGLE - ERROR');
    console.error('========================================');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    if (req.file) {
      console.error('File Details:');
      console.error('   - Original Name:', req.file.originalname);
      console.error('   - MIME Type:', req.file.mimetype);
      console.error('   - Size:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');
    }
    console.error('========================================');
    next(error);
  }
};

// @desc    Upload avatar image with compression
// @route   POST /api/v1/upload/avatar
// @access  Private
exports.uploadAvatarImage = async (req, res, next) => {
  try {
    console.log('========================================');
    console.log('📤 UPLOAD AVATAR - REQUEST RECEIVED');
    console.log('========================================');
    console.log('🪫 DISABLE_IMAGE_COMPRESSION:', process.env.DISABLE_IMAGE_COMPRESSION === 'true' ? 'ON' : 'OFF');
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
    console.log('========================================');
    console.log('📤 UPLOAD STORY - REQUEST RECEIVED');
    console.log('========================================');
    console.log('🪫 DISABLE_VIDEO_COMPRESSION:', process.env.DISABLE_VIDEO_COMPRESSION === 'true' ? 'ON' : 'OFF');
    console.log('🪫 DISABLE_IMAGE_COMPRESSION:', process.env.DISABLE_IMAGE_COMPRESSION === 'true' ? 'ON' : 'OFF');
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
    console.log('========================================');
    console.log('📤 UPLOAD COVER - REQUEST RECEIVED');
    console.log('========================================');
    console.log('🪫 DISABLE_IMAGE_COMPRESSION:', process.env.DISABLE_IMAGE_COMPRESSION === 'true' ? 'ON' : 'OFF');
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
