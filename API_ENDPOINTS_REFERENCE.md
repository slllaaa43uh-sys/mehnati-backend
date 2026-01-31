# API Endpoints Reference - مهنتي لي
# مرجع شامل لجميع نقاط الوصول في الـ API

## 📋 جدول المحتويات | Table of Contents

1. [المصادقة (Authentication)](#authentication)
2. [المنشورات (Posts)](#posts)
3. [المستخدمون (Users)](#users)
4. [المتابعة (Follow)](#follow)
5. [القصص (Stories)](#stories)
6. [الفيديوهات القصيرة (Shorts)](#shorts)
7. [الإشعارات (Notifications)](#notifications)
8. [البلاغات (Reports)](#reports)
9. [رفع الملفات (Upload)](#upload)
10. [الذكاء الاصطناعي (AI)](#ai)
11. [الوظائف العالمية (External Jobs)](#external-jobs)
12. [الدفع (Payment)](#payment)
13. [FCM (Push Notifications)](#fcm)
14. [المواقع (Location)](#location)

---

<a name="authentication"></a>
## 🔐 1. المصادقة | Authentication

### تسجيل مستخدم جديد | Register
```
POST /api/v1/auth/register
```
**Body:**
```json
{
  "fullName": "أحمد محمد",
  "email": "ahmed@example.com",
  "password": "123456",
  "phone": "+966501234567",
  "bio": "مطور برامج",
  "location": {
    "country": "السعودية",
    "city": "الرياض"
  }
}
```
**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "fullName": "أحمد محمد",
    "email": "ahmed@example.com",
    ...
  }
}
```

### تسجيل الدخول | Login
```
POST /api/v1/auth/login
```
**Body:**
```json
{
  "email": "ahmed@example.com",
  "password": "123456"
}
```
**Response:** مثل التسجيل

### الحصول على بيانات المستخدم الحالي | Get Current User
```
GET /api/v1/auth/me
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "fullName": "أحمد محمد",
    "email": "ahmed@example.com",
    ...
  }
}
```

---

<a name="posts"></a>
## 📝 2. المنشورات | Posts

### جلب جميع المنشورات | Get All Posts
```
GET /api/v1/posts
```
**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10)
- `category` (string: 'jobs' | 'haraj' | 'services')
- `type` (string: 'lookingForJob' | 'lookingForEmployee')
- `scope` (string: 'global' | 'local')
- `country` (string)
- `city` (string)
- `isUrgent` (boolean)
- `sort` (string: 'latest' | 'popular')

**مثال:**
```
GET /api/v1/posts?category=jobs&scope=global&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "posts": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "title": "مطلوب مطور React Native",
      "description": "نبحث عن مطور...",
      "category": "jobs",
      "type": "lookingForEmployee",
      "user": {
        "_id": "...",
        "fullName": "أحمد محمد",
        "profileImage": "..."
      },
      "images": ["url1", "url2"],
      "reactions": 15,
      "commentsCount": 5,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalPosts": 48,
    "hasMore": true
  }
}
```

### جلب منشور محدد | Get Single Post
```
GET /api/v1/posts/:id
```

### إنشاء منشور | Create Post
```
POST /api/v1/posts
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "title": "مطلوب مطور React Native",
  "description": "نبحث عن مطور محترف...",
  "category": "jobs",
  "type": "lookingForEmployee",
  "scope": "global",
  "country": "السعودية",
  "city": "الرياض",
  "contactInfo": {
    "email": "hr@company.com",
    "phone": "+966501234567"
  },
  "images": ["url1", "url2"],
  "videos": ["url1"],
  "isUrgent": false
}
```

### تحديث منشور | Update Post
```
PUT /api/v1/posts/:id
```
**Headers:** `Authorization: Bearer {token}`

**Body:** نفس بيانات الإنشاء (يمكن إرسال حقول معينة فقط)

### حذف منشور | Delete Post
```
DELETE /api/v1/posts/:id
```
**Headers:** `Authorization: Bearer {token}`

### إعجاب/إلغاء إعجاب | React to Post
```
POST /api/v1/posts/:id/react
```
**Headers:** `Authorization: Bearer {token}`

### إضافة تعليق | Add Comment
```
POST /api/v1/posts/:id/comments
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "comment": "تعليق رائع!"
}
```

### جلب التعليقات | Get Comments
```
GET /api/v1/posts/:id/comments
```

---

<a name="users"></a>
## 👥 3. المستخدمون | Users

### الملف الشخصي الحالي | Current User Profile
```
GET /api/v1/users/me
```
**Headers:** `Authorization: Bearer {token}`

### تحديث الملف الشخصي | Update Profile
```
PUT /api/v1/users/me
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "fullName": "أحمد محمد الجديد",
  "bio": "مطور برامج محترف",
  "profileImage": "url",
  "location": {
    "country": "السعودية",
    "city": "جدة"
  }
}
```

### ملف مستخدم آخر | Get User Profile
```
GET /api/v1/users/:id
```

### المستخدمون المقترحون | Suggested Users
```
GET /api/v1/users/suggested
```
**Headers:** `Authorization: Bearer {token}`

---

<a name="follow"></a>
## 🔗 4. المتابعة | Follow

### متابعة/إلغاء متابعة | Follow/Unfollow
```
POST /api/v1/follow/:userId
```
**Headers:** `Authorization: Bearer {token}`

### حالة المتابعة | Follow Status
```
GET /api/v1/follow/:userId/status
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "isFollowing": true
}
```

### قائمة المتابعين | Followers
```
GET /api/v1/users/:userId/followers
```

### قائمة المتابَعين | Following
```
GET /api/v1/users/:userId/following
```

---

<a name="stories"></a>
## 📖 5. القصص | Stories

### إنشاء قصة | Create Story
```
POST /api/v1/stories
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "media": ["url1", "url2"],
  "caption": "قصة جميلة!"
}
```

### جلب قصص المتابَعين | Get Feed Stories
```
GET /api/v1/stories/feed
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "stories": [
    {
      "user": {
        "_id": "...",
        "fullName": "أحمد محمد",
        "profileImage": "..."
      },
      "stories": [
        {
          "_id": "...",
          "media": ["url1"],
          "caption": "...",
          "createdAt": "...",
          "views": 10
        }
      ]
    }
  ]
}
```

### مشاهدة قصة | View Story
```
POST /api/v1/stories/:id/view
```
**Headers:** `Authorization: Bearer {token}`

---

<a name="shorts"></a>
## 🎬 6. الفيديوهات القصيرة | Shorts

### فيديوهات لك | For You
```
GET /api/v1/posts/shorts/for-you
```
**Query:** `?page=1&limit=10`

### فيديوهات الأصدقاء | Friends' Shorts
```
GET /api/v1/posts/shorts/friends
```
**Headers:** `Authorization: Bearer {token}`
**Query:** `?page=1&limit=10`

---

<a name="notifications"></a>
## 🔔 7. الإشعارات | Notifications

### جلب الإشعارات | Get Notifications
```
GET /api/v1/notifications
```
**Headers:** `Authorization: Bearer {token}`
**Query:** `?page=1&limit=20`

### تحديد جميع الإشعارات كمقروءة | Mark All as Read
```
PUT /api/v1/notifications/read-all
```
**Headers:** `Authorization: Bearer {token}`

### حذف إشعار | Delete Notification
```
DELETE /api/v1/notifications/:id
```
**Headers:** `Authorization: Bearer {token}`

---

<a name="reports"></a>
## 🚩 8. البلاغات | Reports

### إرسال بلاغ | Submit Report
```
POST /api/v1/reports
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "targetType": "post",
  "targetId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "reason": "spam",
  "description": "محتوى مزعج"
}
```

**Allowed Values:**
- `targetType`: 'post' | 'user' | 'story' | 'comment'
- `reason`: 'spam' | 'inappropriate' | 'fake' | 'other'

---

<a name="upload"></a>
## 📤 9. رفع الملفات | Upload

### رفع صورة واحدة | Upload Single Image
```
POST /api/v1/upload/image
```
**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Body (FormData):**
```javascript
const formData = new FormData();
formData.append('image', file);
```

**Response:**
```json
{
  "success": true,
  "url": "https://f005.backblazeb2.com/file/mehnati-media/..."
}
```

### رفع عدة صور | Upload Multiple Images
```
POST /api/v1/upload/images
```
**Body (FormData):**
```javascript
formData.append('images', file1);
formData.append('images', file2);
```

### رفع فيديو | Upload Video
```
POST /api/v1/upload/video
```
**Body (FormData):**
```javascript
formData.append('video', videoFile);
```

### رفع عدة فيديوهات | Upload Multiple Videos
```
POST /api/v1/upload/videos
```

---

<a name="ai"></a>
## 🤖 10. الذكاء الاصطناعي | AI

### المحادثة مع AI | Chat with AI
```
POST /api/v1/ai/chat
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "message": "مرحبا، ما هو تطبيق مهنتي لي؟",
  "conversationHistory": [
    {
      "role": "user",
      "content": "مرحبا"
    },
    {
      "role": "model",
      "content": "مرحباً بك!"
    }
  ]
}
```

**Response:** Server-Sent Events (SSE) Stream
```
data: {"type":"status","status":"responding","message":"يفكر... 🤔"}

data: {"type":"chunk","content":"مرحباً"}

data: {"type":"chunk","content":" بك"}

data: {"type":"done","fullResponse":"مرحباً بك في تطبيق مهنتي لي..."}
```

### فحص صحة AI | AI Health Check
```
GET /api/v1/ai/health
```

**Response:**
```json
{
  "success": true,
  "status": "OpenAI Ready",
  "model": "gpt-4o-mini"
}
```

---

<a name="external-jobs"></a>
## 🌍 11. الوظائف العالمية | External Jobs

### البحث عن وظائف | Search Jobs
```
GET /api/v1/external-jobs
```
**Query Parameters:**
- `country` (required): 'us', 'gb', 'sa', 'ae', etc.
- `what`: Job title or keywords
- `where`: Location (city/state)
- `page`: Page number (default: 1)
- `results_per_page`: Results per page (default: 10, max: 50)

**مثال:**
```
GET /api/v1/external-jobs?country=us&what=developer&where=NewYork&page=1
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "1234567890",
      "title": "Senior React Developer",
      "company": "Tech Company",
      "location": "New York, NY",
      "description": "...",
      "salary": "$100,000 - $150,000",
      "created": "2024-01-15T10:00:00Z",
      "category": "IT Jobs",
      "url": "https://..."
    }
  ],
  "pagination": {
    "current": 1,
    "total": 100,
    "pages": 10
  }
}
```

### جلب التصنيفات | Get Categories
```
GET /api/v1/external-jobs/categories
```

### جلب الدول المدعومة | Get Supported Countries
```
GET /api/v1/external-jobs/countries
```

---

<a name="payment"></a>
## 💰 12. الدفع | Payment

### تمييز منشور (مدفوع) | Feature Post
```
POST /api/v1/payment/feature-post
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "postId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "duration": "daily"
}
```
**Duration:** 'daily' | 'weekly' | 'monthly'

### حالة التمييز المجاني | Free Feature Status
```
GET /api/v1/payment/free-feature/status
```
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "canUseFreeFeature": true,
  "lastUsedDate": null
}
```

### تمييز مجاني | Free Feature
```
POST /api/v1/payment/free-feature
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "postId": "65a1b2c3d4e5f6g7h8i9j0k1"
}
```

---

<a name="fcm"></a>
## 🔔 13. FCM (Push Notifications)

### تسجيل Device Token | Register Device Token
```
POST /api/v1/fcm/register
```
**Headers:** `Authorization: Bearer {token}`

**Body:**
```json
{
  "token": "fcm-device-token-here"
}
```

---

<a name="location"></a>
## 📍 14. المواقع | Location

### جلب الدول | Get Countries
```
GET /api/v1/location/countries
```

**Response:**
```json
{
  "success": true,
  "countries": [
    "السعودية",
    "الإمارات",
    "مصر",
    ...
  ]
}
```

### جلب المدن | Get Cities
```
GET /api/v1/location/cities
```
**Query:** `?country=السعودية`

**Response:**
```json
{
  "success": true,
  "cities": [
    "الرياض",
    "جدة",
    "الدمام",
    ...
  ]
}
```

---

## 🔄 Socket.IO Events

### الاتصال | Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});
```

### الأحداث | Events

**تلقي إشعار جديد:**
```javascript
socket.on('notification', (data) => {
  console.log('New notification:', data);
  // data: { type, message, data, createdAt }
});
```

**تلقي رسالة محادثة:**
```javascript
socket.on('message', (data) => {
  console.log('New message:', data);
});
```

---

## 📊 أكواد الاستجابة | Response Codes

| Code | المعنى | الوصف |
|------|--------|-------|
| 200 | OK | نجح الطلب |
| 201 | Created | تم الإنشاء بنجاح |
| 400 | Bad Request | بيانات غير صحيحة |
| 401 | Unauthorized | غير مصرح (Token مفقود/غير صحيح) |
| 403 | Forbidden | ممنوع (لا صلاحية) |
| 404 | Not Found | غير موجود |
| 500 | Server Error | خطأ في الخادم |

---

## ⚠️ ملاحظات مهمة | Important Notes

1. **جميع التواريخ** بصيغة ISO 8601: `2024-01-15T10:00:00Z`
2. **الرفع** يستخدم `multipart/form-data`
3. **باقي الطلبات** تستخدم `application/json`
4. **Token** صالح لمدة 30 يوماً
5. **CORS** مفتوح لجميع المصادر

---

**آخر تحديث:** 2026-01-27  
**النسخة:** 2.2.0
