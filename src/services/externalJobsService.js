/**
 * ============================================
 * خدمة الوظائف الخارجية - RemoteOK API (مجاني)
 * ============================================
 * 
 * تم التحديث لاستخدام RemoteOK API المجاني
 * بدلاً من JSearch API (الذي انتهت صلاحيته)
 * 
 * RemoteOK API: https://remoteok.com/api
 * - مجاني بالكامل
 * - لا يحتاج مفتاح API
 * - يحتوي على وظائف عن بعد من جميع أنحاء العالم
 */

const axios = require('axios');
const ExternalJob = require('../models/ExternalJob');

// إعدادات RemoteOK API (مجاني - لا يحتاج مفتاح)
const REMOTEOK_CONFIG = {
  BASE_URL: 'https://remoteok.com/api'
};

// إعدادات Arbeitnow API (مجاني - لا يحتاج مفتاح)
const ARBEITNOW_CONFIG = {
  BASE_URL: 'https://www.arbeitnow.com/api/job-board-api'
};

// إعدادات Pixabay API
const PIXABAY_CONFIG = {
  API_KEY: '54217973-0197d2bcb30ad2fbff44689dc',
  BASE_URL: 'https://pixabay.com/api/'
};

// كاش للوسائط لتجنب التكرار
const mediaCache = new Map();

// كاش للوظائف (صالح لمدة 10 دقائق)
let jobsCache = {
  data: [],
  timestamp: 0
};
const CACHE_DURATION = 10 * 60 * 1000; // 10 دقائق

/**
 * جلب الوظائف من RemoteOK API (مجاني)
 */
const fetchFromRemoteOK = async () => {
  try {
    console.log('[RemoteOK] Fetching jobs...');

    const response = await axios.get(REMOTEOK_CONFIG.BASE_URL, {
      headers: {
        'User-Agent': 'Mehnati-App/1.0'
      },
      timeout: 15000
    });

    // RemoteOK يرجع مصفوفة، العنصر الأول هو معلومات قانونية
    const jobs = response.data.slice(1); // تخطي العنصر الأول
    console.log(`[RemoteOK] Fetched ${jobs.length} jobs`);

    return jobs;

  } catch (error) {
    console.error('[RemoteOK] Error fetching jobs:', error.message);
    return [];
  }
};

/**
 * جلب الوظائف من Arbeitnow API (مجاني - احتياطي)
 */
const fetchFromArbeitnow = async () => {
  try {
    console.log('[Arbeitnow] Fetching jobs...');

    const response = await axios.get(ARBEITNOW_CONFIG.BASE_URL, {
      timeout: 15000
    });

    const jobs = response.data.data || [];
    console.log(`[Arbeitnow] Fetched ${jobs.length} jobs`);

    return jobs;

  } catch (error) {
    console.error('[Arbeitnow] Error fetching jobs:', error.message);
    return [];
  }
};

/**
 * جلب صورة من Pixabay
 */
const fetchPixabayImage = async (searchTerm) => {
  try {
    const cacheKey = searchTerm;
    
    if (mediaCache.has(cacheKey)) {
      const cached = mediaCache.get(cacheKey);
      const randomIndex = Math.floor(Math.random() * cached.length);
      return cached[randomIndex];
    }

    const searchTerms = extractSearchTerms(searchTerm);

    const response = await axios.get(PIXABAY_CONFIG.BASE_URL, {
      params: {
        key: PIXABAY_CONFIG.API_KEY,
        q: searchTerms.join('+'),
        lang: 'en',
        image_type: 'photo',
        orientation: 'horizontal',
        safesearch: true,
        per_page: 10
      },
      timeout: 5000
    });

    const hits = response.data?.hits || [];

    if (hits.length === 0) {
      return getDefaultImage();
    }

    const formattedMedia = hits.map(hit => ({
      type: 'image',
      url: hit.largeImageURL || hit.webformatURL,
      thumbnail: hit.previewURL,
      source: 'pixabay'
    }));

    mediaCache.set(cacheKey, formattedMedia);

    const randomIndex = Math.floor(Math.random() * formattedMedia.length);
    return formattedMedia[randomIndex];

  } catch (error) {
    console.error('[Pixabay] Error:', error.message);
    return getDefaultImage();
  }
};

/**
 * صورة افتراضية
 */
const getDefaultImage = () => ({
  type: 'image',
  url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800',
  thumbnail: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=200',
  source: 'default'
});

/**
 * استخراج كلمات البحث من عنوان الوظيفة
 */
const extractSearchTerms = (title) => {
  if (!title) return ['business', 'work'];

  const lowerTitle = title.toLowerCase();

  const searchMappings = {
    'software': ['software', 'coding', 'programming'],
    'developer': ['developer', 'coding', 'computer'],
    'engineer': ['engineer', 'engineering', 'technical'],
    'designer': ['designer', 'creative', 'design'],
    'marketing': ['marketing', 'business', 'advertising'],
    'manager': ['manager', 'business', 'office'],
    'data': ['data', 'analytics', 'computer'],
    'product': ['product', 'business', 'meeting'],
    'sales': ['sales', 'business', 'meeting'],
    'support': ['support', 'customer', 'service'],
    'writer': ['writer', 'content', 'creative'],
    'analyst': ['analyst', 'business', 'charts']
  };

  for (const [keyword, terms] of Object.entries(searchMappings)) {
    if (lowerTitle.includes(keyword)) {
      return terms;
    }
  }

  return ['business', 'professional', 'work'];
};

/**
 * تحويل بيانات RemoteOK إلى صيغة ExternalJob
 */
const formatRemoteOKJob = (job, media) => {
  return {
    jobId: job.id || job.slug || `remoteok-${Date.now()}-${Math.random()}`,
    title: job.position || 'وظيفة عن بعد',
    description: job.description || '',
    employer: {
      name: job.company || 'شركة عالمية',
      logo: job.company_logo || null,
      website: job.url || null
    },
    location: {
      city: '',
      state: '',
      country: job.location || 'Remote',
      isRemote: true
    },
    employmentType: 'FULLTIME',
    salary: {
      min: job.salary_min || null,
      max: job.salary_max || null,
      currency: 'USD',
      period: 'YEAR'
    },
    applyLink: job.url || job.apply_url || `https://remoteok.com/remote-jobs/${job.slug}`,
    media: media || getDefaultImage(),
    postedAt: job.date ? new Date(job.date) : new Date(),
    expiresAt: null,
    isActive: true,
    tags: job.tags || [],
    lastFetchedAt: new Date(),
    source: 'remoteok'
  };
};

/**
 * تحويل بيانات Arbeitnow إلى صيغة ExternalJob
 */
const formatArbeitnowJob = (job, media) => {
  return {
    jobId: job.slug || `arbeitnow-${Date.now()}-${Math.random()}`,
    title: job.title || 'وظيفة',
    description: job.description || '',
    employer: {
      name: job.company_name || 'شركة',
      logo: null,
      website: job.url || null
    },
    location: {
      city: job.location || '',
      state: '',
      country: 'Germany',
      isRemote: job.remote || false
    },
    employmentType: 'FULLTIME',
    salary: {
      min: null,
      max: null,
      currency: 'EUR',
      period: 'YEAR'
    },
    applyLink: job.url || `https://www.arbeitnow.com/view/${job.slug}`,
    media: media || getDefaultImage(),
    postedAt: job.created_at ? new Date(job.created_at * 1000) : new Date(),
    expiresAt: null,
    isActive: true,
    tags: job.tags || [],
    lastFetchedAt: new Date(),
    source: 'arbeitnow'
  };
};

/**
 * ============================================
 * 🚀 الدالة الرئيسية - جلب مباشر وتخزين
 * ============================================
 */
exports.getJobsLive = async (params = {}) => {
  try {
    const {
      page = 1,
      limit = 10
    } = params;

    console.log(`[ExternalJobsService] Live fetch - page: ${page}`);

    const now = Date.now();
    const cacheValid = (now - jobsCache.timestamp) < CACHE_DURATION && jobsCache.data.length > 0;

    let allJobs = [];

    if (cacheValid) {
      console.log('[ExternalJobsService] Using cached jobs');
      allJobs = jobsCache.data;
    } else {
      // جلب من RemoteOK أولاً
      let remoteOKJobs = await fetchFromRemoteOK();
      
      // إذا فشل RemoteOK، جلب من Arbeitnow
      if (remoteOKJobs.length === 0) {
        console.log('[ExternalJobsService] RemoteOK failed, trying Arbeitnow...');
        const arbeitnowJobs = await fetchFromArbeitnow();
        
        if (arbeitnowJobs.length > 0) {
          // تحويل وظائف Arbeitnow
          const formattedJobs = await Promise.all(
            arbeitnowJobs.slice(0, 30).map(async (job) => {
              const media = await fetchPixabayImage(job.title);
              const formatted = formatArbeitnowJob(job, media);
              
              // حفظ في قاعدة البيانات
              saveJobToDatabase(formatted).catch(() => {});
              
              return formatted;
            })
          );
          allJobs = formattedJobs;
        }
      } else {
        // تحويل وظائف RemoteOK
        const formattedJobs = await Promise.all(
          remoteOKJobs.slice(0, 30).map(async (job) => {
            const media = await fetchPixabayImage(job.position);
            const formatted = formatRemoteOKJob(job, media);
            
            // حفظ في قاعدة البيانات
            saveJobToDatabase(formatted).catch(() => {});
            
            return formatted;
          })
        );
        allJobs = formattedJobs;
      }

      // إذا فشل كل شيء، جلب من قاعدة البيانات
      if (allJobs.length === 0) {
        console.log('[ExternalJobsService] All APIs failed, fetching from database');
        const dbJobs = await ExternalJob.find({ isActive: true })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
        allJobs = dbJobs;
      }

      // تحديث الكاش
      if (allJobs.length > 0) {
        jobsCache = {
          data: allJobs,
          timestamp: now
        };
        console.log(`[ExternalJobsService] Cached ${allJobs.length} jobs`);
      }
    }

    // تطبيق الـ pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedJobs = allJobs.slice(startIndex, endIndex);

    return {
      success: true,
      jobs: paginatedJobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allJobs.length,
        totalPages: Math.ceil(allJobs.length / parseInt(limit))
      }
    };

  } catch (error) {
    console.error('[ExternalJobsService] Error in getJobsLive:', error.message);
    
    // Fallback: جلب من قاعدة البيانات
    try {
      const dbJobs = await ExternalJob.find({ isActive: true })
        .sort({ createdAt: -1 })
        .skip((parseInt(params.page || 1) - 1) * parseInt(params.limit || 10))
        .limit(parseInt(params.limit || 10))
        .lean();

      const total = await ExternalJob.countDocuments({ isActive: true });

      return {
        success: true,
        jobs: dbJobs,
        pagination: {
          page: parseInt(params.page || 1),
          limit: parseInt(params.limit || 10),
          total,
          totalPages: Math.ceil(total / parseInt(params.limit || 10))
        },
        source: 'database'
      };
    } catch (dbError) {
      console.error('[ExternalJobsService] Database fallback failed:', dbError.message);
      return {
        success: false,
        jobs: [],
        message: 'حدث خطأ أثناء جلب الوظائف'
      };
    }
  }
};

/**
 * حفظ وظيفة في قاعدة البيانات
 */
const saveJobToDatabase = async (formattedJob) => {
  try {
    const existingJob = await ExternalJob.findOne({ jobId: formattedJob.jobId });

    if (existingJob) {
      await ExternalJob.updateOne(
        { jobId: formattedJob.jobId },
        { $set: { ...formattedJob, lastFetchedAt: new Date() } }
      );
    } else {
      await ExternalJob.create(formattedJob);
    }
  } catch (error) {
    if (error.code !== 11000) {
      console.error('[DB] Error saving job:', error.message);
    }
  }
};

/**
 * جلب الوظائف من قاعدة البيانات فقط
 */
exports.getJobs = async (params = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      country,
      city,
      employmentType,
      isRemote,
      search
    } = params;

    const query = { isActive: true };

    if (country) query['location.country'] = new RegExp(country, 'i');
    if (city) query['location.city'] = new RegExp(city, 'i');
    if (employmentType) query.employmentType = employmentType;
    if (isRemote !== undefined) query['location.isRemote'] = isRemote === 'true';
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      ExternalJob.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ExternalJob.countDocuments(query)
    ]);

    return {
      success: true,
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    };

  } catch (error) {
    console.error('[ExternalJobsService] Error in getJobs:', error.message);
    throw error;
  }
};

/**
 * جلب وظيفة واحدة بالمعرف
 */
exports.getJobById = async (jobId) => {
  try {
    const job = await ExternalJob.findOne({ jobId }).lean();
    
    if (!job) {
      return { success: false, message: 'الوظيفة غير موجودة' };
    }

    await ExternalJob.updateOne({ jobId }, { $inc: { views: 1 } });

    return { success: true, job };

  } catch (error) {
    console.error('[ExternalJobsService] Error in getJobById:', error.message);
    throw error;
  }
};

/**
 * تسجيل نقرة على رابط التقديم
 */
exports.recordClick = async (jobId) => {
  try {
    await ExternalJob.updateOne({ jobId }, { $inc: { clicks: 1 } });
    return { success: true };
  } catch (error) {
    console.error('[ExternalJobsService] Error in recordClick:', error.message);
    throw error;
  }
};

/**
 * جلب الوظائف وحفظها (للـ Cron Job)
 */
exports.fetchAndSaveJobs = async () => {
  try {
    console.log('[ExternalJobsService] Cron: Starting job fetch...');
    
    const remoteOKJobs = await fetchFromRemoteOK();

    if (!remoteOKJobs || remoteOKJobs.length === 0) {
      console.log('[ExternalJobsService] No jobs found');
      return { success: true, count: 0 };
    }

    let savedCount = 0;

    for (let i = 0; i < Math.min(remoteOKJobs.length, 50); i++) {
      try {
        const media = await fetchPixabayImage(remoteOKJobs[i].position);
        const formattedJob = formatRemoteOKJob(remoteOKJobs[i], media);
        await saveJobToDatabase(formattedJob);
        savedCount++;
      } catch (err) {
        // تجاهل الأخطاء الفردية
      }
    }

    console.log(`[ExternalJobsService] Cron: Saved ${savedCount} jobs`);
    return { success: true, count: savedCount, newJobs: savedCount, updatedJobs: 0 };

  } catch (error) {
    console.error('[ExternalJobsService] Cron Error:', error.message);
    throw error;
  }
};

/**
 * حذف الوظائف القديمة
 */
exports.cleanupOldJobs = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await ExternalJob.deleteMany({
      createdAt: { $lt: thirtyDaysAgo }
    });

    console.log(`[ExternalJobsService] Cleaned up ${result.deletedCount} old jobs`);
    return { success: true, deletedCount: result.deletedCount };

  } catch (error) {
    console.error('[ExternalJobsService] Error in cleanupOldJobs:', error.message);
    throw error;
  }
};

/**
 * إحصائيات الوظائف
 */
exports.getStats = async () => {
  try {
    const [total, active, withVideo, withImage] = await Promise.all([
      ExternalJob.countDocuments(),
      ExternalJob.countDocuments({ isActive: true }),
      ExternalJob.countDocuments({ 'media.type': 'video' }),
      ExternalJob.countDocuments({ 'media.type': 'image' })
    ]);

    return {
      success: true,
      stats: {
        total,
        active,
        withVideo,
        withImage,
        videoRatio: total > 0 ? ((withVideo / total) * 100).toFixed(1) + '%' : '0%'
      }
    };

  } catch (error) {
    console.error('[ExternalJobsService] Error in getStats:', error.message);
    throw error;
  }
};

/**
 * مسح الكاش
 */
exports.clearCache = () => {
  jobsCache = { data: [], timestamp: 0 };
  mediaCache.clear();
  console.log('[ExternalJobsService] Cache cleared');
};
