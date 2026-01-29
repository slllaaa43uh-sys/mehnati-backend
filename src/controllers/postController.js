const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { updateSingleVideoScore, updateUserInterestProfile } = require('../services/recommendationService');
const { sendNotificationByCategory } = require('../services/fcmService');
const { checkFeaturedExpiryBatch, updateExpiredFeaturedPosts } = require('../cron/featuredCron');

/**
 * ============================================
 * دالة مساعدة لإنشاء الإشعارات
 * ============================================
 */
const createNotification = async (data) => {
  try {
    // التحقق من وجود البيانات المطلوبة
    if (!data.recipient || !data.sender || !data.type) {
      console.error('Missing required notification data:', { recipient: data.recipient, sender: data.sender, type: data.type });
      return null;
    }
    
    // لا تنشئ إشعار إذا كان المرسل هو المستلم
    if (data.sender.toString() === data.recipient.toString()) {
      console.log('Skipping notification: sender is recipient');
      return null;
    }
    
    console.log('Creating notification:', { type: data.type, recipient: data.recipient, sender: data.sender });
    const notification = await Notification.create(data);
    console.log('Notification created successfully:', notification._id);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
};

// @desc    Create new post
// @route   POST /api/v1/posts
// @access  Private
exports.createPost = async (req, res, next) => {
  try {
    const {
      title,
      content,
      text, // الواجهة الأمامية ترسل text بدلاً من content
      type,
      category,
      subcategory,
      condition,
      scope,
      country,
      city,
      location,
      contactEmail,
      contactPhone,
      contactMethods,
      isFeatured,
      displayPage,
      specialTag,
      isShort,
      price,
      currency,
      jobDetails,
      websiteLink,
      // حقول الشورتس الجديدة
      attractiveTitle,
      privacy,
      allowComments,
      allowDownloads,
      allowDownload, // الواجهة الأمامية ترسل allowDownload
      allowRepost,
      allowDuet, // الواجهة الأمامية ترسل allowDuet بدلاً من allowRepost
      // ميزات تحرير الفيديو الجديدة (Video Editing Features)
      textOverlays,
      stickerOverlays,
      videoFilter,
      voiceover,
      audioSettings,
      overlays // الواجهة الأمامية ترسل overlays ككائن مجمع
    } = req.body;

    // Handle media files from Cloudinary
    let media = [];
    if (req.files && req.files.length > 0) {
      media = req.files.map(file => ({
        url: file.path,
        publicId: file.filename,
        type: file.mimetype.startsWith('video') ? 'video' : 'image'
      }));
    }

    // Parse media from body if sent as JSON string
    if (req.body.media) {
      try {
        const parsedMedia = typeof req.body.media === 'string' 
          ? JSON.parse(req.body.media) 
          : req.body.media;
        if (Array.isArray(parsedMedia)) {
          media = [...media, ...parsedMedia];
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // معالجة غلاف الفيديو (coverImage) إذا تم إرساله
    let coverImage = null;
    if (req.body.coverImage) {
      try {
        coverImage = typeof req.body.coverImage === 'string'
          ? JSON.parse(req.body.coverImage)
          : req.body.coverImage;
      } catch (e) {
        // Ignore parse errors
      }
    }

    // دمج content و text (الواجهة الأمامية ترسل text)
    const finalContent = content || text || '';

    // Validate: Must have either content or media
    if ((!finalContent || finalContent.trim() === '') && media.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة محتوى نصي أو صور/فيديو'
      });
    }

    // إنشاء بيانات المنشور
    const postData = {
      user: req.user.id,
      title,
      content: finalContent, // استخدام finalContent الذي يدمج content و text
      media,
      type: type || 'general',
      category,
      subcategory,
      condition,
      scope: scope || 'global',
      country: scope === 'local' ? country : null,
      city: scope === 'local' ? city : null,
      location,
      contactEmail,
      contactPhone,
      contactMethods: contactMethods ? (Array.isArray(contactMethods) ? contactMethods : [contactMethods]) : [],
      isFeatured: isFeatured || false,
      displayPage: displayPage || 'home',
      specialTag: specialTag || null,
      isShort: isShort || false,
      price,
      currency,
      jobDetails,
      websiteLink
    };

    // إضافة حقول الشورتس إذا كان المنشور فيديو قصير
    if (isShort === true || isShort === 'true') {
      postData.attractiveTitle = attractiveTitle || title || null;
      postData.privacy = privacy || 'public';
      
      // دالة مساعدة لتحويل القيم إلى boolean بشكل صحيح
      const parseBoolean = (value, defaultValue = true) => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          if (value.toLowerCase() === 'true') return true;
          if (value.toLowerCase() === 'false') return false;
        }
        return defaultValue;
      };
      
      // قبول allowComments - التعامل مع true/false و 'true'/'false'
      postData.allowComments = parseBoolean(allowComments, true);
      
      // قبول allowDownloads أو allowDownload (الواجهة الأمامية ترسل allowDownload)
      const finalAllowDownloads = allowDownloads !== undefined ? allowDownloads : allowDownload;
      postData.allowDownloads = parseBoolean(finalAllowDownloads, true);
      
      // قبول allowRepost أو allowDuet (الواجهة الأمامية ترسل allowDuet)
      const finalAllowRepost = allowRepost !== undefined ? allowRepost : allowDuet;
      postData.allowRepost = parseBoolean(finalAllowRepost, true);
      
      // سجل للتدقيق - يمكن حذفه لاحقاً
      console.log('Shorts settings received:', {
        allowComments: req.body.allowComments,
        allowDownloads: req.body.allowDownloads,
        allowDownload: req.body.allowDownload,
        allowRepost: req.body.allowRepost,
        allowDuet: req.body.allowDuet,
        parsed: {
          allowComments: postData.allowComments,
          allowDownloads: postData.allowDownloads,
          allowRepost: postData.allowRepost
        }
      });
      
      // معالجة غلاف الفيديو - قبوله من coverImage أو من media[0].thumbnail
      if (coverImage) {
        postData.coverImage = coverImage;
      } else if (media.length > 0 && media[0].thumbnail) {
        // الواجهة الأمامية ترسل الغلاف في media[0].thumbnail
        postData.coverImage = { url: media[0].thumbnail };
      }
      
      // ============================================
      // معالجة ميزات تحرير الفيديو (Video Editing Features)
      // ============================================
      
      // معالجة overlays المجمعة من الواجهة الأمامية
      if (overlays) {
        try {
          const parsedOverlays = typeof overlays === 'string' ? JSON.parse(overlays) : overlays;
          if (parsedOverlays.texts) postData.textOverlays = parsedOverlays.texts;
          if (parsedOverlays.stickers) postData.stickerOverlays = parsedOverlays.stickers;
          if (parsedOverlays.filter) postData.videoFilter = parsedOverlays.filter;
          if (parsedOverlays.voiceover) postData.voiceover = parsedOverlays.voiceover;
          if (parsedOverlays.audioSettings) postData.audioSettings = parsedOverlays.audioSettings;
        } catch (e) {
          console.log('Error parsing overlays:', e);
        }
      }
      
      // معالجة النصوص المضافة (Text Overlays)
      if (textOverlays) {
        try {
          postData.textOverlays = typeof textOverlays === 'string' ? JSON.parse(textOverlays) : textOverlays;
        } catch (e) {
          console.log('Error parsing textOverlays:', e);
        }
      }
      
      // معالجة الملصقات (Sticker Overlays)
      if (stickerOverlays) {
        try {
          postData.stickerOverlays = typeof stickerOverlays === 'string' ? JSON.parse(stickerOverlays) : stickerOverlays;
        } catch (e) {
          console.log('Error parsing stickerOverlays:', e);
        }
      }
      
      // معالجة فلتر الفيديو (Video Filter)
      if (videoFilter) {
        postData.videoFilter = videoFilter;
      }
      
      // معالجة التعليق الصوتي (Voiceover)
      if (voiceover) {
        try {
          postData.voiceover = typeof voiceover === 'string' ? JSON.parse(voiceover) : voiceover;
        } catch (e) {
          console.log('Error parsing voiceover:', e);
        }
      }
      
      // معالجة إعدادات الصوت (Audio Settings)
      if (audioSettings) {
        try {
          postData.audioSettings = typeof audioSettings === 'string' ? JSON.parse(audioSettings) : audioSettings;
        } catch (e) {
          console.log('Error parsing audioSettings:', e);
        }
      }
      
      console.log('Video editing features received:', {
        textOverlays: postData.textOverlays?.length || 0,
        stickerOverlays: postData.stickerOverlays?.length || 0,
        videoFilter: postData.videoFilter,
        hasVoiceover: !!postData.voiceover?.url,
        audioSettings: postData.audioSettings
      });
      
      // ============================================
      // معالجة الميزات الجديدة للفيديوهات (New Video Features)
      // ============================================
      
      // معالجة الهاشتاجات (Hashtags)
      if (req.body.hashtags) {
        try {
          const parsedHashtags = typeof req.body.hashtags === 'string' 
            ? JSON.parse(req.body.hashtags) 
            : req.body.hashtags;
          postData.hashtags = Array.isArray(parsedHashtags) ? parsedHashtags : [];
        } catch (e) {
          // استخراج الهاشتاجات من النص إذا كان سلسلة نصية
          const hashtagRegex = /#[\u0600-\u06FF\w]+/g;
          const matches = req.body.hashtags.match(hashtagRegex);
          postData.hashtags = matches ? matches.map(h => h.replace('#', '')) : [];
        }
      }
      // استخراج الهاشتاجات من الوصف تلقائياً
      if (!postData.hashtags || postData.hashtags.length === 0) {
        const hashtagRegex = /#[\u0600-\u06FF\w]+/g;
        const contentMatches = finalContent.match(hashtagRegex);
        if (contentMatches) {
          postData.hashtags = contentMatches.map(h => h.replace('#', ''));
        }
      }
      
      // معالجة الذكر/الإشارة (Mentions)
      if (req.body.mentions) {
        try {
          postData.mentions = typeof req.body.mentions === 'string' 
            ? JSON.parse(req.body.mentions) 
            : req.body.mentions;
        } catch (e) {
          console.log('Error parsing mentions:', e);
        }
      }
      // استخراج الإشارات من الوصف تلقائياً (@username)
      if (!postData.mentions || postData.mentions.length === 0) {
        const mentionRegex = /@[\u0600-\u06FF\w]+/g;
        const contentMentions = finalContent.match(mentionRegex);
        if (contentMentions) {
          postData.mentions = contentMentions.map(m => ({ username: m.replace('@', '') }));
        }
      }
      
      // معالجة رابط الموقع (Website Link)
      if (req.body.websiteLink) {
        postData.websiteLink = req.body.websiteLink;
      }
      
      // معالجة ترويج الفيديو (Video Promotion)
      if (req.body.promotion) {
        try {
          const promotion = typeof req.body.promotion === 'string' 
            ? JSON.parse(req.body.promotion) 
            : req.body.promotion;
          
          if (promotion && promotion.duration > 0) {
            const startDate = new Date();
            const endDate = new Date(startDate.getTime() + (promotion.duration * 24 * 60 * 60 * 1000));
            
            // حساب المشاهدات المتوقعة
            let minViews = 500, maxViews = 1000;
            if (promotion.budget > 0) {
              minViews = promotion.budget * 80;
              maxViews = promotion.budget * 120;
            }
            
            // تحديد نوع الترويج
            let promotionType = 'free';
            if (promotion.duration === 7) promotionType = 'weekly';
            else if (promotion.duration === 30) promotionType = 'monthly';
            else if (promotion.duration > 1) promotionType = 'custom';
            
            postData.videoPromotion = {
              isPromoted: true,
              promotionType,
              targetCountry: promotion.city?.split(' - ')[0] || null,
              targetCity: promotion.city?.split(' - ')[1] || promotion.city || null,
              duration: promotion.duration,
              budget: promotion.budget || 0,
              startDate,
              endDate,
              estimatedViews: { min: minViews, max: maxViews }
            };
          }
        } catch (e) {
          console.log('Error parsing promotion:', e);
        }
      }
      
      console.log('New video features received:', {
        hashtags: postData.hashtags?.length || 0,
        mentions: postData.mentions?.length || 0,
        websiteLink: postData.websiteLink || null,
        videoPromotion: postData.videoPromotion?.isPromoted || false
      });
    }

    const post = await Post.create(postData);

    await post.populate('user', 'name avatar');

    // ============================================
    // إرسال إشعار FCM بناءً على التصنيف
    // ============================================
    console.log('========================================');
    console.log('📤 POST CONTROLLER - FCM NOTIFICATION DEBUG');
    console.log('========================================');
    console.log('📋 Post Created:');
    console.log('   - Post ID:', post._id);
    console.log('   - Category:', category || 'NOT SET');
    console.log('   - Type:', type || 'general');
    console.log('   - Display Page:', displayPage || 'home');
    console.log('   - Is Short:', isShort);
    console.log('   - Title:', title || 'NO TITLE');
    
    if (category) {
      console.log('✅ Category exists, preparing to send FCM notification...');
      
      // اسم المستخدم للإشعار
      const userName = post.user?.name || req.user?.name || 'مستخدم';
      
      // صورة المستخدم (avatar) للإشعار - مثل واتساب
      const userAvatar = post.user?.avatar || null;
      // أول حرف من اسم المستخدم (في حالة عدم وجود صورة)
      const userInitial = userName ? userName.charAt(0).toUpperCase() : 'م';
      
      // تبسيط اسم الفئة (سائق بدلاً من سائق خاص)
      const SIMPLIFIED_CATEGORIES = {
        'سائق خاص': 'سائق',
        'حارس أمن': 'حارس',
        'طبيب/ممرض': 'طبيب',
        'بائع / كاشير': 'بائع',
        'حلاق / خياط': 'حلاق',
        'مهندس مدني': 'مهندس',
        'مدير مشاريع': 'مدير',
        'كاتب محتوى': 'كاتب',
        'مدرس خصوصي': 'مدرس',
        'مصمم جرافيك': 'مصمم',
        'خدمة عملاء': 'خدمة عملاء',
        'مقدم طعام': 'نادل',
        'وظائف أخرى': 'وظيفة'
      };
      const simplifiedCategory = SIMPLIFIED_CATEGORIES[category] || category;
      
      // تحديد نوع الوظيفة (يبحث عن وظيفة / يبحث عن موظفين)
      let jobTypeText = '';
      if (title) {
        if (title.includes('ابحث عن وظيفة') || title.includes('أبحث عن وظيفة')) {
          jobTypeText = 'يبحث عن وظيفة';
        } else if (title.includes('ابحث عن موظفين') || title.includes('أبحث عن موظفين')) {
          jobTypeText = 'يبحث عن موظفين';
        }
      }
      
      // ============================================
      // إشعارات مخصصة للوظائف المستعجلة
      // ============================================
      let notificationTitle = '';
      let notificationBody = '';
      
      // استخراج جزء من النص للإشعار (أول 80 حرف)
      const contentPreview = finalContent ? finalContent.substring(0, 80).trim() : '';
      
      // التحقق من أن المنشور في صفحة المستعجل
      if (displayPage === 'urgent' && specialTag) {
        // ============================================
        // إشعارات الوظائف المستعجلة مع specialTag
        // ============================================
        const urgentTagEmoji = {
          'مطلوب الآن': '🔴',
          'عقود مؤقتة': '📋',
          'دفع يومي': '💰'
        };
        const emoji = urgentTagEmoji[specialTag] || '⚡';
        
        notificationTitle = `${emoji} وظيفة مستعجلة - ${specialTag}`;
        notificationBody = contentPreview 
          ? `${userName} ينشر فرصة عمل (${specialTag}): ${contentPreview}${finalContent.length > 80 ? '...' : ''}`
          : `${userName} ينشر فرصة عمل مستعجلة (${specialTag})`;
        
        console.log('🚨 URGENT JOB NOTIFICATION:');
        console.log('   - Special Tag:', specialTag);
        console.log('   - Title:', notificationTitle);
        console.log('   - Body:', notificationBody);
      } else if (jobTypeText) {
        // إذا كان منشور وظيفة عادية: "أحمد يبحث عن وظيفة: نص المنشور..."
        notificationTitle = `إعلان جديد - ${simplifiedCategory}`;
        notificationBody = contentPreview 
          ? `${userName} ${jobTypeText}: ${contentPreview}${finalContent.length > 80 ? '...' : ''}`
          : `${userName} ${jobTypeText}`;
      } else {
        // إذا لم يكن وظيفة: "أحمد: نص المنشور..."
        notificationTitle = `إعلان جديد - ${simplifiedCategory}`;
        notificationBody = contentPreview 
          ? `${userName}: ${contentPreview}${finalContent.length > 80 ? '...' : ''}`
          : `${userName} نشر إعلان جديد`;
      }

      console.log('📋 Notification Details:');
      console.log('   - User Name:', userName);
      console.log('   - Original Category:', category);
      console.log('   - Simplified Category:', simplifiedCategory);
      console.log('   - Job Type:', jobTypeText || 'NOT A JOB POST');
      console.log('   - Notification Title:', notificationTitle);
      console.log('   - Notification Body:', notificationBody);
      console.log('🚀 Calling sendNotificationByCategory...');

      // استخراج صورة المنشور (للإشعارات الغنية مثل يوتيوب)
      let postImage = null;
      if (post.media && post.media.length > 0) {
        // إذا كان هناك صورة أو صورة مصغرة للفيديو
        const firstMedia = post.media[0];
        if (firstMedia.type === 'image') {
          postImage = firstMedia.url;
        } else if (firstMedia.type === 'video' && firstMedia.thumbnail) {
          postImage = firstMedia.thumbnail;
        }
      }
      // إذا كان هناك غلاف مخصص للفيديو
      if (!postImage && post.coverImage && post.coverImage.url) {
        postImage = post.coverImage.url;
      }

      // استخراج جزء من النص (أول 100 حرف)
      const postContentPreview = finalContent ? finalContent.substring(0, 100) + (finalContent.length > 100 ? '...' : '') : '';

      console.log('   - Post Image:', postImage || 'NO IMAGE');
      console.log('   - Content Preview:', postContentPreview.substring(0, 50) + '...');

      // إرسال الإشعار بشكل غير متزامن (لا ننتظر النتيجة)
      // نمرر postTitle لتحديد نوع الوظيفة (seeker/employer)
      sendNotificationByCategory(
        category,
        notificationTitle,
        notificationBody,
        {
          postId: post._id.toString(),
          type: type || 'general',
          displayPage: displayPage || 'home',
          userId: req.user.id,
          creatorId: req.user.id, // معرف صاحب المنشور لاستثنائه من الإشعار
          postTitle: title || '', // عنوان المنشور لتحديد نوع الوظيفة
          // بيانات إضافية للإشعارات الغنية (مثل يوتيوب)
          postImage: postImage || '', // صورة المنشور
          postContent: postContentPreview, // جزء من النص
          category: category, // التصنيف
          specialTag: specialTag || '', // نوع الوظيفة المستعجلة
          // ============================================
          // بيانات Deep Linking للتطبيق (Android/iOS)
          // ============================================
          url: `/your-path`, // رابط مباشر للانتقال
          itemId: post._id.toString(), // معرف العنصر
          // ============================================
          // بيانات صورة المستخدم للإشعار (مثل واتساب)
          // ============================================
          userAvatar: userAvatar || '', // صورة المستخدم
          userInitial: userInitial, // أول حرف من اسم المستخدم
          userName: userName // اسم المستخدم
        }
      ).then(result => {
        console.log('========================================');
        console.log('📤 FCM sendNotificationByCategory RESULT:');
        console.log('   - Success:', result.success);
        console.log('   - Topics:', result.topics);
        console.log('   - Results:', JSON.stringify(result.results, null, 2));
        console.log('========================================');
      }).catch(err => {
        // تسجيل الخطأ فقط دون إيقاف العملية
        console.error('========================================');
        console.error('❌ FCM NOTIFICATION ERROR in postController:');
        console.error('   - Error:', err.message);
        console.error('   - Stack:', err.stack);
        console.error('========================================');
      });
    } else {
      console.log('⚠️ No category provided, skipping FCM notification');
    }
    console.log('========================================');

    res.status(201).json({
      success: true,
      message: 'تم نشر المنشور بنجاح',
      post
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all posts (with filters)
// @route   GET /api/v1/posts
// @access  Public
exports.getPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      scope,
      country,
      city,
      displayPage,
      isShort,
      isFeatured,
      userId,
      specialTag,
      postType // فلتر حسب العنوان (ابحث عن وظيفة / ابحث عن موظفين)
    } = req.query;

    const query = { status: 'approved' };
    
    // استبعاد المنشورات المخفية من قبل المستخدم الحالي
    if (req.user) {
      query.hiddenBy = { $ne: req.user.id };
    }

    // المنشورات المعاد نشرها تظهر في الصفحة الرئيسية فقط
    // إذا كان الطلب للصفحة الرئيسية أو بدون فلتر، نضمن المنشورات المعاد نشرها
    if (!displayPage || displayPage === 'home') {
      // للصفحة الرئيسية: نجلب المنشورات العادية + المعاد نشرها (بدون المستعجلة)
      query.$or = [
        { type: { $ne: 'repost' }, displayPage: { $ne: 'urgent' } },
        { type: 'repost', displayPage: 'home' }
      ];
    } else if (displayPage === 'urgent') {
      // للصفحة المستعجلة: فقط المنشورات المستعجلة
      query.type = { $ne: 'repost' };
      query.displayPage = 'urgent';
    } else {
      // للصفحات الأخرى (الحراج/الوظائف): لا نعرض المنشورات المعاد نشرها ولا المستعجلة
      query.type = { $ne: 'repost' };
      query.$and = [
        { displayPage: { $in: [displayPage, 'all'] } },
        { displayPage: { $ne: 'urgent' } }
      ];
    }
    
    if (type && type !== 'repost') query.type = type;
    if (category) query.category = category;
    if (scope) query.scope = scope;
    if (country) query.country = country;
    if (city && city !== 'كل المدن') query.city = city;
    if (isShort !== undefined) query.isShort = isShort === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (userId) query.user = userId;
    if (specialTag) query.specialTag = specialTag;
    
    // فلتر حسب نوع المنشور (ابحث عن وظيفة / ابحث عن موظفين)
    if (postType) {
      // استخدام regex للتعامل مع الاختلافات في الكتابة (ابحث/أبحث)
      if (postType.includes('وظيفة')) {
        query.title = { $regex: 'ابحث عن وظيفة|أبحث عن وظيفة', $options: 'i' };
      } else if (postType.includes('موظفين')) {
        query.title = { $regex: 'ابحث عن موظفين|أبحث عن موظفين', $options: 'i' };
      }
      console.log('Filtering by postType:', postType, '| Query title:', query.title);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // تحديث المنشورات المنتهية الصلاحية في قاعدة البيانات قبل الجلب
    await updateExpiredFeaturedPosts();

    const posts = await Post.find(query)
      .populate('user', 'name avatar isVerified')
      .populate('reactions.user', 'name avatar')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'user',
          select: 'name avatar isVerified'
        }
      })
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // استخدام lean للأداء الأفضل

    // التحقق من صلاحية التمييز في الوقت الفعلي (احتياطي إضافي)
    const processedPosts = checkFeaturedExpiryBatch(posts);
    
    // إضافة حقول التوافق مع Frontend لكل منشور
    const formattedPosts = processedPosts.map(post => {
      const formattedPost = { ...post };
      
      // Frontend يستخدم text بدلاً من content
      formattedPost.text = formattedPost.content;
      
      // إضافة image و video للتوافق مع Frontend
      if (formattedPost.media && formattedPost.media.length > 0) {
        const firstImage = formattedPost.media.find(m => m.type === 'image');
        if (firstImage) {
          formattedPost.image = firstImage.url;
        }
        
        const firstVideo = formattedPost.media.find(m => m.type === 'video');
        if (firstVideo) {
          formattedPost.video = firstVideo.url;
        }
      }
      
      return formattedPost;
    });

    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: formattedPosts.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      posts: formattedPosts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single post
// @route   GET /api/v1/posts/:id
// @access  Public
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar bio isVerified followersCount')
      .populate('reactions.user', 'name avatar')
      .populate('comments.user', 'name avatar')
      .populate('comments.replies.user', 'name avatar')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'user',
          select: 'name avatar isVerified'
        }
      });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    post.views += 1;
    await post.save();

    // تحويل المنشور لكائن وإضافة حقول إضافية للتوافق مع الواجهة الأمامية
    const postObj = post.toObject();
    
    // إضافة حقول التوافق مع Frontend
    postObj.text = postObj.content; // Frontend يستخدم text بدلاً من content
    postObj.likes = post.reactions ? post.reactions.length : 0;
    postObj.commentsCount = post.comments ? post.comments.length : 0;
    
    // إضافة image و video للتوافق مع Frontend
    // ملاحظة: بعض المنشورات قد تحتوي على URLs نسبية، نحتاج التأكد من إضافة البادئة الصحيحة
    if (postObj.media && postObj.media.length > 0) {
      const firstImage = postObj.media.find(m => m.type === 'image');
      if (firstImage) {
        postObj.image = firstImage.url;
      }
      
      const firstVideo = postObj.media.find(m => m.type === 'video');
      if (firstVideo) {
        postObj.video = firstVideo.url;
      }
    }

    // إضافة حقول إعدادات الشورتس بشكل صريح إذا كان المنشور شورتس
    if (postObj.isShort) {
      postObj.attractiveTitle = postObj.attractiveTitle || null;
      postObj.privacy = postObj.privacy || 'public';
      postObj.allowComments = postObj.allowComments !== undefined ? postObj.allowComments : true;
      postObj.allowDownloads = postObj.allowDownloads !== undefined ? postObj.allowDownloads : true;
      postObj.allowRepost = postObj.allowRepost !== undefined ? postObj.allowRepost : true;
      postObj.coverImage = postObj.coverImage || null;
    }

    res.status(200).json({
      success: true,
      post: postObj
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update post
// @route   PUT /api/v1/posts/:id
// @access  Private
exports.updatePost = async (req, res, next) => {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل هذا المنشور'
      });
    }

    const allowedUpdates = [
      'title', 'content', 'category', 'subcategory', 'condition', 'scope', 'country', 'city',
      'location', 'contactEmail', 'contactPhone', 'contactMethods',
      'isFeatured', 'displayPage', 'specialTag', 'price', 'currency', 'jobDetails', 'websiteLink'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        post[field] = req.body[field];
      }
    });

    await post.save();
    await post.populate('user', 'name avatar');

    res.status(200).json({
      success: true,
      message: 'تم تحديث المنشور بنجاح',
      post
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post
// @route   DELETE /api/v1/posts/:id
// @access  Private
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بحذف هذا المنشور'
      });
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم حذف المنشور بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * الإعجاب بالمنشور - إشعار: أعجب بمنشورك
 * ============================================
 */
// @desc    Like/Unlike post
// @route   POST /api/v1/posts/:id/react
// @access  Private
exports.reactToPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    const { type = 'like' } = req.body;

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const existingReaction = post.reactions.find(
      r => r.user.toString() === req.user.id
    );

    if (existingReaction) {
      // إلغاء الإعجاب
      post.reactions = post.reactions.filter(
        r => r.user.toString() !== req.user.id
      );
    } else {
      // إضافة إعجاب
      post.reactions.push({ user: req.user.id, type });

      // إنشاء إشعار: أعجب بمنشورك أو أعجب بفيديوهك
      if (post.isShort) {
        // إشعار للشورتس
        const videoMedia = post.media?.find(m => m.type === 'video') || post.media?.[0];
        await createNotification({
          recipient: post.user,
          sender: req.user.id,
          type: 'short_like',
          post: post._id,
          metadata: {
            shortTitle: post.attractiveTitle || post.content?.substring(0, 50) || null,
            shortThumbnail: videoMedia?.thumbnail || post.coverImage?.url || null,
            isShort: true
          }
        });
      } else {
        // إشعار للمنشورات العادية
        await createNotification({
          recipient: post.user,
          sender: req.user.id,
          type: 'like',
          post: post._id,
          metadata: {
            postContent: post.content ? post.content.substring(0, 100) : null,
            displayPage: post.displayPage
          }
        });
      }
    }

    await post.save();

    // تحديث تقييم الفيديو وملف اهتمامات المستخدم (للشورتس)
    if (post.isShort && !existingReaction) {
      await updateSingleVideoScore(post._id);
      await updateUserInterestProfile(req.user.id, post._id, 'LIKE');
    }

    res.status(200).json({
      success: true,
      isLiked: !existingReaction,
      likesCount: post.reactions.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * التعليق على المنشور - إشعار: علق على منشورك
 * ============================================
 */
// @desc    Add comment to post
// @route   POST /api/v1/posts/:id/comments
// @access  Private
exports.addComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    const { text } = req.body;

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    // التحقق من إعداد السماح بالتعليقات (للشورتس)
    if (post.isShort && post.allowComments === false) {
      return res.status(403).json({
        success: false,
        message: 'التعليقات غير مسموح بها على هذا الفيديو'
      });
    }

    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'نص التعليق مطلوب'
      });
    }

    const comment = {
      user: req.user.id,
      text: text.trim()
    };

    post.comments.push(comment);
    await post.save();

    const newComment = post.comments[post.comments.length - 1];

    // إنشاء إشعار: علق على منشورك أو علق على فيديوهك
    if (post.isShort) {
      // إشعار للشورتس
      const videoMedia = post.media?.find(m => m.type === 'video') || post.media?.[0];
      await createNotification({
        recipient: post.user,
        sender: req.user.id,
        type: 'short_comment',
        post: post._id,
        comment: {
          commentId: newComment._id,
          text: text.trim()
        },
        metadata: {
          commentText: text.trim().substring(0, 100),
          shortTitle: post.attractiveTitle || post.content?.substring(0, 50) || null,
          shortThumbnail: videoMedia?.thumbnail || post.coverImage?.url || null,
          isShort: true
        }
      });
    } else {
      // إشعار للمنشورات العادية
      await createNotification({
        recipient: post.user,
        sender: req.user.id,
        type: 'comment',
        post: post._id,
        comment: {
          commentId: newComment._id,
          text: text.trim()
        },
        metadata: {
          commentText: text.trim().substring(0, 100),
          postContent: post.content ? post.content.substring(0, 50) : null,
          displayPage: post.displayPage
        }
      });
    }

    await post.populate('comments.user', 'name avatar');

    // تحديث تقييم الفيديو وملف اهتمامات المستخدم (للشورتس)
    if (post.isShort) {
      await updateSingleVideoScore(post._id);
      await updateUserInterestProfile(req.user.id, post._id, 'COMMENT');
    }

    res.status(201).json({
      success: true,
      message: 'تم إضافة التعليق',
      comment: post.comments[post.comments.length - 1]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * الرد على التعليق - إشعار: رد على تعليقك
 * ============================================
 */
// @desc    Add reply to comment
// @route   POST /api/v1/posts/:id/comments/:commentId/replies
// @access  Private
exports.addReply = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'نص الرد مطلوب'
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    const reply = {
      user: req.user.id,
      text: text.trim(),
      likes: []
    };

    comment.replies.push(reply);
    await post.save();

    const newReply = comment.replies[comment.replies.length - 1];

    // إنشاء إشعار: رد على تعليقك
    if (post.isShort) {
      // إشعار للشورتس
      const videoMedia = post.media?.find(m => m.type === 'video') || post.media?.[0];
      await createNotification({
        recipient: comment.user,
        sender: req.user.id,
        type: 'short_reply',
        post: post._id,
        comment: {
          commentId: comment._id,
          text: comment.text
        },
        reply: {
          replyId: newReply._id,
          commentId: comment._id,
          text: text.trim()
        },
        metadata: {
          replyText: text.trim().substring(0, 100),
          commentText: comment.text ? comment.text.substring(0, 50) : null,
          shortTitle: post.attractiveTitle || post.content?.substring(0, 50) || null,
          shortThumbnail: videoMedia?.thumbnail || post.coverImage?.url || null,
          isShort: true
        }
      });
    } else {
      // إشعار للمنشورات العادية
      await createNotification({
        recipient: comment.user,
        sender: req.user.id,
        type: 'reply',
        post: post._id,
        comment: {
          commentId: comment._id,
          text: comment.text
        },
        reply: {
          replyId: newReply._id,
          commentId: comment._id,
          text: text.trim()
        },
        metadata: {
          replyText: text.trim().substring(0, 100),
          commentText: comment.text ? comment.text.substring(0, 50) : null,
          displayPage: post.displayPage
        }
      });
    }

    await post.populate('comments.replies.user', 'name avatar');

    const updatedComment = post.comments.id(commentId);
    const populatedReply = updatedComment.replies[updatedComment.replies.length - 1];

    res.status(201).json({
      success: true,
      message: 'تم إضافة الرد',
      reply: populatedReply
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * الإعجاب بالتعليق - إشعار: أعجب بتعليقك
 * ============================================
 */
// @desc    Like/Unlike comment
// @route   POST /api/v1/posts/:id/comments/:commentId/like
// @access  Private
exports.likeComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    if (!comment.likes) {
      comment.likes = [];
    }

    const existingLike = comment.likes.find(
      like => like.user.toString() === req.user.id
    );

    if (existingLike) {
      // إلغاء الإعجاب
      comment.likes = comment.likes.filter(
        like => like.user.toString() !== req.user.id
      );
    } else {
      // إضافة إعجاب
      comment.likes.push({ user: req.user.id });

      // إنشاء إشعار: أعجب بتعليقك
      if (post.isShort) {
        // إشعار للشورتس
        const videoMedia = post.media?.find(m => m.type === 'video') || post.media?.[0];
        await createNotification({
          recipient: comment.user,
          sender: req.user.id,
          type: 'short_comment_like',
          post: post._id,
          comment: {
            commentId: comment._id,
            text: comment.text
          },
          metadata: {
            commentText: comment.text ? comment.text.substring(0, 100) : null,
            shortTitle: post.attractiveTitle || post.content?.substring(0, 50) || null,
            shortThumbnail: videoMedia?.thumbnail || post.coverImage?.url || null,
            isShort: true
          }
        });
      } else {
        // إشعار للمنشورات العادية
        await createNotification({
          recipient: comment.user,
          sender: req.user.id,
          type: 'comment_like',
          post: post._id,
          comment: {
            commentId: comment._id,
            text: comment.text
          },
          metadata: {
            commentText: comment.text ? comment.text.substring(0, 100) : null,
            displayPage: post.displayPage
          }
        });
      }
    }

    await post.save();

    res.status(200).json({
      success: true,
      isLiked: !existingLike,
      likesCount: comment.likes.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * الإعجاب بالرد - إشعار: أعجب بردك
 * ============================================
 */
// @desc    Like/Unlike reply
// @route   POST /api/v1/posts/:id/comments/:commentId/replies/:replyId/like
// @access  Private
exports.likeReply = async (req, res, next) => {
  try {
    const { id, commentId, replyId } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'الرد غير موجود'
      });
    }

    if (!reply.likes) {
      reply.likes = [];
    }

    const existingLike = reply.likes.find(
      like => like.user.toString() === req.user.id
    );

    if (existingLike) {
      // إلغاء الإعجاب
      reply.likes = reply.likes.filter(
        like => like.user.toString() !== req.user.id
      );
    } else {
      // إضافة إعجاب
      reply.likes.push({ user: req.user.id });

      // إنشاء إشعار: أعجب بردك
      if (post.isShort) {
        // إشعار للشورتس
        const videoMedia = post.media?.find(m => m.type === 'video') || post.media?.[0];
        await createNotification({
          recipient: reply.user,
          sender: req.user.id,
          type: 'short_reply_like',
          post: post._id,
          comment: {
            commentId: comment._id,
            text: comment.text
          },
          reply: {
            replyId: reply._id,
            commentId: comment._id,
            text: reply.text
          },
          metadata: {
            replyText: reply.text ? reply.text.substring(0, 100) : null,
            shortTitle: post.attractiveTitle || post.content?.substring(0, 50) || null,
            shortThumbnail: videoMedia?.thumbnail || post.coverImage?.url || null,
            isShort: true
          }
        });
      } else {
        // إشعار للمنشورات العادية
        await createNotification({
          recipient: reply.user,
          sender: req.user.id,
          type: 'reply_like',
          post: post._id,
          comment: {
            commentId: comment._id,
            text: comment.text
          },
          reply: {
            replyId: reply._id,
            commentId: comment._id,
            text: reply.text
          },
          metadata: {
            replyText: reply.text ? reply.text.substring(0, 100) : null,
            displayPage: post.displayPage
          }
        });
      }
    }

    await post.save();

    res.status(200).json({
      success: true,
      isLiked: !existingLike,
      likesCount: reply.likes.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================
 * إعادة النشر - إشعار: أعاد نشر منشورك
 * ============================================
 */
// @desc    Repost a post
// @route   POST /api/v1/posts/:id/repost
// @access  Private
exports.repostPost = async (req, res, next) => {
  try {
    const { content } = req.body;
    const originalPostId = req.params.id;

    const originalPost = await Post.findById(originalPostId)
      .populate('user', 'name avatar');

    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: 'المنشور الأصلي غير موجود'
      });
    }

    // التحقق من إعداد السماح بإعادة النشر
    if (originalPost.isShort && originalPost.allowRepost === false) {
      return res.status(403).json({
        success: false,
        message: 'إعادة النشر غير مسموح بها على هذا الفيديو'
      });
    }

    // ============================================
    // إعادة نشر الشورتس (مثل تيك توك)
    // لا يتم إنشاء منشور جديد، فقط زيادة العداد لتقوية ظهور الفيديو
    // ============================================
    if (originalPost.isShort) {
      // التحقق من عدم إعادة النشر مسبقاً
      if (!originalPost.repostedBy) {
        originalPost.repostedBy = [];
      }
      
      const alreadyReposted = originalPost.repostedBy.some(
        userId => userId.toString() === req.user.id
      );
      
      if (alreadyReposted) {
        return res.status(400).json({
          success: false,
          message: 'لقد قمت بإعادة نشر هذا الفيديو مسبقاً'
        });
      }
      
      // إضافة المستخدم إلى قائمة من أعادوا النشر
      originalPost.repostedBy.push(req.user.id);
      originalPost.repostsCount = (originalPost.repostsCount || 0) + 1;
      await originalPost.save();
      
      // إنشاء إشعار: أعاد نشر فيديوهك
      const recipientId = originalPost.user._id || originalPost.user;
      if (recipientId) {
        const videoMedia = originalPost.media?.find(m => m.type === 'video') || originalPost.media?.[0];
        await createNotification({
          recipient: recipientId,
          sender: req.user.id,
          type: 'short_repost',
          post: originalPost._id,
          metadata: {
            shortTitle: originalPost.attractiveTitle || originalPost.content?.substring(0, 50) || null,
            shortThumbnail: videoMedia?.thumbnail || originalPost.coverImage?.url || null,
            isShort: true
          }
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'تمت إعادة النشر بنجاح',
        repostsCount: originalPost.repostsCount,
        isReposted: true
      });
    }

    // ============================================
    // إعادة نشر المنشورات العادية (الطريقة التقليدية)
    // ============================================
    const existingRepost = await Post.findOne({
      user: req.user.id,
      originalPost: originalPostId,
      isRepost: true
    });

    if (existingRepost) {
      return res.status(400).json({
        success: false,
        message: 'لقد قمت بإعادة نشر هذا المنشور مسبقاً'
      });
    }

    // المنشورات المعاد نشرها تظهر في الصفحة الرئيسية فقط
    const repost = await Post.create({
      user: req.user.id,
      content: content || '',
      type: 'repost',
      isRepost: true,
      originalPost: originalPostId,
      displayPage: 'home',
      status: 'approved'
    });

    originalPost.repostsCount = (originalPost.repostsCount || 0) + 1;
    await originalPost.save();

    await repost.populate('user', 'name avatar');
    await repost.populate({
      path: 'originalPost',
      populate: {
        path: 'user',
        select: 'name avatar'
      }
    });

    // إنشاء إشعار: أعاد نشر منشورك
    const recipientId = originalPost.user._id || originalPost.user;
    if (recipientId) {
      await createNotification({
        recipient: recipientId,
        sender: req.user.id,
        type: 'repost',
        post: originalPost._id,
        metadata: {
          postContent: originalPost.content ? originalPost.content.substring(0, 100) : null,
          displayPage: originalPost.displayPage
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'تمت إعادة النشر بنجاح',
      post: repost
    });
  } catch (error) {
    console.error('Repost error:', error);
    next(error);
  }
};

// @desc    Undo repost (delete repost)
// @route   DELETE /api/v1/posts/:id/repost
// @access  Private
exports.undoRepost = async (req, res, next) => {
  try {
    const originalPostId = req.params.id;
    const originalPost = await Post.findById(originalPostId);
    
    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    // ============================================
    // إلغاء إعادة نشر الشورتس
    // ============================================
    if (originalPost.isShort) {
      if (!originalPost.repostedBy) {
        originalPost.repostedBy = [];
      }
      
      const hasReposted = originalPost.repostedBy.some(
        userId => userId.toString() === req.user.id
      );
      
      if (!hasReposted) {
        return res.status(404).json({
          success: false,
          message: 'لم تقم بإعادة نشر هذا الفيديو'
        });
      }
      
      // إزالة المستخدم من قائمة من أعادوا النشر
      originalPost.repostedBy = originalPost.repostedBy.filter(
        userId => userId.toString() !== req.user.id
      );
      originalPost.repostsCount = Math.max(0, (originalPost.repostsCount || 1) - 1);
      await originalPost.save();
      
      return res.status(200).json({
        success: true,
        message: 'تم إلغاء إعادة النشر',
        repostsCount: originalPost.repostsCount,
        isReposted: false
      });
    }

    // ============================================
    // إلغاء إعادة نشر المنشورات العادية
    // ============================================
    const repost = await Post.findOne({
      user: req.user.id,
      originalPost: originalPostId,
      isRepost: true
    });

    if (!repost) {
      return res.status(404).json({
        success: false,
        message: 'لم تقم بإعادة نشر هذا المنشور'
      });
    }

    originalPost.repostsCount = Math.max(0, (originalPost.repostsCount || 1) - 1);
    await originalPost.save();

    await repost.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم إلغاء إعادة النشر'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/v1/posts/:id/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    if (comment.user.toString() !== req.user.id && post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بحذف هذا التعليق'
      });
    }

    comment.deleteOne();
    await post.save();

    res.status(200).json({
      success: true,
      message: 'تم حذف التعليق بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete reply
// @route   DELETE /api/v1/posts/:id/comments/:commentId/replies/:replyId
// @access  Private
exports.deleteReply = async (req, res, next) => {
  try {
    const { id, commentId, replyId } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'التعليق غير موجود'
      });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'الرد غير موجود'
      });
    }

    if (reply.user.toString() !== req.user.id && 
        comment.user.toString() !== req.user.id && 
        post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بحذف هذا الرد'
      });
    }

    reply.deleteOne();
    await post.save();

    res.status(200).json({
      success: true,
      message: 'تم حذف الرد بنجاح'
    });
  } catch (error) {
    next(error);
  }
};



// @desc    Get user posts
// @route   GET /api/v1/posts/user/:userId
// @access  Public
exports.getUserPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isShort } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { user: req.params.userId, status: 'approved' };
    if (isShort !== undefined) query.isShort = isShort === 'true';

    const posts = await Post.find(query)
      .populate('user', 'name avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // معالجة المنشورات لإضافة حقول إعدادات الشورتس بشكل صريح
    const postsWithSettings = posts.map(post => {
      const postObj = post.toObject();
      // إذا كان المنشور شورتس، نضيف حقول الإعدادات بشكل صريح
      if (postObj.isShort) {
        // سجل للتدقيق - يمكن حذفه لاحقاً
        console.log('getUserPosts - Short settings from DB:', {
          postId: postObj._id,
          allowComments: postObj.allowComments,
          allowDownloads: postObj.allowDownloads,
          allowRepost: postObj.allowRepost
        });
        
        return {
          ...postObj,
          attractiveTitle: postObj.attractiveTitle || null,
          privacy: postObj.privacy || 'public',
          allowComments: postObj.allowComments !== undefined ? postObj.allowComments : true,
          allowDownloads: postObj.allowDownloads !== undefined ? postObj.allowDownloads : true,
          allowRepost: postObj.allowRepost !== undefined ? postObj.allowRepost : true,
          coverImage: postObj.coverImage || null,
          views: postObj.views || 0
        };
      }
      return postObj;
    });

    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: postsWithSettings.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      posts: postsWithSettings
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Hide post from user's feed
// @route   POST /api/v1/posts/:id/hide
// @access  Private
exports.hidePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    // التحقق من أن المستخدم لم يخفِ المنشور مسبقاً
    const alreadyHidden = post.hiddenBy.some(
      userId => userId.toString() === req.user.id
    );

    if (alreadyHidden) {
      return res.status(400).json({
        success: false,
        message: 'المنشور مخفي بالفعل'
      });
    }

    post.hiddenBy.push(req.user.id);
    await post.save();

    // تحديث تقييم الفيديو وملف اهتمامات المستخدم (للشورتس)
    if (post.isShort) {
      await updateSingleVideoScore(post._id);
      await updateUserInterestProfile(req.user.id, post._id, 'HIDE');
    }

    res.status(200).json({
      success: true,
      message: 'تم إخفاء المنشور'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unhide post from user's feed
// @route   DELETE /api/v1/posts/:id/hide
// @access  Private
exports.unhidePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    post.hiddenBy = post.hiddenBy.filter(
      userId => userId.toString() !== req.user.id
    );
    await post.save();

    res.status(200).json({
      success: true,
      message: 'تم إظهار المنشور'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update job status (open, negotiating, hired)
// @route   PUT /api/v1/posts/:id/job-status
// @access  Private (owner only)
exports.updateJobStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!['open', 'negotiating', 'hired'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صالحة. الحالات المتاحة: open, negotiating, hired'
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    // التحقق من أن المستخدم هو صاحب المنشور
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل هذا المنشور'
      });
    }

    post.jobStatus = status;
    await post.save();

    const statusMessages = {
      'open': 'المنشور مفتوح للتقديم',
      'negotiating': 'قيد المفاوضة',
      'hired': 'تم التوظيف'
    };

    res.status(200).json({
      success: true,
      message: statusMessages[status],
      jobStatus: status
    });
  } catch (error) {
    next(error);
  }
};



// @desc    Increment view count for a short
// @route   POST /api/v1/posts/:id/view
// @access  Public
exports.incrementShortView = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'الفيديو غير موجود'
      });
    }

    if (!post.isShort) {
      return res.status(400).json({
        success: false,
        message: 'هذا ليس فيديو قصير'
      });
    }

    // زيادة عدد المشاهدات
    post.views = (post.views || 0) + 1;
    await post.save();

    // تحديث تقييم الفيديو بعد كل مشاهدة
    await updateSingleVideoScore(post._id);

    res.status(200).json({
      success: true,
      views: post.views
    });
  } catch (error) {
    next(error);
  }
};


// ============================================
// دالة جلب التعليقات
// ============================================

// @desc    Get comments for a post
// @route   GET /api/v1/posts/:id/comments
// @access  Public
exports.getComments = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('comments.user', 'name avatar')
      .populate('comments.likes.user', 'name avatar')
      .populate('comments.replies.user', 'name avatar')
      .populate('comments.replies.likes.user', 'name avatar');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'المنشور غير موجود'
      });
    }

    // تحويل التعليقات لتضمين عدد الإعجابات والردود
    const formattedComments = post.comments.map(comment => {
      const commentObj = comment.toObject();
      return {
        _id: commentObj._id,
        text: commentObj.text,
        user: commentObj.user,
        createdAt: commentObj.createdAt,
        likes: commentObj.likes || [],
        likesCount: commentObj.likes ? commentObj.likes.length : 0,
        repliesCount: commentObj.replies ? commentObj.replies.length : 0,
        replies: (commentObj.replies || []).map(reply => ({
          _id: reply._id,
          text: reply.text,
          user: reply.user,
          createdAt: reply.createdAt,
          likes: reply.likes || [],
          likesCount: reply.likes ? reply.likes.length : 0
        }))
      };
    });

    // ترتيب التعليقات من الأحدث للأقدم
    formattedComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      success: true,
      comments: formattedComments,
      count: formattedComments.length
    });
  } catch (error) {
    next(error);
  }
};


// ============================================
// دالة البحث الشامل
// ============================================

// @desc    Search posts with comprehensive filters
// @route   GET /api/v1/posts/search
// @access  Public
exports.searchPosts = async (req, res, next) => {
  try {
    const {
      q, // نص البحث
      page = 1,
      limit = 20,
      type, // all, job, haraj, general, service
      category,
      country,
      city,
      sortBy = 'relevance' // relevance, newest, oldest
    } = req.query;

    // التحقق من وجود نص البحث
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال نص للبحث'
      });
    }

    const searchText = q.trim();
    
    // تحديث المنشورات المنتهية الصلاحية قبل البحث
    await updateExpiredFeaturedPosts();

    // بناء استعلام البحث الأساسي
    const query = { 
      status: 'approved',
      $or: [
        // البحث في العنوان
        { title: { $regex: searchText, $options: 'i' } },
        // البحث في المحتوى/الوصف
        { content: { $regex: searchText, $options: 'i' } },
        // البحث في الكلمات المفتاحية (الهاشتاجات)
        { hashtags: { $regex: searchText, $options: 'i' } },
        // البحث في التصنيف
        { category: { $regex: searchText, $options: 'i' } },
        // البحث في الموقع
        { location: { $regex: searchText, $options: 'i' } },
        { city: { $regex: searchText, $options: 'i' } },
        { country: { $regex: searchText, $options: 'i' } }
      ]
    };

    // استبعاد المنشورات المخفية من قبل المستخدم الحالي
    if (req.user) {
      query.hiddenBy = { $ne: req.user.id };
    }

    // فلتر حسب نوع المنشور
    if (type && type !== 'all') {
      query.type = type;
    }

    // فلتر حسب التصنيف
    if (category) {
      query.category = category;
    }

    // فلتر حسب الدولة
    if (country) {
      query.country = country;
    }

    // فلتر حسب المدينة
    if (city && city !== 'كل المدن') {
      query.city = city;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // تحديد الترتيب
    let sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'relevance':
      default:
        // الترتيب حسب الأهمية: المميزة أولاً، ثم الأحدث
        sortOptions = { isFeatured: -1, createdAt: -1 };
        break;
    }

    const posts = await Post.find(query)
      .populate('user', 'name avatar isVerified')
      .populate('reactions.user', 'name avatar')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'user',
          select: 'name avatar isVerified'
        }
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // التحقق من صلاحية التمييز في الوقت الفعلي
    const processedPosts = checkFeaturedExpiryBatch(posts);

    const total = await Post.countDocuments(query);

    // إحصائيات البحث حسب النوع
    const typeStats = await Post.aggregate([
      { $match: { ...query, type: { $exists: true } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const stats = {
      all: total,
      job: 0,
      haraj: 0,
      general: 0,
      service: 0
    };

    typeStats.forEach(stat => {
      if (stats.hasOwnProperty(stat._id)) {
        stats[stat._id] = stat.count;
      }
    });

    res.status(200).json({
      success: true,
      query: searchText,
      count: processedPosts.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      stats,
      posts: processedPosts
    });
  } catch (error) {
    console.error('Search Error:', error);
    next(error);
  }
};

// @desc    Get search suggestions based on popular searches and categories
// @route   GET /api/v1/posts/search/suggestions
// @access  Public
exports.getSearchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;

    // الاقتراحات الافتراضية (الأكثر بحثاً)
    const defaultSuggestions = [
      'سائق خاص',
      'طباخ ماهر',
      'محاسب',
      'مصمم جرافيك',
      'سيارة للبيع',
      'شقة للإيجار',
      'خادمة منزلية',
      'مندوب توصيل',
      'مهندس برمجيات',
      'معلم خصوصي'
    ];

    if (!q || q.trim() === '') {
      return res.status(200).json({
        success: true,
        suggestions: defaultSuggestions
      });
    }

    const searchText = q.trim();

    // البحث عن اقتراحات من العناوين والتصنيفات الموجودة
    const titleSuggestions = await Post.find({
      status: 'approved',
      title: { $regex: searchText, $options: 'i' }
    })
    .select('title')
    .limit(5)
    .lean();

    const categorySuggestions = await Post.find({
      status: 'approved',
      category: { $regex: searchText, $options: 'i' }
    })
    .select('category')
    .limit(5)
    .lean();

    // دمج الاقتراحات وإزالة التكرارات
    const suggestions = new Set();
    
    titleSuggestions.forEach(post => {
      if (post.title) suggestions.add(post.title);
    });
    
    categorySuggestions.forEach(post => {
      if (post.category) suggestions.add(post.category);
    });

    // إضافة الاقتراحات الافتراضية المطابقة
    defaultSuggestions.forEach(suggestion => {
      if (suggestion.toLowerCase().includes(searchText.toLowerCase())) {
        suggestions.add(suggestion);
      }
    });

    res.status(200).json({
      success: true,
      query: searchText,
      suggestions: Array.from(suggestions).slice(0, 10)
    });
  } catch (error) {
    console.error('Search Suggestions Error:', error);
    next(error);
  }
};
