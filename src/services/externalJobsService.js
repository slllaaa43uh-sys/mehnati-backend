/**
 * ============================================
 * خدمة الوظائف الخارجية - Adzuna API + Pixabay + Translation
 * ============================================
 * 
 * هذه الخدمة تقوم بجلب الوظائف من Adzuna API
 * مع دعم الأولوية حسب دولة المستخدم
 * والترجمة التلقائية الحقيقية باستخدام Google Translate
 * وصور عالية الجودة من Pixabay
 */

const axios = require('axios');
const { translateText, translateBatch } = require('./translationService');

// إعدادات Adzuna API
const ADZUNA_CONFIG = {
  APP_ID: '4cba22c2',
  APP_KEY: '55a99895e575dec59446a506164c6d7f',
  BASE_URL: 'https://api.adzuna.com/v1/api/jobs'
};

// إعدادات Pixabay API
const PIXABAY_CONFIG = {
  API_KEY: '54217973-0197d2bcb30ad2fbff44689dc',
  BASE_URL: 'https://pixabay.com/api/'
};

// الدول المدعومة من Adzuna مع أسمائها بالعربية
const SUPPORTED_COUNTRIES = {
  // دول الخليج والعربية (الأولوية القصوى)
  'sa': { en: 'Saudi Arabia', ar: 'السعودية', priority: 1 },
  'ae': { en: 'United Arab Emirates', ar: 'الإمارات', priority: 1 },
  'kw': { en: 'Kuwait', ar: 'الكويت', priority: 1 },
  'qa': { en: 'Qatar', ar: 'قطر', priority: 1 },
  'bh': { en: 'Bahrain', ar: 'البحرين', priority: 1 },
  'om': { en: 'Oman', ar: 'عُمان', priority: 1 },
  // دول أخرى
  'gb': { en: 'United Kingdom', ar: 'المملكة المتحدة', priority: 2 },
  'us': { en: 'United States', ar: 'الولايات المتحدة', priority: 2 },
  'au': { en: 'Australia', ar: 'أستراليا', priority: 3 },
  'at': { en: 'Austria', ar: 'النمسا', priority: 3 },
  'be': { en: 'Belgium', ar: 'بلجيكا', priority: 3 },
  'br': { en: 'Brazil', ar: 'البرازيل', priority: 3 },
  'ca': { en: 'Canada', ar: 'كندا', priority: 2 },
  'ch': { en: 'Switzerland', ar: 'سويسرا', priority: 3 },
  'de': { en: 'Germany', ar: 'ألمانيا', priority: 2 },
  'es': { en: 'Spain', ar: 'إسبانيا', priority: 3 },
  'fr': { en: 'France', ar: 'فرنسا', priority: 2 },
  'in': { en: 'India', ar: 'الهند', priority: 3 },
  'it': { en: 'Italy', ar: 'إيطاليا', priority: 3 },
  'mx': { en: 'Mexico', ar: 'المكسيك', priority: 3 },
  'nl': { en: 'Netherlands', ar: 'هولندا', priority: 3 },
  'nz': { en: 'New Zealand', ar: 'نيوزيلندا', priority: 3 },
  'pl': { en: 'Poland', ar: 'بولندا', priority: 3 },
  'ru': { en: 'Russia', ar: 'روسيا', priority: 3 },
  'sg': { en: 'Singapore', ar: 'سنغافورة', priority: 3 },
  'za': { en: 'South Africa', ar: 'جنوب أفريقيا', priority: 3 }
};

// خريطة تحويل أسماء الدول من العربية/الإنجليزية إلى رمز الدولة
const COUNTRY_NAME_TO_CODE = {
  // العربية
  'السعودية': 'sa',
  'المملكة العربية السعودية': 'sa',
  'الإمارات': 'ae',
  'الامارات': 'ae',
  'الإمارات العربية المتحدة': 'ae',
  'الكويت': 'kw',
  'قطر': 'qa',
  'البحرين': 'bh',
  'عمان': 'om',
  'عُمان': 'om',
  'سلطنة عمان': 'om',
  'مصر': 'eg',
  'الأردن': 'jo',
  'لبنان': 'lb',
  // الإنجليزية
  'saudi arabia': 'sa',
  'saudi': 'sa',
  'uae': 'ae',
  'united arab emirates': 'ae',
  'emirates': 'ae',
  'kuwait': 'kw',
  'qatar': 'qa',
  'bahrain': 'bh',
  'oman': 'om',
  'united kingdom': 'gb',
  'uk': 'gb',
  'united states': 'us',
  'usa': 'us',
  'germany': 'de',
  'france': 'fr',
  'canada': 'ca'
};

// التصنيفات المتاحة مع الترجمة العربية
const JOB_CATEGORIES = {
  'accounting-finance-jobs': { en: 'Accounting & Finance', ar: 'المحاسبة والمالية' },
  'it-jobs': { en: 'IT & Technology', ar: 'تقنية المعلومات' },
  'sales-jobs': { en: 'Sales', ar: 'المبيعات' },
  'customer-services-jobs': { en: 'Customer Service', ar: 'خدمة العملاء' },
  'engineering-jobs': { en: 'Engineering', ar: 'الهندسة' },
  'hr-jobs': { en: 'HR & Recruitment', ar: 'الموارد البشرية' },
  'healthcare-nursing-jobs': { en: 'Healthcare & Nursing', ar: 'الرعاية الصحية والتمريض' },
  'hospitality-catering-jobs': { en: 'Hospitality & Catering', ar: 'الضيافة والتموين' },
  'pr-advertising-marketing-jobs': { en: 'Marketing & PR', ar: 'التسويق والعلاقات العامة' },
  'logistics-warehouse-jobs': { en: 'Logistics & Warehouse', ar: 'اللوجستيات والمستودعات' },
  'teaching-jobs': { en: 'Teaching & Education', ar: 'التعليم والتدريس' },
  'trade-construction-jobs': { en: 'Trade & Construction', ar: 'البناء والتشييد' },
  'admin-jobs': { en: 'Admin', ar: 'الإدارة' },
  'legal-jobs': { en: 'Legal', ar: 'القانون' },
  'creative-design-jobs': { en: 'Creative & Design', ar: 'التصميم والإبداع' },
  'graduate-jobs': { en: 'Graduate', ar: 'حديثي التخرج' },
  'retail-jobs': { en: 'Retail', ar: 'التجزئة' },
  'consultancy-jobs': { en: 'Consultancy', ar: 'الاستشارات' },
  'manufacturing-jobs': { en: 'Manufacturing', ar: 'التصنيع' },
  'scientific-qa-jobs': { en: 'Scientific & QA', ar: 'العلوم وضمان الجودة' },
  'social-work-jobs': { en: 'Social Work', ar: 'العمل الاجتماعي' },
  'travel-jobs': { en: 'Travel & Tourism', ar: 'السفر والسياحة' },
  'energy-oil-gas-jobs': { en: 'Energy & Oil/Gas', ar: 'الطاقة والنفط والغاز' },
  'property-jobs': { en: 'Property', ar: 'العقارات' },
  'charity-voluntary-jobs': { en: 'Charity & Voluntary', ar: 'العمل الخيري والتطوعي' },
  'domestic-help-cleaning-jobs': { en: 'Domestic Help & Cleaning', ar: 'المساعدة المنزلية والتنظيف' },
  'maintenance-jobs': { en: 'Maintenance', ar: 'الصيانة' },
  'part-time-jobs': { en: 'Part Time', ar: 'دوام جزئي' },
  'other-general-jobs': { en: 'Other / General', ar: 'أخرى / عام' }
};

// كاش للصور لتجنب التكرار
const imageCache = new Map();

/**
 * تحويل اسم الدولة إلى رمز الدولة
 */
const getCountryCode = (countryName) => {
  if (!countryName) return null;
  
  const normalized = countryName.toLowerCase().trim();
  
  if (SUPPORTED_COUNTRIES[normalized]) {
    return normalized;
  }
  
  if (COUNTRY_NAME_TO_CODE[normalized]) {
    return COUNTRY_NAME_TO_CODE[normalized];
  }
  
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      return code;
    }
  }
  
  return null;
};

/**
 * جلب صورة من Pixabay بناءً على عنوان الوظيفة
 */
const fetchPixabayImage = async (jobTitle) => {
  try {
    const searchTerms = extractSearchTerms(jobTitle);
    const cacheKey = searchTerms.join('-');
    
    if (imageCache.has(cacheKey)) {
      const cachedImages = imageCache.get(cacheKey);
      const randomIndex = Math.floor(Math.random() * cachedImages.length);
      return cachedImages[randomIndex];
    }
    
    const useVideo = Math.random() < 0.10;
    
    const params = {
      key: PIXABAY_CONFIG.API_KEY,
      q: searchTerms.join('+'),
      lang: 'en',
      image_type: 'photo',
      orientation: 'horizontal',
      safesearch: true,
      per_page: 20,
      min_width: 800,
      min_height: 600
    };
    
    let response;
    let mediaType = 'image';
    
    if (useVideo) {
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
      response = await axios.get(PIXABAY_CONFIG.BASE_URL, {
        params,
        timeout: 10000
      });
    }
    
    const hits = response.data.hits || [];
    
    if (hits.length === 0) {
      const fallbackResponse = await axios.get(PIXABAY_CONFIG.BASE_URL, {
        params: {
          ...params,
          q: 'business+office+work'
        },
        timeout: 10000
      });
      
      const fallbackHits = fallbackResponse.data.hits || [];
      if (fallbackHits.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(fallbackHits.length, 20));
        const selected = fallbackHits[randomIndex];
        return {
          type: 'image',
          url: selected.largeImageURL || selected.webformatURL,
          thumbnail: selected.previewURL,
          width: selected.imageWidth,
          height: selected.imageHeight,
          source: 'pixabay',
          photographer: selected.user
        };
      }
      
      return null;
    }
    
    const formattedImages = hits.map(hit => {
      if (mediaType === 'video') {
        return {
          type: 'video',
          url: hit.videos?.large?.url || hit.videos?.medium?.url,
          thumbnail: hit.videos?.tiny?.thumbnail || hit.picture_id,
          width: hit.videos?.large?.width || 1920,
          height: hit.videos?.large?.height || 1080,
          source: 'pixabay',
          photographer: hit.user
        };
      }
      return {
        type: 'image',
        url: hit.largeImageURL || hit.webformatURL,
        thumbnail: hit.previewURL,
        width: hit.imageWidth,
        height: hit.imageHeight,
        source: 'pixabay',
        photographer: hit.user
      };
    });
    
    imageCache.set(cacheKey, formattedImages);
    
    const randomIndex = Math.floor(Math.random() * Math.min(formattedImages.length, 20));
    return formattedImages[randomIndex];
    
  } catch (error) {
    console.error('[Pixabay] Error fetching image:', error.message);
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
    'delivery': ['delivery', 'shipping', 'package'],
    'customer service': ['customer service', 'support', 'helpdesk'],
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
 * جلب الوظائف من Adzuna API مع دعم أولوية دولة المستخدم والترجمة
 */
exports.fetchJobs = async (params = {}) => {
  try {
    const {
      country,
      userCountry,
      category = '',
      what = '',
      where = '',
      page = 1,
      results_per_page = 20,
      sort_by = 'date',
      salary_min,
      salary_max,
      contract_type,
      full_time,
      lang = 'ar' // اللغة المستهدفة للترجمة
    } = params;

    let targetCountry = country;
    
    if (!targetCountry && userCountry) {
      targetCountry = getCountryCode(userCountry);
    }
    
    const adzunaSupportedCountries = ['gb', 'us', 'au', 'at', 'be', 'br', 'ca', 'ch', 'de', 'es', 'fr', 'in', 'it', 'mx', 'nl', 'nz', 'pl', 'ru', 'sg', 'za'];
    
    let countryCode = targetCountry?.toLowerCase();
    let isMixedResults = false;
    
    if (!countryCode || !adzunaSupportedCountries.includes(countryCode)) {
      isMixedResults = true;
      countryCode = 'gb';
    }

    let url = `${ADZUNA_CONFIG.BASE_URL}/${countryCode}/search/${page}`;

    const queryParams = {
      app_id: ADZUNA_CONFIG.APP_ID,
      app_key: ADZUNA_CONFIG.APP_KEY,
      results_per_page: Math.min(results_per_page, 50),
      sort_by
    };

    if (what) queryParams.what = what;
    if (where) queryParams.where = where;
    if (category && JOB_CATEGORIES[category]) queryParams.category = category;
    if (salary_min) queryParams.salary_min = salary_min;
    if (salary_max) queryParams.salary_max = salary_max;
    if (contract_type) queryParams.contract_type = contract_type;
    if (full_time !== undefined) queryParams.full_time = full_time ? 1 : 0;

    console.log('[ExternalJobsService] Fetching jobs from Adzuna:', { url, params: queryParams, userCountry, isMixedResults, lang });

    const response = await axios.get(url, {
      params: queryParams,
      timeout: 15000
    });

    // تحويل البيانات مع الترجمة الحقيقية
    const jobs = await Promise.all(
      (response.data.results || []).map(job => formatJobWithRealTranslation(job, countryCode, lang))
    );

    const countryInfo = SUPPORTED_COUNTRIES[countryCode] || { en: 'Unknown', ar: 'غير معروف' };

    return {
      success: true,
      count: jobs.length,
      total: response.data.count || 0,
      page: parseInt(page),
      results_per_page: parseInt(results_per_page),
      totalPages: Math.ceil((response.data.count || 0) / results_per_page),
      country: {
        code: countryCode,
        name: countryInfo.en,
        nameAr: countryInfo.ar
      },
      userCountry: userCountry || null,
      isMixedResults,
      targetLanguage: lang,
      jobs
    };

  } catch (error) {
    console.error('[ExternalJobsService] Error fetching jobs:', error.message);
    
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        throw new Error('خطأ في مصادقة API - تحقق من APP_ID و APP_KEY');
      } else if (status === 429) {
        throw new Error('تم تجاوز حد الطلبات - حاول مرة أخرى لاحقاً');
      } else if (status === 404) {
        throw new Error('لم يتم العثور على وظائف');
      }
    }
    
    throw error;
  }
};

/**
 * جلب التصنيفات المتاحة
 */
exports.getCategories = () => {
  return {
    success: true,
    categories: Object.entries(JOB_CATEGORIES).map(([key, value]) => ({
      id: key,
      name: value.en,
      nameAr: value.ar
    }))
  };
};

/**
 * جلب الدول المدعومة
 */
exports.getSupportedCountries = () => {
  const sortedCountries = Object.entries(SUPPORTED_COUNTRIES)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([code, data]) => ({
      code,
      name: data.en,
      nameAr: data.ar,
      priority: data.priority
    }));

  return {
    success: true,
    countries: sortedCountries
  };
};

/**
 * تنسيق بيانات الوظيفة مع الترجمة الحقيقية والصورة
 */
const formatJobWithRealTranslation = async (job, countryCode, targetLang = 'ar') => {
  // جلب صورة من Pixabay
  const pixabayImage = await fetchPixabayImage(job.title);
  
  // استخراج اسم الشركة
  const companyName = job.company?.display_name || 'شركة غير محددة';
  
  const cleanCompanyName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const logoUrl = cleanCompanyName ? `https://logo.clearbit.com/${cleanCompanyName}.com` : null;

  const countryInfo = SUPPORTED_COUNTRIES[countryCode] || { en: 'Unknown', ar: 'غير معروف' };

  // تنظيف الوصف
  let cleanDesc = (job.description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanDesc.length > 500) {
    cleanDesc = cleanDesc.substring(0, 500) + '...';
  }

  // الترجمة الحقيقية باستخدام Google Translate
  let translatedTitle = job.title;
  let translatedDesc = cleanDesc;

  if (targetLang !== 'en') {
    try {
      // ترجمة العنوان والوصف بالتوازي
      const [titleResult, descResult] = await Promise.all([
        translateText(job.title, targetLang, 'en'),
        translateText(cleanDesc.substring(0, 300), targetLang, 'en') // تقليص للسرعة
      ]);
      
      translatedTitle = titleResult;
      translatedDesc = descResult;
    } catch (error) {
      console.error('[Translation] Error:', error.message);
      // استخدام النص الأصلي عند فشل الترجمة
    }
  }

  return {
    id: job.id,
    title: {
      ar: targetLang === 'ar' ? translatedTitle : job.title,
      en: job.title,
      display: translatedTitle // العنوان المترجم للغة المستهدفة
    },
    description: {
      ar: targetLang === 'ar' ? translatedDesc : cleanDesc,
      en: cleanDesc,
      display: translatedDesc
    },
    company: {
      name: companyName,
      logo: logoUrl,
      logoFallback: `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=random&color=fff&size=128`
    },
    location: {
      display: job.location?.display_name || '',
      area: job.location?.area || [],
      country: countryInfo.en,
      countryAr: countryInfo.ar
    },
    salary: {
      min: job.salary_min || null,
      max: job.salary_max || null,
      currency: getCurrencyByCountry(countryCode),
      display: formatSalary(job.salary_min, job.salary_max, countryCode),
      displayAr: formatSalaryArabic(job.salary_min, job.salary_max, countryCode)
    },
    category: {
      tag: job.category?.tag || '',
      label: job.category?.label || '',
      labelAr: JOB_CATEGORIES[job.category?.tag]?.ar || 'أخرى'
    },
    contract: {
      type: job.contract_type || null,
      time: job.contract_time || null,
      typeAr: translateContractType(job.contract_type),
      timeAr: translateContractTime(job.contract_time)
    },
    dates: {
      created: job.created,
      posted: formatDate(job.created),
      postedAr: formatDateArabic(job.created)
    },
    media: pixabayImage || {
      type: 'image',
      url: `https://ui-avatars.com/api/?name=${encodeURIComponent(job.title)}&background=667eea&color=fff&size=800&font-size=0.3`,
      thumbnail: null,
      source: 'generated'
    },
    url: job.redirect_url,
    source: 'adzuna'
  };
};

/**
 * ترجمة نوع العقد
 */
const translateContractType = (type) => {
  const translations = {
    'permanent': 'دائم',
    'contract': 'عقد',
    'temporary': 'مؤقت',
    'part_time': 'دوام جزئي',
    'full_time': 'دوام كامل'
  };
  return translations[type?.toLowerCase()] || type || 'غير محدد';
};

/**
 * ترجمة وقت العقد
 */
const translateContractTime = (time) => {
  const translations = {
    'full_time': 'دوام كامل',
    'part_time': 'دوام جزئي'
  };
  return translations[time?.toLowerCase()] || time || 'غير محدد';
};

/**
 * الحصول على العملة حسب الدولة
 */
const getCurrencyByCountry = (countryCode) => {
  const currencies = {
    'sa': 'SAR',
    'ae': 'AED',
    'kw': 'KWD',
    'qa': 'QAR',
    'bh': 'BHD',
    'om': 'OMR',
    'gb': 'GBP',
    'us': 'USD',
    'au': 'AUD',
    'ca': 'CAD',
    'de': 'EUR',
    'fr': 'EUR',
    'es': 'EUR',
    'it': 'EUR',
    'nl': 'EUR',
    'at': 'EUR',
    'be': 'EUR',
    'ch': 'CHF',
    'in': 'INR',
    'br': 'BRL',
    'mx': 'MXN',
    'nz': 'NZD',
    'pl': 'PLN',
    'ru': 'RUB',
    'sg': 'SGD',
    'za': 'ZAR'
  };
  return currencies[countryCode] || 'USD';
};

/**
 * تنسيق الراتب للعرض
 */
const formatSalary = (min, max, countryCode) => {
  const currency = getCurrencyByCountry(countryCode);
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  });

  if (min && max) {
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  } else if (min) {
    return `From ${formatter.format(min)}`;
  } else if (max) {
    return `Up to ${formatter.format(max)}`;
  }
  return 'Salary not specified';
};

/**
 * تنسيق الراتب بالعربية
 */
const formatSalaryArabic = (min, max, countryCode) => {
  const currency = getCurrencyByCountry(countryCode);
  const currencyNames = {
    'SAR': 'ريال',
    'AED': 'درهم',
    'KWD': 'دينار',
    'QAR': 'ريال',
    'BHD': 'دينار',
    'OMR': 'ريال',
    'GBP': 'جنيه',
    'USD': 'دولار',
    'EUR': 'يورو'
  };
  
  const currencyName = currencyNames[currency] || currency;
  
  const formatNumber = (num) => {
    return new Intl.NumberFormat('ar-SA').format(num);
  };

  if (min && max) {
    return `${formatNumber(min)} - ${formatNumber(max)} ${currencyName}`;
  } else if (min) {
    return `من ${formatNumber(min)} ${currencyName}`;
  } else if (max) {
    return `حتى ${formatNumber(max)} ${currencyName}`;
  }
  return 'الراتب غير محدد';
};

/**
 * تنسيق التاريخ
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * تنسيق التاريخ بالعربية
 */
const formatDateArabic = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
  if (diffDays < 365) return `منذ ${Math.floor(diffDays / 30)} أشهر`;
  
  return date.toLocaleDateString('ar-SA', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

/**
 * ترجمة نص واحد - للاستخدام من الـ API
 */
exports.translateJobText = async (text, targetLang = 'ar', sourceLang = 'auto') => {
  return await translateText(text, targetLang, sourceLang);
};
