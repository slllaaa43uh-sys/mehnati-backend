const sharp = require('sharp');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// إعدادات الضغط
const COMPRESSION_CONFIG = {
  image: {
    // إعدادات ضغط الصور
    maxWidth: 1080,           // الحد الأقصى للعرض
    maxHeight: 1920,          // الحد الأقصى للارتفاع
    quality: 70,              // جودة الضغط (0-100) - 70 يعطي توازن جيد
    format: 'webp',           // تنسيق الإخراج - WebP أصغر حجماً
    avatarSize: 400,          // حجم صور الملف الشخصي
    avatarQuality: 75,        // جودة صور الملف الشخصي
    storyMaxWidth: 1080,      // عرض القصص
    storyQuality: 65          // جودة القصص (أقل لأنها مؤقتة)
  },
  video: {
    // إعدادات ضغط الفيديو
    maxWidth: 720,            // الحد الأقصى للعرض
    maxHeight: 1280,          // الحد الأقصى للارتفاع
    crf: 28,                  // Constant Rate Factor (18-28 جيد، أعلى = ضغط أكثر)
    preset: 'fast',           // سرعة الترميز (ultrafast, fast, medium, slow)
    audioBitrate: '96k',      // معدل بت الصوت
    maxDuration: 60,          // الحد الأقصى للمدة بالثواني
    format: 'mp4'             // تنسيق الإخراج
  }
};

// تعطيل التخزين المؤقت في Sharp لتوفير الذاكرة
sharp.cache(false);
// تحديد عدد الخيوط المتزامنة
sharp.concurrency(1);

/**
 * ضغط صورة باستخدام Sharp مع إدارة الذاكرة
 * @param {Buffer} inputBuffer - بيانات الصورة الأصلية
 * @param {Object} options - خيارات الضغط
 * @returns {Promise<{buffer: Buffer, info: Object}>}
 */
const compressImage = async (inputBuffer, options = {}) => {
  let sharpInstance = null;
  
  try {
    const config = COMPRESSION_CONFIG.image;
    const {
      maxWidth = config.maxWidth,
      maxHeight = config.maxHeight,
      quality = config.quality,
      format = config.format,
      isAvatar = false,
      isStory = false
    } = options;

    // إنشاء instance جديد من Sharp
    sharpInstance = sharp(inputBuffer, {
      limitInputPixels: 268402689, // حد أقصى للبكسلات (16384 x 16384)
      sequentialRead: true // قراءة تسلسلية لتوفير الذاكرة
    });
    
    // الحصول على معلومات الصورة الأصلية
    const metadata = await sharpInstance.metadata();
    
    // تحديد الأبعاد المناسبة
    let targetWidth = maxWidth;
    let targetHeight = maxHeight;
    let targetQuality = quality;
    
    if (isAvatar) {
      targetWidth = config.avatarSize;
      targetHeight = config.avatarSize;
      targetQuality = config.avatarQuality;
    } else if (isStory) {
      targetWidth = config.storyMaxWidth;
      targetQuality = config.storyQuality;
    }
    
    // تغيير الحجم مع الحفاظ على النسبة
    sharpInstance = sharpInstance.resize(targetWidth, targetHeight, {
      fit: isAvatar ? 'cover' : 'inside',
      withoutEnlargement: true
    });
    
    // تحويل إلى WebP مع الضغط
    let outputBuffer;
    let outputFormat = format;
    
    if (format === 'webp') {
      outputBuffer = await sharpInstance
        .webp({ quality: targetQuality, effort: 4 })
        .toBuffer();
    } else if (format === 'jpeg' || format === 'jpg') {
      outputBuffer = await sharpInstance
        .jpeg({ quality: targetQuality, mozjpeg: true })
        .toBuffer();
      outputFormat = 'jpeg';
    } else {
      outputBuffer = await sharpInstance
        .png({ compressionLevel: 9, quality: targetQuality })
        .toBuffer();
      outputFormat = 'png';
    }
    
    // حساب نسبة الضغط
    const originalSize = inputBuffer.length;
    const compressedSize = outputBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    console.log(`📸 ضغط الصورة: ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB (${compressionRatio}% توفير)`);
    
    return {
      buffer: outputBuffer,
      info: {
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio),
        format: outputFormat,
        width: metadata.width,
        height: metadata.height
      }
    };
  } catch (error) {
    console.error('❌ خطأ في ضغط الصورة:', error.message);
    throw error;
  } finally {
    // تنظيف الذاكرة - مهم جداً!
    if (sharpInstance) {
      sharpInstance.destroy();
      sharpInstance = null;
    }
    // تشغيل garbage collector إذا كان متاحاً
    if (global.gc) {
      global.gc();
    }
  }
};

/**
 * ضغط فيديو باستخدام FFmpeg
 * @param {Buffer} inputBuffer - بيانات الفيديو الأصلية
 * @param {Object} options - خيارات الضغط
 * @returns {Promise<{buffer: Buffer, info: Object}>}
 */
const compressVideo = async (inputBuffer, options = {}) => {
  const config = COMPRESSION_CONFIG.video;
  const {
    maxWidth = config.maxWidth,
    maxHeight = config.maxHeight,
    crf = config.crf,
    preset = config.preset,
    audioBitrate = config.audioBitrate
  } = options;
  
  // إنشاء ملفات مؤقتة
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input_${uuidv4()}.mp4`);
  const outputPath = path.join(tempDir, `output_${uuidv4()}.mp4`);
  
  try {
    // كتابة الملف المؤقت
    await fs.writeFile(inputPath, inputBuffer);
    
    // تحرير الذاكرة من الـ buffer الأصلي
    inputBuffer = null;
    
    // أمر FFmpeg للضغط مع تحديد الذاكرة
    const ffmpegCommand = `ffmpeg -i "${inputPath}" \
      -vf "scale='min(${maxWidth},iw)':min'(${maxHeight},ih)':force_original_aspect_ratio=decrease" \
      -c:v libx264 \
      -crf ${crf} \
      -preset ${preset} \
      -c:a aac \
      -b:a ${audioBitrate} \
      -movflags +faststart \
      -threads 1 \
      -y "${outputPath}"`;
    
    // تنفيذ الأمر مع حد أقصى للذاكرة
    await new Promise((resolve, reject) => {
      const process = exec(ffmpegCommand, { 
        maxBuffer: 50 * 1024 * 1024, // تقليل من 100MB إلى 50MB
        timeout: 120000 // 2 دقيقة كحد أقصى
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg stderr:', stderr);
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    // قراءة الملف المضغوط
    const outputBuffer = await fs.readFile(outputPath);
    
    // حساب نسبة الضغط
    const inputStats = await fs.stat(inputPath);
    const originalSize = inputStats.size;
    const compressedSize = outputBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    console.log(`🎬 ضغط الفيديو: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% توفير)`);
    
    // تنظيف الملفات المؤقتة فوراً
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    
    return {
      buffer: outputBuffer,
      info: {
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio),
        format: 'mp4'
      }
    };
  } catch (error) {
    // تنظيف في حالة الخطأ
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    
    console.error('❌ خطأ في ضغط الفيديو:', error.message);
    throw error;
  }
};

/**
 * ضغط ملف تلقائياً بناءً على نوعه
 * @param {Buffer} inputBuffer - بيانات الملف
 * @param {string} mimeType - نوع الملف
 * @param {Object} options - خيارات إضافية
 * @returns {Promise<{buffer: Buffer, info: Object, contentType: string}>}
 */
const compressFile = async (inputBuffer, mimeType, options = {}) => {
  const isVideo = mimeType.startsWith('video/');
  const isImage = mimeType.startsWith('image/');
  
  if (isImage) {
    const result = await compressImage(inputBuffer, options);
    return {
      ...result,
      contentType: `image/${result.info.format}`
    };
  } else if (isVideo) {
    const result = await compressVideo(inputBuffer, options);
    return {
      ...result,
      contentType: 'video/mp4'
    };
  } else {
    // إرجاع الملف كما هو إذا لم يكن صورة أو فيديو
    return {
      buffer: inputBuffer,
      info: {
        originalSize: inputBuffer.length,
        compressedSize: inputBuffer.length,
        compressionRatio: 0
      },
      contentType: mimeType
    };
  }
};

/**
 * إنشاء صورة مصغرة للفيديو
 * @param {Buffer} videoBuffer - بيانات الفيديو
 * @returns {Promise<Buffer>}
 */
const generateVideoThumbnail = async (videoBuffer) => {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `thumb_input_${uuidv4()}.mp4`);
  const outputPath = path.join(tempDir, `thumb_output_${uuidv4()}.jpg`);
  
  try {
    await fs.writeFile(inputPath, videoBuffer);
    
    // تحرير الذاكرة
    videoBuffer = null;
    
    // استخراج إطار من الثانية الأولى
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 -vf "scale=720:-1" -q:v 2 -threads 1 -y "${outputPath}"`;
    
    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, { timeout: 30000 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    const thumbnailBuffer = await fs.readFile(outputPath);
    
    // ضغط الصورة المصغرة
    const compressed = await compressImage(thumbnailBuffer, { quality: 70 });
    
    // تنظيف
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    
    return compressed.buffer;
  } catch (error) {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    throw error;
  }
};

/**
 * تنظيف الملفات المؤقتة القديمة
 * يجب استدعاؤها دورياً
 */
const cleanupTempFiles = async () => {
  const tempDir = os.tmpdir();
  try {
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 دقيقة
    
    for (const file of files) {
      if (file.startsWith('input_') || file.startsWith('output_') || file.startsWith('thumb_')) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            console.log(`🧹 تم حذف ملف مؤقت قديم: ${file}`);
          }
        } catch (e) {
          // تجاهل الأخطاء
        }
      }
    }
  } catch (error) {
    console.error('خطأ في تنظيف الملفات المؤقتة:', error.message);
  }
};

// تشغيل التنظيف كل 15 دقيقة
setInterval(cleanupTempFiles, 15 * 60 * 1000);

module.exports = {
  compressImage,
  compressVideo,
  compressFile,
  generateVideoThumbnail,
  cleanupTempFiles,
  COMPRESSION_CONFIG
};
