const Post = require('../models/Post');
const User = require('../models/User');
const { getIO } = require('../config/socket');

// PayTabs payment links mapping
const PAYMENT_LINKS = {
  weekly: 'https://secure.paytabs.sa/payment/link/124497/1788743',
  monthly: 'https://secure.paytabs.sa/payment/link/124497/1788750'
};

// Duration mapping (in milliseconds)
const PROMOTION_DURATIONS = {
  free: 24 * 60 * 60 * 1000,      // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
  monthly: 30 * 24 * 60 * 60 * 1000 // 30 days
};

// @desc    PayTabs Webhook Handler
// @route   POST /api/payment/webhook
// @access  Public (PayTabs only)
exports.paytabsWebhook = async (req, res) => {
  try {
    console.log('📥 PayTabs Webhook received:', JSON.stringify(req.body, null, 2));

    const {
      tran_ref,
      cart_id,
      cart_description,
      cart_currency,
      cart_amount,
      payment_result,
      payment_info
    } = req.body;

    // Verify payment success
    if (payment_result?.response_status !== 'A' || payment_result?.response_code !== '100') {
      console.log('❌ Payment failed or pending:', payment_result);
      
      // Emit failure to frontend via Socket.io
      if (cart_description) {
        const [userId, postId] = cart_description.split('|');
        const io = getIO();
        io.to(userId).emit('payment-status', {
          success: false,
          postId,
          message: payment_result?.response_message || 'فشل الدفع',
          code: payment_result?.response_code
        });
      }

      return res.status(200).json({ received: true });
    }

    // Extract userId and postId from cart_description
    // Expected format: "userId|postId|promotionType"
    if (!cart_description) {
      console.log('⚠️ No cart_description provided');
      return res.status(200).json({ received: true });
    }

    const [userId, postId, promotionType] = cart_description.split('|');

    if (!userId || !postId || !promotionType) {
      console.log('⚠️ Invalid cart_description format');
      return res.status(200).json({ received: true });
    }

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      console.log('⚠️ Post not found:', postId);
      return res.status(200).json({ received: true });
    }

    // Calculate expiry date
    const duration = PROMOTION_DURATIONS[promotionType];
    const expiryDate = new Date(Date.now() + duration);

    // Update post with featured status
    post.isFeatured = true;
    post.featuredUntil = expiryDate;
    post.featuredExpiry = expiryDate;
    post.featuredType = promotionType;
    await post.save();

    console.log(`✅ Post ${postId} promoted successfully (${promotionType}) until ${expiryDate}`);

    // Emit success to frontend via Socket.io
    const io = getIO();
    io.to(userId).emit('payment-status', {
      success: true,
      postId,
      promotionType,
      expiryDate,
      message: 'تم تمييز الإعلان بنجاح'
    });

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ PayTabs Webhook Error:', error);
    res.status(500).json({ received: true, error: error.message });
  }
};

// @desc    Promote a post (free or initiate paid)
// @route   POST /api/payment/promote/:postId
// @access  Private
exports.promotePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { promotionType } = req.body; // 'free', 'weekly', 'monthly'

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'المنشور غير موجود' });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتمييز هذا المنشور' });
    }

    // Handle free promotion
    if (promotionType === 'free') {
      const user = await User.findById(req.user.id);
      
      // Check if 24 hours passed since last free promotion
      if (user.lastFreePromotionUsed) {
        const timeSinceLastPromotion = Date.now() - new Date(user.lastFreePromotionUsed).getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (timeSinceLastPromotion < twentyFourHours) {
          const remainingTime = twentyFourHours - timeSinceLastPromotion;
          const hoursRemaining = Math.ceil(remainingTime / (60 * 60 * 1000));
          
          return res.status(400).json({
            success: false,
            message: `يمكنك استخدام التمييز المجاني بعد ${hoursRemaining} ساعة`,
            remainingHours: hoursRemaining
          });
        }
      }

      // Apply free promotion
      const expiryDate = new Date(Date.now() + PROMOTION_DURATIONS.free);
      post.isFeatured = true;
      post.featuredUntil = expiryDate;
      post.featuredExpiry = expiryDate;
      post.featuredType = 'free';
      await post.save();

      // Update user's last free promotion time
      user.lastFreePromotionUsed = new Date();
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'تم تمييز الإعلان مجاناً لمدة 24 ساعة',
        post,
        expiryDate
      });
    }

    // Handle paid promotion (weekly/monthly)
    if (promotionType === 'weekly' || promotionType === 'monthly') {
      const paymentLink = PAYMENT_LINKS[promotionType];
      
      // Generate cart_description for webhook identification
      const cartDescription = `${req.user.id}|${postId}|${promotionType}`;
      
      // Return payment link to frontend
      return res.status(200).json({
        success: true,
        requiresPayment: true,
        paymentLink,
        cartDescription,
        promotionType,
        message: 'يرجى إكمال عملية الدفع'
      });
    }

    return res.status(400).json({
      success: false,
      message: 'نوع التمييز غير صالح'
    });

  } catch (error) {
    console.error('❌ Promote Post Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// @desc    Get payment link for promotion
// @route   POST /api/payment/get-payment-link
// @access  Private
exports.getPaymentLink = async (req, res) => {
  try {
    const { promotionType, userId } = req.body;

    // Validate promotion type
    if (!promotionType || (promotionType !== 'weekly' && promotionType !== 'monthly')) {
      return res.status(400).json({
        success: false,
        message: 'نوع التمييز غير صالح'
      });
    }

    // Get payment link from mapping
    const paymentLink = PAYMENT_LINKS[promotionType];

    if (!paymentLink) {
      return res.status(500).json({
        success: false,
        message: 'رابط الدفع غير متوفر'
      });
    }

    // Return payment link
    return res.status(200).json({
      success: true,
      paymentLink,
      promotionType,
      message: 'تم الحصول على رابط الدفع بنجاح'
    });

  } catch (error) {
    console.error('❌ Get Payment Link Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// @desc    Check if user can use free promotion
// @route   GET /api/payment/check-free-eligibility
// @access  Private
exports.checkFreePromotionEligibility = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.lastFreePromotionUsed) {
      return res.status(200).json({
        success: true,
        eligible: true,
        message: 'يمكنك استخدام التمييز المجاني'
      });
    }

    const timeSinceLastPromotion = Date.now() - new Date(user.lastFreePromotionUsed).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    if (timeSinceLastPromotion >= twentyFourHours) {
      return res.status(200).json({
        success: true,
        eligible: true,
        message: 'يمكنك استخدام التمييز المجاني'
      });
    }

    const remainingTime = twentyFourHours - timeSinceLastPromotion;
    const hoursRemaining = Math.ceil(remainingTime / (60 * 60 * 1000));

    return res.status(200).json({
      success: true,
      eligible: false,
      remainingHours: hoursRemaining,
      message: `يمكنك استخدام التمييز المجاني بعد ${hoursRemaining} ساعة`
    });

  } catch (error) {
    console.error('❌ Check Eligibility Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};
