const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// رابط تنزيل التطبيق
const APP_DOWNLOAD_URL = 'https://apkpure.com/p/com.my.newprojeci';
const APP_NAME = 'مهنتي لي';

/**
 * إنشاء صورة شبكية (Grid/Collage) باستخدام Cloudinary transformations
 * هذه الدالة تستخدم ميزة overlay في Cloudinary لدمج الصور
 * @param {Array} images - مصفوفة روابط الصور
 * @returns {string} - رابط الصورة المجمعة
 */
function createCollageUrl(images) {
  if (!images || images.length === 0) return null;
  if (images.length === 1) return images[0];
  
  // استخدام أول صورة كأساس
  const baseImage = images[0];
  
  // إذا كانت الصورة من Cloudinary، نستخدم transformations
  if (baseImage.includes('cloudinary.com')) {
    // استخراج أجزاء الرابط
    const parts = baseImage.split('/upload/');
    if (parts.length === 2) {
      const baseUrl = parts[0] + '/upload/';
      
      // إنشاء تحويلات للصورة المجمعة
      // نستخدم تخطيط شبكي 2x2 أو 1x2 أو 1x3 حسب عدد الصور
      let transformation = '';
      
      if (images.length === 2) {
        // صورتين جنباً إلى جنب
        transformation = 'c_fill,w_600,h_630,g_center/';
      } else if (images.length === 3) {
        // صورة كبيرة على اليمين وصورتين صغيرتين على اليسار
        transformation = 'c_fill,w_600,h_630,g_center/';
      } else {
        // 4 صور أو أكثر - شبكة 2x2
        transformation = 'c_fill,w_600,h_315,g_center/';
      }
      
      // إرجاع الصورة الأولى مع التحويلات المناسبة لـ Open Graph
      return baseUrl + 'c_fill,w_1200,h_630,g_center/' + parts[1];
    }
  }
  
  return baseImage;
}

/**
 * إنشاء صورة Open Graph محسنة للمشاركة
 * @param {Array} media - مصفوفة الوسائط
 * @param {string} baseUrl - الرابط الأساسي
 * @returns {string} - رابط صورة OG
 */
function getOptimizedOgImage(media, baseUrl) {
  if (!media || media.length === 0) {
    return `${baseUrl}/assets/default-post.png`;
  }
  
  const images = media.filter(m => m.type === 'image').map(m => m.url);
  const videos = media.filter(m => m.type === 'video');
  
  // إذا كان هناك فيديو، استخدم الصورة المصغرة
  if (videos.length > 0) {
    const thumbnail = videos[0].thumbnail;
    if (thumbnail) {
      return getFullUrl(thumbnail, baseUrl);
    }
  }
  
  // إذا كانت هناك صور
  if (images.length > 0) {
    const firstImage = getFullUrl(images[0], baseUrl);
    
    // تحسين الصورة لـ Open Graph (1200x630)
    if (firstImage && firstImage.includes('cloudinary.com')) {
      const parts = firstImage.split('/upload/');
      if (parts.length === 2) {
        // إزالة أي transformations موجودة وإضافة تحويلات OG
        let imagePath = parts[1];
        // إزالة version إذا وجد
        if (imagePath.match(/^v\d+\//)) {
          imagePath = imagePath.replace(/^v\d+\//, '');
        }
        return parts[0] + '/upload/c_fill,w_1200,h_630,g_auto,q_auto/' + imagePath;
      }
    }
    
    return firstImage;
  }
  
  return `${baseUrl}/assets/default-post.png`;
}

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
    
    const baseUrl = process.env.BASE_URL || 'https://mehnati-backend-3bu7.onrender.com';
    
    if (hasVideo) {
      const videoMedia = post.media.find(m => m.type === 'video');
      ogVideo = videoMedia?.url;
      ogImage = videoMedia?.thumbnail || post.coverImage?.url || null;
    } else if (hasImage) {
      // استخدام الدالة المحسنة للحصول على صورة OG
      ogImage = getOptimizedOgImage(post.media, baseUrl);
    }

    const title = post.title || `منشور من ${post.user?.name || 'مستخدم'}`;
    const description = post.content ? post.content.substring(0, 200) : 'شاهد هذا المنشور على تطبيق مهنتي لي';
    const userName = post.user?.name || 'مستخدم';
    
    // حساب عدد الصور للعرض في الوصف
    const imageCount = post.media ? post.media.filter(m => m.type === 'image').length : 0;
    const enhancedDescription = imageCount > 1 
      ? `${description} | ${imageCount} صور`
      : description;

    const html = generatePostPage({
      title,
      description: enhancedDescription,
      userName,
      ogImage,
      ogVideo,
      hasVideo,
      postId: req.params.id,
      media: post.media || [],
      content: post.content || '',
      baseUrl,
      imageCount
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

function generatePostPage({ title, description, userName, ogImage, ogVideo, hasVideo, postId, media, content, baseUrl, imageCount }) {
  const pageUrl = `${baseUrl}/share/post/${postId}`;
  const fullOgImage = getFullUrl(ogImage, baseUrl) || `${baseUrl}/assets/default-post.png`;
  const fullOgVideo = getFullUrl(ogVideo, baseUrl);

  // إنشاء معرض الوسائط مع تحسينات للعرض
  let mediaGallery = '';
  if (media && media.length > 0) {
    const images = media.filter(m => m.type === 'image');
    const videos = media.filter(m => m.type === 'video');
    
    if (videos.length > 0) {
      const videoUrl = getFullUrl(videos[0].url, baseUrl);
      const thumbUrl = getFullUrl(videos[0].thumbnail, baseUrl) || fullOgImage;
      mediaGallery = `
        <div class="video-container">
          <video controls playsinline preload="metadata" poster="${thumbUrl}" class="video-player">
            <source src="${videoUrl}" type="video/mp4">
            متصفحك لا يدعم تشغيل الفيديو
          </video>
        </div>
      `;
    } else if (images.length > 0) {
      // تحديد نوع الشبكة حسب عدد الصور
      const gridClass = images.length === 1 ? 'single' : 
                        images.length === 2 ? 'double' : 
                        images.length === 3 ? 'triple' : 'quad';
      
      mediaGallery = `<div class="image-gallery ${gridClass}">`;
      images.forEach((img, i) => {
        const imgUrl = getFullUrl(img.url, baseUrl);
        // إضافة class للصور حسب موقعها
        const imgClass = i === 0 ? 'main-image' : 'sub-image';
        mediaGallery += `
          <div class="gallery-item ${imgClass}">
            <img src="${imgUrl}" alt="صورة ${i + 1}" class="gallery-image" loading="lazy">
          </div>
        `;
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
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:type" content="${hasVideo ? 'video.other' : 'article'}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${fullOgImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:site_name" content="${APP_NAME}">
  <meta property="og:locale" content="ar_SA">
  ${fullOgVideo ? `<meta property="og:video" content="${fullOgVideo}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="${hasVideo ? 'player' : 'summary_large_image'}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${fullOgImage}">
  
  <!-- WhatsApp specific -->
  <meta property="og:image:secure_url" content="${fullOgImage}">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
      max-width: 480px;
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
      transition: transform 0.2s;
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
    
    /* Video Styles */
    .video-container { background: #000; }
    .video-player { width: 100%; max-height: 450px; display: block; }
    
    /* Image Gallery Styles - Grid Layout */
    .image-gallery {
      display: grid;
      gap: 2px;
      background: #f0f0f0;
    }
    .image-gallery.single {
      grid-template-columns: 1fr;
    }
    .image-gallery.double {
      grid-template-columns: 1fr 1fr;
    }
    .image-gallery.triple {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
    }
    .image-gallery.triple .gallery-item:first-child {
      grid-row: span 2;
    }
    .image-gallery.quad {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
    }
    .gallery-item {
      overflow: hidden;
      background: #f5f5f5;
      position: relative;
    }
    .gallery-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      min-height: 150px;
      max-height: 300px;
    }
    .image-gallery.single .gallery-image {
      max-height: 400px;
    }
    .image-gallery.triple .gallery-item:first-child .gallery-image {
      min-height: 302px;
    }
    
    /* Image loading placeholder */
    .gallery-item::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      border: 3px solid #ddd;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      z-index: 1;
    }
    .gallery-image:not([src=""]) + .gallery-item::before,
    .gallery-item:has(.gallery-image[complete="true"])::before {
      display: none;
    }
    @keyframes spin {
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }
    
    .content { 
      padding: 14px 16px; 
      font-size: 14px; 
      line-height: 1.7; 
      color: #333;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    /* Image count badge */
    .image-count {
      position: absolute;
      bottom: 8px;
      left: 8px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
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
    ${content ? `<div class="content">${escapeHtml(content.substring(0, 500))}${content.length > 500 ? '...' : ''}</div>` : ''}
  </div>
  
  <script>
    // Handle image loading errors gracefully
    document.querySelectorAll('.gallery-image').forEach(function(img) {
      img.onerror = function() {
        this.parentElement.style.display = 'none';
      };
      img.onload = function() {
        this.parentElement.style.background = 'transparent';
        this.setAttribute('complete', 'true');
      };
    });
  </script>
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
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${fullOgImage}">
  <meta property="og:image:width" content="720">
  <meta property="og:image:height" content="1280">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:site_name" content="${APP_NAME}">
  <meta property="og:locale" content="ar_SA">
  ${fullOgVideo ? `<meta property="og:video" content="${fullOgVideo}">
  <meta property="og:video:secure_url" content="${fullOgVideo}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="720">
  <meta property="og:video:height" content="1280">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${fullOgImage}">
  ${fullOgVideo ? `<meta name="twitter:player" content="${fullOgVideo}">
  <meta name="twitter:player:width" content="720">
  <meta name="twitter:player:height" content="1280">` : ''}
  
  <!-- WhatsApp specific -->
  <meta property="og:image:secure_url" content="${fullOgImage}">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
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
      transition: transform 0.2s;
    }
    .download-btn:hover { transform: scale(1.05); }
    .download-btn svg { width: 20px; height: 20px; }
    .promo-text { color: white; font-size: 11px; margin-top: 8px; opacity: 0.9; }
    .video-wrapper { 
      background: #000; 
      position: relative;
    }
    .video-player { 
      width: 100%; 
      max-height: 70vh; 
      display: block; 
    }
    .video-poster {
      width: 100%;
      aspect-ratio: 9/16;
      object-fit: cover;
    }
    .play-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      background: rgba(255,255,255,0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .play-overlay:hover { transform: translate(-50%, -50%) scale(1.1); }
    .play-overlay svg { width: 40px; height: 40px; fill: #ff0050; margin-left: 4px; }
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
    <div class="video-wrapper" id="video-container">
      ${fullOgVideo ? `
      <video id="main-video" controls playsinline preload="metadata" poster="${fullOgImage}" class="video-player">
        <source src="${fullOgVideo}" type="video/mp4">
        متصفحك لا يدعم تشغيل الفيديو
      </video>
      ` : `<img src="${fullOgImage}" alt="غلاف الفيديو" class="video-poster">`}
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
  
  <script>
    // Video error handling
    var video = document.getElementById('main-video');
    if (video) {
      video.onerror = function() {
        console.log('Video failed to load');
      };
    }
  </script>
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
  <meta property="og:title" content="خطأ - ${APP_NAME}">
  <meta property="og:description" content="${escapeHtml(message)}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
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
      transition: transform 0.2s;
    }
    .download-btn:hover { transform: scale(1.05); }
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
