# تقرير إصلاح مشكلة CORS - مهنتي لي Backend

## 📋 ملخص المشكلة

**رسالة الخطأ:** "خطأ في الاتصال بالخادم. تأكد من الرابط أو إعدادات الأمان (CORS)"

**السبب الجذري:** إعدادات CORS الحالية في ملف `server.js` تحتوي على عدة مشاكل تمنع تطبيقات الموبايل والواجهات الأمامية من الاتصال بالخادم بشكل صحيح.

---

## 🔍 تحليل المشاكل المكتشفة

### المشكلة 1: قائمة Origins غير شاملة

**الكود الأصلي:**
```javascript
const allowedOrigins = [
  "https://mihnt.netlify.app",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
  // ... محدود جداً
];
```

**المشكلة:** القائمة لا تشمل جميع الـ origins المحتملة لتطبيقات الموبايل، خاصة:
- Android WebView يرسل `file://` كـ origin
- بعض إصدارات Capacitor ترسل origins مختلفة
- عدم وجود دعم لـ `127.0.0.1`

---

### المشكلة 2: ترتيب Middleware غير صحيح

**الكود الأصلي:**
```javascript
app.use(helmet({...}));  // ← Helmet أولاً
// ...
app.use(cors(corsOptions));  // ← CORS بعده
app.use((req, res, next) => {  // ← معالج OPTIONS آخراً
  if (req.method === 'OPTIONS') {...}
});
```

**المشكلة:** 
- Helmet يُطبَّق قبل CORS، مما قد يتعارض مع headers
- معالج OPTIONS يأتي بعد CORS، وهذا قد يسبب مشاكل في بعض الحالات

**الترتيب الصحيح:**
1. معالج OPTIONS (preflight) أولاً
2. CORS middleware
3. Helmet
4. باقي الـ middleware

---

### المشكلة 3: عدم معالجة أخطاء CORS بشكل صحيح

**الكود الأصلي:**
```javascript
callback(new Error('Not allowed by CORS'));
```

**المشكلة:** عند رفض origin، يتم إرسال خطأ عام بدون معالجة مناسبة، مما يؤدي لظهور رسالة غير واضحة للمستخدم.

---

### المشكلة 4: إعدادات Socket.IO غير متوافقة

**الكود الأصلي:**
```javascript
io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',  // ← استخدام * مع credentials
    credentials: true
  }
});
```

**المشكلة:** استخدام `*` مع `credentials: true` غير مسموح في مواصفات CORS، ويسبب أخطاء في المتصفحات.

---

## ✅ الحلول المطبقة

### 1. قائمة Origins شاملة ومرنة

```javascript
const allowedOrigins = [
  // الإنتاج
  "https://mihnt.netlify.app",
  "https://mehnati-api.xyz",
  
  // التطوير المحلي
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:8080",
  "http://localhost:8100",
  "http://127.0.0.1:3000",
  // ... المزيد
  
  // تطبيقات الموبايل
  "capacitor://localhost",
  "ionic://localhost",
  
  // من متغيرات البيئة
  process.env.FRONTEND_URL,
  process.env.MOBILE_APP_URL
].filter(Boolean);
```

### 2. دالة Origin ذكية

```javascript
origin: function (origin, callback) {
  // السماح بالطلبات بدون origin (تطبيقات الموبايل)
  if (!origin) return callback(null, true);
  
  // السماح بـ file:// (Android WebView)
  if (origin.startsWith('file://')) return callback(null, true);
  
  // السماح بـ capacitor:// و ionic://
  if (origin.startsWith('capacitor://') || origin.startsWith('ionic://')) {
    return callback(null, true);
  }
  
  // التحقق من القائمة
  if (allowedOrigins.includes(origin)) return callback(null, true);
  
  // السماح بـ localhost في التطوير
  if (process.env.NODE_ENV !== 'production') {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
  }
  
  // رفض الباقي مع تسجيل
  console.warn(`⚠️ CORS: طلب مرفوض من: ${origin}`);
  callback(new Error('Not allowed by CORS'));
}
```

### 3. ترتيب Middleware الصحيح

```javascript
// 1️⃣ معالج OPTIONS أولاً
app.use((req, res, next) => {
  // إضافة headers لجميع الطلبات
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  // ...
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  next();
});

// 2️⃣ CORS middleware
app.use(cors(corsOptions));

// 3️⃣ Helmet
app.use(helmet({...}));

// 4️⃣ باقي الـ middleware
app.use(morgan('dev'));
app.use(express.json());
```

### 4. معالج أخطاء CORS مخصص

```javascript
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'خطأ في سياسة CORS - Origin غير مسموح به'
    });
  }
  next(err);
});
```

---

## 📁 الملفات المعدلة

### 1. `src/server.js`
استبدل الملف الحالي بـ `src/server_fixed.js`

### 2. `src/config/socket.js`
استبدل الملف الحالي بـ `src/config/socket_fixed.js`

---

## 🚀 خطوات التطبيق

### الخطوة 1: نسخ احتياطي
```bash
cp src/server.js src/server_backup.js
cp src/config/socket.js src/config/socket_backup.js
```

### الخطوة 2: تطبيق الإصلاحات
```bash
cp src/server_fixed.js src/server.js
cp src/config/socket_fixed.js src/config/socket.js
```

### الخطوة 3: إعادة تشغيل الخادم
```bash
npm run dev  # للتطوير
# أو
npm start    # للإنتاج
```

### الخطوة 4: اختبار الاتصال
```bash
# اختبار من curl
curl -X OPTIONS https://your-server.com/api/v1/auth/login \
  -H "Origin: capacitor://localhost" \
  -H "Access-Control-Request-Method: POST" \
  -v

# يجب أن ترى:
# < Access-Control-Allow-Origin: capacitor://localhost
# < Access-Control-Allow-Credentials: true
```

---

## ⚙️ إعدادات إضافية (اختياري)

### إضافة Origins جديدة

أضف في ملف `.env`:
```env
FRONTEND_URL=https://your-frontend.com
MOBILE_APP_URL=https://your-mobile-app.com
```

### تعطيل CORS في التطوير (غير موصى به للإنتاج)

```javascript
// فقط للتطوير المحلي
if (process.env.NODE_ENV === 'development') {
  app.use(cors({ origin: true, credentials: true }));
}
```

---

## 🧪 اختبار الإصلاح

### من المتصفح (DevTools Console):
```javascript
fetch('https://your-server.com/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  }),
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

### من تطبيق الموبايل:
تأكد من أن التطبيق يستخدم الرابط الصحيح للـ API ويرسل الـ headers المطلوبة.

---

## 📞 الدعم

إذا استمرت المشكلة بعد تطبيق الإصلاحات:

1. تحقق من سجلات الخادم للرسائل التي تبدأ بـ `⚠️ CORS:`
2. أضف الـ origin المرفوض إلى قائمة `allowedOrigins`
3. تأكد من أن الخادم يعمل على البورت الصحيح
4. تحقق من إعدادات الـ proxy إذا كنت تستخدم واحداً

---

**تاريخ التقرير:** 2026-01-15
**الإصدار:** 2.0.1
