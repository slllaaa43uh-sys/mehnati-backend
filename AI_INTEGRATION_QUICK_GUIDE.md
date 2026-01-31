# مطالبة مختصرة لربط الذكاء الاصطناعي بالخادم
# AI Integration Prompt - Quick Guide

## 🎯 للذكاء الاصطناعي: كيف تربط الواجهة الأمامية بخادم مهنتي لي

### المعلومات الأساسية:
```
نوع الخادم: REST API (Express.js)
العنوان: http://localhost:5000
التنسيق: JSON
المصادقة: JWT Bearer Token
```

---

## 🔥 خطوات الربط السريع (3 خطوات فقط):

### الخطوة 1: إعداد الاتصال
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1'
});

// إضافة Token تلقائياً
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### الخطوة 2: تسجيل الدخول والحصول على Token
```javascript
const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('token', data.token);
  return data;
};
```

### الخطوة 3: استخدام الـ API
```javascript
// جلب المنشورات
const posts = await api.get('/posts');

// إنشاء منشور
const newPost = await api.post('/posts', {
  title: 'عنوان المنشور',
  description: 'وصف المنشور',
  category: 'jobs'
});
```

---

## 🤖 ربط خدمة الذكاء الاصطناعي (AI Chat):

```javascript
const chatWithAI = async (message) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:5000/api/v1/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let fullText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        if (data.type === 'chunk') {
          fullText += data.content;
          console.log('جزء جديد:', data.content);
        }
      }
    }
  }
  
  return fullText;
};

// الاستخدام:
const response = await chatWithAI('مرحبا، ما هو تطبيق مهنتي لي؟');
console.log('الرد الكامل:', response);
```

---

## 📋 أهم نقاط الوصول (API Endpoints):

| الوظيفة | الـ Endpoint | Method | Auth |
|---------|-------------|--------|------|
| **تسجيل** | `/api/v1/auth/register` | POST | ❌ |
| **دخول** | `/api/v1/auth/login` | POST | ❌ |
| **المنشورات** | `/api/v1/posts` | GET | ❌ |
| **إنشاء منشور** | `/api/v1/posts` | POST | ✅ |
| **الملف الشخصي** | `/api/v1/users/me` | GET | ✅ |
| **الذكاء الاصطناعي** | `/api/v1/ai/chat` | POST | ✅ |
| **القصص** | `/api/v1/stories/feed` | GET | ✅ |
| **الإشعارات** | `/api/v1/notifications` | GET | ✅ |
| **الوظائف العالمية** | `/api/v1/external-jobs` | GET | ❌ |

✅ = يحتاج Token  |  ❌ = لا يحتاج Token

---

## 🚀 كود React كامل جاهز للاستخدام:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// إعداد Axios
const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Component مثالي
function MehnatiApp() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  // تسجيل الدخول
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  // جلب المنشورات
  const fetchPosts = async () => {
    const { data } = await api.get('/posts');
    setPosts(data.posts);
  };

  // إنشاء منشور
  const createPost = async (postData) => {
    const { data } = await api.post('/posts', postData);
    setPosts([data.post, ...posts]);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <div>
      <h1>مهنتي لي</h1>
      {/* باقي الـ UI */}
    </div>
  );
}

export default MehnatiApp;
```

---

## ⚡ نصائح سريعة:

1. **احفظ الـ Token:** استخدم `localStorage.setItem('token', token)`
2. **أضف الـ Token في كل طلب:** في الـ `Authorization` header
3. **تعامل مع الأخطاء:** استخدم `try/catch`
4. **AI Chat يستخدم Streaming:** اقرأ البيانات تدريجياً
5. **CORS مفتوح:** لا توجد قيود على المصدر

---

## 🎨 مثال React Component كامل للـ AI Chat:

```jsx
import React, { useState } from 'react';

function AIChat() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    const userMessage = { role: 'user', content: message };
    setChat(prev => [...prev, userMessage]);
    
    let aiResponse = '';
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
          conversationHistory: chat 
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'chunk') {
              aiResponse += data.content;
              // تحديث الرد في الوقت الفعلي
              setChat(prev => {
                const newChat = [...prev];
                if (newChat[newChat.length - 1]?.role === 'model') {
                  newChat[newChat.length - 1].content = aiResponse;
                } else {
                  newChat.push({ role: 'model', content: aiResponse });
                }
                return newChat;
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('AI Error:', error);
    }
    
    setMessage('');
    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>💬 الذكاء الاصطناعي - مهنتي لي</h2>
      
      <div style={{ height: 400, overflowY: 'auto', border: '1px solid #ddd', padding: 10, marginBottom: 10 }}>
        {chat.map((msg, i) => (
          <div key={i} style={{ 
            margin: 10, 
            padding: 10, 
            backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
            borderRadius: 8 
          }}>
            <strong>{msg.role === 'user' ? '👤 أنت' : '🤖 مساعد'}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اكتب رسالتك هنا..."
          style={{ flex: 1, padding: 10 }}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? '⏳ جاري الإرسال...' : '📤 إرسال'}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
```

---

## 📦 Dependencies المطلوبة:

```bash
npm install axios
# أو للـ Streaming:
# لا حاجة لمكتبات إضافية - استخدم fetch API
```

---

## ✅ جاهز للاستخدام!

1. انسخ الكود أعلاه
2. غيّر `baseURL` إلى عنوان الخادم
3. شغّل التطبيق
4. استمتع! 🎉

---

**ملاحظة:** للتفاصيل الكاملة، راجع ملف `FRONTEND_API_INTEGRATION_GUIDE.md`
