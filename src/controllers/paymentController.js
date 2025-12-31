const Post = require('../models/Post');
const User = require('../models/User');
const { getIO } = require('../config/socket');

// Duration mapping (in milliseconds) - جميع الخيارات مجانية الآن
const PROMOTION_DURATIONS = {
  free: 24 * 60 * 60 * 1000,      // 24 ساعة - مجاني
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 أيام - مجاني (السعر القديم: 10 ريال)
  monthly: 30 * 24 * 60 * 60 * 1000 // 30 يوم - مجاني (السعر القديم: 30 ريال)
};

// الأسعار القديمة (للعرض فقط - مشطوبة)
const OLD_PRICES = {
  free: 0,
  weekly: 10,  // 10 ريال - مشطوب
  monthly: 30  // 30 ريال - مشطوب
};

// @desc    Promote a post (ALL FREE NOW)
// @route   POST /api/payment/promote/:postId
// @access  Private
exports.promotePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { promotionType } = req.body; // 'free', 'weekly', 'monthly'

    // Validate promotion type
    if (!promotionType || !PROMOTION_DURATIONS[promotionType]) {
      return res.status(400).json({
        success: false,
        message: 'نوع التمييز غير صالح'
      });
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'المنشور غير موجود' });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتمييز هذا المنشور' });
    }

    // جميع التمييزات مجانية الآن - لا حاجة للتحقق من الدفع
    const expiryDate = new Date(Date.now() + PROMOTION_DURATIONS[promotionType]);
    
    // Update post with featured status
    post.isFeatured = true;
    post.featuredUntil = expiryDate;
    post.featuredExpiry = expiryDate;
    post.featuredType = promotionType;
    await post.save();

    // تحديد الرسالة بناءً على نوع التمييز
    let message = '';
    switch (promotionType) {
      case 'free':
        message = 'تم تمييز الإعلان مجاناً لمدة 24 ساعة';
        break;
      case 'weekly':
        message = 'تم تمييز الإعلان مجاناً لمدة أسبوع';
        break;
      case 'monthly':
        message = 'تم تمييز الإعلان مجاناً لمدة شهر';
        break;
    }

    console.log(`✅ Post ${postId} promoted for FREE (${promotionType}) until ${expiryDate}`);

    return res.status(200).json({
      success: true,
      message,
      post,
      expiryDate,
      promotionType,
      isFree: true,
      oldPrice: OLD_PRICES[promotionType] // السعر القديم للعرض مشطوباً
    });

  } catch (error) {
    console.error('❌ Promote Post Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// @desc    Get promotion options (ALL FREE)
// @route   GET /api/payment/promotion-options
// @access  Public
exports.getPromotionOptions = async (req, res) => {
  try {
    const options = [
      {
        type: 'free',
        duration: '24 ساعة',
        durationMs: PROMOTION_DURATIONS.free,
        price: 0,
        oldPrice: 0,
        isFree: true,
        label: 'مجاني'
      },
      {
        type: 'weekly',
        duration: 'أسبوع',
        durationMs: PROMOTION_DURATIONS.weekly,
        price: 0,
        oldPrice: OLD_PRICES.weekly, // 10 ريال - مشطوب
        isFree: true,
        label: 'مجاني',
        strikePrice: `${OLD_PRICES.weekly} ريال`
      },
      {
        type: 'monthly',
        duration: 'شهر',
        durationMs: PROMOTION_DURATIONS.monthly,
        price: 0,
        oldPrice: OLD_PRICES.monthly, // 30 ريال - مشطوب
        isFree: true,
        label: 'مجاني',
        strikePrice: `${OLD_PRICES.monthly} ريال`
      }
    ];

    return res.status(200).json({
      success: true,
      options,
      message: 'جميع خيارات التمييز مجانية حالياً!'
    });

  } catch (error) {
    console.error('❌ Get Promotion Options Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// @desc    Check if user can use free promotion (ALWAYS ELIGIBLE NOW)
// @route   GET /api/payment/check-free-eligibility
// @access  Private
exports.checkFreePromotionEligibility = async (req, res) => {
  try {
    // جميع المستخدمين مؤهلون للتمييز المجاني الآن
    return res.status(200).json({
      success: true,
      eligible: true,
      message: 'جميع خيارات التمييز مجانية حالياً!'
    });

  } catch (error) {
    console.error('❌ Check Eligibility Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// @desc    PayTabs Webhook Handler (DISABLED - All promotions are free now)
// @route   POST /api/payment/webhook
// @access  Public
exports.paytabsWebhook = async (req, res) => {
  // Webhook معطل - جميع التمييزات مجانية الآن
  console.log('⚠️ PayTabs Webhook received but payments are disabled (all promotions are free)');
  return res.status(200).json({ 
    received: true, 
    message: 'Payments disabled - all promotions are free' 
  });
};

// @desc    Get payment link (DISABLED - returns free promotion instead)
// @route   POST /api/payment/get-payment-link
// @access  Private
exports.getPaymentLink = async (req, res) => {
  // إرجاع رسالة بأن جميع التمييزات مجانية
  return res.status(200).json({
    success: true,
    isFree: true,
    message: 'جميع خيارات التمييز مجانية حالياً! لا حاجة للدفع.'
  });
};
