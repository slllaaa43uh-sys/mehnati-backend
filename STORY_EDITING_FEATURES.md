# ميزات تعديل القصص - Story Editing Features

## نظرة عامة
تم تحديث نظام القصص لدعم ميزات تعديل متقدمة تشمل:
- إضافة نصوص مخصصة
- إضافة ملصقات (Stickers)
- تطبيق فلاتر على الصور والفيديو
- تكبير وتصغير الوسائط
- قص الفيديو (Trimming)

## التحسينات على الجودة

### جودة الصور
- **الدقة**: تم رفع الدقة إلى 1080p (من 400px)
- **الجودة**: تم تحسين الجودة إلى 65% (من 15%)
- **القصص**: دقة 720px بجودة 68%
- **الصور الشخصية**: 200px بجودة 70%

### جودة الفيديو
- **الدقة**: تم رفع الدقة إلى 720p (1280x720) (من 360p)
- **CRF**: تم تحسين الضغط إلى 28 (من 40)
- **الصوت**: معدل بت 128k (من 32k)
- **Preset**: medium للتوازن بين السرعة والجودة

## البنية الجديدة للبيانات

### Story Model
```javascript
{
  user: ObjectId,
  text: String,
  backgroundColor: String,
  media: {
    url: String,
    fileId: String,
    fileName: String,
    type: 'image' | 'video'
  },
  // الميزات الجديدة
  overlays: [{
    id: Number,
    type: 'text' | 'sticker',
    content: String,
    x: Number,
    y: Number,
    scale: Number,
    color: String
  }],
  filter: String,
  mediaScale: Number,
  objectFit: 'contain' | 'cover',
  trimStart: Number,
  trimEnd: Number,
  views: [{ user: ObjectId, viewedAt: Date }],
  expiresAt: Date
}
```

## API Endpoint

### POST /api/v1/stories

**Request Body (FormData):**
```javascript
{
  // الحقول الأساسية
  text: String (optional),
  backgroundColor: String (optional),
  
  // الملف (صورة أو فيديو)
  file: File (optional),
  
  // ميزات التعديل الجديدة
  overlays: JSON String [{
    id: Number,
    type: 'text' | 'sticker',
    content: String,
    x: Number,
    y: Number,
    scale: Number,
    color: String
  }],
  filter: String (e.g., 'none', 'saturate(1.5)', 'grayscale(1)'),
  mediaScale: Number (e.g., 1, 1.5, 2),
  objectFit: 'contain' | 'cover',
  
  // قص الفيديو
  trimStart: Number (seconds),
  trimEnd: Number (seconds)
}
```

**Response:**
```javascript
{
  success: true,
  message: 'تم نشر القصة',
  story: {
    _id: String,
    user: { _id, name, avatar },
    text: String,
    backgroundColor: String,
    media: { url, type },
    overlays: Array,
    filter: String,
    mediaScale: Number,
    objectFit: String,
    trimStart: Number,
    trimEnd: Number,
    views: Array,
    createdAt: Date,
    expiresAt: Date
  }
}
```

## مثال على الاستخدام

### من الواجهة الأمامية (Frontend)

```javascript
const formData = new FormData();

// إضافة الملف
formData.append('file', mediaFile);

// إضافة النصوص والملصقات
const overlays = [
  {
    id: 1,
    type: 'text',
    content: 'مرحباً بكم',
    x: 200,
    y: 300,
    scale: 1.2,
    color: '#ffffff'
  },
  {
    id: 2,
    type: 'sticker',
    content: '😍',
    x: 150,
    y: 450,
    scale: 1.5
  }
];
formData.append('overlays', JSON.stringify(overlays));

// إضافة الفلتر
formData.append('filter', 'saturate(1.5) contrast(1.1)');

// إضافة التكبير/التصغير
formData.append('mediaScale', '1.3');
formData.append('objectFit', 'cover');

// قص الفيديو (إذا كان فيديو)
formData.append('trimStart', '2.5');
formData.append('trimEnd', '15.0');

// إرسال الطلب
const response = await fetch(`${API_BASE_URL}/api/v1/stories`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

## الفوائد

1. **تجربة مستخدم محسنة**: يمكن للمستخدمين تخصيص قصصهم بشكل كامل
2. **جودة أفضل**: صور وفيديوهات بجودة عالية دون غشوشة
3. **مرونة أكبر**: إمكانية إضافة نصوص وملصقات وفلاتر
4. **توافق كامل**: يعمل مع جميع أنواع الوسائط

## ملاحظات مهمة

- يتم حفظ جميع التعديلات في قاعدة البيانات
- الواجهة الأمامية مسؤولة عن عرض التعديلات (overlays, filters)
- الخادم يقوم بمعالجة وضغط الوسائط فقط
- الفلاتر يتم تطبيقها على مستوى CSS في الواجهة الأمامية
- النصوص والملصقات يتم عرضها كطبقات فوق الوسائط

## التوافق مع الإصدارات السابقة

جميع الحقول الجديدة اختيارية (optional) مع قيم افتراضية، لذلك:
- القصص القديمة ستستمر في العمل بشكل طبيعي
- القصص الجديدة بدون تعديلات ستعمل بشكل طبيعي
- لا حاجة لترحيل البيانات (migration)
