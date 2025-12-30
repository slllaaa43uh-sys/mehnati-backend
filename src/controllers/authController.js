const User = require('../models/User');
const crypto = require('crypto');
const sendEmail = require('../config/email');
const { isDisposableEmail } = require('../utils/disposableEmails');

// أيقونة التطبيق SVG (الحقيبة) - مرسومة بـ CSS/SVG
const getAppLogoSVG = () => `
<img src="https://mehnati-backend.onrender.com/assets/app-logo.jpg" alt="مهنتي لي" style="width: 80px; height: 80px; border-radius: 18px; object-fit: cover;">
`;

// قالب البريد الإلكتروني الأساسي
const getEmailTemplate = (title, subtitle, userName, content, footerText) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; text-align: center;">
      <div style="display: inline-block; margin-bottom: 15px;">
        ${getAppLogoSVG()}
      </div>
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">${title}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">${subtitle}</p>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">مرحباً ${userName}،</h2>
      ${content}
    </div>
    <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} مهنتي لي. جميع الحقوق محفوظة.
      </p>
      ${footerText ? `<p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0 0;">${footerText}</p>` : ''}
    </div>
  </div>
</body>
</html>
`;

// @desc    Register user (Step 1: Create user and send verification code)
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    // استقبال جميع الحقول من الواجهة الأمامية
    const { name, email, password, accountType, userType, country, phone } = req.body;

    // Check if email is from a disposable/temporary email service
    if (isDisposableEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن استخدام البريد الإلكتروني المؤقت. يرجى استخدام بريد إلكتروني حقيقي'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists but email not verified, allow re-registration
      if (!existingUser.isEmailVerified) {
        // Delete the unverified user to allow new registration
        await User.findByIdAndDelete(existingUser._id);
      } else {
        return res.status(400).json({
          success: false,
          message: 'البريد الإلكتروني مستخدم بالفعل'
        });
      }
    }

    // تحديد نوع الحساب - الواجهة الأمامية ترسل userType أو accountType
    const finalAccountType = userType || accountType || 'person';
    // تحويل 'individual' إلى 'person' للتوافق مع النموذج
    const mappedAccountType = finalAccountType === 'individual' ? 'person' : finalAccountType;

    // Create user (not verified yet)
    const user = await User.create({
      name,
      email,
      password,
      accountType: mappedAccountType,
      country: country || null,
      phone: phone || null,
      isEmailVerified: false
    });

    // Generate verification code
    const verificationCode = user.getEmailVerificationCode();
    await user.save({ validateBeforeSave: false });

    // Email content for verification
    const emailContent = `
      <p style="color: #6b7280; line-height: 1.8; margin: 0 0 25px 0;">
        شكراً لتسجيلك في مهنتي لي! استخدم الرمز التالي لتأكيد بريدك الإلكتروني:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; padding: 20px 40px; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
          ${verificationCode}
        </div>
      </div>
      <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0;">
        هذا الرمز صالح لمدة 10 دقائق فقط. إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد.
      </p>
    `;

    const htmlMessage = getEmailTemplate(
      'مهنتي لي',
      'تأكيد البريد الإلكتروني',
      user.name,
      emailContent,
      null
    );

    try {
      await sendEmail({
        email: user.email,
        subject: 'رمز التحقق - مهنتي لي',
        html: htmlMessage
      });

      res.status(200).json({
        success: true,
        message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
        userId: user._id
      });
    } catch (err) {
      console.error('Email error:', err);
      // Delete user if email fails
      await User.findByIdAndDelete(user._id);

      return res.status(500).json({
        success: false,
        message: 'فشل في إرسال رمز التحقق. يرجى المحاولة لاحقاً'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email with code (Step 2: Complete registration)
// @route   POST /api/v1/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رمز التحقق'
      });
    }

    // Hash the provided code
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    // Find user with matching code and not expired
    const user = await User.findOne({
      _id: userId,
      emailVerificationCode: hashedCode,
      emailVerificationExpire: { $gt: Date.now() }
    }).select('+emailVerificationCode +emailVerificationExpire');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح أو منتهي الصلاحية'
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    // Generate token for auto-login
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: 'تم تأكيد البريد الإلكتروني بنجاح',
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        accountType: user.accountType
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend verification code
// @route   POST /api/v1/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'معرف المستخدم مطلوب'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مؤكد بالفعل'
      });
    }

    // Generate new verification code
    const verificationCode = user.getEmailVerificationCode();
    await user.save({ validateBeforeSave: false });

    // Email content
    const emailContent = `
      <p style="color: #6b7280; line-height: 1.8; margin: 0 0 25px 0;">
        إليك رمز التحقق الجديد:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; padding: 20px 40px; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
          ${verificationCode}
        </div>
      </div>
      <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0;">
        هذا الرمز صالح لمدة 10 دقائق فقط.
      </p>
    `;

    const htmlMessage = getEmailTemplate(
      'مهنتي لي',
      'رمز التحقق الجديد',
      user.name,
      emailContent,
      null
    );

    try {
      await sendEmail({
        email: user.email,
        subject: 'رمز التحقق الجديد - مهنتي لي',
        html: htmlMessage
      });

      res.status(200).json({
        success: true,
        message: 'تم إرسال رمز التحقق الجديد'
      });
    } catch (err) {
      console.error('Email error:', err);
      return res.status(500).json({
        success: false,
        message: 'فشل في إرسال رمز التحقق. يرجى المحاولة لاحقاً'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'يرجى تأكيد بريدك الإلكتروني أولاً',
        requireVerification: true,
        userId: user._id
      });
    }

    // Check if account is deleted
    if (user.isDeleted) {
      return res.status(403).json({
        success: false,
        message: 'تم حذف حسابك ولا يمكنك الدخول إليه مرة أخرى'
      });
    }

    // Check if account is deactivated
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'حسابك معطل. يرجى التواصل مع الدعم'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    // Generate token
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        accountType: user.accountType,
        followersCount: user.followers.length,
        followingCount: user.following.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('followers', 'name avatar')
      .populate('following', 'name avatar');

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        phone: user.phone,
        country: user.country,
        city: user.city,
        accountType: user.accountType,
        isVerified: user.isVerified,
        isEmailVerified: user.isEmailVerified,
        followers: user.followers,
        following: user.following,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        sections: user.sections,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'تم تسجيل الخروج بنجاح'
  });
};

// @desc    Forgot password - Send reset email
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'لا يوجد مستخدم بهذا البريد الإلكتروني'
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset URL - Server URL (صفحة إعادة التعيين على الخادم)
    const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${serverUrl}/reset-password/${resetToken}`;

    // Email content for password reset
    const emailContent = `
      <p style="color: #6b7280; line-height: 1.8; margin: 0 0 25px 0;">
        لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لإنشاء كلمة مرور جديدة.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 12px; font-weight: bold; font-size: 16px;">
          إعادة تعيين كلمة المرور
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0;">
        إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني. سينتهي صلاحية هذا الرابط خلال 30 دقيقة.
      </p>
    `;

    const htmlMessage = getEmailTemplate(
      'مهنتي لي',
      'إعادة تعيين كلمة المرور',
      user.name,
      emailContent,
      null
    );

    try {
      await sendEmail({
        email: user.email,
        subject: 'إعادة تعيين كلمة المرور - مهنتي لي',
        html: htmlMessage
      });

      res.status(200).json({
        success: true,
        message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
      });
    } catch (err) {
      console.error('Email error:', err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'فشل في إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية'
      });
    }

    // Validate new password
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    // Generate token for auto-login
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: 'تم تحديث كلمة المرور بنجاح',
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        accountType: user.accountType
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify reset token (check if valid before showing reset form)
// @route   GET /api/v1/auth/verifyresettoken/:resettoken
// @access  Public
exports.verifyResetToken = async (req, res, next) => {
  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية'
      });
    }

    res.status(200).json({
      success: true,
      message: 'رابط إعادة التعيين صالح'
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Detect user country from IP address
// @route   GET /api/v1/auth/detect-country
// @access  Public
exports.detectCountry = async (req, res, next) => {
  try {
    // الحصول على عنوان IP الحقيقي للمستخدم
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               req.ip;

    // تنظيف عنوان IP (إزالة ::ffff: للـ IPv6)
    const cleanIP = ip?.replace(/^::ffff:/, '');

    // إذا كان IP محلي (localhost)، أرجع null
    if (!cleanIP || cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP === 'localhost') {
      return res.status(200).json({
        success: true,
        country: null,
        countryAr: null,
        message: 'لا يمكن تحديد الدولة من عنوان IP محلي'
      });
    }

    // استخدام خدمة ip-api.com المجانية (لا تحتاج مفتاح API)
    // Node.js 18+ يدعم fetch الأصلي
    const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=status,country,countryCode`);
    const data = await response.json();

    if (data.status !== 'success') {
      return res.status(200).json({
        success: true,
        country: null,
        countryAr: null,
        message: 'لم يتم العثور على معلومات الدولة'
      });
    }

    // خريطة تحويل أسماء الدول من الإنجليزية إلى العربية
    const countryMap = {
      'Saudi Arabia': 'السعودية',
      'United Arab Emirates': 'الإمارات',
      'Egypt': 'مصر',
      'Jordan': 'الأردن',
      'Kuwait': 'الكويت',
      'Qatar': 'قطر',
      'Bahrain': 'البحرين',
      'Oman': 'عمان',
      'Iraq': 'العراق',
      'Syria': 'سوريا',
      'Lebanon': 'لبنان',
      'Palestine': 'فلسطين',
      'Yemen': 'اليمن',
      'Libya': 'ليبيا',
      'Tunisia': 'تونس',
      'Algeria': 'الجزائر',
      'Morocco': 'المغرب',
      'Sudan': 'السودان',
      'Somalia': 'الصومال',
      'Mauritania': 'موريتانيا',
      'Djibouti': 'جيبوتي',
      'Comoros': 'جزر القمر'
    };

    const countryAr = countryMap[data.country] || null;

    res.status(200).json({
      success: true,
      country: data.country,
      countryCode: data.countryCode,
      countryAr: countryAr,
      isArabCountry: !!countryAr
    });

  } catch (error) {
    console.error('Error detecting country:', error);
    res.status(200).json({
      success: true,
      country: null,
      countryAr: null,
      message: 'حدث خطأ في تحديد الدولة'
    });
  }
};
