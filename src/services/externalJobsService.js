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
  IMAGE_URL: 'https://pixabay.com/api/',
  VIDEO_URL: 'https://pixabay.com/api/videos/'
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
 * جلب صورة من Pixabay (محسّن)
 */
const fetchPixabayImage = async (searchTerm) => {
  try {
    const cacheKey = `img_${searchTerm}`;
    
    if (mediaCache.has(cacheKey)) {
      const cached = mediaCache.get(cacheKey);
      const randomIndex = Math.floor(Math.random() * cached.length);
      return cached[randomIndex];
    }

    const searchTerms = extractSearchTerms(searchTerm);
    console.log('[Pixabay Image] Searching for:', searchTerms.join('+'));

    const response = await axios.get(PIXABAY_CONFIG.IMAGE_URL, {
      params: {
        key: PIXABAY_CONFIG.API_KEY,
        q: searchTerms.join('+'),
        lang: 'en',
        image_type: 'photo',
        orientation: 'horizontal',
        safesearch: true,
        per_page: 15,
        editors_choice: false
      },
      timeout: 10000
    });

    const hits = response.data?.hits || [];
    console.log(`[Pixabay Image] Found ${hits.length} images`);

    if (hits.length === 0) {
      // محاولة ثانية بكلمات بحث عامة
      console.log('[Pixabay Image] No results, trying fallback search...');
      const fallbackResponse = await axios.get(PIXABAY_CONFIG.IMAGE_URL, {
        params: {
          key: PIXABAY_CONFIG.API_KEY,
          q: 'business+office+work',
          lang: 'en',
          image_type: 'photo',
          orientation: 'horizontal',
          safesearch: true,
          per_page: 10
        },
        timeout: 10000
      });
      
      const fallbackHits = fallbackResponse.data?.hits || [];
      if (fallbackHits.length === 0) {
        return getDefaultImage();
      }
      
      const formattedMedia = fallbackHits.map(hit => ({
        type: 'image',
        url: hit.largeImageURL || hit.webformatURL,
        thumbnail: hit.previewURL || hit.webformatURL,
        source: 'pixabay',
        pixabayId: hit.id
      }));
      
      const randomIndex = Math.floor(Math.random() * formattedMedia.length);
      return formattedMedia[randomIndex];
    }

    const formattedMedia = hits.map(hit => ({
      type: 'image',
      url: hit.largeImageURL || hit.webformatURL,
      thumbnail: hit.previewURL || hit.webformatURL,
      source: 'pixabay',
      pixabayId: hit.id
    }));

    mediaCache.set(cacheKey, formattedMedia);

    const randomIndex = Math.floor(Math.random() * formattedMedia.length);
    return formattedMedia[randomIndex];

  } catch (error) {
    console.error('[Pixabay Image] Error:', error.message);
    if (error.response) {
      console.error('[Pixabay Image] Status:', error.response.status);
      console.error('[Pixabay Image] Data:', error.response.data);
    }
    return getDefaultImage();
  }
};

/**
 * جلب فيديو من Pixabay
 */
const fetchPixabayVideo = async (searchTerm) => {
  try {
    const cacheKey = `vid_${searchTerm}`;
    
    if (mediaCache.has(cacheKey)) {
      const cached = mediaCache.get(cacheKey);
      const randomIndex = Math.floor(Math.random() * cached.length);
      return cached[randomIndex];
    }

    const searchTerms = extractSearchTerms(searchTerm);
    console.log('[Pixabay Video] Searching for:', searchTerms.join('+'));

    const response = await axios.get(PIXABAY_CONFIG.VIDEO_URL, {
      params: {
        key: PIXABAY_CONFIG.API_KEY,
        q: searchTerms.join('+'),
        lang: 'en',
        safesearch: true,
        per_page: 10
      },
      timeout: 10000
    });

    const hits = response.data?.hits || [];
    console.log(`[Pixabay Video] Found ${hits.length} videos`);

    if (hits.length === 0) {
      return null; // سنستخدم صورة بدلاً من الفيديو
    }

    const formattedMedia = hits.map(hit => {
      // اختيار أفضل جودة متاحة
      const videoData = hit.videos?.medium || hit.videos?.small || hit.videos?.tiny;
      return {
        type: 'video',
        url: videoData?.url,
        thumbnail: videoData?.thumbnail || hit.videos?.large?.thumbnail,
        source: 'pixabay',
        pixabayId: hit.id,
        duration: hit.duration
      };
    }).filter(v => v.url); // تصفية الفيديوهات بدون URL

    if (formattedMedia.length === 0) {
      return null;
    }

    mediaCache.set(cacheKey, formattedMedia);

    const randomIndex = Math.floor(Math.random() * formattedMedia.length);
    return formattedMedia[randomIndex];

  } catch (error) {
    console.error('[Pixabay Video] Error:', error.message);
    return null;
  }
};

/**
 * جلب وسائط (صورة أو فيديو) من Pixabay
 * يحاول جلب فيديو أولاً، ثم صورة إذا لم يجد
 */
const fetchPixabayMedia = async (searchTerm, preferVideo = false) => {
  try {
    // إذا كان المستخدم يفضل الفيديو، نحاول جلبه أولاً
    if (preferVideo) {
      const video = await fetchPixabayVideo(searchTerm);
      if (video) {
        console.log('[Pixabay] Returning video');
        return video;
      }
    }

    // جلب صورة
    const image = await fetchPixabayImage(searchTerm);
    return image;

  } catch (error) {
    console.error('[Pixabay Media] Error:', error.message);
    return getDefaultImage();
  }
};

/**
 * صورة افتراضية (محسّنة مع عدة خيارات)
 * تستخدم صور من Pixabay مباشرة (مجانية وموثوقة)
 */
const getDefaultImage = () => {
  // صور من Pixabay - مجانية ولا تحتاج API key للعرض
  const defaultImages = [
    {
      url: 'https://cdn.pixabay.com/photo/2015/01/09/11/08/startup-594090_1280.jpg',
      thumbnail: 'https://cdn.pixabay.com/photo/2015/01/09/11/08/startup-594090_640.jpg'
    },
    {
      url: 'https://cdn.pixabay.com/photo/2017/10/31/09/55/dream-job-2904780_1280.jpg',
      thumbnail: 'https://cdn.pixabay.com/photo/2017/10/31/09/55/dream-job-2904780_640.jpg'
    },
    {
      url: 'https://cdn.pixabay.com/photo/2015/07/17/22/43/student-849822_1280.jpg',
      thumbnail: 'https://cdn.pixabay.com/photo/2015/07/17/22/43/student-849822_640.jpg'
    },
    {
      url: 'https://cdn.pixabay.com/photo/2016/11/19/14/00/code-1839406_1280.jpg',
      thumbnail: 'https://cdn.pixabay.com/photo/2016/11/19/14/00/code-1839406_640.jpg'
    },
    {
      url: 'https://cdn.pixabay.com/photo/2015/01/08/18/29/entrepreneur-593358_1280.jpg',
      thumbnail: 'https://cdn.pixabay.com/photo/2015/01/08/18/29/entrepreneur-593358_640.jpg'
    },
    {
      url: 'https://cdn.pixabay.com/photo/2017/07/31/11/21/people-2557396_1280.jpg',
      thumbnail: 'https://cdn.pixabay.com/photo/2017/07/31/11/21/people-2557396_640.jpg'
    },
    {
      url: 'https://cdn.pixabay.com/photo/2015/01/09/11/11/office-594132_1280.jpg',
      thumbnail: 'https://cdn.pixabay.com/photo/2015/01/09/11/11/office-594132_640.jpg'
    },
    {
      url: 'https://cdn.pixabay.com/photo/2016/03/09/09/22/workplace-1245776_1280.jpg',
      thumbnail: 'https://cdn.pixabay.com/photo/2016/03/09/09/22/workplace-1245776_640.jpg'
    }
  ];
  
  const randomIndex = Math.floor(Math.random() * defaultImages.length);
  return {
    type: 'image',
    url: defaultImages[randomIndex].url,
    thumbnail: defaultImages[randomIndex].thumbnail,
    source: 'pixabay_default'
  };
};

/**
 * استخراج كلمات البحث (محسّن)
 */
const extractSearchTerms = (title) => {
  if (!title) return ['business', 'work', 'office'];

  const lowerTitle = title.toLowerCase();

  const searchMappings = {
    'software': ['software', 'developer', 'coding'],
    'developer': ['developer', 'programming', 'computer'],
    'engineer': ['engineer', 'engineering', 'technical'],
    'manager': ['manager', 'business', 'leadership'],
    'sales': ['sales', 'business', 'customer'],
    'marketing': ['marketing', 'digital', 'advertising'],
    'driver': ['driver', 'transportation', 'delivery'],
    'nurse': ['nurse', 'healthcare', 'hospital'],
    'doctor': ['doctor', 'medical', 'healthcare'],
    'teacher': ['teacher', 'education', 'classroom'],
    'accountant': ['accountant', 'finance', 'accounting'],
    'chef': ['chef', 'cooking', 'restaurant'],
    'designer': ['designer', 'creative', 'design'],
    'data': ['data', 'analytics', 'technology'],
    'analyst': ['analyst', 'business', 'research'],
    'operations': ['operations', 'logistics', 'management'],
    'hr': ['hr', 'recruitment', 'human resources'],
    'finance': ['finance', 'banking', 'investment'],
    'it': ['it', 'technology', 'computer'],
    'admin': ['admin', 'office', 'administrative'],
    'customer': ['customer', 'service', 'support'],
    'security': ['security', 'guard', 'safety'],
    'construction': ['construction', 'building', 'engineering'],
    'retail': ['retail', 'store', 'shopping'],
    'warehouse': ['warehouse', 'logistics', 'storage']
  };

  for (const [keyword, terms] of Object.entries(searchMappings)) {
    if (lowerTitle.includes(keyword)) {
      return terms;
    }
  }

  // استخراج كلمات من العنوان
  const words = lowerTitle.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0) {
    return [words[0], 'business', 'professional'];
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
            // جلب وسائط من Pixabay (صورة أو فيديو)
            const media = await fetchPixabayMedia(jsearchJobs[i].job_title, i % 3 === 0);
            const formattedJob = formatJSearchJob(jsearchJobs[i], media);
            const result = await saveJobToDatabase(formattedJob);
            if (result !== 'error') savedCount++;
            
            // تأخير صغير لتجنب rate limiting
            if (i < jsearchJobs.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
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
        const media = await fetchPixabayMedia(jobs[i].job_title, i % 3 === 0);
        const formattedJob = formatJSearchJob(jobs[i], media);
        const result = await saveJobToDatabase(formattedJob);
        
        if (result === 'created') savedCount++;
        else if (result === 'updated') updatedCount++;
        
        // تأخير صغير
        if (i < jobs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
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

/**
 * تحديث وسائط وظيفة موجودة (لإصلاح الصور المفقودة)
 */
exports.refreshJobMedia = async (jobId) => {
  try {
    const job = await ExternalJob.findOne({ jobId });
    if (!job) {
      return { success: false, message: 'الوظيفة غير موجودة' };
    }

    const media = await fetchPixabayMedia(job.title, true);
    
    await ExternalJob.updateOne(
      { jobId },
      { $set: { media, lastFetchedAt: new Date() } }
    );

    return { success: true, media };
  } catch (error) {
    console.error('[ExternalJobsService] Error refreshing media:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * تحديث وسائط جميع الوظائف (للإصلاح الشامل)
 */
exports.refreshAllJobsMedia = async () => {
  try {
    console.log('[ExternalJobsService] Starting media refresh for all jobs...');
    
    const jobs = await ExternalJob.find({ isActive: true }).lean();
    let updatedCount = 0;

    for (const job of jobs) {
      try {
        const media = await fetchPixabayMedia(job.title, Math.random() > 0.7);
        await ExternalJob.updateOne(
          { jobId: job.jobId },
          { $set: { media, lastFetchedAt: new Date() } }
        );
        updatedCount++;
        
        // تأخير لتجنب rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`[ExternalJobsService] Error updating job ${job.jobId}:`, err.message);
      }
    }

    console.log(`[ExternalJobsService] Refreshed media for ${updatedCount} jobs`);
    return { success: true, updatedCount };
  } catch (error) {
    console.error('[ExternalJobsService] Error in refreshAllJobsMedia:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * تحديث الوظائف التي لا تحتوي على صور فقط
 * هذه الدالة تبحث عن الوظائف بدون صور وتضيف لها صور افتراضية
 */
exports.fixJobsWithoutMedia = async () => {
  try {
    console.log('[ExternalJobsService] Finding jobs without media...');
    
    // البحث عن الوظائف بدون صور
    const jobsWithoutMedia = await ExternalJob.find({
      isActive: true,
      $or: [
        { 'media.url': null },
        { 'media.url': '' },
        { 'media.url': { $exists: false } },
        { media: null },
        { media: { $exists: false } }
      ]
    }).lean();
    
    console.log(`[ExternalJobsService] Found ${jobsWithoutMedia.length} jobs without media`);
    
    if (jobsWithoutMedia.length === 0) {
      return { success: true, updatedCount: 0, message: 'All jobs have media' };
    }
    
    let updatedCount = 0;
    
    for (const job of jobsWithoutMedia) {
      try {
        // محاولة جلب صورة من Pixabay أولاً
        let media = await fetchPixabayImage(job.title);
        
        // إذا فشلت، استخدم الصورة الافتراضية
        if (!media || !media.url) {
          media = getDefaultImage();
        }
        
        await ExternalJob.updateOne(
          { jobId: job.jobId },
          { $set: { media, lastFetchedAt: new Date() } }
        );
        
        updatedCount++;
        console.log(`[ExternalJobsService] Fixed media for job: ${job.title?.substring(0, 30)}...`);
        
        // تأخير لتجنب rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`[ExternalJobsService] Error fixing job ${job.jobId}:`, err.message);
      }
    }
    
    console.log(`[ExternalJobsService] Fixed media for ${updatedCount} jobs`);
    return { success: true, updatedCount };
    
  } catch (error) {
    console.error('[ExternalJobsService] Error in fixJobsWithoutMedia:', error.message);
    return { success: false, error: error.message };
  }
};
