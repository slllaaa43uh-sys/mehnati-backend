const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // المحتوى الأساسي
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'العنوان يجب أن لا يتجاوز 200 حرف']
  },
  content: {
    type: String,
    default: '',
    maxlength: [5000, 'المحتوى يجب أن لا يتجاوز 5000 حرف']
  },
  
  // الوسائط (صور/فيديوهات)
  media: [{
    url: String,
    publicId: String, // Cloudinary public ID for deletion
    type: {
      type: String,
      enum: ['image', 'video']
    },
    thumbnail: String // للفيديوهات
  }],
  
  // نوع المنشور
  type: {
    type: String,
    enum: ['general', 'job', 'haraj', 'service', 'repost'],
    default: 'general'
  },
  
  // إعادة النشر (Repost)
  isRepost: {
    type: Boolean,
    default: false
  },
  originalPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  
  // التصنيف
  category: {
    type: String,
    default: null
  },
  
  // نطاق النشر (عالمي أو محلي)
  scope: {
    type: String,
    enum: ['global', 'local'],
    default: 'global'
  },
  
  // الموقع الجغرافي (للمنشورات المحلية)
  country: {
    type: String,
    default: null
  },
  city: {
    type: String,
    default: null
  },
  location: {
    type: String,
    default: null
  },
  
  // معلومات التواصل
  contactEmail: {
    type: String,
    default: null
  },
  contactPhone: {
    type: String,
    default: null
  },
  contactMethods: [{
    type: String,
    enum: ['email', 'phone', 'whatsapp', 'chat', 'واتساب', 'اتصال', 'بريد إلكتروني']
  }],
  
  // تمييز الإعلان
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredUntil: {
    type: Date,
    default: null
  },
  
  // صفحة الظهور
  displayPage: {
    type: String,
    enum: ['home', 'jobs', 'haraj', 'all'],
    default: 'home'
  },
  
  // هل هو فيديو قصير (Short)
  isShort: {
    type: Boolean,
    default: false
  },
  
  // ============================================
  // إعدادات الشورتس (Shorts Settings)
  // ============================================
  
  // عنوان جذاب للشورتس
  attractiveTitle: {
    type: String,
    trim: true,
    maxlength: [150, 'العنوان الجذاب يجب أن لا يتجاوز 150 حرف'],
    default: null
  },
  
  // إعدادات الخصوصية للشورتس
  privacy: {
    type: String,
    enum: ['public', 'private', 'friends'],
    default: 'public'
  },
  
  // السماح بالتعليقات
  allowComments: {
    type: Boolean,
    default: true
  },
  
  // السماح بالتنزيلات
  allowDownloads: {
    type: Boolean,
    default: true
  },
  
  // السماح بإعادة النشر/الدويت
  allowRepost: {
    type: Boolean,
    default: true
  },
  
  // غلاف الفيديو (صورة مصغرة مخصصة)
  coverImage: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    }
  },
  
  // ============================================
  // نهاية إعدادات الشورتس
  // ============================================
  
    // ============================================
  // قسم التوصية والانتشار (Recommendation & Propagation)
  // ============================================
  recommendation: {
    score: { type: Number, default: 0, index: true }, // التقييم الحالي للفيديو
    positivePoints: { type: Number, default: 0 },
    negativePoints: { type: Number, default: 0 },
    watchTimeTotal: { type: Number, default: 0 },
    fullWatchCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    followCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    skipCount: { type: Number, default: 0 },
    propagationTier: { type: Number, default: 0, index: true },
    lastTestedAt: { type: Date, default: Date.now }
  },

  videoDuration: { type: Number, default: 0 },

  // حالة التوظيف (للوظائف)
  jobStatus: {
    type: String,
    enum: ['open', 'negotiating', 'hired'],
    default: 'open'
  },
  
  // المستخدمون الذين أخفوا هذا المنشور
  hiddenBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // التفاعلات
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
      default: 'like'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // التعليقات
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: {
      type: String,
      required: true,
      maxlength: 1000
    },
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      text: String,
      likes: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }],
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // المشاركات
  shares: {
    type: Number,
    default: 0
  },
  
  // عدد إعادات النشر
  repostsCount: {
    type: Number,
    default: 0
  },
  
  // قائمة المستخدمين الذين أعادوا نشر الشورتس (للفيديوهات القصيرة فقط)
  repostedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // المشاهدات
  views: {
    type: Number,
    default: 0
  },
  
  // حالة المنشور
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'archived'],
    default: 'approved'
  },
  
  // سبب الرفض (إن وجد)
  rejectionReason: {
    type: String,
    default: null
  },
  
  // تاريخ انتهاء الإعلان
  expiresAt: {
    type: Date,
    default: null
  },
  
  // السعر (للحراج والخدمات)
  price: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'SAR'
  },
  
  // معلومات إضافية للوظائف
  jobDetails: {
    salary: String,
    salaryType: {
      type: String,
      enum: ['monthly', 'yearly', 'hourly', 'negotiable']
    },
    experience: String,
    jobType: {
      type: String,
      enum: ['full-time', 'part-time', 'remote', 'contract', 'freelance']
    },
    requirements: [String]
  }
  
}, {
  timestamps: true
});

// Indexes for better query performance
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ type: 1, createdAt: -1 });
postSchema.index({ category: 1 });
postSchema.index({ scope: 1, country: 1, city: 1 });
postSchema.index({ isFeatured: 1, createdAt: -1 });
postSchema.index({ displayPage: 1, createdAt: -1 });
postSchema.index({ isShort: 1, createdAt: -1 });
postSchema.index({ status: 1 });
postSchema.index({ originalPost: 1 }); // Index for reposts
postSchema.index({ privacy: 1 }); // Index for privacy filtering
postSchema.index({ isShort: 1, privacy: 1, createdAt: -1 }); // Compound index for shorts with privacy

// Virtual for likes count
postSchema.virtual('likesCount').get(function() {
  return this.reactions ? this.reactions.length : 0;
});

// Virtual for comments count
postSchema.virtual('commentsCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Ensure virtuals are included in JSON
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);
