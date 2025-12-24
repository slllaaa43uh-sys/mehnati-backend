const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// رابط تنزيل التطبيق
const APP_DOWNLOAD_URL = 'https://apkpure.com/p/com.my.newprojeci';
const APP_NAME = 'مهنتي لي';

/**
 * صفحة مشاركة المنشور
 * GET /share/post/:id
 */
router.get('/post/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar');

    if (!post) {
      return res.status(404).send(generateErrorPage('المنشور غير موجود'));
    }

    const hasVideo = post.media && post.media.some(m => m.type === 'video');
    const hasImage = post.media && post.media.some(m => m.type === 'image');
    
    let ogImage = null;
    let ogVideo = null;
    
    if (hasVideo) {
      const videoMedia = post.media.find(m => m.type === 'video');
      ogVideo = videoMedia?.url;
      ogImage = videoMedia?.thumbnail || post.coverImage?.url || null;
    } else if (hasImage) {
      ogImage = post.media.find(m => m.type === 'image')?.url;
    }

    const title = post.title || `منشور من ${post.user?.name || 'مستخدم'}`;
    const description = post.content ? post.content.substring(0, 200) : 'شاهد هذا المنشور على تطبيق مهنتي لي';
    const userName = post.user?.name || 'مستخدم';
    const baseUrl = process.env.BASE_URL || 'https://mehnati-backend-3bu7.onrender.com';

    const html = generatePostPage({
      title,
      description,
      userName,
      ogImage,
      ogVideo,
      hasVideo,
      postId: req.params.id,
      media: post.media || [],
      content: post.content || '',
      baseUrl
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error in share post:', error);
    res.status(500).send(generateErrorPage('حدث خطأ في تحميل المنشور'));
  }
});

/**
 * صفحة مشاركة الشورتس
 * GET /share/short/:id
 */
router.get('/short/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar');

    if (!post || !post.isShort) {
      return res.status(404).send(generateErrorPage('الفيديو غير موجود'));
    }

    const videoMedia = post.media?.find(m => m.type === 'video');
    const ogVideo = videoMedia?.url;
    const ogImage = post.coverImage?.url || videoMedia?.thumbnail || null;

    const title = post.title || post.attractiveTitle || `فيديو من ${post.user?.name || 'مستخدم'}`;
    const description = post.content ? post.content.substring(0, 200) : 'شاهد هذا الفيديو على تطبيق مهنتي لي';
    const userName = post.user?.name || 'مستخدم';
    const baseUrl = process.env.BASE_URL || 'https://mehnati-backend-3bu7.onrender.com';

    const html = generateShortPage({
      title,
      description,
      userName,
      ogImage,
      ogVideo,
      postId: req.params.id,
      views: post.views || 0,
      baseUrl
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error in share short:', error);
    res.status(500).send(generateErrorPage('حدث خطأ في تحميل الفيديو'));
  }
});

function getFullUrl(url, baseUrl) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${baseUrl}${url}`;
}

function generatePostPage({ title, description, userName, ogImage, ogVideo, hasVideo, postId, media, content, baseUrl }) {
  const pageUrl = `${baseUrl}/share/post/${postId}`;
  const fullOgImage = getFullUrl(ogImage, baseUrl) || `${baseUrl}/assets/default-post.png`;
  const fullOgVideo = getFullUrl(ogVideo, baseUrl);

  // إنشاء معرض الوسائط
  let mediaGallery = '';
  if (media && media.length > 0) {
    const images = media.filter(m => m.type === 'image');
    const videos = media.filter(m => m.type === 'video');
    
    if (videos.length > 0) {
      const videoUrl = getFullUrl(videos[0].url, baseUrl);
      const thumbUrl = getFullUrl(videos[0].thumbnail, baseUrl) || fullOgImage;
      mediaGallery = `
        <div class="video-container">
          <video controls playsinline preload="auto" poster="${thumbUrl}" class="video-player">
            <source src="${videoUrl}" type="video/mp4">
          </video>
        </div>
      `;
    } else if (images.length > 0) {
      mediaGallery = '<div class="image-gallery">';
      images.forEach((img, i) => {
        const imgUrl = getFullUrl(img.url, baseUrl);
        mediaGallery += `<img src="${imgUrl}" alt="صورة ${i + 1}" class="gallery-image" onerror="this.style.display='none'">`;
      });
      mediaGallery += '</div>';
    }
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${APP_NAME}</title>
  
  <meta property="og:type" content="${hasVideo ? 'video.other' : 'article'}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${fullOgImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${APP_NAME}">
  ${fullOgVideo ? `<meta property="og:video" content="${fullOgVideo}">
  <meta property="og:video:type" content="video/mp4">` : ''}
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${fullOgImage}">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 20px;
      max-width: 420px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .download-section {
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      text-align: center;
    }
    .download-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: white;
      color: #667eea;
      padding: 12px 24px;
      border-radius: 30px;
      text-decoration: none;
      font-weight: bold;
      font-size: 15px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    .download-btn:hover { transform: scale(1.05); }
    .download-btn svg { width: 20px; height: 20px; }
    .app-promo { color: white; font-size: 12px; margin-top: 8px; opacity: 0.9; }
    .header {
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #eee;
    }
    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 16px;
    }
    .user-info h3 { font-size: 15px; color: #1a1a1a; }
    .user-info p { font-size: 11px; color: #666; }
    .video-container { background: #000; }
    .video-player { width: 100%; max-height: 450px; display: block; }
    .image-gallery { display: flex; flex-direction: column; gap: 2px; }
    .gallery-image { width: 100%; max-height: 300px; object-fit: cover; display: block; }
    .content { padding: 14px 16px; font-size: 14px; line-height: 1.6; color: #333; }
  </style>
</head>
<body>
  <div class="card">
    <div class="download-section">
      <a href="${APP_DOWNLOAD_URL}" class="download-btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        تنزيل ${APP_NAME}
      </a>
      <p class="app-promo">شاهد المزيد على التطبيق</p>
    </div>
    <div class="header">
      <div class="avatar">${userName.charAt(0)}</div>
      <div class="user-info">
        <h3>${escapeHtml(userName)}</h3>
        <p>${APP_NAME}</p>
      </div>
    </div>
    ${mediaGallery}
    ${content ? `<div class="content">${escapeHtml(content.substring(0, 300))}${content.length > 300 ? '...' : ''}</div>` : ''}
  </div>
</body>
</html>`;
}

function generateShortPage({ title, description, userName, ogImage, ogVideo, postId, views, baseUrl }) {
  const pageUrl = `${baseUrl}/share/short/${postId}`;
  const fullOgImage = getFullUrl(ogImage, baseUrl) || `${baseUrl}/assets/default-video.png`;
  const fullOgVideo = getFullUrl(ogVideo, baseUrl);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${APP_NAME}</title>
  
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${fullOgImage}">
  <meta property="og:image:width" content="720">
  <meta property="og:image:height" content="1280">
  <meta property="og:site_name" content="${APP_NAME}">
  ${fullOgVideo ? `<meta property="og:video" content="${fullOgVideo}">
  <meta property="og:video:secure_url" content="${fullOgVideo}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="720">
  <meta property="og:video:height" content="1280">` : ''}
  
  <meta name="twitter:card" content="player">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${fullOgImage}">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 400px;
      width: 100%;
      background: #1a1a1a;
      border-radius: 20px;
      overflow: hidden;
      margin: 20px;
    }
    .download-bar {
      padding: 14px;
      background: linear-gradient(135deg, #ff0050 0%, #00f2ea 100%);
      text-align: center;
    }
    .download-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: white;
      color: #ff0050;
      padding: 12px 28px;
      border-radius: 30px;
      text-decoration: none;
      font-weight: bold;
      font-size: 15px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    .download-btn:hover { transform: scale(1.05); }
    .download-btn svg { width: 20px; height: 20px; }
    .promo-text { color: white; font-size: 11px; margin-top: 8px; opacity: 0.9; }
    .video-wrapper { background: #000; }
    .video-player { width: 100%; max-height: 70vh; display: block; }
    .info { padding: 14px; color: white; }
    .user-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff0050, #00f2ea);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
    }
    .username { font-weight: 600; font-size: 14px; }
    .views { font-size: 11px; color: #888; }
    .title { font-size: 14px; line-height: 1.5; margin-bottom: 8px; color: #eee; }
    .description { font-size: 12px; color: #aaa; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="download-bar">
      <a href="${APP_DOWNLOAD_URL}" class="download-btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        تنزيل ${APP_NAME}
      </a>
      <p class="promo-text">شاهد المزيد على التطبيق</p>
    </div>
    <div class="video-wrapper">
      ${fullOgVideo ? `
      <video controls playsinline autoplay muted preload="auto" poster="${fullOgImage}" class="video-player">
        <source src="${fullOgVideo}" type="video/mp4">
      </video>
      ` : `<img src="${fullOgImage}" alt="غلاف الفيديو" style="width:100%; aspect-ratio:9/16; object-fit:cover;">`}
    </div>
    <div class="info">
      <div class="user-row">
        <div class="avatar">${userName.charAt(0)}</div>
        <div>
          <div class="username">${escapeHtml(userName)}</div>
          <div class="views">${formatViews(views)} مشاهدة</div>
        </div>
      </div>
      ${title ? `<div class="title">${escapeHtml(title)}</div>` : ''}
      ${description ? `<div class="description">${escapeHtml(description.substring(0, 150))}${description.length > 150 ? '...' : ''}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

function generateErrorPage(message) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خطأ - ${APP_NAME}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .error-card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
    }
    .error-icon { font-size: 60px; margin-bottom: 20px; }
    h1 { color: #333; margin-bottom: 10px; font-size: 18px; }
    p { color: #666; margin-bottom: 20px; font-size: 14px; }
    .download-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 14px 28px;
      border-radius: 30px;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="error-icon">😕</div>
    <h1>${escapeHtml(message)}</h1>
    <p>جرب تنزيل التطبيق لمشاهدة المحتوى</p>
    <a href="${APP_DOWNLOAD_URL}" class="download-btn">تنزيل ${APP_NAME}</a>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatViews(views) {
  if (!views) return '0';
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
  return views.toString();
}

module.exports = router;
