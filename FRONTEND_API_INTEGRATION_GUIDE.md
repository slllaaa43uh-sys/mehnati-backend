# دليل ربط الواجهة الأمامية بالخادم - مهنتي لي
# Frontend API Integration Guide - Mehnati Li

## 📋 نظرة عامة | Overview

الخادم (Backend) هو Express.js REST API يعمل على المنفذ 5000 بشكل افتراضي.
الواجهة الأمامية تتصل بالخادم عبر **HTTP REST API** باستخدام JSON.

**طريقة الاتصال:**
- البروتوكول: HTTP/HTTPS
- التنسيق: JSON
- المصادقة: JWT Bearer Token
- CORS: مفتوح لجميع المصادر

---

## 🔗 قاعدة الـ API | API Base URL

```
Development: http://localhost:5000
Production: https://your-server-url.com
```

---

## 🔐 نظام المصادقة | Authentication System

### كيفية المصادقة:

1. **التسجيل/الدخول:**
   - المستخدم يسجل أو يدخل عبر `/api/v1/auth/register` أو `/api/v1/auth/login`
   - الخادم يُرجع `token` (JWT)

2. **استخدام الـ Token:**
   ```javascript
   // في كل طلب محمي، أضف في الهيدر:
   headers: {
     'Authorization': 'Bearer YOUR_JWT_TOKEN',
     'Content-Type': 'application/json'
   }
   ```

3. **تخزين الـ Token:**
   ```javascript
   // في localStorage أو secure storage
   localStorage.setItem('token', response.data.token);
   ```

---

## 🚀 كيفية الاتصال من الواجهة الأمامية | How to Connect

### مثال باستخدام Axios (React/React Native):

```javascript
import axios from 'axios';

// 1. إعداد Axios Instance
const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 2. إضافة الـ Token تلقائياً في كل طلب
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// 3. استخدام الـ API
const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  localStorage.setItem('token', response.data.token);
  return response.data;
};

const getPosts = async () => {
  const response = await api.get('/posts');
  return response.data;
};

const createPost = async (postData) => {
  const response = await api.post('/posts', postData);
  return response.data;
};
```

### مثال باستخدام Fetch API:

```javascript
// 1. دالة مساعدة للطلبات
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    }
  };

  const response = await fetch(`http://localhost:5000/api/v1${endpoint}`, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  
  return data;
};

// 2. استخدام الدالة
const login = async (email, password) => {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  localStorage.setItem('token', data.token);
  return data;
};

const getPosts = async () => {
  return await apiRequest('/posts');
};
```

---

## 🤖 ربط الذكاء الاصطناعي | AI Integration

### 1. معلومات الاتصال:
- **Endpoint:** `/api/v1/ai/chat`
- **Method:** `POST`
- **Auth:** مطلوب (Bearer Token)
- **Type:** Server-Sent Events (SSE) Streaming

### 2. كيفية الاتصال بخدمة AI:

```javascript
// دالة للاتصال بخدمة الذكاء الاصطناعي (مع Streaming)
const chatWithAI = async (message, conversationHistory = [], onChunk, onDone, onError) => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch('http://localhost:5000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        message, 
        conversationHistory 
      })
    });

    if (!response.ok) {
      throw new Error('AI service error');
    }

    // قراءة الرد المتدفق (Streaming)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            
            if (data.type === 'chunk') {
              onChunk(data.content); // إضافة النص تدريجياً
            } else if (data.type === 'done') {
              onDone(data.fullResponse); // الرد الكامل
            } else if (data.type === 'error') {
              onError(data.message);
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    }
  } catch (error) {
    onError(error.message);
  }
};

// مثال على الاستخدام في React:
import React, { useState } from 'react';

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  const sendMessage = () => {
    const newMessages = [...messages, { role: 'user', content: currentMessage }];
    setMessages(newMessages);
    setAiResponse('');

    chatWithAI(
      currentMessage,
      messages,
      // onChunk: يُستدعى مع كل جزء من الرد
      (chunk) => {
        setAiResponse(prev => prev + chunk);
      },
      // onDone: يُستدعى عند انتهاء الرد
      (fullResponse) => {
        setMessages(prev => [...prev, { role: 'model', content: fullResponse }]);
        setCurrentMessage('');
      },
      // onError: في حالة الخطأ
      (error) => {
        console.error('AI Error:', error);
      }
    );
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.content}
          </div>
        ))}
        {aiResponse && <div className="ai-typing">{aiResponse}</div>}
      </div>
      <input 
        value={currentMessage} 
        onChange={(e) => setCurrentMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>إرسال</button>
    </div>
  );
}
```

### 3. فحص صحة خدمة AI:

```javascript
// التحقق من جاهزية خدمة الذكاء الاصطناعي
const checkAIHealth = async () => {
  const response = await fetch('http://localhost:5000/api/v1/ai/health');
  const data = await response.json();
  console.log('AI Status:', data);
  // { success: true, status: 'OpenAI Ready', model: 'gpt-4o-mini' }
};
```

---

## 📚 جميع نقاط الوصول (API Endpoints)

### 🔐 المصادقة (Authentication)
```javascript
POST /api/v1/auth/register
Body: { fullName, email, password, phone?, bio?, location? }

POST /api/v1/auth/login
Body: { email, password }

GET /api/v1/auth/me
Headers: { Authorization: 'Bearer token' }
```

### 📝 المنشورات (Posts)
```javascript
GET /api/v1/posts
Query: ?page=1&limit=10&category=jobs&scope=global

GET /api/v1/posts/:id

POST /api/v1/posts
Body: { title, description, category, type, scope, images?, videos? }

PUT /api/v1/posts/:id
Body: { title?, description?, ... }

DELETE /api/v1/posts/:id

POST /api/v1/posts/:id/react
POST /api/v1/posts/:id/comments
Body: { comment }
```

### 👥 المستخدمون (Users)
```javascript
GET /api/v1/users/me
PUT /api/v1/users/me
Body: { fullName?, bio?, location?, ... }

GET /api/v1/users/:id
GET /api/v1/users/suggested
```

### 🔔 الإشعارات (Notifications)
```javascript
GET /api/v1/notifications
PUT /api/v1/notifications/read-all
DELETE /api/v1/notifications/:id
```

### 📖 القصص (Stories)
```javascript
POST /api/v1/stories
Body: { media: [urls], caption? }

GET /api/v1/stories/feed
POST /api/v1/stories/:id/view
```

### 🎬 الفيديوهات القصيرة (Shorts)
```javascript
GET /api/v1/posts/shorts/for-you
GET /api/v1/posts/shorts/friends
```

### 🔍 البحث عن الوظائف العالمية (External Jobs)
```javascript
GET /api/v1/external-jobs
Query: ?country=us&what=developer&where=NewYork&page=1

GET /api/v1/external-jobs/categories
GET /api/v1/external-jobs/countries
```

### 🤖 الذكاء الاصطناعي (AI Chat)
```javascript
POST /api/v1/ai/chat
Body: { message, conversationHistory? }

GET /api/v1/ai/health
```

### 📤 رفع الملفات (File Upload)
```javascript
POST /api/v1/upload/image
POST /api/v1/upload/video
POST /api/v1/upload/images
POST /api/v1/upload/videos
Content-Type: multipart/form-data
```

### 🚩 البلاغات (Reports)
```javascript
POST /api/v1/reports
Body: { targetType, targetId, reason, description? }
```

### 💰 الدفع (Payment)
```javascript
POST /api/v1/payment/feature-post
Body: { postId, duration: 'daily'|'weekly'|'monthly' }

GET /api/v1/payment/free-feature/status
POST /api/v1/payment/free-feature
```

---

## 🧪 اختبار الاتصال | Testing the Connection

### 1. فحص صحة الخادم:
```bash
curl http://localhost:5000/
```
يجب أن تحصل على:
```json
{
  "success": true,
  "message": "مرحباً بك في API مهنتي لي 🚀",
  "version": "2.2.0",
  "endpoints": { ... }
}
```

### 2. اختبار التسجيل:
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "123456"
  }'
```

### 3. اختبار AI Chat:
```bash
curl -X POST http://localhost:5000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "مرحبا، ما هو تطبيق مهنتي لي؟"
  }'
```

---

## ⚙️ متغيرات البيئة المطلوبة | Required Environment Variables

للعمل مع خدمة الذكاء الاصطناعي، يجب إضافة في ملف `.env`:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...your-key...
OPENAI_MODEL=gpt-4o-mini
```

---

## 🎯 نصائح مهمة | Important Tips

1. **التعامل مع الأخطاء:**
   ```javascript
   try {
     const response = await api.get('/posts');
   } catch (error) {
     if (error.response) {
       // الخادم أرجع خطأ
       console.error('Error:', error.response.data.message);
     } else if (error.request) {
       // لم يتم الوصول للخادم
       console.error('Network error');
     }
   }
   ```

2. **رفع الملفات:**
   ```javascript
   const uploadImage = async (file) => {
     const formData = new FormData();
     formData.append('image', file);
     
     const response = await api.post('/upload/image', formData, {
       headers: {
         'Content-Type': 'multipart/form-data'
       }
     });
     
     return response.data.url; // URL الصورة على Backblaze B2
   };
   ```

3. **التحديثات الفورية (Socket.IO):**
   ```javascript
   import io from 'socket.io-client';
   
   const socket = io('http://localhost:5000', {
     auth: { token: localStorage.getItem('token') }
   });
   
   socket.on('notification', (data) => {
     console.log('New notification:', data);
   });
   ```

---

## 📱 أمثلة جاهزة للاستخدام | Ready-to-Use Examples

يوجد في مجلد `frontend-components/` أمثلة React جاهزة:
- `JobCard.jsx` - بطاقة الوظيفة
- `JobsSearchPage.jsx` - صفحة البحث عن الوظائف
- `useExternalJobs.js` - Hook للاتصال بـ API الوظائف

**للاستخدام:**
```javascript
import JobsSearchPage from './frontend-components/JobsSearchPage';

function App() {
  return <JobsSearchPage />;
}
```

---

## 🔄 تدفق البيانات | Data Flow

```
Frontend                    Backend                     Database
   |                          |                             |
   |-- HTTP Request --------->|                             |
   |   (with JWT Token)       |                             |
   |                          |-- Verify Token ------------>|
   |                          |                             |
   |                          |-- Query Data -------------->|
   |                          |                             |
   |                          |<-- Return Data -------------|
   |<-- HTTP Response --------|                             |
   |   (JSON Data)            |                             |
```

---

## 📞 الدعم | Support

للمزيد من المعلومات أو الإبلاغ عن مشاكل:
- تحقق من ملف `README.md`
- راجع الكود في مجلد `src/routes/` و `src/controllers/`
- تحقق من لوغات الخادم في مجلد `logs/`

---

**آخر تحديث:** 2026-01-27
**الإصدار:** 2.2.0
