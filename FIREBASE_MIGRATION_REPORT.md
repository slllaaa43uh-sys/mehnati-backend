# 🔥 Firebase Project Migration Report
## تقرير الانتقال إلى Firebase Project الجديد

**Date:** January 8, 2026  
**Backend Repository:** mehnati-backend  
**New Firebase Project ID:** `mehnati-d7ab9`  
**Old Firebase Project ID:** `mihnty-e94ca`

---

## ✅ 1. Backend Code Verification

### 🎯 Firebase Admin SDK Initialization

تم التحقق من كود Backend وهو **صحيح ومتوافق** مع المتطلبات:

#### **الملف:** `src/config/firebase.js`

الكود يدعم **طريقتين** للإعداد:

**الطريقة 1: استخدام ملف JSON (للتطوير المحلي)**
```javascript
const serviceAccount = require('../../firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

**الطريقة 2: استخدام متغيرات البيئة (للخوادم الإنتاجية - موصى بها)**
```javascript
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  })
});
```

✅ **الكود يبحث عن ملف باسم:** `firebase-service-account.json` (وليس `serviceAccountKey.json`)

---

### 🎯 Notification Sending Logic

#### **الملف:** `src/services/fcmService.js`

الكود يستخدم **`admin.messaging().send()`** بشكل صحيح:

```javascript
// إرسال إلى Topic
const response = await admin.messaging().send({
  notification: { title, body },
  data: { ...data },
  topic: cleanTopic,
  android: { priority: 'high' },
  apns: { payload: { aps: { sound: 'default', badge: 1 } } }
});
```

✅ **الكود صحيح ويدعم:**
- إرسال إلى Topics محددة
- إرسال إلى Device Tokens
- إرسال إلى Multiple Topics
- دعم Android و iOS

---

## 🔄 2. Environment Variables Update Required

### ⚠️ المتغيرات القديمة الموجودة في الخادم (يجب تحديثها):

```bash
# OLD Firebase Project (mihnty-e94ca)
FIREBASE_PROJECT_ID=mihnty-e94ca
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@mihnty-e94ca.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### ✅ المتغيرات الجديدة المطلوبة:

يجب عليك الحصول على **Service Account Key** الجديد من Firebase Console:

#### **خطوات الحصول على المتغيرات:**

1. **افتح Firebase Console:**
   ```
   https://console.firebase.google.com/project/mehnati-d7ab9/settings/serviceaccounts/adminsdk
   ```

2. **اضغط على "Generate new private key"**

3. **سيتم تنزيل ملف JSON** يحتوي على:
   - `project_id`
   - `private_key`
   - `client_email`

4. **افتح الملف واستخرج القيم التالية:**

```bash
# NEW Firebase Project (mehnati-d7ab9)
FIREBASE_PROJECT_ID=mehnati-d7ab9
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@mehnati-d7ab9.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
```

⚠️ **ملاحظة مهمة:** 
- يجب أن يكون `FIREBASE_PRIVATE_KEY` محاطاً بعلامات اقتباس مزدوجة
- يجب أن يحتوي على `\n` (وليس أسطر جديدة حقيقية)
- الكود سيقوم تلقائياً بتحويل `\n` إلى أسطر جديدة

---

## 📋 3. Migration Steps

### **الطريقة الأولى: استخدام متغيرات البيئة (موصى بها للخادم)**

#### **الخطوة 1: الحصول على Service Account Key الجديد**

1. اذهب إلى:
   ```
   https://console.firebase.google.com/project/mehnati-d7ab9/settings/serviceaccounts/adminsdk
   ```

2. اضغط على **"Generate new private key"**

3. احفظ الملف المُنزّل (مثل: `mehnati-d7ab9-firebase-adminsdk-xxxxx.json`)

#### **الخطوة 2: تحديث متغيرات البيئة في الخادم**

افتح ملف `.env` في الخادم وحدّث المتغيرات الثلاثة:

```bash
# قم بنسخ القيم من ملف JSON الذي تم تنزيله
FIREBASE_PROJECT_ID=mehnati-d7ab9
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@mehnati-d7ab9.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
```

#### **الخطوة 3: إعادة تشغيل الخادم**

```bash
pm2 restart mehnati-backend
# أو
npm run start
```

#### **الخطوة 4: التحقق من نجاح التهيئة**

راقب logs الخادم، يجب أن ترى:

```
========================================
🔥 FIREBASE INITIALIZATION DEBUG - START
========================================
📋 Checking Firebase Environment Variables:
   - FIREBASE_PROJECT_ID: ✓ SET (mehnati-d7ab9)
   - FIREBASE_CLIENT_EMAIL: ✓ SET (firebase-adminsdk-xxxxx@mehnati-d7ab9.iam.gserviceaccount.com)
   - FIREBASE_PRIVATE_KEY: ✓ SET (length: 1678 chars)
========================================
✅ Firebase Admin SDK تم تهيئته بنجاح
📬 خدمة FCM جاهزة لإرسال الإشعارات
========================================
```

---

### **الطريقة الثانية: استخدام ملف JSON (للتطوير المحلي)**

إذا كنت تفضل استخدام ملف JSON بدلاً من متغيرات البيئة:

#### **الخطوة 1: تنزيل Service Account Key**

نفس الخطوة 1 من الطريقة الأولى

#### **الخطوة 2: رفع الملف إلى الخادم**

1. أعد تسمية الملف إلى: **`firebase-service-account.json`** (مهم جداً!)

2. ضع الملف في المجلد الرئيسي للمشروع:
   ```
   /path/to/mehnati-backend/firebase-service-account.json
   ```

3. تأكد من أن الملف في نفس مستوى `package.json`

#### **الخطوة 3: حذف متغيرات البيئة (اختياري)**

إذا كنت تستخدم ملف JSON، يمكنك حذف المتغيرات الثلاثة من `.env`:

```bash
# احذف أو علّق على هذه الأسطر
# FIREBASE_PROJECT_ID=...
# FIREBASE_CLIENT_EMAIL=...
# FIREBASE_PRIVATE_KEY=...
```

#### **الخطوة 4: إعادة تشغيل الخادم**

```bash
pm2 restart mehnati-backend
```

---

## 📝 4. Important Notes

### ⚠️ اسم الملف الصحيح:

الكود يبحث عن ملف باسم:
```
firebase-service-account.json
```

**وليس:**
- ❌ `serviceAccountKey.json`
- ❌ `google-services.json` (هذا للتطبيق فقط)

### 🔒 الأمان:

1. **لا تشارك** ملف Service Account مع أحد
2. **لا تضعه** في Git Repository
3. **تأكد** من إضافته إلى `.gitignore`:
   ```
   firebase-service-account.json
   serviceAccountKey.json
   ```

### 📱 ملف `google-services.json`:

الملف الذي أرسلته (`google-services(2).json`) هو **للتطبيق (Flutter/Android)** فقط:
- ✅ يُستخدم في التطبيق
- ❌ **لا يُستخدم** في Backend
- Backend يحتاج إلى **Service Account Key** (ملف مختلف تماماً)

---

## ✅ 5. Summary Checklist

### للانتقال إلى Firebase Project الجديد:

- [ ] **الحصول على Service Account Key الجديد** من Firebase Console
- [ ] **تحديث المتغيرات الثلاثة** في `.env` على الخادم:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
- [ ] **إعادة تشغيل الخادم** (`pm2 restart mehnati-backend`)
- [ ] **التحقق من logs** للتأكد من نجاح التهيئة
- [ ] **اختبار إرسال إشعار** من التطبيق

### ✅ لا حاجة لتعديل الكود:

- ✅ كود Firebase Admin SDK صحيح
- ✅ كود إرسال الإشعارات صحيح
- ✅ فقط تحديث متغيرات البيئة مطلوب

---

## 🆘 Troubleshooting

### إذا ظهرت أخطاء بعد التحديث:

#### **خطأ: "Firebase not initialized"**
- تأكد من صحة المتغيرات الثلاثة
- تأكد من عدم وجود مسافات زائدة
- تأكد من أن `FIREBASE_PRIVATE_KEY` محاط بعلامات اقتباس مزدوجة

#### **خطأ: "Invalid private key"**
- تأكد من أن المفتاح يبدأ بـ `-----BEGIN PRIVATE KEY-----`
- تأكد من أن المفتاح ينتهي بـ `-----END PRIVATE KEY-----`
- تأكد من وجود `\n` (وليس أسطر جديدة حقيقية)

#### **خطأ: "Project ID mismatch"**
- تأكد من أن `FIREBASE_PROJECT_ID` هو `mehnati-d7ab9`
- تأكد من أن التطبيق يستخدم نفس Firebase Project

---

## 📞 Next Steps

بعد تحديث المتغيرات:

1. **اختبر إرسال إشعار** من التطبيق
2. **راقب logs الخادم** للتأكد من عدم وجود أخطاء
3. **تحقق من وصول الإشعارات** إلى الأجهزة

---

**Generated:** January 8, 2026  
**Backend Version:** 2.0.0  
**Firebase SDK:** firebase-admin v13.6.0
