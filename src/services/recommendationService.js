const Post = require('../models/Post');
const User = require('../models/User');

// أوزان التفاعلات
const INTERACTION_WEIGHTS = {
  FULL_WATCH: 5,
  FOLLOW: 20,
  SHARE: 15,
  COMMENT: 10,
  LIKE: 2,
  QUICK_SKIP: -3, // مشاهدة أقل من 3 ثواني
  NOT_INTERESTED: -10,
  PARTIAL_WATCH: 1
};

/**
 * ============================================
 * معالجة تفاعل المشاهدة
 * ============================================
 */
exports.handleWatchInteraction = async (postId, userId, watchTime, videoDuration) => {
  const post = await Post.findById(postId);
  if (!post || !post.isShort) return;

  const user = await User.findById(userId);

  let points = 0;
  const watchPercentage = (watchTime / videoDuration) * 100;

  // 1. حساب النقاط بناءً على مدة المشاهدة
  if (watchTime < 3) {
    points += INTERACTION_WEIGHTS.QUICK_SKIP;
    post.recommendation.skipCount = (post.recommendation.skipCount || 0) + 1;
    if(user) user.interestProfile.skippedVideos.addToSet(postId);
  } else if (watchPercentage >= 95) { // اعتبارها مشاهدة كاملة
    points += INTERACTION_WEIGHTS.FULL_WATCH;
    post.recommendation.fullWatchCount = (post.recommendation.fullWatchCount || 0) + 1;
    if(user) user.interestProfile.fullyWatchedVideos.addToSet(postId);
  } else {
    points += INTERACTION_WEIGHTS.PARTIAL_WATCH;
  }

  post.recommendation.watchTimeTotal = (post.recommendation.watchTimeTotal || 0) + watchTime;
  
  // 2. تحديث نقاط الفيديو
  if (points > 0) {
    post.recommendation.positivePoints = (post.recommendation.positivePoints || 0) + points;
  } else {
    post.recommendation.negativePoints = (post.recommendation.negativePoints || 0) + Math.abs(points);
  }

  // 3. تحديث ملف اهتمامات المستخدم
  if (user && post.category) {
      const currentCategoryScore = user.interestProfile.interactedCategories.get(post.category) || 0;
      user.interestProfile.interactedCategories.set(post.category, currentCategoryScore + (points > 0 ? 1 : -1));
  }
  if (user) {
      const currentCreatorScore = user.interestProfile.interactedCreators.get(post.user.toString()) || 0;
      user.interestProfile.interactedCreators.set(post.user.toString(), currentCreatorScore + (points > 0 ? 1 : -1));
      await user.save();
  }

  await post.save();
  // يتم حساب الـ score النهائي بشكل دوري
};

/**
 * ============================================
 * معالجة التفاعلات الأخرى (لايك، تعليق، الخ)
 * ============================================
 */
exports.handleExplicitInteraction = async (postId, userId, interactionType) => {
    const post = await Post.findById(postId);
    if (!post || !post.isShort) return;

    const user = await User.findById(userId);
    let points = 0;

    switch (interactionType) {
        case 'LIKE':
            points = INTERACTION_WEIGHTS.LIKE;
            post.recommendation.likeCount = (post.recommendation.likeCount || 0) + 1;
            break;
        case 'COMMENT':
            points = INTERACTION_WEIGHTS.COMMENT;
            post.recommendation.commentCount = (post.recommendation.commentCount || 0) + 1;
            break;
        case 'SHARE':
            points = INTERACTION_WEIGHTS.SHARE;
            post.recommendation.shareCount = (post.recommendation.shareCount || 0) + 1;
            break;
        case 'FOLLOW': // يتم استدعاؤها بعد المتابعة مباشرة
            points = INTERACTION_WEIGHTS.FOLLOW;
            post.recommendation.followCount = (post.recommendation.followCount || 0) + 1;
            break;
        case 'NOT_INTERESTED':
            points = INTERACTION_WEIGHTS.NOT_INTERESTED;
            if(user) user.interestProfile.hiddenCreators.addToSet(post.user);
            break;
    }

    if (points > 0) {
        post.recommendation.positivePoints = (post.recommendation.positivePoints || 0) + points;
    } else {
        post.recommendation.negativePoints = (post.recommendation.negativePoints || 0) + Math.abs(points);
    }
    
    // تحديث ملف اهتمامات المستخدم
    if (user && post.category) {
        const currentCategoryScore = user.interestProfile.interactedCategories.get(post.category) || 0;
        user.interestProfile.interactedCategories.set(post.category, currentCategoryScore + 2); // نقاط أعلى للتفاعل الصريح
    }
    if (user) {
        const currentCreatorScore = user.interestProfile.interactedCreators.get(post.user.toString()) || 0;
        user.interestProfile.interactedCreators.set(post.user.toString(), currentCreatorScore + 5);
        await user.save();
    }

    await post.save();
};

/**
 * ============================================
 * مهمة مجدولة لحساب التقييم النهائي
 * ============================================
 */
exports.calculateScoresCronJob = async () => {
    // جلب الفيديوهات التي تحتاج تحديث (مثلاً التي تم التفاعل معها مؤخراً)
    const postsToUpdate = await Post.find({ isShort: true, status: 'approved' });

    for (const post of postsToUpdate) {
        const score = (post.recommendation.positivePoints || 0) - (post.recommendation.negativePoints || 0);
        const wtr = (post.views > 0) ? ((post.recommendation.fullWatchCount || 0) / post.views) : 0;
        const finalScore = score * (1 + wtr);

        post.recommendation.score = finalScore;
        
        // منطق الترقية بين المستويات
        // ... (سيتم إضافته لاحقاً)

        await post.save();
    }
    console.log('Recommendation scores updated for', postsToUpdate.length, 'posts.');
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

    // 1. إنشاء قائمة المرشحين
    const candidateQuery = {
        isShort: true,
        status: 'approved',
        'recommendation.score': { $gt: 50 }, // فلتر أساسي لجودة الفيديو
        'recommendation.propagationTier': { $gt: 0 },
    };

    if (user) {
        // استبعاد الفيديوهات التي شاهدها المستخدم أو أخفاها
        const seenVideos = [...user.interestProfile.fullyWatchedVideos, ...user.interestProfile.skippedVideos];
        candidateQuery._id = { $nin: seenVideos };
        candidateQuery.user = { $nin: user.interestProfile.hiddenCreators };
    }

    const candidates = await Post.find(candidateQuery)
        .sort({ 'recommendation.score': -1 })
        .limit(200) // جلب مجموعة كبيرة للترتيب
        .populate('user', 'name avatar');

    // 2. حساب درجة التخصيص والترتيب النهائي
    let rankedShorts = candidates.map(short => {
        let personalizationScore = 0;
        if (user) {
            // نقاط إضافية للمتابَعين
            if (user.following.includes(short.user._id)) {
                personalizationScore += 20;
            }
            // نقاط من تفاعل المستخدم مع التصنيف
            if (short.category && user.interestProfile.interactedCategories.has(short.category)) {
                personalizationScore += user.interestProfile.interactedCategories.get(short.category);
            }
            // نقاط من تفاعل المستخدم مع صانع المحتوى
            if (user.interestProfile.interactedCreators.has(short.user._id.toString())) {
                personalizationScore += user.interestProfile.interactedCreators.get(short.user._id.toString());
            }
        }
        
        const finalRank = (short.recommendation.score * 0.7) + (personalizationScore * 0.3);
        return { ...short.toObject(), finalRank };
    });

    // 3. فرز القائمة النهائية
    rankedShorts.sort((a, b) => b.finalRank - a.finalRank);

    // 4. تطبيق منطق التنوع ومنع الاحتكار
    const finalShorts = [];
    const creatorCount = new Map();
    for (const short of rankedShorts) {
        if (finalShorts.length >= limit) break;

        const creatorId = short.user._id.toString();
        const count = creatorCount.get(creatorId) || 0;

        if (count < 2) { // السماح بظهور فيديوهين كحد أقصى من نفس الصانع
            finalShorts.push(short);
            creatorCount.set(creatorId, count + 1);
        }
    }
    
    // 5. إضافة عنصر الاستكشاف (إذا لم تكتمل القائمة)
    if (finalShorts.length < limit) {
        const explorationCount = limit - finalShorts.length;
        const explorationShorts = await Post.find({
            ...candidateQuery,
            _id: { $nin: finalShorts.map(s => s._id) } // استبعاد ما تم اختياره بالفعل
        })
        .sort({ createdAt: -1 })
        .limit(explorationCount)
        .populate('user', 'name avatar');
        finalShorts.push(...explorationShorts);
    }

    const total = await Post.countDocuments(candidateQuery);

    return {
        posts: finalShorts.slice(0, limit),
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page)
    };
};
