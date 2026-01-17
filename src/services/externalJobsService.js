/**
 * ============================================
 * خدمة الوظائف الخارجية - JSearch API + Pixabay
 * ============================================
 * 
 * هذه الخدمة تقوم بجلب الوظائف من JSearch API (RapidAPI)
 * مع صور/فيديوهات من Pixabay
 * بدون ترجمة - تعرض البيانات كما هي من API
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

// نسبة الفيديو vs الصور (25% فيديو، 75% صور)
const VIDEO_RATIO = 0.25;

// كاش للوسائط لتجنب التكرار
const mediaCache = new Map();

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
    console.log(`[JSearch] Fetched ${jobs.length} jobs`);

    return jobs;

  } catch (error) {
    console.error('[JSearch] Error fetching jobs:', error.message);
    if (error.response) {
      console.error('[JSearch] Response status:', error.response.status);
      console.error('[JSearch] Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * جلب وسائط من Pixabay (صورة أو فيديو)
 */
const fetchPixabayMedia = async (searchTerm, forceVideo = false) => {
  try {
    const cacheKey = `${searchTerm}-${forceVideo ? 'video' : 'image'}`;
    
    if (mediaCache.has(cacheKey)) {
      const cached = mediaCache.get(cacheKey);
      const randomIndex = Math.floor(Math.random() * cached.length);
      return cached[randomIndex];
    }

    const searchTerms = extractSearchTerms(searchTerm);
    const isVideo = forceVideo || Math.random() < VIDEO_RATIO;

    let response;
    let mediaType = 'image';

    if (isVideo) {
      // جلب فيديو
      response = await axios.get('https://pixabay.com/api/videos/', {
        params: {
          key: PIXABAY_CONFIG.API_KEY,
          q: searchTerms.join('+'),
          lang: 'en',
          safesearch: true,
          per_page: 20
        },
        timeout: 10000
      });
      mediaType = 'video';
    } else {
      // جلب صورة
      response = await axios.get(PIXABAY_CONFIG.BASE_URL, {
        params: {
          key: PIXABAY_CONFIG.API_KEY,
          q: searchTerms.join('+'),
          lang: 'en',
          image_type: 'photo',
          orientation: 'horizontal',
          safesearch: true,
          per_page: 20,
          min_width: 800,
          min_height: 600
        },
        timeout: 10000
      });
    }

    const hits = response.data?.hits || [];

    if (hits.length === 0) {
      // Fallback إلى صور عامة
      const fallbackResponse = await axios.get(PIXABAY_CONFIG.BASE_URL, {
        params: {
          key: PIXABAY_CONFIG.API_KEY,
          q: 'business+office+work',
          lang: 'en',
          image_type: 'photo',
          orientation: 'horizontal',
          safesearch: true,
          per_page: 20
        },
        timeout: 10000
      });

      const fallbackHits = fallbackResponse.data?.hits || [];
      if (fallbackHits.length > 0) {
        const randomIndex = Math.floor(Math.random() * fallbackHits.length);
        const selected = fallbackHits[randomIndex];
        return {
          type: 'image',
          url: selected.largeImageURL || selected.webformatURL,
          thumbnail: selected.previewURL,
          source: 'pixabay'
        };
      }
      return null;
    }

    // تنسيق النتائج
    const formattedMedia = hits.map(hit => {
      if (mediaType === 'video') {
        return {
          type: 'video',
          url: hit.videos?.large?.url || hit.videos?.medium?.url || hit.videos?.small?.url,
          thumbnail: `https://i.vimeocdn.com/video/${hit.picture_id}_640x360.jpg`,
          source: 'pixabay'
        };
      }
      return {
        type: 'image',
        url: hit.largeImageURL || hit.webformatURL,
        thumbnail: hit.previewURL,
        source: 'pixabay'
      };
    });

    // حفظ في الكاش
    mediaCache.set(cacheKey, formattedMedia);

    const randomIndex = Math.floor(Math.random() * formattedMedia.length);
    return formattedMedia[randomIndex];

  } catch (error) {
    console.error('[Pixabay] Error fetching media:', error.message);
    return null;
  }
};

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
    'driver': ['driver', 'driving', 'car'],
    'nurse': ['nurse', 'healthcare', 'medical'],
    'doctor': ['doctor', 'medical', 'healthcare'],
    'teacher': ['teacher', 'education', 'classroom'],
    'accountant': ['accountant', 'finance', 'office'],
    'sales': ['sales', 'business', 'meeting'],
    'marketing': ['marketing', 'business', 'advertising'],
    'manager': ['manager', 'business', 'office'],
    'chef': ['chef', 'cooking', 'kitchen'],
    'designer': ['designer', 'creative', 'design'],
    'lawyer': ['lawyer', 'legal', 'justice'],
    'mechanic': ['mechanic', 'automotive', 'repair'],
    'electrician': ['electrician', 'electrical', 'wiring'],
    'construction': ['construction', 'building', 'worker'],
    'security': ['security', 'guard', 'protection'],
    'warehouse': ['warehouse', 'logistics', 'storage'],
    'retail': ['retail', 'shopping', 'store'],
    'receptionist': ['receptionist', 'office', 'front desk'],
    'cleaner': ['cleaning', 'housekeeping', 'janitorial'],
    'data': ['data', 'analytics', 'computer'],
    'analyst': ['analyst', 'business', 'charts']
  };

  for (const [keyword, terms] of Object.entries(searchMappings)) {
    if (lowerTitle.includes(keyword)) {
      return terms;
    }
  }

  const words = title.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0) {
    return [words[0], 'professional', 'work'];
  }

  return ['business', 'professional', 'work'];
};

/**
 * تحويل بيانات JSearch إلى صيغة ExternalJob
 */
const formatJSearchJob = async (job, index) => {
  // تحديد ما إذا كانت هذه الوظيفة ستحصل على فيديو (25%)
  const shouldBeVideo = index % 4 === 0; // كل رابع وظيفة تحصل على فيديو

  // جلب الوسائط من Pixabay
  const media = await fetchPixabayMedia(job.job_title, shouldBeVideo);

  return {
    jobId: job.job_id,
    title: job.job_title || 'وظيفة غير معنونة',
    description: job.job_description || '',
    employer: {
      name: job.employer_name || 'غير محدد',
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
    media: media || {
      type: 'image',
      url: null,
      thumbnail: null,
      source: 'none'
    },
    postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : new Date(),
    expiresAt: job.job_offer_expiration_datetime_utc ? new Date(job.job_offer_expiration_datetime_utc) : null,
    isActive: true,
    tags: extractTags(job),
    lastFetchedAt: new Date()
  };
};

/**
 * تحويل نوع التوظيف
 */
const mapEmploymentType = (type) => {
  if (!type) return 'FULLTIME';
  
  const typeMap = {
    'FULLTIME': 'FULLTIME',
    'FULL_TIME': 'FULLTIME',
    'PARTTIME': 'PARTTIME',
    'PART_TIME': 'PARTTIME',
    'CONTRACTOR': 'CONTRACTOR',
    'CONTRACT': 'CONTRACTOR',
    'INTERN': 'INTERN',
    'INTERNSHIP': 'INTERN'
  };

  return typeMap[type.toUpperCase()] || 'OTHER';
};

/**
 * استخراج التصنيفات من الوظيفة
 */
const extractTags = (job) => {
  const tags = [];
  
  if (job.job_employment_type) tags.push(job.job_employment_type);
  if (job.job_is_remote) tags.push('remote');
  if (job.job_city) tags.push(job.job_city);
  if (job.job_country) tags.push(job.job_country);
  
  // استخراج كلمات مفتاحية من العنوان
  const titleWords = (job.job_title || '').split(/\s+/).filter(w => w.length > 3);
  tags.push(...titleWords.slice(0, 3));

  return [...new Set(tags)];
};

/**
 * جلب الوظائف وحفظها في MongoDB
 * يُستدعى من Cron Job كل 6 ساعات
 */
exports.fetchAndSaveJobs = async (query = 'وظائف في السعودية') => {
  try {
    console.log('[ExternalJobsService] Starting job fetch...');
    
    // جلب الوظائف من JSearch
    const jobs = await fetchFromJSearch(query, 1, 3); // 3 صفحات

    if (!jobs || jobs.length === 0) {
      console.log('[ExternalJobsService] No jobs found');
      return { success: true, count: 0, message: 'لم يتم العثور على وظائف' };
    }

    let savedCount = 0;
    let updatedCount = 0;

    // معالجة كل وظيفة
    for (let i = 0; i < jobs.length; i++) {
      try {
        const formattedJob = await formatJSearchJob(jobs[i], i);

        // التحقق من وجود الوظيفة
        const existingJob = await ExternalJob.findOne({ jobId: formattedJob.jobId });

        if (existingJob) {
          // تحديث الوظيفة الموجودة
          await ExternalJob.updateOne(
            { jobId: formattedJob.jobId },
            { 
              $set: { 
                ...formattedJob,
                lastFetchedAt: new Date()
              }
            }
          );
          updatedCount++;
        } else {
          // إنشاء وظيفة جديدة
          await ExternalJob.create(formattedJob);
          savedCount++;
        }

        // تأخير بسيط لتجنب حد الطلبات
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (jobError) {
        console.error(`[ExternalJobsService] Error processing job ${i}:`, jobError.message);
      }
    }

    console.log(`[ExternalJobsService] Completed: ${savedCount} new, ${updatedCount} updated`);

    return {
      success: true,
      count: savedCount + updatedCount,
      newJobs: savedCount,
      updatedJobs: updatedCount,
      message: `تم جلب ${savedCount} وظيفة جديدة وتحديث ${updatedCount} وظيفة`
    };

  } catch (error) {
    console.error('[ExternalJobsService] Error in fetchAndSaveJobs:', error.message);
    throw error;
  }
};

/**
 * جلب الوظائف من قاعدة البيانات (للواجهة الأمامية)
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

    // فلاتر
    if (country) query['location.country'] = new RegExp(country, 'i');
    if (city) query['location.city'] = new RegExp(city, 'i');
    if (employmentType) query.employmentType = employmentType;
    if (isRemote !== undefined) query['location.isRemote'] = isRemote === 'true';
    if (search) {
      query.$text = { $search: search };
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

    // زيادة عدد المشاهدات
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
 * حذف الوظائف القديمة (أكثر من 30 يوم)
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
