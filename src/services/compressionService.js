const sharp = require('sharp');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// إعدادات الضغط المحسنة - جودة متوازنة للصور (1080p) والفيديو (720p)
const COMPRESSION_CONFIG = {
  image: {
    // إعدادات ضغط الصور - جودة محسنة ومتوازنة
    maxWidth: 1080,           // عرض متوسط لجودة أفضل
    maxHeight: 1920,          // ارتفاع متوسط
    quality: 65,              // جودة متوسطة لتوازن بين الحجم والوضوح
    format: 'webp',           // تنسيق WebP الأصغر حجماً
    avatarSize: 200,          // حجم معقول لصور الملف الشخصي
    avatarQuality: 70,        // جودة جيدة للأفاتار
    storyMaxWidth: 720,       // عرض القصص محسن
    storyQuality: 68,         // جودة جيدة للقصص
    // إعدادات إضافية للضغط المتوازن
    thumbnailWidth: 300,      // عرض الصور المصغرة
    thumbnailQuality: 60,     // جودة معقولة للصور المصغرة
    webpEffort: 4,            // جهد ضغط متوازن WebP
    mozjpegQuality: 65        // جودة معقولة لـ JPEG
  },
  video: {
    // إعدادات ضغط الفيديو - جودة 720p
    maxWidth: 1280,           // عرض 720p
    maxHeight: 720,           // ارتفاع 720p
    crf: 28,                  // ضغط متوازن لجودة جيدة
    preset: 'medium',         // توازن بين السرعة والجودة
    audioBitrate: '128k',     // معدل بت صوت جيد
    maxDuration: 60,          // الحد الأقصى للمدة بالثواني
    format: 'mp4',            // تنسيق الإخراج
    videoCodec: 'libx264',    // ترميز الفيديو
    audioCodec: 'aac',        // ترميز الصوت
    pixelFormat: 'yuv420p',   // تنسيق البكسل للتوافق
    profile: 'baseline',      // ملف تعريف أساسي للتوافق الأقصى
    level: '3.0'              // مستوى منخفض للتوافق
  }
};

// تعطيل التخزين المؤقت في Sharp لتوفير الذاكرة
sharp.cache(false);
// تحديد عدد الخيوط المتزامنة
sharp.concurrency(1);

/**
 * ضغط صورة باستخدام Sharp - أقصى ضغط ممكن
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
      isStory = false,
      isThumbnail = false
    } = options;

    // إنشاء instance جديد من Sharp
    sharpInstance = sharp(inputBuffer, {
      limitInputPixels: 268402689,
      sequentialRead: true
    });
    
    // الحصول على معلومات الصورة الأصلية
    const metadata = await sharpInstance.metadata();
    
    // تحديد الأبعاد والجودة المناسبة
    let targetWidth = maxWidth;
    let targetHeight = maxHeight;
    let targetQuality = quality;
    
    if (isThumbnail) {
      targetWidth = config.thumbnailWidth;
      targetHeight = Math.round(config.thumbnailWidth * 1.5);
      targetQuality = config.thumbnailQuality;
    } else if (isAvatar) {
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
      withoutEnlargement: true,
      kernel: 'lanczos2' // خوارزمية أسرع وأصغر
    });
    
    // تحويل إلى WebP مع الضغط الأقصى
    let outputBuffer;
    let outputFormat = format;
    
    if (format === 'webp') {
      outputBuffer = await sharpInstance
        .webp({ 
          quality: targetQuality, 
          effort: config.webpEffort,
          smartSubsample: true,
          nearLossless: false,
          alphaQuality: Math.max(targetQuality - 5, 5),
          reductionEffort: 6,
          preset: 'photo'
        })
        .toBuffer();
    } else if (format === 'jpeg' || format === 'jpg') {
      outputBuffer = await sharpInstance
        .jpeg({ 
          quality: config.mozjpegQuality, 
          mozjpeg: true,
          chromaSubsampling: '4:2:0',
          trellisQuantisation: true,
          overshootDeringing: true,
          optimizeScans: true,
          quantisationTable: 3
        })
        .toBuffer();
      outputFormat = 'jpeg';
    } else {
      outputBuffer = await sharpInstance
        .png({ 
          compressionLevel: 9,
          quality: targetQuality,
          palette: true,
          colors: 64
        })
        .toBuffer();
      outputFormat = 'png';
    }
    
    // حساب نسبة الضغط
    const originalSize = inputBuffer.length;
    const compressedSize = outputBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    console.log(`📸 ضغط محسن للصورة: ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB (${compressionRatio}% توفير)`);
    
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
    if (sharpInstance) {
      sharpInstance.destroy();
      sharpInstance = null;
    }
    if (global.gc) {
      global.gc();
    }
  }
};

/**
 * ضغط فيديو باستخدام FFmpeg - أقصى ضغط
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
  
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input_${uuidv4()}.mp4`);
  const outputPath = path.join(tempDir, `output_${uuidv4()}.mp4`);
  
  try {
    await fs.writeFile(inputPath, inputBuffer);
    inputBuffer = null;
    
    // أمر FFmpeg للضغط - صيغة مبسطة ومستقرة
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -vf "scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease,pad=${maxWidth}:${maxHeight}:(ow-iw)/2:(oh-ih)/2,format=${config.pixelFormat}" -c:v ${config.videoCodec} -profile:v ${config.profile} -level ${config.level} -crf ${crf} -preset ${preset} -c:a ${config.audioCodec} -b:a ${audioBitrate} -ac 2 -ar 44100 -movflags +faststart -y "${outputPath}"`;
    
    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, { 
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg stderr:', stderr);
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    const outputBuffer = await fs.readFile(outputPath);
    
    const inputStats = await fs.stat(inputPath);
    const originalSize = inputStats.size;
    const compressedSize = outputBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    console.log(`🎬 ضغط محسن 720p للفيديو: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% توفير)`);
    
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
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    
    console.error('❌ خطأ في ضغط الفيديو:', error.message);
    throw error;
  }
};

/**
 * ضغط ملف تلقائياً بناءً على نوعه
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
 */
const generateVideoThumbnail = async (videoBuffer) => {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `thumb_input_${uuidv4()}.mp4`);
  const outputPath = path.join(tempDir, `thumb_output_${uuidv4()}.jpg`);
  
  try {
    await fs.writeFile(inputPath, videoBuffer);
    videoBuffer = null;
    
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 -vf "scale=200:-1" -q:v 10 -threads 1 -y "${outputPath}"`;
    
    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, { timeout: 30000 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    const thumbnailBuffer = await fs.readFile(outputPath);
    
    const compressed = await compressImage(thumbnailBuffer, { 
      quality: COMPRESSION_CONFIG.image.thumbnailQuality,
      isThumbnail: true
    });
    
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
 * إنشاء صورة مصغرة للصورة
 */
const generateImageThumbnail = async (imageBuffer) => {
  try {
    const result = await compressImage(imageBuffer, {
      isThumbnail: true,
      quality: COMPRESSION_CONFIG.image.thumbnailQuality
    });
    return result.buffer;
  } catch (error) {
    console.error('❌ خطأ في إنشاء الصورة المصغرة:', error.message);
    throw error;
  }
};

/**
 * تنظيف الملفات المؤقتة القديمة
 */
const cleanupTempFiles = async () => {
  const tempDir = os.tmpdir();
  try {
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    
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

setInterval(cleanupTempFiles, 15 * 60 * 1000);

module.exports = {
  compressImage,
  compressVideo,
  compressFile,
  generateVideoThumbnail,
  generateImageThumbnail,
  cleanupTempFiles,
  COMPRESSION_CONFIG
};
