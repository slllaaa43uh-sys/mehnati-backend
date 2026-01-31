# دليل API للوظائف المستعجلة - Urgent Jobs API Guide

## 📌 نظرة عامة (Overview)

تم تحديث API الخاص بالوظائف المستعجلة لدعم جميع أنواع الاستعجال المطلوبة من الواجهة الأمامية.

**آخر تحديث:** 28 يناير 2026

---

## 🏷️ أنواع الاستعجال المدعومة (Supported Special Tags)

| النوع العربي | الوصف | الاستخدام |
|--------------|-------|-----------|
| `مطلوب الآن` | وظائف تحتاج تعيين فوري | For immediate hiring needs |
| `عقود مؤقتة` | وظائف بعقود محددة المدة | For temporary/fixed-term contracts |
| `دفع يومي` | وظائف بدفع يومي أو أسبوعي | For daily/weekly payment jobs |
| `عقود معقدة` | وظائف بعقود معقدة أو ذات شروط خاصة | For complex contracts with special terms |

---

## 📡 API Endpoints

### 1. جلب الوظائف المستعجلة (Get Urgent Jobs)

#### جلب جميع الوظائف المستعجلة
```http
GET /api/v1/posts?displayPage=urgent&limit=50
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "total": 10,
  "totalPages": 1,
  "currentPage": 1,
  "posts": [
    {
      "_id": "...",
      "displayPage": "urgent",
      "specialTag": "مطلوب الآن",
      "title": "ابحث عن موظفين",
      "content": "مطلوب موظف مبيعات للعمل فوراً",
      "user": {
        "_id": "...",
        "name": "أحمد محمد",
        "avatar": "...",
        "isVerified": true
      },
      "category": "موظف مبيعات",
      "scope": "local",
      "country": "السعودية",
      "city": "الرياض",
      "type": "job",
      "status": "approved",
      "createdAt": "2026-01-28T08:00:00.000Z",
      "updatedAt": "2026-01-28T08:00:00.000Z"
    }
  ]
}
```

---

### 2. فلترة حسب نوع الاستعجال (Filter by Special Tag)

#### مطلوب الآن (Needed Now)
```http
GET /api/v1/posts?displayPage=urgent&specialTag=مطلوب الآن
Authorization: Bearer {token}
```

#### عقود مؤقتة (Temporary Contracts)
```http
GET /api/v1/posts?displayPage=urgent&specialTag=عقود مؤقتة
Authorization: Bearer {token}
```

#### دفع يومي (Daily Payment)
```http
GET /api/v1/posts?displayPage=urgent&specialTag=دفع يومي
Authorization: Bearer {token}
```

#### عقود معقدة (Complex Contracts)
```http
GET /api/v1/posts?displayPage=urgent&specialTag=عقود معقدة
Authorization: Bearer {token}
```

**Response Structure:** نفس هيكل الاستجابة أعلاه، لكن يتم تصفية النتائج حسب النوع المحدد.

---

### 3. إنشاء منشور مستعجل (Create Urgent Post)

```http
POST /api/v1/posts
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "مطلوب موظف مبيعات للعمل فوراً",
  "displayPage": "urgent",
  "specialTag": "مطلوب الآن",
  "category": "موظف مبيعات",
  "scope": "local",
  "country": "السعودية",
  "city": "الرياض",
  "contactPhone": "+966501234567",
  "contactMethods": ["phone", "whatsapp"]
}
```

**Required Fields:**
- `content` أو `media`: يجب توفير محتوى نصي أو ملفات وسائط
- `specialTag`: **إلزامي** عند اختيار `displayPage: "urgent"`

**Response:**
```json
{
  "success": true,
  "message": "تم نشر المنشور بنجاح",
  "post": {
    "_id": "...",
    "displayPage": "urgent",
    "specialTag": "مطلوب الآن",
    "content": "مطلوب موظف مبيعات للعمل فوراً",
    // ... بقية الحقول
  }
}
```

---

### 4. تحديث منشور (Update Post)

```http
PUT /api/v1/posts/:id
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "displayPage": "urgent",
  "specialTag": "عقود مؤقتة",
  "content": "محتوى محدث"
}
```

**Allowed Updates:**
- `title`, `content`, `category`, `subcategory`, `condition`
- `scope`, `country`, `city`, `location`
- `contactEmail`, `contactPhone`, `contactMethods`
- `isFeatured`, `displayPage`, `specialTag`
- `price`, `currency`, `jobDetails`, `websiteLink`

---

## ⚠️ التحقق من الصحة (Validation)

### 1. specialTag إلزامي مع displayPage='urgent'
عند إنشاء منشور مع `displayPage: "urgent"`, يجب تحديد `specialTag`.

**خطأ:**
```json
{
  "success": false,
  "message": "يجب اختيار نوع الاستعجال عند النشر في الصفحة المستعجلة"
}
```

### 2. قيم specialTag صحيحة فقط
القيم المسموحة فقط: `مطلوب الآن`, `عقود مؤقتة`, `دفع يومي`, `عقود معقدة`, `null`

**خطأ:**
```json
{
  "success": false,
  "message": "Validation error message..."
}
```

---

## 🔄 أمثلة على الاستخدام (Usage Examples)

### مثال 1: جلب جميع الوظائف المستعجلة

```javascript
// Frontend Code Example
const fetchUrgentJobs = async () => {
  try {
    const response = await fetch(
      'http://localhost:5000/api/v1/posts?displayPage=urgent&limit=50',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const data = await response.json();
    
    if (data.success) {
      setUrgentJobs(data.posts);
    }
  } catch (error) {
    console.error('Error fetching urgent jobs:', error);
  }
};
```

### مثال 2: فلترة حسب نوع الاستعجال

```javascript
// Frontend Code Example
const filterBySpecialTag = async (tag) => {
  try {
    const url = tag 
      ? `http://localhost:5000/api/v1/posts?displayPage=urgent&specialTag=${encodeURIComponent(tag)}`
      : 'http://localhost:5000/api/v1/posts?displayPage=urgent';
      
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    
    if (data.success) {
      setFilteredJobs(data.posts);
    }
  } catch (error) {
    console.error('Error filtering jobs:', error);
  }
};

// استخدام
filterBySpecialTag('مطلوب الآن'); // فلترة
filterBySpecialTag(null); // إلغاء الفلتر
```

### مثال 3: إنشاء منشور مستعجل

```javascript
// Frontend Code Example
const createUrgentPost = async (postData) => {
  try {
    const response = await fetch(
      'http://localhost:5000/api/v1/posts',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: postData.content,
          displayPage: 'urgent',
          specialTag: postData.specialTag, // إلزامي!
          category: postData.category,
          scope: 'local',
          country: postData.country,
          city: postData.city,
          contactPhone: postData.phone
        })
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Post created successfully:', data.post);
    } else {
      console.error('Error:', data.message);
    }
  } catch (error) {
    console.error('Error creating post:', error);
  }
};
```

---

## 🎯 معلومات إضافية (Additional Info)

### سلوك الفلترة
- **بدون فلتر:** `displayPage=urgent` يعرض جميع المنشورات المستعجلة
- **مع فلتر:** `displayPage=urgent&specialTag=مطلوب الآن` يعرض المنشورات المحددة فقط
- **المنشورات المعاد نشرها:** لا تظهر في الصفحة المستعجلة

### الترتيب
المنشورات يتم ترتيبها بـ:
1. المنشورات المميزة (`isFeatured: true`) أولاً
2. ثم حسب تاريخ الإنشاء (`createdAt`) من الأحدث إلى الأقدم

### Pagination
- `page`: رقم الصفحة (الافتراضي: 1)
- `limit`: عدد النتائج في الصفحة (الافتراضي: 20، الحد الأقصى: 100)

**مثال:**
```http
GET /api/v1/posts?displayPage=urgent&page=2&limit=30
```

---

## 🔐 المصادقة (Authentication)

جميع endpoints تتطلب توكن JWT صالح في الـ header:
```http
Authorization: Bearer {your_jwt_token}
```

**ملاحظة:** بعض endpoints قد تعمل بدون مصادقة لعرض المنشورات العامة، لكن يُفضل استخدام المصادقة.

---

## 📝 ملاحظات التكامل (Integration Notes)

### للواجهة الأمامية:
1. **تحقق من القيمة:** تأكد من إرسال القيمة الصحيحة لـ `specialTag` بالعربية
2. **التحقق الإلزامي:** عند اختيار `displayPage='urgent'`، يجب اختيار `specialTag`
3. **معالجة الأخطاء:** تعامل مع رسائل الخطأ من الـ API بشكل صحيح
4. **التشفير:** استخدم `encodeURIComponent()` عند إرسال النصوص العربية في الـ URL

### اختبار API:
```bash
# اختبار جلب الوظائف المستعجلة
curl -X GET "http://localhost:5000/api/v1/posts?displayPage=urgent" \
  -H "Authorization: Bearer YOUR_TOKEN"

# اختبار الفلترة
curl -X GET "http://localhost:5000/api/v1/posts?displayPage=urgent&specialTag=مطلوب الآن" \
  -H "Authorization: Bearer YOUR_TOKEN"

# اختبار إنشاء منشور
curl -X POST "http://localhost:5000/api/v1/posts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "مطلوب موظف فوراً",
    "displayPage": "urgent",
    "specialTag": "مطلوب الآن",
    "category": "موظف مبيعات",
    "scope": "local",
    "country": "السعودية"
  }'
```

---

## 🐛 استكشاف الأخطاء (Troubleshooting)

### المشكلة: لا تظهر المنشورات المستعجلة
**الحل:** تحقق من:
- استخدام `displayPage=urgent` في الطلب
- المنشورات لها `status: 'approved'`
- التوكن صالح

### المشكلة: خطأ "يجب اختيار نوع الاستعجال"
**الحل:** أضف `specialTag` عند إنشاء منشور مع `displayPage='urgent'`

### المشكلة: الفلترة لا تعمل
**الحل:** تأكد من:
- استخدام القيمة الصحيحة بالعربية
- استخدام `encodeURIComponent()` في JavaScript
- القيمة موجودة في القائمة المسموحة

---

## ✅ الخلاصة (Summary)

تم تحديث API بنجاح لدعم:
- ✅ 4 أنواع من الاستعجال
- ✅ فلترة دقيقة حسب النوع
- ✅ التحقق الإلزامي من `specialTag`
- ✅ دعم كامل لإنشاء وتحديث المنشورات المستعجلة

**الميزة جاهزة للتكامل مع الواجهة الأمامية!** 🚀
