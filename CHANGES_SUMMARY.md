# ملخص التغييرات - مهنتي لي Backend

## التاريخ: 10 يناير 2026

---

## 1. زيادة مهلة رفع القصص والمنشورات إلى 5 دقائق

### المشكلة
عند رفع قصة أو منشور على شبكة بطيئة، كان الطلب يفشل بسبب انتهاء المهلة الزمنية.

### الحل
تم زيادة مهلة الخادم إلى 5 دقائق (300 ثانية) في عدة أماكن:

#### الملفات المعدلة:

**`src/server.js`**
```javascript
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000; // 5 minutes
server.headersTimeout = 310000; // 5 minutes + 10 seconds
```

**`src/routes/stories.js`**
```javascript
const extendTimeout = (req, res, next) => {
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
};

router.post('/', protect, extendTimeout, upload.storyMedia, createStory);
```

**`src/routes/posts.js`**
```javascript
router.post('/', protect, extendTimeout, upload.media, createPost);
```

**`src/routes/upload.js`**
```javascript
router.post('/multiple', protect, extendTimeout, upload.multiple, uploadMultiple);
router.post('/single', protect, extendTimeout, upload.single, uploadSingle);
router.post('/avatar', protect, extendTimeout, upload.avatar, uploadAvatarImage);
router.post('/story', protect, extendTimeout, upload.storyMedia, uploadStory);
router.post('/cover', protect, extendTimeout, upload.cover, uploadCoverImage);
```

---

## 2. تحسين الإشعارات لتظهر صورة المنشور (مثل يوتيوب)

### المشكلة
الإشعارات كانت تظهر نص فقط بدون صورة المنشور.

### الحل
تم تحديث نظام الإشعارات ليشمل صورة المنشور وجزء من النص.

#### الملفات المعدلة:

**`src/models/Notification.js`**
```javascript
// إضافة حقول جديدة في metadata
metadata: {
  // ... الحقول الموجودة
  postImage: String,        // رابط صورة المنشور
  postTitle: String,        // عنوان المنشور
  category: String          // تصنيف المنشور
}

// إضافة أنواع إشعارات جديدة
type: {
  enum: [
    // ... الأنواع الموجودة
    'channel_post',       // منشور جديد من قناة متابَعة
    'new_ad',             // إعلان جديد في تصنيف متابَع
    'story_view'          // شاهد قصتك
  ]
}
```

**`src/controllers/postController.js`**
```javascript
// استخراج صورة المنشور
let postImage = null;
if (post.media && post.media.length > 0) {
  const firstMedia = post.media[0];
  if (firstMedia.type === 'image') {
    postImage = firstMedia.url;
  } else if (firstMedia.type === 'video' && firstMedia.thumbnail) {
    postImage = firstMedia.thumbnail;
  }
}

// إرسال الإشعار مع الصورة
sendNotificationByCategory(category, notificationTitle, notificationBody, {
  postImage: postImage || '',
  postContent: postContentPreview,
  category: category
});
```

**`src/services/fcmService.js`**
```javascript
// إضافة الصورة إلى إشعارات FCM
const message = {
  notification: {
    title: title,
    body: body,
    ...(postImage && { imageUrl: postImage })
  },
  android: {
    notification: {
      ...(postImage && { imageUrl: postImage })
    }
  },
  apns: {
    payload: {
      aps: {
        'mutable-content': 1 // لدعم الإشعارات الغنية على iOS
      }
    },
    fcm_options: {
      ...(postImage && { image: postImage })
    }
  }
};
```

---

## 3. حل مشكلة استنزاف الذاكرة

### المشكلة
الخادم كان يرسل رسائل تحذير عن استنزاف الذاكرة.

### الحلول المطبقة:

#### أ. تحسين إعدادات الضغط (`src/services/compressionService.js`)

| الإعداد | القيمة القديمة | القيمة الجديدة |
|---------|---------------|----------------|
| جودة الصور | 65 | 60 |
| حجم الأفاتار | 200px | 150px |
| جودة الأفاتار | 70 | 65 |
| جودة القصص | 68 | 60 |
| عرض الصور المصغرة | 300px | 250px |
| جودة الصور المصغرة | 60 | 55 |
| CRF للفيديو | 28 | 30 |
| Preset للفيديو | medium | fast |
| معدل بت الصوت | 128k | 96k |

#### ب. تحسين FFmpeg
```javascript
// إضافة -threads 1 لتقليل استخدام الذاكرة
const ffmpegCommand = `ffmpeg -i "${inputPath}" -threads 1 ...`;
```

#### ج. تحسين تنظيف الملفات المؤقتة
- تقليل فترة الاحتفاظ بالملفات من 30 إلى 10 دقائق
- تشغيل التنظيف كل 5 دقائق بدلاً من 15 دقيقة
- تشغيل GC بعد التنظيف

#### د. تحسين مراقبة الذاكرة (`src/server.js`)
- تقليل عتبة التحذير من 400MB إلى 250MB
- إضافة تحذير حرج عند 400MB
- تسجيل الذاكرة كل 3 دقائق بدلاً من 5

#### هـ. تحسين خدمة التوصيات (`src/services/recommendationService.js`)
- تحديد عدد المرشحين بـ 500 كحد أقصى
- تحديد الحقول المطلوبة فقط في الاستعلام

#### و. تقليل فترة cron للتوصيات
- من 60 دقيقة إلى 120 دقيقة

---

## ملاحظات للنشر

1. **لتفعيل Garbage Collector اليدوي:**
   ```bash
   node --expose-gc src/server.js
   ```

2. **متطلبات الإشعارات الغنية على iOS:**
   - يجب إضافة Notification Service Extension في تطبيق iOS
   - يجب تفعيل `mutable-content` في الإشعارات

3. **متطلبات الإشعارات الغنية على Android:**
   - يجب أن يكون حجم الصورة أقل من 1MB
   - يجب أن تكون الصورة بصيغة JPEG أو PNG أو WebP

---

## الملفات المعدلة

| الملف | التغييرات |
|-------|-----------|
| `src/server.js` | زيادة timeout + تحسين مراقبة الذاكرة |
| `src/routes/stories.js` | إضافة extendTimeout |
| `src/routes/posts.js` | إضافة extendTimeout |
| `src/routes/upload.js` | إضافة extendTimeout |
| `src/models/Notification.js` | حقول وأنواع جديدة |
| `src/controllers/postController.js` | استخراج صورة المنشور |
| `src/services/fcmService.js` | إضافة الصورة للإشعارات |
| `src/services/compressionService.js` | تحسين الضغط والتنظيف |
| `src/services/recommendationService.js` | تحديد المرشحين |
