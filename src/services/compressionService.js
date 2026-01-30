const sharp = require('sharp');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// Enable/disable video/image compression via environment variables
// Set DISABLE_VIDEO_COMPRESSION=true to bypass FFmpeg and upload original video buffer
// Set DISABLE_IMAGE_COMPRESSION=true to upload original image buffer without Sharp
const DISABLE_VIDEO_COMPRESSION = process.env.DISABLE_VIDEO_COMPRESSION === 'true';
const DISABLE_IMAGE_COMPRESSION = process.env.DISABLE_IMAGE_COMPRESSION === 'true';

// إعدادات الضغط المحسنة - جودة متوازنة للصور (1080p) والفيديو (720p)
// تم تحسينها لتوفير الذاكرة
const COMPRESSION_CONFIG = {
  image: {
    // إعدادات ضغط الصور - جودة محسنة ومتوازنة
    maxWidth: 1080,           // عرض متوسط لجودة أفضل
    maxHeight: 1920,          // ارتفاع متوسط
    quality: 60,              // جودة متوسطة لتوفير الذاكرة (تم تقليلها من 65)
    format: 'webp',           // تنسيق WebP الأصغر حجماً
    avatarSize: 150,          // حجم معقول لصور الملف الشخصي (تم تقليله من 200)
    avatarQuality: 65,        // جودة جيدة للأفاتار (تم تقليلها من 70)
    storyMaxWidth: 720,       // عرض القصص محسن
    storyQuality: 60,         // جودة جيدة للقصص (تم تقليلها من 68)
    // إعدادات إضافية للضغط المتوازن
    thumbnailWidth: 250,      // عرض الصور المصغرة (تم تقليله من 300)
    thumbnailQuality: 55,     // جودة معقولة للصور المصغرة (تم تقليلها من 60)
    webpEffort: 3,            // جهد ضغط متوازن WebP (تم تقليله من 4 لتوفير الذاكرة)
    mozjpegQuality: 60        // جودة معقولة لـ JPEG (تم تقليلها من 65)
  },
  video: {
    // إعدادات ضغط الفيديو - جودة 720p مع توفير الذاكرة
    maxWidth: 1280,           // عرض 720p
    maxHeight: 720,           // ارتفاع 720p
    crf: 30,                  // ضغط أعلى لتوفير الذاكرة (تم زيادته من 28)
    preset: 'fast',           // سرعة أعلى لتقليل استخدام الذاكرة (تم تغييره من medium)
    audioBitrate: '96k',      // معدل بت صوت مقبول (تم تقليله من 128k)
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
  console.log('========================================');
  console.log('🎬 VIDEO COMPRESSION - STARTING');
  console.log('========================================');
  console.log('📊 Input Buffer Size:', (inputBuffer.length / 1024 / 1024).toFixed(2), 'MB');
  console.log('⚙️ Options:', JSON.stringify(options));
  console.log('🪫 Compression Disabled Flag:', DISABLE_VIDEO_COMPRESSION ? 'ON' : 'OFF');

  // If compression is disabled, return original buffer immediately
  if (DISABLE_VIDEO_COMPRESSION) {
    console.warn('⚠️ Video compression is DISABLED via env. Returning original buffer without FFmpeg.');
    return {
      buffer: inputBuffer,
      info: {
        originalSize: inputBuffer.length,
        compressedSize: inputBuffer.length,
        compressionRatio: 0,
        format: 'mp4'
      }
    };
  }
  
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
  
  console.log('📁 Temp Paths:');
  console.log('   - Input:', inputPath);
  console.log('   - Output:', outputPath);
  
  try {
    console.log('📝 Writing input buffer to temp file...');
    await fs.writeFile(inputPath, inputBuffer);
    console.log('✅ Input file written successfully');
    inputBuffer = null;
    
    // أمر FFmpeg للضغط مع ضمان أبعاد زوجية (عرض/ارتفاع يقبلها الترميز)
    // يستخدم scale للحفاظ على نسبة الأبعاد داخل الحد الأقصى، ثم pad لرفع القيم إلى أقرب رقم زوجي
    // أخيراً يفرض تنسيق البكسل yuv420p للتوافق الواسع
    const vfFilter = `scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2,format=${config.pixelFormat}`;
    // إضافة -threads 1 لتقليل استخدام الذاكرة
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -threads 1 -vf "${vfFilter}" -c:v ${config.videoCodec} -profile:v ${config.profile} -level ${config.level} -crf ${crf} -preset ${preset} -c:a ${config.audioCodec} -b:a ${audioBitrate} -ac 1 -ar 22050 -movflags +faststart -y "${outputPath}"`;
    
    console.log('🔧 FFmpeg Command:');
    console.log('   ', ffmpegCommand);
    console.log('   VF Filter:', vfFilter);
    
    console.log('⏳ Executing FFmpeg compression...');
    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, { 
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('========================================');
          console.error('❌ FFMPEG COMPRESSION ERROR');
          console.error('========================================');
          console.error('Error Message:', error.message);
          console.error('Error Code:', error.code);
          console.error('Error Signal:', error.signal);
          console.error('FFmpeg STDERR:', stderr);
          console.error('FFmpeg STDOUT:', stdout);
          console.error('========================================');
          reject(new Error(`فشل ضغط الفيديو: ${error.message}`));
        } else {
          console.log('✅ FFmpeg compression completed successfully');
          if (stdout) console.log('FFmpeg STDOUT:', stdout);
          resolve();
        }
      });
    });
    
    console.log('📖 Reading compressed output...');
    const outputBuffer = await fs.readFile(outputPath);
    console.log('✅ Output file read successfully');
    
    const inputStats = await fs.stat(inputPath);
    const originalSize = inputStats.size;
    const compressedSize = outputBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    console.log('========================================');
    console.log('📊 COMPRESSION RESULTS:');
    console.log('   - Original Size:', (originalSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('   - Compressed Size:', (compressedSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('   - Compression Ratio:', compressionRatio, '%');
    console.log('========================================');
    console.log(`🎬 ضغط محسن 720p للفيديو: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% توفير)`);
    
    console.log('🧹 Cleaning up temp files...');
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    console.log('✅ Temp files cleaned up');
    
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
    console.error('========================================');
    console.error('❌ CRITICAL ERROR IN VIDEO COMPRESSION');
    console.error('========================================');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('========================================');
    
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
    // Respect disable flag for images
    if (DISABLE_IMAGE_COMPRESSION) {
      console.warn('⚠️ Disabling image compression in compressFile(). Returning original buffer.');
      return {
        buffer: inputBuffer,
        info: {
          originalSize: inputBuffer.length,
          compressedSize: inputBuffer.length,
          compressionRatio: 0,
          format: mimeType.split('/')[1] || 'jpeg'
        },
        contentType: mimeType
      };
    }
    const result = await compressImage(inputBuffer, options);
    return {
      ...result,
      contentType: `image/${result.info.format}`
    };
  } else if (isVideo) {
    // Respect disable flag and preserve original mimeType
    if (DISABLE_VIDEO_COMPRESSION) {
      console.warn('⚠️ Disabling video compression in compressFile(). Returning original buffer.');
      return {
        buffer: inputBuffer,
        info: {
          originalSize: inputBuffer.length,
          compressedSize: inputBuffer.length,
          compressionRatio: 0,
          format: mimeType.split('/')[1] || 'mp4'
        },
        contentType: mimeType
      };
    }
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
 * تنظيف الملفات المؤقتة القديمة - محسن لتوفير الذاكرة
 */
const cleanupTempFiles = async () => {
  const tempDir = os.tmpdir();
  try {
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // تم تقليلها من 30 إلى 10 دقائق
    let deletedCount = 0;
    
    for (const file of files) {
      if (file.startsWith('input_') || file.startsWith('output_') || file.startsWith('thumb_') || file.startsWith('ffmpeg')) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (e) {
          // تجاهل الأخطاء
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🧹 تم حذف ${deletedCount} ملف مؤقت`);
      // تشغيل GC بعد التنظيف
      if (global.gc) {
        global.gc();
      }
    }
  } catch (error) {
    console.error('خطأ في تنظيف الملفات المؤقتة:', error.message);
  }
};

// تشغيل التنظيف كل 5 دقائق (تم تقليلها من 15 دقيقة)
setInterval(cleanupTempFiles, 5 * 60 * 1000);
// تشغيل فوري عند بدء الخادم
cleanupTempFiles();

module.exports = {
  compressImage,
  compressVideo,
  compressFile,
  generateVideoThumbnail,
  generateImageThumbnail,
  cleanupTempFiles,
  COMPRESSION_CONFIG
};
