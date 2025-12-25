const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

/**
 * قص الفيديو باستخدام FFmpeg
 * @param {Buffer} videoBuffer - محتوى الفيديو الأصلي
 * @param {string} originalName - اسم الملف الأصلي
 * @param {number} startTime - وقت البداية بالثواني
 * @param {number} endTime - وقت النهاية بالثواني
 * @returns {Promise<{buffer: Buffer, filename: string}>} - الفيديو المقصوص
 */
exports.trimVideo = async (videoBuffer, originalName, startTime, endTime) => {
  const tempDir = path.join(__dirname, '../../temp');
  
  // إنشاء مجلد مؤقت إذا لم يكن موجوداً
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.error('Error creating temp directory:', error);
  }

  const inputPath = path.join(tempDir, `input_${uuidv4()}_${originalName}`);
  const outputPath = path.join(tempDir, `output_${uuidv4()}_${originalName}`);

  try {
    // كتابة الفيديو الأصلي إلى ملف مؤقت
    await fs.writeFile(inputPath, videoBuffer);

    // حساب المدة المطلوبة
    const duration = endTime - startTime;

    console.log(`Trimming video: start=${startTime}s, end=${endTime}s, duration=${duration}s`);

    // قص الفيديو باستخدام FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .outputOptions([
          '-c:v libx264',      // ترميز الفيديو
          '-preset fast',      // سرعة الترميز
          '-crf 23',           // جودة الفيديو (18-28، أقل = جودة أعلى)
          '-c:a aac',          // ترميز الصوت
          '-b:a 128k',         // معدل بت الصوت
          '-movflags +faststart' // تحسين التشغيل على الويب
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Processing: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('Video trimming completed successfully');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`فشل قص الفيديو: ${err.message}`));
        })
        .run();
    });

    // قراءة الفيديو المقصوص
    const trimmedBuffer = await fs.readFile(outputPath);
    
    // حذف الملفات المؤقتة
    await fs.unlink(inputPath).catch(err => console.error('Error deleting input file:', err));
    await fs.unlink(outputPath).catch(err => console.error('Error deleting output file:', err));

    return {
      buffer: trimmedBuffer,
      filename: `trimmed_${originalName}`
    };

  } catch (error) {
    // تنظيف الملفات المؤقتة في حالة الخطأ
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    
    throw error;
  }
};

/**
 * التحقق من صحة أوقات القص
 * @param {number} startTime - وقت البداية
 * @param {number} endTime - وقت النهاية
 * @param {number} maxDuration - أقصى مدة مسموحة (اختياري)
 * @returns {boolean} - صحيح إذا كانت الأوقات صالحة
 */
exports.validateTrimTimes = (startTime, endTime, maxDuration = 60) => {
  if (typeof startTime !== 'number' || typeof endTime !== 'number') {
    return false;
  }
  
  if (startTime < 0 || endTime <= startTime) {
    return false;
  }
  
  const duration = endTime - startTime;
  if (duration > maxDuration || duration < 0.1) {
    return false;
  }
  
  return true;
};
