# الميزات الجديدة المضافة

## التحديثات في نموذج Post (Post.js)

### إضافة الإعجابات على التعليقات
- تم إضافة حقل `likes` لكل تعليق
- يحتوي على مصفوفة من المستخدمين الذين أعجبوا بالتعليق
- يتضمن تاريخ الإعجاب

### إضافة الإعجابات على الردود
- تم إضافة حقل `likes` لكل رد
- يحتوي على مصفوفة من المستخدمين الذين أعجبوا بالرد
- يتضمن تاريخ الإعجاب

## نقاط النهاية الجديدة (API Endpoints)

### 1. إضافة رد على تعليق
**POST** `/api/v1/posts/:id/comments/:commentId/replies`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "text": "نص الرد"
}
```

**Response:**
```json
{
  "success": true,
  "message": "تم إضافة الرد",
  "reply": {
    "_id": "reply_id",
    "user": {
      "_id": "user_id",
      "name": "اسم المستخدم",
      "avatar": "url"
    },
    "text": "نص الرد",
    "likes": [],
    "createdAt": "2025-12-19T00:00:00.000Z"
  }
}
```

### 2. إعجاب/إلغاء إعجاب على تعليق
**POST** `/api/v1/posts/:id/comments/:commentId/like`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "isLiked": true,
  "likesCount": 5
}
```

### 3. إعجاب/إلغاء إعجاب على رد
**POST** `/api/v1/posts/:id/comments/:commentId/replies/:replyId/like`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "isLiked": true,
  "likesCount": 3
}
```

## الإشعارات

تم إضافة أنواع جديدة من الإشعارات:
- `reply`: عند إضافة رد على تعليق
- `comment_like`: عند الإعجاب بتعليق
- `reply_like`: عند الإعجاب برد

## ملاحظات مهمة

1. جميع نقاط النهاية الجديدة تتطلب المصادقة (Bearer Token)
2. يتم إنشاء إشعار تلقائياً للمستخدم المعني (صاحب التعليق/الرد)
3. لا يتم إنشاء إشعار إذا كان المستخدم يتفاعل مع محتواه الخاص
4. الإعجاب/إلغاء الإعجاب يعمل بنظام Toggle (نقرة واحدة للإعجاب، نقرة أخرى للإلغاء)
5. يتم populate بيانات المستخدم تلقائياً في الردود

## التكامل مع الواجهة الأمامية

عند جلب المنشور باستخدام `GET /api/v1/posts/:id`، ستحصل على:
- `comments[].likes[]`: مصفوفة الإعجابات لكل تعليق
- `comments[].replies[].likes[]`: مصفوفة الإعجابات لكل رد

يمكنك التحقق من إعجاب المستخدم الحالي بمقارنة `userId` مع `likes[].user._id`
