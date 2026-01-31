// ================== رفع فيديو مجزأ (Chunked Video Upload) ==================
const fs = require('fs');
const path = require('path');
const os = require('os');
const { uploadVideo } = require('../services/storageService');

// مجلد مؤقت لتخزين الأجزاء
const CHUNKS_DIR = path.join(os.tmpdir(), 'mehnati_video_chunks');
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });

// رفع جزء واحد من الفيديو
exports.uploadVideoChunk = async (req, res) => {
  try {
    // استخدم formidable أو multer memory
    const uploadId = req.body.uploadId;
    const chunkIndex = req.body.chunkIndex;
    const totalChunks = req.body.totalChunks;
    const chunkFile = req.files?.chunk || req.file || (req.body.chunk && req.body.chunk.buffer);
    // دعم multer memory
    let chunkBuffer;
    if (chunkFile && chunkFile.buffer) {
      chunkBuffer = chunkFile.buffer;
    } else if (chunkFile && chunkFile.data) {
      chunkBuffer = chunkFile.data;
    } else if (req.file && req.file.buffer) {
      chunkBuffer = req.file.buffer;
    } else if (req.body.chunk && Buffer.isBuffer(req.body.chunk)) {
      chunkBuffer = req.body.chunk;
    } else {
      return res.status(400).json({ success: false, message: 'لم يتم إرسال جزء الفيديو بشكل صحيح' });
    }

    if (!uploadId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ success: false, message: 'بيانات chunk ناقصة' });
    }

    const uploadDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const chunkPath = path.join(uploadDir, `chunk_${chunkIndex}`);
    fs.writeFileSync(chunkPath, chunkBuffer);

    return res.status(200).json({ success: true, message: `تم رفع الجزء ${chunkIndex + 1} من ${totalChunks}` });
  } catch (error) {
    console.error('❌ خطأ في رفع جزء الفيديو:', error);
    return res.status(500).json({ success: false, message: 'فشل رفع جزء الفيديو', error: error.message });
  }
};

// تجميع الأجزاء ورفع الفيديو النهائي
exports.completeVideoUpload = async (req, res) => {
  try {
    const { uploadId, filename, mimetype } = req.body;
    if (!uploadId) {
      return res.status(400).json({ success: false, message: 'معرف الرفع (uploadId) مفقود' });
    }
    const uploadDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      return res.status(400).json({ success: false, message: 'لم يتم العثور على أجزاء الفيديو' });
    }
    // ترتيب الأجزاء وتجميعها
    const chunkFiles = fs.readdirSync(uploadDir)
      .filter(f => f.startsWith('chunk_'))
      .sort((a, b) => {
        const aIdx = parseInt(a.split('_')[1]);
        const bIdx = parseInt(b.split('_')[1]);
        return aIdx - bIdx;
      });
    if (chunkFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد أجزاء فيديو مرفوعة' });
    }

    // تحقق من عدم وجود أجزاء ناقصة
    for (let i = 0; i < chunkFiles.length; i++) {
      if (!chunkFiles[i] || !chunkFiles[i].startsWith(`chunk_${i}`)) {
        return res.status(400).json({ success: false, message: `الجزء رقم ${i} مفقود أو غير مرتب بشكل صحيح` });
      }
    }

    // دمج الأجزاء في ملف واحد مؤقت (appendFileSync لضمان الكتابة الثنائية الصحيحة)
    const tempVideoPath = path.join(uploadDir, 'merged_video');
    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    for (const chunkFile of chunkFiles) {
      const chunkPath = path.join(uploadDir, chunkFile);
      const data = fs.readFileSync(chunkPath);
      fs.appendFileSync(tempVideoPath, data);
    }

    // تحقق من حجم الملف النهائي
    const stats = fs.statSync(tempVideoPath);
    if (stats.size === 0) {
      return res.status(400).json({ success: false, message: 'الملف النهائي فارغ بعد التجميع' });
    }

    // رفع الفيديو النهائي إلى التخزين
    const videoBuffer = fs.readFileSync(tempVideoPath);
    const safeFilename = filename || `video_${uploadId}.mp4`;
    const safeMimetype = mimetype || 'video/mp4';
    const result = await uploadVideo(videoBuffer, safeFilename, safeMimetype);

    // حذف الأجزاء المؤقتة
    fs.rmSync(uploadDir, { recursive: true, force: true });

    return res.status(200).json({ success: true, message: 'تم رفع وتجميع الفيديو بنجاح', file: result.file });
  } catch (error) {
    console.error('❌ خطأ في تجميع الفيديو:', error);
    return res.status(500).json({ success: false, message: 'فشل تجميع الفيديو', error: error.message });
  }
};
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
