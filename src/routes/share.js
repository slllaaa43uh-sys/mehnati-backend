const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// رابط تنزيل التطبيق
const APP_DOWNLOAD_URL = 'https://apkpure.com/p/com.my.newprojeci';
const APP_NAME = 'مهنتي لي';
const APP_DESCRIPTION = 'تطبيق مهنتي لي - منصة الوظائف والحراج';

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

    // تحديد نوع المحتوى والصورة
    const hasVideo = post.media && post.media.some(m => m.type === 'video');
    const hasImage = post.media && post.media.some(m => m.type === 'image');
    
    // الحصول على أول صورة أو غلاف الفيديو
    let ogImage = null;
    let ogVideo = null;
    
    if (hasVideo) {
      const videoMedia = post.media.find(m => m.type === 'video');
      ogVideo = videoMedia?.url;
      ogImage = videoMedia?.thumbnail || post.coverImage?.url || null;
    } else if (hasImage) {
      ogImage = post.media.find(m => m.type === 'image')?.url;
    }

    // العنوان والوصف
    const title = post.title || `منشور من ${post.user?.name || 'مستخدم'}`;
    const description = post.content ? post.content.substring(0, 200) : 'شاهد هذا المنشور على تطبيق مهنتي لي';
    const userName = post.user?.name || 'مستخدم';

    // إنشاء صفحة HTML مع Open Graph
    const html = generatePostPage({
      title,
      description,
      userName,
      ogImage,
      ogVideo,
      hasVideo,
      postId: req.params.id,
      media: post.media || [],
      content: post.content || ''
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error in share post:', error);
    res.status(500).send(generateErrorPage('حدث خطأ في تحميل المنشور'));
  }
});

/**
 * صفحة مشاركة الشورتس (فيديو قصير)
 * GET /share/short/:id
 */
router.get('/short/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar');

    if (!post || !post.isShort) {
      return res.status(404).send(generateErrorPage('الفيديو غير موجود'));
    }

    // الحصول على الفيديو والغلاف
    const videoMedia = post.media?.find(m => m.type === 'video');
    const ogVideo = videoMedia?.url;
    const ogImage = post.coverImage?.url || videoMedia?.thumbnail || null;

    // العنوان والوصف
    const title = post.title || post.attractiveTitle || `فيديو من ${post.user?.name || 'مستخدم'}`;
    const description = post.content ? post.content.substring(0, 200) : 'شاهد هذا الفيديو على تطبيق مهنتي لي';
    const userName = post.user?.name || 'مستخدم';

    // إنشاء صفحة HTML مع Open Graph للفيديو
    const html = generateShortPage({
      title,
      description,
      userName,
      ogImage,
      ogVideo,
      postId: req.params.id,
      views: post.views || 0
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error in share short:', error);
    res.status(500).send(generateErrorPage('حدث خطأ في تحميل الفيديو'));
  }
});

/**
 * إنشاء صفحة HTML للمنشور
 */
function generatePostPage({ title, description, userName, ogImage, ogVideo, hasVideo, postId, media, content }) {
  const baseUrl = process.env.BASE_URL || 'https://mehnati-backend-3bu7.onrender.com';
  const pageUrl = `${baseUrl}/share/post/${postId}`;
  
  // تحويل الصور إلى مسارات كاملة
  const fullOgImage = ogImage ? (ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`) : `${baseUrl}/assets/default-post.png`;
  const fullOgVideo = ogVideo ? (ogVideo.startsWith('http') ? ogVideo : `${baseUrl}${ogVideo}`) : null;

  // إنشاء معرض الصور
  let mediaGallery = '';
  if (media && media.length > 0) {
    const images = media.filter(m => m.type === 'image');
    const videos = media.filter(m => m.type === 'video');
    
    if (videos.length > 0) {
      const videoUrl = videos[0].url.startsWith('http') ? videos[0].url : `${baseUrl}${videos[0].url}`;
      const thumbUrl = videos[0].thumbnail ? (videos[0].thumbnail.startsWith('http') ? videos[0].thumbnail : `${baseUrl}${videos[0].thumbnail}`) : fullOgImage;
      mediaGallery = `
        <div class="video-container">
          <img src="${thumbUrl}" alt="غلاف الفيديو" class="video-thumb">
          <div class="play-button">
            <svg viewBox="0 0 24 24" fill="white" width="48" height="48">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      `;
    } else if (images.length > 0) {
      const gridClass = images.length === 1 ? 'single' : images.length === 2 ? 'double' : 'triple';
      mediaGallery = `<div class="image-grid ${gridClass}">`;
      images.slice(0, 4).forEach((img, i) => {
        const imgUrl = img.url.startsWith('http') ? img.url : `${baseUrl}${img.url}`;
        mediaGallery += `<img src="${imgUrl}" alt="صورة ${i + 1}" class="grid-image">`;
      });
      if (images.length > 4) {
        mediaGallery += `<div class="more-images">+${images.length - 4}</div>`;
      }
      mediaGallery += '</div>';
    }
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${APP_NAME}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${hasVideo ? 'video.other' : 'article'}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${fullOgImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${APP_NAME}">
  <meta property="og:locale" content="ar_SA">
  ${fullOgVideo ? `<meta property="og:video" content="${fullOgVideo}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="720">
  <meta property="og:video:height" content="1280">` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="${hasVideo ? 'player' : 'summary_large_image'}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${fullOgImage}">
  ${fullOgVideo ? `<meta name="twitter:player" content="${fullOgVideo}">` : ''}
  
  <!-- WhatsApp specific -->
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  
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
      max-width: 400px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .header {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #eee;
    }
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 18px;
    }
    .user-info h3 { font-size: 16px; color: #1a1a1a; }
    .user-info p { font-size: 12px; color: #666; }
    .video-container {
      position: relative;
      width: 100%;
      aspect-ratio: 9/16;
      max-height: 500px;
      background: #000;
      cursor: pointer;
    }
    .video-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .play-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      background: rgba(0,0,0,0.7);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    .video-container:hover .play-button { transform: translate(-50%, -50%) scale(1.1); }
    .image-grid {
      display: grid;
      gap: 2px;
      background: #f0f0f0;
    }
    .image-grid.single { grid-template-columns: 1fr; }
    .image-grid.double { grid-template-columns: 1fr 1fr; }
    .image-grid.triple { grid-template-columns: 1fr 1fr; }
    .grid-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
    .image-grid.single .grid-image { height: 300px; }
    .content {
      padding: 16px;
      font-size: 15px;
      line-height: 1.6;
      color: #333;
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
      padding: 14px 28px;
      border-radius: 30px;
      text-decoration: none;
      font-weight: bold;
      font-size: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
    .download-btn:hover { transform: scale(1.05); }
    .download-btn svg { width: 24px; height: 24px; }
    .app-promo {
      color: white;
      font-size: 13px;
      margin-top: 10px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="avatar">${userName.charAt(0)}</div>
      <div class="user-info">
        <h3>${escapeHtml(userName)}</h3>
        <p>${APP_NAME}</p>
      </div>
    </div>
    
    ${mediaGallery}
    
    ${content ? `<div class="content">${escapeHtml(content.substring(0, 300))}${content.length > 300 ? '...' : ''}</div>` : ''}
    
    <div class="download-section">
      <a href="${APP_DOWNLOAD_URL}" class="download-btn">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        تنزيل التطبيق
      </a>
      <p class="app-promo">شاهد المزيد على تطبيق ${APP_NAME}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * إنشاء صفحة HTML للشورتس
 */
function generateShortPage({ title, description, userName, ogImage, ogVideo, postId, views }) {
  const baseUrl = process.env.BASE_URL || 'https://mehnati-backend-3bu7.onrender.com';
  const pageUrl = `${baseUrl}/share/short/${postId}`;
  
  const fullOgImage = ogImage ? (ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`) : `${baseUrl}/assets/default-video.png`;
  const fullOgVideo = ogVideo ? (ogVideo.startsWith('http') ? ogVideo : `${baseUrl}${ogVideo}`) : null;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${APP_NAME}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${fullOgImage}">
  <meta property="og:image:width" content="720">
  <meta property="og:image:height" content="1280">
  <meta property="og:site_name" content="${APP_NAME}">
  <meta property="og:locale" content="ar_SA">
  ${fullOgVideo ? `<meta property="og:video" content="${fullOgVideo}">
  <meta property="og:video:secure_url" content="${fullOgVideo}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="720">
  <meta property="og:video:height" content="1280">` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${fullOgImage}">
  ${fullOgVideo ? `<meta name="twitter:player" content="${fullOgVideo}">
  <meta name="twitter:player:width" content="720">
  <meta name="twitter:player:height" content="1280">` : ''}
  
  <!-- WhatsApp specific -->
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  
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
    .video-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 9/16;
      background: #000;
      cursor: pointer;
    }
    .video-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .play-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.3);
    }
    .play-btn {
      width: 80px;
      height: 80px;
      background: rgba(255,255,255,0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      transition: transform 0.2s;
    }
    .video-wrapper:hover .play-btn { transform: scale(1.1); }
    .play-btn svg { width: 40px; height: 40px; margin-left: 4px; }
    .info {
      padding: 16px;
      color: white;
    }
    .user-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff0050, #00f2ea);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
    }
    .username { font-weight: 600; font-size: 15px; }
    .views { font-size: 12px; color: #888; }
    .title {
      font-size: 15px;
      line-height: 1.5;
      margin-bottom: 12px;
      color: #eee;
    }
    .description {
      font-size: 13px;
      color: #aaa;
      line-height: 1.5;
    }
    .download-bar {
      padding: 16px;
      background: linear-gradient(135deg, #ff0050 0%, #00f2ea 100%);
      text-align: center;
    }
    .download-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: white;
      color: #ff0050;
      padding: 14px 32px;
      border-radius: 30px;
      text-decoration: none;
      font-weight: bold;
      font-size: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      transition: transform 0.2s;
    }
    .download-btn:hover { transform: scale(1.05); }
    .download-btn svg { width: 22px; height: 22px; }
    .promo-text {
      color: white;
      font-size: 12px;
      margin-top: 10px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="video-wrapper" onclick="window.location.href='${APP_DOWNLOAD_URL}'">
      <img src="${fullOgImage}" alt="غلاف الفيديو" class="video-thumb">
      <div class="play-overlay">
        <div class="play-btn">
          <svg viewBox="0 0 24 24" fill="#ff0050">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
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
    
    <div class="download-bar">
      <a href="${APP_DOWNLOAD_URL}" class="download-btn">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        تنزيل ${APP_NAME}
      </a>
      <p class="promo-text">شاهد المزيد من الفيديوهات على التطبيق</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * صفحة الخطأ
 */
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
    h1 { color: #333; margin-bottom: 10px; }
    p { color: #666; margin-bottom: 20px; }
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
    <a href="${APP_DOWNLOAD_URL}" class="download-btn">
      تنزيل ${APP_NAME}
    </a>
  </div>
</body>
</html>`;
}

/**
 * دوال مساعدة
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatViews(views) {
  if (!views) return '0';
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
  return views.toString();
}

module.exports = router;
