/**
 * ============================================
 * خدمة الوظائف الخارجية - JSearch API + Pixabay
 * ============================================
 * 
 * التدفق:
 * 1. الواجهة الأمامية تطلب الوظائف
 * 2. الخادم يجلب من JSearch API ويخزن في MongoDB
 * 3. قاعدة البيانات ترجع الوظائف للواجهة الأمامية
 */

const axios = require('axios');
const ExternalJob = require('../models/ExternalJob');

// إعدادات JSearch API (RapidAPI)
const JSEARCH_CONFIG = {
  API_KEY: '6cf9c963f3mshd4aa12f20166a85p1bbe51jsn6acfedd8259a',
  HOST: 'jsearch.p.rapidapi.com',
  BASE_URL: 'https://jsearch.p.rapidapi.com/search'
};

// إعدادات Pixabay API
const PIXABAY_CONFIG = {
  API_KEY: '54217973-0197d2bcb30ad2fbff44689dc',
  BASE_URL: 'https://pixabay.com/api/'
};

// كاش للوسائط
const mediaCache = new Map();

// متغير لتتبع آخر جلب (لتجنب الطلبات المتكررة)
let lastFetchTime = 0;
const FETCH_COOLDOWN = 5 * 60 * 1000; // 5 دقائق

/**
 * جلب الوظائف من JSearch API
 */
const fetchFromJSearch = async (query = 'وظائف في السعودية', page = 1, numPages = 1) => {
  try {
    console.log('[JSearch] Fetching jobs with query:', query);

    const response = await axios.get(JSEARCH_CONFIG.BASE_URL, {
      headers: {
        'X-RapidAPI-Key': JSEARCH_CONFIG.API_KEY,
        'X-RapidAPI-Host': JSEARCH_CONFIG.HOST
      },
      params: {
        query: query,
        page: page.toString(),
        num_pages: numPages.toString(),
        date_posted: 'all'
      },
      timeout: 30000
    });

    const jobs = response.data?.data || [];
    console.log(`[JSearch] Fetched ${jobs.length} jobs from API`);

    return jobs;

  } catch (error) {
    console.error('[JSearch] Error fetching jobs:', error.message);
    if (error.response) {
      console.error('[JSearch] Response status:', error.response.status);
    }
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
 * استخراج كلمات البحث
 */
const extractSearchTerms = (title) => {
  if (!title) return ['business', 'work'];

  const lowerTitle = title.toLowerCase();

  const searchMappings = {
    'software': ['software', 'coding', 'programming'],
    'developer': ['developer', 'coding', 'computer'],
    'engineer': ['engineer', 'engineering', 'technical'],
    'manager': ['manager', 'business', 'office'],
    'sales': ['sales', 'business', 'meeting'],
    'marketing': ['marketing', 'business', 'advertising'],
    'driver': ['driver', 'driving', 'car'],
    'nurse': ['nurse', 'healthcare', 'medical'],
    'doctor': ['doctor', 'medical', 'healthcare'],
    'teacher': ['teacher', 'education', 'classroom'],
    'accountant': ['accountant', 'finance', 'office'],
    'chef': ['chef', 'cooking', 'kitchen'],
    'designer': ['designer', 'creative', 'design'],
    'data': ['data', 'analytics', 'computer'],
    'analyst': ['analyst', 'business', 'charts'],
    'operations': ['operations', 'business', 'office'],
    'hr': ['hr', 'human resources', 'office'],
    'finance': ['finance', 'money', 'banking']
  };

  for (const [keyword, terms] of Object.entries(searchMappings)) {
    if (lowerTitle.includes(keyword)) {
      return terms;
    }
  }

  return ['business', 'professional', 'work'];
};

/**
 * تحويل نوع التوظيف
 */
const mapEmploymentType = (type) => {
  if (!type) return 'FULLTIME';
  
  const typeMap = {
    'FULLTIME': 'FULLTIME',
    'FULL_TIME': 'FULLTIME',
    'Full-time': 'FULLTIME',
    'PARTTIME': 'PARTTIME',
    'PART_TIME': 'PARTTIME',
    'Part-time': 'PARTTIME',
    'CONTRACTOR': 'CONTRACTOR',
    'CONTRACT': 'CONTRACTOR',
    'INTERN': 'INTERN',
    'INTERNSHIP': 'INTERN'
  };

  return typeMap[type] || typeMap[type.toUpperCase()] || 'OTHER';
};

/**
 * استخراج التصنيفات
 */
const extractTags = (job) => {
  const tags = [];
  
  if (job.job_employment_type) tags.push(job.job_employment_type);
  if (job.job_is_remote) tags.push('remote');
  if (job.job_city) tags.push(job.job_city);
  if (job.job_country) tags.push(job.job_country);
  
  const titleWords = (job.job_title || '').split(/\s+/).filter(w => w.length > 3);
  tags.push(...titleWords.slice(0, 3));

  return [...new Set(tags)];
};

/**
 * تحويل بيانات JSearch إلى صيغة ExternalJob
 */
const formatJSearchJob = (job, media) => {
  return {
    jobId: job.job_id,
    title: job.job_title || 'وظيفة',
    description: job.job_description || '',
    employer: {
      name: job.employer_name || 'شركة',
      logo: job.employer_logo || null,
      website: job.employer_website || null
    },
    location: {
      city: job.job_city || '',
      state: job.job_state || '',
      country: job.job_country || 'Saudi Arabia',
      isRemote: job.job_is_remote || false
    },
    employmentType: mapEmploymentType(job.job_employment_type),
    salary: {
      min: job.job_min_salary || null,
      max: job.job_max_salary || null,
      currency: job.job_salary_currency || 'SAR',
      period: job.job_salary_period || 'YEAR'
    },
    applyLink: job.job_apply_link || job.job_google_link || '#',
    media: media || getDefaultImage(),
    postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : new Date(),
    expiresAt: job.job_offer_expiration_datetime_utc ? new Date(job.job_offer_expiration_datetime_utc) : null,
    isActive: true,
    tags: extractTags(job),
    lastFetchedAt: new Date()
  };
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
      return 'updated';
    } else {
      await ExternalJob.create(formattedJob);
      return 'created';
    }
  } catch (error) {
    if (error.code !== 11000) {
      console.error('[DB] Error saving job:', error.message);
    }
    return 'error';
  }
};

/**
 * ============================================
 * 🚀 الدالة الرئيسية - جلب من JSearch ثم من قاعدة البيانات
 * ============================================
 * 
 * التدفق:
 * 1. جلب الوظائف من JSearch API
 * 2. تخزينها في قاعدة البيانات
 * 3. إرجاع الوظائف من قاعدة البيانات
 */
exports.getJobsLive = async (params = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = 'jobs in Saudi Arabia'
    } = params;

    console.log(`[ExternalJobsService] Request - page: ${page}, search: ${search}`);

    const now = Date.now();
    const shouldFetch = (now - lastFetchTime) > FETCH_COOLDOWN;

    // الخطوة 1: جلب من JSearch وتخزين في قاعدة البيانات (إذا مر وقت كافي)
    if (shouldFetch) {
      console.log('[ExternalJobsService] Fetching fresh jobs from JSearch...');
      
      const queries = [
        'jobs in Saudi Arabia',
        'وظائف في السعودية',
        'jobs in Dubai UAE',
        'jobs in Riyadh',
        'jobs in Jeddah'
      ];

      // جلب من استعلام عشوائي
      const randomQuery = queries[Math.floor(Math.random() * queries.length)];
      const jsearchJobs = await fetchFromJSearch(randomQuery, 1, 2);

      if (jsearchJobs && jsearchJobs.length > 0) {
        console.log(`[ExternalJobsService] Processing ${jsearchJobs.length} jobs...`);
        
        let savedCount = 0;
        
        // معالجة وتخزين الوظائف
        for (let i = 0; i < jsearchJobs.length; i++) {
          try {
            const media = await fetchPixabayImage(jsearchJobs[i].job_title);
            const formattedJob = formatJSearchJob(jsearchJobs[i], media);
            const result = await saveJobToDatabase(formattedJob);
            if (result !== 'error') savedCount++;
          } catch (err) {
            console.error(`[ExternalJobsService] Error processing job ${i}:`, err.message);
          }
        }

        console.log(`[ExternalJobsService] Saved ${savedCount} jobs to database`);
        lastFetchTime = now;
      }
    } else {
      console.log('[ExternalJobsService] Using cached data (cooldown active)');
    }

    // الخطوة 2: جلب من قاعدة البيانات
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      ExternalJob.find({ isActive: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ExternalJob.countDocuments({ isActive: true })
    ]);

    console.log(`[ExternalJobsService] Returning ${jobs.length} jobs from database (total: ${total})`);

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
    console.error('[ExternalJobsService] Error in getJobsLive:', error.message);
    
    // Fallback: جلب من قاعدة البيانات فقط
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
        }
      };
    } catch (dbError) {
      console.error('[ExternalJobsService] Database error:', dbError.message);
      return {
        success: false,
        jobs: [],
        message: 'حدث خطأ أثناء جلب الوظائف'
      };
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
 * جلب وظيفة واحدة
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
 * تسجيل نقرة
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
 * جلب وحفظ الوظائف (للـ Cron Job)
 */
exports.fetchAndSaveJobs = async (query = 'jobs in Saudi Arabia') => {
  try {
    console.log('[ExternalJobsService] Cron: Starting job fetch...');
    
    const jobs = await fetchFromJSearch(query, 1, 3);

    if (!jobs || jobs.length === 0) {
      console.log('[ExternalJobsService] No jobs found');
      return { success: true, count: 0 };
    }

    let savedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < jobs.length; i++) {
      try {
        const media = await fetchPixabayImage(jobs[i].job_title);
        const formattedJob = formatJSearchJob(jobs[i], media);
        const result = await saveJobToDatabase(formattedJob);
        
        if (result === 'created') savedCount++;
        else if (result === 'updated') updatedCount++;
      } catch (err) {
        // تجاهل الأخطاء الفردية
      }
    }

    console.log(`[ExternalJobsService] Cron: ${savedCount} new, ${updatedCount} updated`);
    
    // تحديث وقت آخر جلب
    lastFetchTime = Date.now();
    
    return { success: true, count: savedCount + updatedCount, newJobs: savedCount, updatedJobs: updatedCount };

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
 * إحصائيات
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
        withImage
      }
    };

  } catch (error) {
    console.error('[ExternalJobsService] Error in getStats:', error.message);
    throw error;
  }
};

/**
 * مسح الكاش وإعادة الجلب
 */
exports.clearCache = () => {
  lastFetchTime = 0;
  mediaCache.clear();
  console.log('[ExternalJobsService] Cache cleared - next request will fetch fresh data');
};
