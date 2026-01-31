# 🎯 دليل الذكاء الاصطناعي لربط الواجهة الأمامية بالخادم

## للذكاء الاصطناعي: ابدأ من هنا! 🤖

---

## 📋 ما هذا المشروع؟

**مهنتي لي** هو خادم (Backend) مبني بـ Express.js يوفر REST API لتطبيق توظيف ووظائف وحراج.

---

## 🔗 كيف تربط الواجهة الأمامية بالخادم؟

### الإجابة المختصرة:
الواجهة الأمامية تتصل بالخادم عبر **REST API** باستخدام:
- **HTTP Requests** (GET, POST, PUT, DELETE)
- **JSON Format** للبيانات
- **JWT Token** للمصادقة
- **URL:** `http://localhost:5000/api/v1`

---

## 📚 الملفات التي يجب قراءتها:

### 1️⃣ للبدء السريع (5 دقائق):
```
📄 AI_INTEGRATION_QUICK_GUIDE.md
```
- 3 خطوات فقط
- كود React جاهز
- مثال AI Chat كامل

### 2️⃣ للفهم الشامل (15 دقيقة):
```
📄 FRONTEND_API_INTEGRATION_GUIDE.md
```
- شرح مفصل للمصادقة
- أمثلة Axios و Fetch
- AI Chat مع Streaming
- نصائح وأمثلة

### 3️⃣ كمرجع دائم:
```
📄 API_ENDPOINTS_REFERENCE.md
```
- 40+ endpoint
- تفاصيل كاملة
- أمثلة Request/Response

### 4️⃣ للنظرة العامة:
```
📄 INTEGRATION_SUMMARY.md
```
- ملخص شامل
- إحصائيات
- قائمة مراجعة

---

## ⚡ البدء السريع (30 ثانية):

```javascript
// 1. Setup
import axios from 'axios';
const api = axios.create({ baseURL: 'http://localhost:5000/api/v1' });

// 2. Login
const { data } = await api.post('/auth/login', { 
  email: 'user@example.com', 
  password: '123456' 
});
localStorage.setItem('token', data.token);

// 3. Add token to all requests
api.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return config;
});

// 4. Use API
const posts = await api.get('/posts');
const newPost = await api.post('/posts', { 
  title: 'عنوان', 
  category: 'jobs' 
});
```

---

## 🤖 كيف تربط AI بالخادم؟

```javascript
const chatWithAI = async (message) => {
  const response = await fetch('http://localhost:5000/api/v1/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ message })
  });

  // Read streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    // Parse and display chunk
    console.log(chunk);
  }
};

// Usage
await chatWithAI('مرحبا، ما هو تطبيق مهنتي لي؟');
```

---

## 📊 أهم النقاط (Top Endpoints):

| الوظيفة | Endpoint | Method | Auth |
|---------|----------|--------|------|
| تسجيل | `/api/v1/auth/register` | POST | ❌ |
| دخول | `/api/v1/auth/login` | POST | ❌ |
| المنشورات | `/api/v1/posts` | GET | ❌ |
| إنشاء منشور | `/api/v1/posts` | POST | ✅ |
| AI Chat | `/api/v1/ai/chat` | POST | ✅ |
| الوظائف العالمية | `/api/v1/external-jobs` | GET | ❌ |

---

## 🎨 مثال React Component كامل:

انسخ هذا الكود وابدأ فوراً:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function App() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  const fetchPosts = async () => {
    const { data } = await api.get('/posts');
    setPosts(data.posts);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <div>
      <h1>مهنتي لي</h1>
      {user ? (
        <div>
          <p>مرحباً {user.fullName}</p>
          {posts.map(post => (
            <div key={post._id}>
              <h3>{post.title}</h3>
              <p>{post.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <button onClick={() => login('test@test.com', '123456')}>
          تسجيل الدخول
        </button>
      )}
    </div>
  );
}

export default App;
```

---

## 🔥 AI Chat Component (نسخ ولصق):

```jsx
import React, { useState } from 'react';

function AIChat() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    setChat(prev => [...prev, { role: 'user', content: message }]);
    
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
      <h2>💬 محادثة مع الذكاء الاصطناعي</h2>
      
      <div style={{ 
        height: 400, 
        overflowY: 'auto', 
        border: '1px solid #ddd', 
        padding: 10, 
        marginBottom: 10,
        backgroundColor: '#f9f9f9'
      }}>
        {chat.map((msg, i) => (
          <div key={i} style={{ 
            margin: 10, 
            padding: 10, 
            backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
            borderRadius: 8 
          }}>
            <strong>{msg.role === 'user' ? '👤 أنت' : '🤖 AI'}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
        {loading && <p>⏳ جاري الكتابة...</p>}
      </div>
      
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اكتب رسالتك هنا..."
          style={{ flex: 1, padding: 10, fontSize: 16 }}
          disabled={loading}
        />
        <button 
          onClick={sendMessage} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            fontSize: 16,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          📤 إرسال
        </button>
      </div>
    </div>
  );
}

export default AIChat;
```

---

## ✅ قائمة المراجعة للذكاء الاصطناعي:

عند إنشاء واجهة أمامية، تأكد من:

- [ ] قراءة `AI_INTEGRATION_QUICK_GUIDE.md`
- [ ] إعداد Axios أو Fetch API
- [ ] تنفيذ نظام المصادقة (login + token storage)
- [ ] إضافة Token في headers لجميع الطلبات المحمية
- [ ] معالجة الأخطاء (try/catch)
- [ ] تنفيذ AI Chat مع Streaming
- [ ] اختبار الاتصال
- [ ] إضافة Loading states
- [ ] تنفيذ Pagination للقوائم

---

## 🎯 الخلاصة:

### السؤال: كيف مربوطة الواجهة الأمامية بالخادم؟
### الإجابة:
✅ عن طريق **REST API**  
✅ باستخدام **HTTP Requests**  
✅ تنسيق **JSON**  
✅ مصادقة **JWT Token**  
✅ URL: `http://localhost:5000/api/v1`  

### للذكاء الاصطناعي:
اقرأ الملف **AI_INTEGRATION_QUICK_GUIDE.md** واستخدم الأمثلة الجاهزة.
كل شيء موثّق بالتفصيل في 4 ملفات شاملة بـ **1,586 سطر**.

---

## 🚀 ابدأ الآن!

1. افتح `AI_INTEGRATION_QUICK_GUIDE.md`
2. انسخ الكود الجاهز
3. عدّل URL حسب بيئتك
4. شغّل التطبيق
5. استمتع! 🎉

---

**تم إنشاؤه:** 2026-01-27  
**النسخة:** 2.2.0  
**الحالة:** ✅ جاهز تماماً
