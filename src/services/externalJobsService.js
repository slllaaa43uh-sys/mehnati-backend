/**
 * ============================================
 * خدمة الوظائف الخارجية - Adzuna API + Pixabay
 * ============================================
 * 
 * هذه الخدمة تقوم بجلب الوظائف من Adzuna API
 * مع دعم الأولوية حسب دولة المستخدم
 * والترجمة التلقائية للعربية
 * وصور عالية الجودة من Pixabay
 */

const axios = require('axios');

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

// قاموس ترجمة المسميات الوظيفية الشائعة
const JOB_TITLE_TRANSLATIONS = {
  // تقنية المعلومات
  'software engineer': 'مهندس برمجيات',
  'software developer': 'مطور برمجيات',
  'web developer': 'مطور ويب',
  'frontend developer': 'مطور واجهات أمامية',
  'backend developer': 'مطور خلفي',
  'full stack developer': 'مطور متكامل',
  'mobile developer': 'مطور تطبيقات جوال',
  'ios developer': 'مطور iOS',
  'android developer': 'مطور أندرويد',
  'data scientist': 'عالم بيانات',
  'data analyst': 'محلل بيانات',
  'data engineer': 'مهندس بيانات',
  'machine learning engineer': 'مهندس تعلم آلي',
  'ai engineer': 'مهندس ذكاء اصطناعي',
  'devops engineer': 'مهندس DevOps',
  'cloud engineer': 'مهندس سحابي',
  'system administrator': 'مدير أنظمة',
  'network engineer': 'مهندس شبكات',
  'security engineer': 'مهندس أمن معلومات',
  'qa engineer': 'مهندس ضمان جودة',
  'test engineer': 'مهندس اختبار',
  'product manager': 'مدير منتج',
  'project manager': 'مدير مشروع',
  'scrum master': 'سكرم ماستر',
  'technical lead': 'قائد تقني',
  'tech lead': 'قائد تقني',
  'cto': 'المدير التقني',
  'it manager': 'مدير تقنية المعلومات',
  'it support': 'دعم تقني',
  'help desk': 'مكتب المساعدة',
  'database administrator': 'مدير قواعد بيانات',
  'ui designer': 'مصمم واجهات',
  'ux designer': 'مصمم تجربة المستخدم',
  'ui/ux designer': 'مصمم واجهات وتجربة المستخدم',
  
  // الهندسة
  'engineer': 'مهندس',
  'civil engineer': 'مهندس مدني',
  'mechanical engineer': 'مهندس ميكانيكي',
  'electrical engineer': 'مهندس كهربائي',
  'chemical engineer': 'مهندس كيميائي',
  'industrial engineer': 'مهندس صناعي',
  'petroleum engineer': 'مهندس بترول',
  'structural engineer': 'مهندس إنشائي',
  'architect': 'مهندس معماري',
  'interior designer': 'مصمم داخلي',
  
  // الإدارة والمالية
  'accountant': 'محاسب',
  'senior accountant': 'محاسب أول',
  'chief accountant': 'رئيس الحسابات',
  'financial analyst': 'محلل مالي',
  'finance manager': 'مدير مالي',
  'cfo': 'المدير المالي',
  'auditor': 'مدقق حسابات',
  'bookkeeper': 'ماسك دفاتر',
  'tax specialist': 'أخصائي ضرائب',
  'payroll specialist': 'أخصائي رواتب',
  'hr manager': 'مدير موارد بشرية',
  'hr specialist': 'أخصائي موارد بشرية',
  'recruiter': 'موظف توظيف',
  'talent acquisition': 'استقطاب المواهب',
  'office manager': 'مدير مكتب',
  'executive assistant': 'مساعد تنفيذي',
  'administrative assistant': 'مساعد إداري',
  'secretary': 'سكرتير',
  'receptionist': 'موظف استقبال',
  'ceo': 'الرئيس التنفيذي',
  'coo': 'مدير العمليات',
  'general manager': 'مدير عام',
  'operations manager': 'مدير عمليات',
  'business analyst': 'محلل أعمال',
  'consultant': 'مستشار',
  'management consultant': 'مستشار إداري',
  
  // المبيعات والتسويق
  'sales manager': 'مدير مبيعات',
  'sales representative': 'مندوب مبيعات',
  'sales executive': 'تنفيذي مبيعات',
  'account manager': 'مدير حسابات',
  'business development': 'تطوير أعمال',
  'marketing manager': 'مدير تسويق',
  'marketing specialist': 'أخصائي تسويق',
  'digital marketing': 'تسويق رقمي',
  'social media manager': 'مدير وسائل التواصل',
  'content writer': 'كاتب محتوى',
  'copywriter': 'كاتب إعلاني',
  'seo specialist': 'أخصائي SEO',
  'brand manager': 'مدير علامة تجارية',
  'public relations': 'علاقات عامة',
  
  // خدمة العملاء
  'customer service': 'خدمة عملاء',
  'customer support': 'دعم العملاء',
  'call center agent': 'موظف مركز اتصال',
  'customer success': 'نجاح العملاء',
  
  // الصحة والطب
  'doctor': 'طبيب',
  'physician': 'طبيب',
  'nurse': 'ممرض',
  'registered nurse': 'ممرض مسجل',
  'pharmacist': 'صيدلي',
  'dentist': 'طبيب أسنان',
  'surgeon': 'جراح',
  'medical assistant': 'مساعد طبي',
  'lab technician': 'فني مختبر',
  'radiologist': 'أخصائي أشعة',
  'physiotherapist': 'أخصائي علاج طبيعي',
  
  // التعليم
  'teacher': 'معلم',
  'professor': 'أستاذ جامعي',
  'lecturer': 'محاضر',
  'trainer': 'مدرب',
  'tutor': 'مدرس خصوصي',
  'teaching assistant': 'مساعد تدريس',
  
  // الضيافة والسياحة
  'chef': 'شيف',
  'cook': 'طباخ',
  'waiter': 'نادل',
  'hotel manager': 'مدير فندق',
  'front desk': 'موظف استقبال',
  'housekeeper': 'عامل نظافة',
  'tour guide': 'مرشد سياحي',
  
  // النقل واللوجستيات
  'driver': 'سائق',
  'truck driver': 'سائق شاحنة',
  'delivery driver': 'سائق توصيل',
  'logistics manager': 'مدير لوجستيات',
  'warehouse manager': 'مدير مستودع',
  'supply chain': 'سلسلة الإمداد',
  'procurement': 'مشتريات',
  'purchasing manager': 'مدير مشتريات',
  
  // القانون
  'lawyer': 'محامي',
  'legal advisor': 'مستشار قانوني',
  'paralegal': 'مساعد قانوني',
  'legal secretary': 'سكرتير قانوني',
  
  // التصميم والإبداع
  'graphic designer': 'مصمم جرافيك',
  'creative director': 'مدير إبداعي',
  'art director': 'مدير فني',
  'photographer': 'مصور',
  'videographer': 'مصور فيديو',
  'video editor': 'محرر فيديو',
  'animator': 'رسام متحرك',
  '3d artist': 'فنان ثلاثي الأبعاد',
  
  // أخرى
  'manager': 'مدير',
  'supervisor': 'مشرف',
  'coordinator': 'منسق',
  'specialist': 'أخصائي',
  'analyst': 'محلل',
  'assistant': 'مساعد',
  'intern': 'متدرب',
  'trainee': 'متدرب',
  'senior': 'أول',
  'junior': 'مبتدئ',
  'lead': 'قائد',
  'head': 'رئيس',
  'director': 'مدير',
  'vice president': 'نائب الرئيس',
  'president': 'رئيس',
  'founder': 'مؤسس',
  'co-founder': 'شريك مؤسس',
  'owner': 'مالك',
  'freelancer': 'مستقل',
  'contractor': 'متعاقد',
  'technician': 'فني',
  'operator': 'مشغل',
  'worker': 'عامل',
  'cleaner': 'عامل نظافة',
  'security guard': 'حارس أمن',
  'electrician': 'كهربائي',
  'plumber': 'سباك',
  'carpenter': 'نجار',
  'mechanic': 'ميكانيكي',
  'welder': 'لحام'
};

// كاش للصور لتجنب التكرار
const imageCache = new Map();

/**
 * تحويل اسم الدولة إلى رمز الدولة
 * @param {string} countryName - اسم الدولة (عربي أو إنجليزي)
 * @returns {string|null} - رمز الدولة أو null
 */
const getCountryCode = (countryName) => {
  if (!countryName) return null;
  
  const normalized = countryName.toLowerCase().trim();
  
  // إذا كان رمز دولة مباشرة
  if (SUPPORTED_COUNTRIES[normalized]) {
    return normalized;
  }
  
  // البحث في خريطة الأسماء
  if (COUNTRY_NAME_TO_CODE[normalized]) {
    return COUNTRY_NAME_TO_CODE[normalized];
  }
  
  // البحث الجزئي
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      return code;
    }
  }
  
  return null;
};

/**
 * ترجمة عنوان الوظيفة إلى العربية
 * @param {string} title - عنوان الوظيفة بالإنجليزية
 * @returns {Object} - العنوان بالعربية والإنجليزية
 */
const translateJobTitle = (title) => {
  if (!title) return { ar: 'وظيفة', en: '' };
  
  const lowerTitle = title.toLowerCase().trim();
  
  // البحث عن ترجمة مباشرة
  if (JOB_TITLE_TRANSLATIONS[lowerTitle]) {
    return {
      ar: JOB_TITLE_TRANSLATIONS[lowerTitle],
      en: title
    };
  }
  
  // البحث عن ترجمة جزئية
  let arabicTitle = title;
  let foundTranslation = false;
  
  for (const [eng, ar] of Object.entries(JOB_TITLE_TRANSLATIONS)) {
    if (lowerTitle.includes(eng)) {
      arabicTitle = arabicTitle.replace(new RegExp(eng, 'gi'), ar);
      foundTranslation = true;
    }
  }
  
  // إذا لم نجد ترجمة، نستخدم ترجمة عامة
  if (!foundTranslation) {
    // محاولة ترجمة الكلمات الفردية
    const words = lowerTitle.split(/\s+/);
    const translatedWords = words.map(word => {
      return JOB_TITLE_TRANSLATIONS[word] || word;
    });
    arabicTitle = translatedWords.join(' ');
  }
  
  return {
    ar: arabicTitle,
    en: title
  };
};

/**
 * ترجمة الوصف إلى العربية (ملخص)
 * @param {string} description - الوصف بالإنجليزية
 * @returns {Object} - الوصف بالعربية والإنجليزية
 */
const translateDescription = (description) => {
  if (!description) return { ar: '', en: '' };
  
  // تنظيف الوصف
  let cleanDesc = description
    .replace(/<[^>]*>/g, '') // إزالة HTML
    .replace(/\s+/g, ' ')
    .trim();
  
  // اختصار الوصف إذا كان طويلاً
  if (cleanDesc.length > 500) {
    cleanDesc = cleanDesc.substring(0, 500) + '...';
  }
  
  // ترجمة بعض الكلمات الشائعة في الوصف
  let arabicDesc = cleanDesc;
  const descTranslations = {
    'we are looking for': 'نبحث عن',
    'looking for': 'نبحث عن',
    'required': 'مطلوب',
    'requirements': 'المتطلبات',
    'responsibilities': 'المسؤوليات',
    'experience': 'خبرة',
    'years of experience': 'سنوات خبرة',
    'skills': 'مهارات',
    'qualifications': 'المؤهلات',
    'benefits': 'المزايا',
    'salary': 'الراتب',
    'full time': 'دوام كامل',
    'part time': 'دوام جزئي',
    'remote': 'عن بعد',
    'hybrid': 'هجين',
    'on-site': 'في الموقع',
    'apply now': 'قدم الآن',
    'join our team': 'انضم لفريقنا',
    'opportunity': 'فرصة',
    'position': 'وظيفة',
    'role': 'دور',
    'job': 'وظيفة'
  };
  
  for (const [eng, ar] of Object.entries(descTranslations)) {
    arabicDesc = arabicDesc.replace(new RegExp(eng, 'gi'), ar);
  }
  
  return {
    ar: arabicDesc,
    en: cleanDesc
  };
};

/**
 * جلب صورة من Pixabay بناءً على عنوان الوظيفة
 * @param {string} jobTitle - عنوان الوظيفة بالإنجليزية
 * @returns {Promise<Object>} - بيانات الصورة
 */
const fetchPixabayImage = async (jobTitle) => {
  try {
    // استخراج كلمة البحث الرئيسية من العنوان
    const searchTerms = extractSearchTerms(jobTitle);
    const cacheKey = searchTerms.join('-');
    
    // التحقق من الكاش
    if (imageCache.has(cacheKey)) {
      const cachedImages = imageCache.get(cacheKey);
      // اختيار صورة عشوائية من الكاش
      const randomIndex = Math.floor(Math.random() * cachedImages.length);
      return cachedImages[randomIndex];
    }
    
    // تحديد نوع الوسائط (صور 90%، فيديو 10%)
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
        params,
        timeout: 10000
      });
    }
    
    const hits = response.data.hits || [];
    
    if (hits.length === 0) {
      // إذا لم نجد نتائج، نبحث بكلمة عامة
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
    
    // تخزين النتائج في الكاش
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
    
    // اختيار صورة عشوائية من أفضل 20 نتيجة
    const randomIndex = Math.floor(Math.random() * Math.min(formattedImages.length, 20));
    return formattedImages[randomIndex];
    
  } catch (error) {
    console.error('[Pixabay] Error fetching image:', error.message);
    return null;
  }
};

/**
 * استخراج كلمات البحث من عنوان الوظيفة
 * @param {string} title - عنوان الوظيفة
 * @returns {Array<string>} - كلمات البحث
 */
const extractSearchTerms = (title) => {
  if (!title) return ['business', 'work'];
  
  const lowerTitle = title.toLowerCase();
  
  // كلمات البحث حسب نوع الوظيفة
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
  
  // إذا لم نجد تطابق، نستخدم الكلمة الأولى مع كلمات عامة
  const words = title.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0) {
    return [words[0], 'professional', 'work'];
  }
  
  return ['business', 'professional', 'work'];
};

/**
 * جلب الوظائف من Adzuna API مع دعم أولوية دولة المستخدم
 * @param {Object} params - معاملات البحث
 * @returns {Promise<Object>} - قائمة الوظائف
 */
exports.fetchJobs = async (params = {}) => {
  try {
    const {
      country,
      userCountry, // دولة المستخدم من الحساب
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

    // تحديد الدولة المستهدفة
    let targetCountry = country;
    
    // إذا لم يتم تحديد دولة، نستخدم دولة المستخدم
    if (!targetCountry && userCountry) {
      targetCountry = getCountryCode(userCountry);
    }
    
    // الدول المدعومة فعلياً من Adzuna
    const adzunaSupportedCountries = ['gb', 'us', 'au', 'at', 'be', 'br', 'ca', 'ch', 'de', 'es', 'fr', 'in', 'it', 'mx', 'nl', 'nz', 'pl', 'ru', 'sg', 'za'];
    
    // إذا كانت الدولة غير مدعومة من Adzuna، نجلب مختلط
    let countryCode = targetCountry?.toLowerCase();
    let isMixedResults = false;
    
    if (!countryCode || !adzunaSupportedCountries.includes(countryCode)) {
      // جلب من دول متعددة (مختلط)
      isMixedResults = true;
      countryCode = 'gb'; // نبدأ بالمملكة المتحدة كافتراضي
    }

    // بناء رابط الـ API
    let url = `${ADZUNA_CONFIG.BASE_URL}/${countryCode}/search/${page}`;

    // بناء معاملات الاستعلام
    const queryParams = {
      app_id: ADZUNA_CONFIG.APP_ID,
      app_key: ADZUNA_CONFIG.APP_KEY,
      results_per_page: Math.min(results_per_page, 50),
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

    console.log('[ExternalJobsService] Fetching jobs from Adzuna:', { url, params: queryParams, userCountry, isMixedResults });

    // إرسال الطلب
    const response = await axios.get(url, {
      params: queryParams,
      timeout: 15000
    });

    // تحويل البيانات إلى تنسيق موحد مع الترجمة والصور
    const jobs = await Promise.all(
      (response.data.results || []).map(job => formatJobWithTranslationAndImage(job, countryCode))
    );

    // إذا كانت النتائج مختلطة، نضيف معلومات إضافية
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
 * @returns {Object} - قائمة التصنيفات
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
 * @returns {Object} - قائمة الدول
 */
exports.getSupportedCountries = () => {
  // ترتيب الدول حسب الأولوية (الخليج أولاً)
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
 * تنسيق بيانات الوظيفة مع الترجمة والصورة
 * @param {Object} job - بيانات الوظيفة من Adzuna
 * @param {string} countryCode - رمز الدولة
 * @returns {Promise<Object>} - بيانات الوظيفة المنسقة
 */
const formatJobWithTranslationAndImage = async (job, countryCode) => {
  // ترجمة العنوان
  const translatedTitle = translateJobTitle(job.title);
  
  // ترجمة الوصف
  const translatedDescription = translateDescription(job.description);
  
  // جلب صورة من Pixabay
  const pixabayImage = await fetchPixabayImage(job.title);
  
  // استخراج اسم الشركة
  const companyName = job.company?.display_name || 'شركة غير محددة';
  
  // تنظيف اسم الشركة للاستخدام في رابط اللوجو
  const cleanCompanyName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  // بناء رابط اللوجو من Clearbit
  const logoUrl = cleanCompanyName ? `https://logo.clearbit.com/${cleanCompanyName}.com` : null;

  const countryInfo = SUPPORTED_COUNTRIES[countryCode] || { en: 'Unknown', ar: 'غير معروف' };

  return {
    id: job.id,
    title: {
      ar: translatedTitle.ar,
      en: translatedTitle.en,
      display: translatedTitle.ar // العنوان المعروض بالعربية
    },
    description: {
      ar: translatedDescription.ar,
      en: translatedDescription.en,
      display: translatedDescription.ar
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
