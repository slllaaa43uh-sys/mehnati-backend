/**
 * ============================================
 * خدمة التوصية للفيديوهات القصيرة (Shorts)
 * ============================================
 * 
 * هذه الخدمة تعمل بالكامل من الخادم دون الحاجة لأي تعديلات
 * على الواجهة الأمامية. تعتمد على البيانات الموجودة حالياً:
 * - views: عدد المشاهدات
 * - reactions: الإعجابات
 * - comments: التعليقات
 * - shares: المشاركات
 * - hiddenBy: المستخدمون الذين أخفوا الفيديو
 * - following: قائمة المتابعين
 */

const Post = require('../models/Post');
const User = require('../models/User');

// أوزان التفاعلات
const INTERACTION_WEIGHTS = {
  VIEW: 1,           // كل مشاهدة
  LIKE: 3,           // إعجاب
  COMMENT: 8,        // تعليق (تفاعل عميق)
  SHARE: 12,         // مشاركة (أقوى تفاعل)
  HIDE: -15          // إخفاء (مؤشر سلبي قوي)
};

// حدود الترقية بين المستويات
const TIER_THRESHOLDS = {
  0: { minScore: 0, maxViews: 200 },      // اختبار أولي
  1: { minScore: 50, maxViews: 1000 },    // انتشار محدود
  2: { minScore: 300, maxViews: 10000 },  // انتشار متوسط
  3: { minScore: 2000, maxViews: 100000 }, // انتشار واسع
  4: { minScore: 15000, maxViews: Infinity } // فايروسي
};

/**
 * ============================================
 * حساب تقييم الفيديو بناءً على التفاعلات الموجودة
 * ============================================
 */
const calculateVideoScore = (post) => {
  const views = post.views || 0;
  const likes = post.reactions ? post.reactions.length : 0;
  const comments = post.comments ? post.comments.length : 0;
  const shares = post.shares || 0;
  const hides = post.hiddenBy ? post.hiddenBy.length : 0;

  // حساب النقاط الإيجابية
  const positivePoints = 
    (views * INTERACTION_WEIGHTS.VIEW) +
    (likes * INTERACTION_WEIGHTS.LIKE) +
    (comments * INTERACTION_WEIGHTS.COMMENT) +
    (shares * INTERACTION_WEIGHTS.SHARE);

  // حساب النقاط السلبية
  const negativePoints = hides * Math.abs(INTERACTION_WEIGHTS.HIDE);

  // التقييم الأساسي
  let score = positivePoints - negativePoints;

  // معامل نسبة التفاعل (Engagement Rate)
  // كلما زادت نسبة التفاعل مقارنة بالمشاهدات، كلما كان الفيديو أفضل
  if (views > 0) {
    const engagementRate = (likes + comments + shares) / views;
    score = score * (1 + engagementRate);
  }

  // معامل تفضيل الفيديوهات الجديدة (Freshness Boost)
  // الفيديوهات الجديدة تحصل على دفعة إضافية
  const ageInHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  if (ageInHours < 24) {
    score = score * 1.5; // دفعة 50% للفيديوهات الأقل من 24 ساعة
  } else if (ageInHours < 72) {
    score = score * 1.2; // دفعة 20% للفيديوهات الأقل من 3 أيام
  }

  return Math.round(score);
};

/**
 * ============================================
 * تحديد مستوى الانتشار للفيديو
 * ============================================
 */
const calculatePropagationTier = (post, score) => {
  const views = post.views || 0;
  
  // إذا كان الفيديو مخفي من كثير من المستخدمين، خفض مستواه
  const hideRatio = post.hiddenBy ? post.hiddenBy.length / Math.max(views, 1) : 0;
  if (hideRatio > 0.1) { // أكثر من 10% أخفوه
    return -1; // إيقاف الانتشار
  }

  // تحديد المستوى بناءً على التقييم وعدد المشاهدات
  for (let tier = 4; tier >= 0; tier--) {
    const threshold = TIER_THRESHOLDS[tier];
    if (score >= threshold.minScore && views <= threshold.maxViews) {
      return tier;
    }
  }
  
  return 0;
};

/**
 * ============================================
 * مهمة مجدولة لتحديث تقييمات جميع الفيديوهات
 * يجب تشغيلها كل 30 دقيقة أو ساعة
 * ============================================
 */
exports.updateAllScoresCronJob = async () => {
  try {
    const shorts = await Post.find({ isShort: true, status: 'approved' });
    
    let updated = 0;
    for (const short of shorts) {
      const newScore = calculateVideoScore(short);
      const newTier = calculatePropagationTier(short, newScore);
      
      // تحديث فقط إذا تغيرت القيم
      if (short.recommendation.score !== newScore || short.recommendation.propagationTier !== newTier) {
        short.recommendation.score = newScore;
        short.recommendation.propagationTier = newTier;
        short.recommendation.lastTestedAt = new Date();
        
        // تحديث الإحصائيات
        short.recommendation.likeCount = short.reactions ? short.reactions.length : 0;
        short.recommendation.commentCount = short.comments ? short.comments.length : 0;
        short.recommendation.shareCount = short.shares || 0;
        
        await short.save();
        updated++;
      }
    }
    
    console.log(`[RecommendationService] Updated scores for ${updated}/${shorts.length} shorts`);
    return { total: shorts.length, updated };
  } catch (error) {
    console.error('[RecommendationService] Error updating scores:', error);
    throw error;
  }
};

/**
 * ============================================
 * تحديث تقييم فيديو واحد (يُستدعى عند التفاعل)
 * ============================================
 */
exports.updateSingleVideoScore = async (postId) => {
  try {
    const post = await Post.findById(postId);
    if (!post || !post.isShort) return null;

    const newScore = calculateVideoScore(post);
    const newTier = calculatePropagationTier(post, newScore);

    post.recommendation.score = newScore;
    post.recommendation.propagationTier = newTier;
    post.recommendation.lastTestedAt = new Date();
    post.recommendation.likeCount = post.reactions ? post.reactions.length : 0;
    post.recommendation.commentCount = post.comments ? post.comments.length : 0;
    post.recommendation.shareCount = post.shares || 0;

    await post.save();
    return post;
  } catch (error) {
    console.error('[RecommendationService] Error updating single video:', error);
    return null;
  }
};

/**
 * ============================================
 * جلب الفيديوهات الموصى بها (صفحة "لك")
 * ============================================
 */
exports.getRecommendedShorts = async (userId, page = 1, limit = 10) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  let user = null;
  
  if (userId) {
    user = await User.findById(userId);
  }

  // 1. بناء استعلام المرشحين
  const candidateQuery = {
    isShort: true,
    status: 'approved',
    $or: [
      { privacy: 'public' },
      { privacy: { $exists: false } },
      { privacy: null }
    ]
  };

  // استبعاد الفيديوهات المخفية من قبل المستخدم
  if (user) {
    candidateQuery.hiddenBy = { $ne: userId };
    
    // استبعاد صناع المحتوى المخفيين
    if (user.interestProfile && user.interestProfile.hiddenCreators && user.interestProfile.hiddenCreators.length > 0) {
      candidateQuery.user = { $nin: user.interestProfile.hiddenCreators };
    }
  }

  // 2. جلب المرشحين مع حساب التقييم الفوري
  const candidates = await Post.find(candidateQuery)
    .populate('user', 'name avatar isVerified')
    .lean(); // استخدام lean للأداء

  // 3. حساب التقييم والترتيب لكل فيديو
  let rankedShorts = candidates.map(short => {
    // حساب التقييم الفوري
    const score = calculateVideoScore(short);
    
    // حساب درجة التخصيص
    let personalizationScore = 0;
    if (user) {
      // نقاط إضافية للمتابَعين
      if (user.following && user.following.some(f => f.toString() === short.user._id.toString())) {
        personalizationScore += 30;
      }
      
      // نقاط من تفاعل المستخدم مع التصنيف
      if (short.category && user.interestProfile && user.interestProfile.interactedCategories) {
        const categoryScore = user.interestProfile.interactedCategories.get(short.category);
        if (categoryScore) {
          personalizationScore += categoryScore * 2;
        }
      }
      
      // نقاط من تفاعل المستخدم مع صانع المحتوى
      if (user.interestProfile && user.interestProfile.interactedCreators) {
        const creatorScore = user.interestProfile.interactedCreators.get(short.user._id.toString());
        if (creatorScore) {
          personalizationScore += creatorScore * 3;
        }
      }
    }
    
    // الترتيب النهائي: 70% جودة الفيديو + 30% تخصيص
    const finalRank = (score * 0.7) + (personalizationScore * 0.3);
    
    return {
      ...short,
      calculatedScore: score,
      personalizationScore,
      finalRank
    };
  });

  // 4. فرز القائمة بالترتيب النهائي
  rankedShorts.sort((a, b) => b.finalRank - a.finalRank);

  // 5. تطبيق منطق التنوع ومنع الاحتكار
  const finalShorts = [];
  const creatorCount = new Map();
  
  for (const short of rankedShorts) {
    if (finalShorts.length >= parseInt(limit) * 2) break; // جلب ضعف المطلوب للتنوع

    const creatorId = short.user._id.toString();
    const count = creatorCount.get(creatorId) || 0;

    // السماح بظهور فيديوهين كحد أقصى من نفس الصانع
    if (count < 2) {
      finalShorts.push(short);
      creatorCount.set(creatorId, count + 1);
    }
  }

  // 6. تطبيق التصفح (pagination)
  const paginatedShorts = finalShorts.slice(skip, skip + parseInt(limit));

  // 7. تنسيق النتائج للتوافق مع الواجهة الأمامية
  const formattedShorts = paginatedShorts.map(short => ({
    ...short,
    attractiveTitle: short.attractiveTitle || null,
    privacy: short.privacy || 'public',
    allowComments: short.allowComments !== undefined ? short.allowComments : true,
    allowDownloads: short.allowDownloads !== undefined ? short.allowDownloads : true,
    allowRepost: short.allowRepost !== undefined ? short.allowRepost : true,
    coverImage: short.coverImage || null,
    views: short.views || 0
  }));

  const total = await Post.countDocuments(candidateQuery);

  return {
    posts: formattedShorts,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page)
  };
};

/**
 * ============================================
 * تحديث ملف اهتمامات المستخدم عند التفاعل
 * يُستدعى من دوال التفاعل الموجودة (reactToPost, addComment, hidePost)
 * ============================================
 */
exports.updateUserInterestProfile = async (userId, postId, interactionType) => {
  try {
    const user = await User.findById(userId);
    const post = await Post.findById(postId);
    
    if (!user || !post || !post.isShort) return;

    // التأكد من وجود interestProfile
    if (!user.interestProfile) {
      user.interestProfile = {
        interactedCategories: new Map(),
        interactedCreators: new Map(),
        fullyWatchedVideos: [],
        skippedVideos: [],
        hiddenCreators: []
      };
    }

    const creatorId = post.user.toString();
    const category = post.category;

    switch (interactionType) {
      case 'LIKE':
      case 'COMMENT':
      case 'SHARE':
        // زيادة نقاط صانع المحتوى
        const currentCreatorScore = user.interestProfile.interactedCreators.get(creatorId) || 0;
        user.interestProfile.interactedCreators.set(creatorId, currentCreatorScore + 5);
        
        // زيادة نقاط التصنيف
        if (category) {
          const currentCategoryScore = user.interestProfile.interactedCategories.get(category) || 0;
          user.interestProfile.interactedCategories.set(category, currentCategoryScore + 3);
        }
        break;
        
      case 'HIDE':
        // إضافة صانع المحتوى للقائمة السوداء
        if (!user.interestProfile.hiddenCreators.includes(post.user)) {
          user.interestProfile.hiddenCreators.push(post.user);
        }
        
        // تخفيض نقاط صانع المحتوى
        const creatorScore = user.interestProfile.interactedCreators.get(creatorId) || 0;
        user.interestProfile.interactedCreators.set(creatorId, creatorScore - 10);
        break;
    }

    await user.save();
  } catch (error) {
    console.error('[RecommendationService] Error updating user interest profile:', error);
  }
};

/**
 * ============================================
 * جلب الفيديوهات الرائجة (Trending)
 * ============================================
 */
exports.getTrendingShorts = async (limit = 10) => {
  // الفيديوهات الرائجة = أعلى تقييم + أحدث + نسبة تفاعل عالية
  const trendingShorts = await Post.find({
    isShort: true,
    status: 'approved',
    createdAt: { $gte: new Date(Date.now() - 72 * 60 * 60 * 1000) }, // آخر 72 ساعة
    views: { $gte: 100 }, // حد أدنى من المشاهدات
    $or: [
      { privacy: 'public' },
      { privacy: { $exists: false } },
      { privacy: null }
    ]
  })
  .populate('user', 'name avatar isVerified')
  .lean();

  // حساب التقييم وترتيب الترند
  const rankedTrending = trendingShorts.map(short => {
    const score = calculateVideoScore(short);
    const views = short.views || 1;
    const engagementRate = ((short.reactions?.length || 0) + (short.comments?.length || 0) + (short.shares || 0)) / views;
    
    // معامل الترند = التقييم * نسبة التفاعل * معامل الحداثة
    const ageInHours = (Date.now() - new Date(short.createdAt).getTime()) / (1000 * 60 * 60);
    const freshnessMultiplier = Math.max(0.5, 1 - (ageInHours / 72));
    
    const trendScore = score * (1 + engagementRate) * freshnessMultiplier;
    
    return { ...short, trendScore };
  });

  rankedTrending.sort((a, b) => b.trendScore - a.trendScore);

  return rankedTrending.slice(0, limit);
};
