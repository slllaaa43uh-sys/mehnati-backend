/**
 * ============================================
 * نموذج الوظائف الخارجية - ExternalJob Model
 * ============================================
 * 
 * يُستخدم لحفظ الوظائف المجلوبة من JSearch API
 * مع صور/فيديوهات من Pixabay
 */

const mongoose = require('mongoose');

const externalJobSchema = new mongoose.Schema({
  // معرف الوظيفة من JSearch
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // معلومات الوظيفة الأساسية (بدون ترجمة - كما هي من API)
  title: {
    type: String,
    required: true
  },
  
  description: {
    type: String,
    default: ''
  },

  // معلومات الشركة
  employer: {
    name: { type: String, default: 'غير محدد' },
    logo: { type: String, default: null }, // من JSearch employer_logo
    website: { type: String, default: null }
  },

  // الموقع
  location: {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    isRemote: { type: Boolean, default: false }
  },

  // نوع الوظيفة
  employmentType: {
    type: String,
    enum: ['FULLTIME', 'PARTTIME', 'CONTRACTOR', 'INTERN', 'OTHER'],
    default: 'FULLTIME'
  },

  // الراتب
  salary: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    currency: { type: String, default: 'SAR' },
    period: { type: String, default: 'YEAR' } // YEAR, MONTH, HOUR
  },

  // روابط
  applyLink: {
    type: String,
    required: true
  },

  // الوسائط من Pixabay (URLs فقط - بدون تحميل)
  media: {
    type: {
      type: String,
      enum: ['image', 'video'],
      default: 'image'
    },
    url: { type: String, default: null },
    thumbnail: { type: String, default: null },
    source: { type: String, default: 'pixabay' }
  },

  // تواريخ
  postedAt: {
    type: Date,
    default: Date.now
  },
  
  expiresAt: {
    type: Date,
    default: null
  },

  // حالة الوظيفة
  isActive: {
    type: Boolean,
    default: true
  },

  // إحصائيات
  views: {
    type: Number,
    default: 0
  },

  clicks: {
    type: Number,
    default: 0
  },

  // تصنيفات للبحث
  tags: [{
    type: String
  }],

  // آخر تحديث من Cron
  lastFetchedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true
});

// فهارس للبحث السريع
externalJobSchema.index({ 'location.country': 1 });
externalJobSchema.index({ 'location.city': 1 });
externalJobSchema.index({ employmentType: 1 });
externalJobSchema.index({ isActive: 1 });
externalJobSchema.index({ createdAt: -1 });
externalJobSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('ExternalJob', externalJobSchema);
