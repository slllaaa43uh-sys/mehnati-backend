/**
 * ✅ مثال الكود الصحيح لرفع الفيديوهات والصور في React
 * This is the CORRECT way to upload videos and images in Frontend
 */

import React, { useState } from 'react';

const PostCreation = () => {
  const [contentText, setContentText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // ========================================
  // ✅ الطريقة الصحيحة لمعالجة اختيار الملف
  // ========================================
  const handleFileSelect = (event) => {
    const files = event.target.files;
    
    if (!files || files.length === 0) {
      setError('يرجى اختيار ملف');
      return;
    }

    // ✅ التحقق من نوع الملف
    const file = files[0];
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/mpeg'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('نوع الملف غير مدعوم. استخدم صورة أو فيديو');
      return;
    }

    // ✅ التحقق من حجم الملف (50MB للفيديوهات، 5MB للصور)
    const maxSize = file.type.startsWith('video') 
      ? 50 * 1024 * 1024  // 50MB للفيديوهات
      : 5 * 1024 * 1024;   // 5MB للصور

    if (file.size > maxSize) {
      setError(`حجم الملف كبير جداً. الحد الأقصى: ${maxSize / 1024 / 1024}MB`);
      return;
    }

    // ✅ حفظ الملف
    setSelectedFiles([file]);
    setError('');
    
    console.log('✅ File selected:', {
      name: file.name,
      type: file.type,
      size: (file.size / 1024 / 1024).toFixed(2) + 'MB'
    });
  };

  // ========================================
  // ✅ الطريقة الصحيحة لإرسال الفيديو/الصورة
  // ========================================
  const handleUpload = async (event) => {
    event.preventDefault();
    
    // التحقق من الملف
    if (selectedFiles.length === 0) {
      setError('يرجى اختيار صورة أو فيديو');
      return;
    }

    const file = selectedFiles[0];
    const isVideo = file.type.startsWith('video');
    
    console.log('🚀 Starting upload:', { 
      fileName: file.name, 
      isVideo: isVideo,
      size: (file.size / 1024 / 1024).toFixed(2) + 'MB'
    });

    setUploading(true);

    // ✅ إنشاء FormData بشكل صحيح
    const formData = new FormData();
    
    // ✅ أضف الملف مع الاسم الصحيح: 'file'
    formData.append('file', file);
    
    // ✅ أضف النص إذا كان موجوداً
    if (contentText.trim()) {
      formData.append('content', contentText);
    }

    // ✅ اختياري: أضف بيانات إضافية
    formData.append('type', isVideo ? 'short' : 'general');

    try {
      console.log('📤 FormData contents:');
      for (let pair of formData.entries()) {
        if (pair[0] === 'file') {
          console.log(`  ${pair[0]}: File(${pair[1].name})`);
        } else {
          console.log(`  ${pair[0]}: ${pair[1]}`);
        }
      }

      // ✅ أرسل الطلب بشكل صحيح
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/v1/upload/single', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // ❌ لا تضيف 'Content-Type' - Browser يضيفه تلقائياً
        },
        body: formData // ✅ أرسل FormData مباشرة
      });

      const data = await response.json();

      console.log('📋 Backend Response:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'فشل في رفع الملف');
      }

      // ✅ نجح الرفع
      console.log('✅ Upload successful!');
      console.log('   File URL:', data.file.filePath);
      console.log('   File ID:', data.file.fileId);
      console.log('   Thumbnail:', data.file.thumbnail);

      // الآن أرسل البيانات للـ create post endpoint
      await createPostWithMedia({
        content: contentText,
        media: [{
          url: data.file.filePath,
          type: isVideo ? 'video' : 'image',
          fileId: data.file.fileId,
          thumbnail: data.file.thumbnail
        }]
      });

      alert('✅ تم رفع الملف بنجاح!');
      setSelectedFiles([]);
      setContentText('');

    } catch (err) {
      console.error('❌ Upload failed:', err);
      setError(err.message || 'خطأ في رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  // ========================================
  // ✅ إنشاء المنشور مع الوسائط
  // ========================================
  const createPostWithMedia = async (postData) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/v1/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message);
      }

      console.log('✅ Post created:', data.post._id);
    } catch (err) {
      console.error('❌ Failed to create post:', err);
      throw err;
    }
  };

  return (
    <div className="post-creation">
      <form onSubmit={handleUpload}>
        {/* النص */}
        <textarea
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          placeholder="أضف نصاً (اختياري)"
          rows="3"
        />

        {/* اختيار الملف */}
        <input
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          disabled={uploading}
        />

        {/* عرض الملف المختار */}
        {selectedFiles.length > 0 && (
          <div className="file-preview">
            <p>✅ الملف المختار: {selectedFiles[0].name}</p>
            <p>📊 الحجم: {(selectedFiles[0].size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}

        {/* عرض الأخطاء */}
        {error && (
          <div className="error">
            ❌ {error}
          </div>
        )}

        {/* زر الإرسال */}
        <button 
          type="submit" 
          disabled={uploading || selectedFiles.length === 0}
        >
          {uploading ? '⏳ جاري الرفع...' : '📤 رفع المنشور'}
        </button>
      </form>
    </div>
  );
};

export default PostCreation;

/**
 * ========================================
 * ✅ ملخص النقاط الأساسية
 * ========================================
 * 
 * 1. ✅ استخدم FormData:
 *    const formData = new FormData();
 * 
 * 2. ✅ أضف الملف مع الاسم 'file':
 *    formData.append('file', fileObject);
 * 
 * 3. ✅ أرسل FormData مباشرة (بدون JSON.stringify):
 *    body: formData
 * 
 * 4. ✅ لا تضيف 'Content-Type': 'multipart/form-data':
 *    Browser يضيفه تلقائياً
 * 
 * 5. ✅ أرسل التوكن في Authorization:
 *    headers: { 'Authorization': `Bearer ${token}` }
 * 
 * 6. ✅ للصور والفيديوهات نفس المعاملة:
 *    formData.append('file', file); // صورة أو فيديو
 * 
 * 7. ✅ استخدم console.log() للتحقق:
 *    for (let pair of formData.entries()) console.log(pair);
 * 
 * 8. ✅ اختبر في DevTools Network:
 *    - هل الملف مرسول؟
 *    - هل Content-Type صحيح؟
 * 
 * ========================================
 */
