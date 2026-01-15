/**
 * ============================================
 * خدمة الوظائف الخارجية - Adzuna API
 * ============================================
 * 
 * هذه الخدمة تقوم بجلب الوظائف من Adzuna API
 * وتوفر واجهة موحدة للبحث عن الوظائف العالمية
 */

const axios = require('axios');

// إعدادات Adzuna API
const ADZUNA_CONFIG = {
  APP_ID: '4cba22c2',
  APP_KEY: '55a99895e575dec59446a506164c6d7f',
  BASE_URL: 'https://api.adzuna.com/v1/api/jobs'
};

// الدول المدعومة من Adzuna
const SUPPORTED_COUNTRIES = {
  'gb': 'United Kingdom',
  'us': 'United States',
  'au': 'Australia',
  'at': 'Austria',
  'be': 'Belgium',
  'br': 'Brazil',
  'ca': 'Canada',
  'ch': 'Switzerland',
  'de': 'Germany',
  'es': 'Spain',
  'fr': 'France',
  'in': 'India',
  'it': 'Italy',
  'mx': 'Mexico',
  'nl': 'Netherlands',
  'nz': 'New Zealand',
  'pl': 'Poland',
  'ru': 'Russia',
  'sg': 'Singapore',
  'za': 'South Africa'
};

// التصنيفات المتاحة
const JOB_CATEGORIES = {
  'accounting-finance-jobs': 'Accounting & Finance',
  'it-jobs': 'IT & Technology',
  'sales-jobs': 'Sales',
  'customer-services-jobs': 'Customer Service',
  'engineering-jobs': 'Engineering',
  'hr-jobs': 'HR & Recruitment',
  'healthcare-nursing-jobs': 'Healthcare & Nursing',
  'hospitality-catering-jobs': 'Hospitality & Catering',
  'pr-advertising-marketing-jobs': 'Marketing & PR',
  'logistics-warehouse-jobs': 'Logistics & Warehouse',
  'teaching-jobs': 'Teaching & Education',
  'trade-construction-jobs': 'Trade & Construction',
  'admin-jobs': 'Admin',
  'legal-jobs': 'Legal',
  'creative-design-jobs': 'Creative & Design',
  'graduate-jobs': 'Graduate',
  'retail-jobs': 'Retail',
  'consultancy-jobs': 'Consultancy',
  'manufacturing-jobs': 'Manufacturing',
  'scientific-qa-jobs': 'Scientific & QA',
  'social-work-jobs': 'Social Work',
  'travel-jobs': 'Travel & Tourism',
  'energy-oil-gas-jobs': 'Energy & Oil/Gas',
  'property-jobs': 'Property',
  'charity-voluntary-jobs': 'Charity & Voluntary',
  'domestic-help-cleaning-jobs': 'Domestic Help & Cleaning',
  'maintenance-jobs': 'Maintenance',
  'part-time-jobs': 'Part Time',
  'other-general-jobs': 'Other / General'
};

/**
 * جلب الوظائف من Adzuna API
 * @param {Object} params - معاملات البحث
 * @param {string} params.country - رمز الدولة (مثل: gb, us, de)
 * @param {string} params.category - تصنيف الوظيفة
 * @param {string} params.what - كلمات البحث
 * @param {string} params.where - الموقع/المدينة
 * @param {number} params.page - رقم الصفحة
 * @param {number} params.results_per_page - عدد النتائج في الصفحة
 * @param {string} params.sort_by - ترتيب النتائج (date, salary, relevance)
 * @param {number} params.salary_min - الحد الأدنى للراتب
 * @param {number} params.salary_max - الحد الأقصى للراتب
 * @param {string} params.contract_type - نوع العقد (permanent, contract)
 * @param {string} params.full_time - دوام كامل أو جزئي
 * @returns {Promise<Object>} - قائمة الوظائف
 */
exports.fetchJobs = async (params = {}) => {
  try {
    const {
      country = 'gb',
      category = '',
      what = '',
      where = '',
      page = 1,
      results_per_page = 20,
      sort_by = 'date',
      salary_min,
      salary_max,
      contract_type,
      full_time
    } = params;

    // التحقق من صحة الدولة
    const countryCode = country.toLowerCase();
    if (!SUPPORTED_COUNTRIES[countryCode]) {
      throw new Error(`الدولة غير مدعومة: ${country}. الدول المدعومة: ${Object.keys(SUPPORTED_COUNTRIES).join(', ')}`);
    }

    // بناء رابط الـ API
    let url = `${ADZUNA_CONFIG.BASE_URL}/${countryCode}/search/${page}`;

    // بناء معاملات الاستعلام
    const queryParams = {
      app_id: ADZUNA_CONFIG.APP_ID,
      app_key: ADZUNA_CONFIG.APP_KEY,
      results_per_page: Math.min(results_per_page, 50), // الحد الأقصى 50
      sort_by
    };

    // إضافة المعاملات الاختيارية
    if (what) queryParams.what = what;
    if (where) queryParams.where = where;
    if (category && JOB_CATEGORIES[category]) queryParams.category = category;
    if (salary_min) queryParams.salary_min = salary_min;
    if (salary_max) queryParams.salary_max = salary_max;
    if (contract_type) queryParams.contract_type = contract_type;
    if (full_time !== undefined) queryParams.full_time = full_time ? 1 : 0;

    console.log('[ExternalJobsService] Fetching jobs from Adzuna:', { url, params: queryParams });

    // إرسال الطلب
    const response = await axios.get(url, {
      params: queryParams,
      timeout: 15000 // 15 ثانية timeout
    });

    // تحويل البيانات إلى تنسيق موحد
    const jobs = (response.data.results || []).map(job => formatJob(job, countryCode));

    return {
      success: true,
      count: jobs.length,
      total: response.data.count || 0,
      page: parseInt(page),
      results_per_page: parseInt(results_per_page),
      totalPages: Math.ceil((response.data.count || 0) / results_per_page),
      country: {
        code: countryCode,
        name: SUPPORTED_COUNTRIES[countryCode]
      },
      jobs
    };

  } catch (error) {
    console.error('[ExternalJobsService] Error fetching jobs:', error.message);
    
    // معالجة أخطاء محددة
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
 * @returns {Object} - قائمة التصنيفات
 */
exports.getCategories = () => {
  return {
    success: true,
    categories: Object.entries(JOB_CATEGORIES).map(([key, value]) => ({
      id: key,
      name: value
    }))
  };
};

/**
 * جلب الدول المدعومة
 * @returns {Object} - قائمة الدول
 */
exports.getSupportedCountries = () => {
  return {
    success: true,
    countries: Object.entries(SUPPORTED_COUNTRIES).map(([code, name]) => ({
      code,
      name
    }))
  };
};

/**
 * تنسيق بيانات الوظيفة
 * @param {Object} job - بيانات الوظيفة من Adzuna
 * @param {string} countryCode - رمز الدولة
 * @returns {Object} - بيانات الوظيفة المنسقة
 */
const formatJob = (job, countryCode) => {
  // استخراج اسم الشركة
  const companyName = job.company?.display_name || 'Unknown Company';
  
  // تنظيف اسم الشركة للاستخدام في رابط اللوجو
  const cleanCompanyName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  // بناء رابط اللوجو من Clearbit
  const logoUrl = cleanCompanyName ? `https://logo.clearbit.com/${cleanCompanyName}.com` : null;

  return {
    id: job.id,
    title: job.title,
    description: job.description,
    company: {
      name: companyName,
      logo: logoUrl,
      // رابط بديل للوجو في حالة فشل Clearbit
      logoFallback: `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=random&color=fff&size=128`
    },
    location: {
      display: job.location?.display_name || '',
      area: job.location?.area || [],
      country: SUPPORTED_COUNTRIES[countryCode]
    },
    salary: {
      min: job.salary_min || null,
      max: job.salary_max || null,
      currency: getCurrencyByCountry(countryCode),
      display: formatSalary(job.salary_min, job.salary_max, countryCode)
    },
    category: {
      tag: job.category?.tag || '',
      label: job.category?.label || ''
    },
    contract: {
      type: job.contract_type || null,
      time: job.contract_time || null
    },
    dates: {
      created: job.created,
      posted: formatDate(job.created)
    },
    url: job.redirect_url,
    source: 'adzuna'
  };
};

/**
 * الحصول على العملة حسب الدولة
 * @param {string} countryCode - رمز الدولة
 * @returns {string} - رمز العملة
 */
const getCurrencyByCountry = (countryCode) => {
  const currencies = {
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
 * @param {number} min - الحد الأدنى
 * @param {number} max - الحد الأقصى
 * @param {string} countryCode - رمز الدولة
 * @returns {string} - الراتب المنسق
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
 * تنسيق التاريخ
 * @param {string} dateString - التاريخ
 * @returns {string} - التاريخ المنسق
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
