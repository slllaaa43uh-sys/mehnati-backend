const axios = require('axios');

/**
 * ============================================
 * خدمة الموقع الجغرافي (Location Service)
 * ============================================
 * 
 * هذه الخدمة توفر وظائف للحصول على معلومات الموقع الجغرافي
 * بناءً على عنوان IP أو إحداثيات GPS
 */

/**
 * الحصول على الموقع الجغرافي من عنوان IP
 * @param {string} ip - عنوان IP
 * @returns {Promise<Object>} معلومات الموقع (country, city, countryCode)
 */
const getLocationFromIP = async (ip) => {
  try {
    // استخدام خدمة مجانية للحصول على الموقع من IP
    // يمكن استخدام خدمات أخرى مثل ipapi.co أو ipgeolocation.io
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000
    });

    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        country: response.data.country,
        countryCode: response.data.countryCode,
        city: response.data.city,
        region: response.data.regionName,
        lat: response.data.lat,
        lon: response.data.lon,
        timezone: response.data.timezone
      };
    }

    return {
      success: false,
      message: 'فشل في الحصول على الموقع'
    };
  } catch (error) {
    console.error('Error getting location from IP:', error.message);
    return {
      success: false,
      message: 'خطأ في الحصول على الموقع',
      error: error.message
    };
  }
};

/**
 * الحصول على الموقع الجغرافي من إحداثيات GPS
 * @param {number} lat - خط العرض
 * @param {number} lon - خط الطول
 * @returns {Promise<Object>} معلومات الموقع (country, city)
 */
const getLocationFromCoordinates = async (lat, lon) => {
  try {
    // استخدام خدمة Nominatim من OpenStreetMap للحصول على الموقع من الإحداثيات
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
      params: {
        lat,
        lon,
        format: 'json',
        'accept-language': 'ar,en'
      },
      headers: {
        'User-Agent': 'MehnatiApp/1.0'
      },
      timeout: 5000
    });

    if (response.data && response.data.address) {
      const address = response.data.address;
      return {
        success: true,
        country: address.country,
        countryCode: address.country_code?.toUpperCase(),
        city: address.city || address.town || address.village || address.state,
        region: address.state,
        lat,
        lon
      };
    }

    return {
      success: false,
      message: 'فشل في الحصول على الموقع'
    };
  } catch (error) {
    console.error('Error getting location from coordinates:', error.message);
    return {
      success: false,
      message: 'خطأ في الحصول على الموقع',
      error: error.message
    };
  }
};

/**
 * تحويل اسم الدولة بالإنجليزية إلى العربية
 * @param {string} countryEn - اسم الدولة بالإنجليزية
 * @returns {string} اسم الدولة بالعربية
 */
const translateCountryToArabic = (countryEn) => {
  const countryMap = {
    'Saudi Arabia': 'السعودية',
    'United Arab Emirates': 'الإمارات',
    'UAE': 'الإمارات',
    'Egypt': 'مصر',
    'Kuwait': 'الكويت',
    'Qatar': 'قطر',
    'Oman': 'عمان',
    'Bahrain': 'البحرين',
    'Jordan': 'الأردن',
    'Morocco': 'المغرب',
    'Algeria': 'الجزائر',
    'Tunisia': 'تونس',
    'Iraq': 'العراق',
    'Lebanon': 'لبنان',
    'Yemen': 'اليمن',
    'Palestine': 'فلسطين',
    'Sudan': 'السودان',
    'Libya': 'ليبيا',
    'Syria': 'سوريا'
  };

  return countryMap[countryEn] || countryEn;
};

/**
 * تحويل اسم المدينة بالإنجليزية إلى العربية (قائمة محدودة)
 * @param {string} cityEn - اسم المدينة بالإنجليزية
 * @param {string} countryEn - اسم الدولة بالإنجليزية
 * @returns {string} اسم المدينة بالعربية
 */
const translateCityToArabic = (cityEn, countryEn) => {
  // قائمة محدودة من المدن الرئيسية
  const cityMap = {
    // السعودية
    'Riyadh': 'الرياض',
    'Jeddah': 'جدة',
    'Makkah': 'مكة المكرمة',
    'Mecca': 'مكة المكرمة',
    'Madinah': 'المدينة المنورة',
    'Medina': 'المدينة المنورة',
    'Dammam': 'الدمام',
    'Khobar': 'الخبر',
    'Taif': 'الطائف',
    'Tabuk': 'تبوك',
    'Buraydah': 'بريدة',
    'Khamis Mushait': 'خميس مشيط',
    'Al Hofuf': 'الهفوف',
    'Hail': 'حائل',
    'Najran': 'نجران',
    'Jubail': 'الجبيل',
    'Abha': 'أبها',
    'Yanbu': 'ينبع',
    
    // الإمارات
    'Abu Dhabi': 'أبو ظبي',
    'Dubai': 'دبي',
    'Sharjah': 'الشارقة',
    'Ajman': 'عجمان',
    'Ras Al Khaimah': 'رأس الخيمة',
    'Fujairah': 'الفجيرة',
    'Umm Al Quwain': 'أم القيوين',
    'Al Ain': 'العين',
    
    // مصر
    'Cairo': 'القاهرة',
    'Alexandria': 'الإسكندرية',
    'Giza': 'الجيزة',
    'Port Said': 'بورسعيد',
    'Suez': 'السويس',
    'Luxor': 'الأقصر',
    'Aswan': 'أسوان',
    
    // الكويت
    'Kuwait City': 'مدينة الكويت',
    'Al Ahmadi': 'الأحمدي',
    'Hawally': 'حولي',
    'Salmiya': 'السالمية',
    
    // قطر
    'Doha': 'الدوحة',
    'Al Rayyan': 'الريان',
    'Al Wakrah': 'الوكرة',
    
    // عمان
    'Muscat': 'مسقط',
    'Salalah': 'صلالة',
    'Sohar': 'صحار',
    
    // البحرين
    'Manama': 'المنامة',
    'Muharraq': 'المحرق',
    'Riffa': 'الرفاع',
    
    // الأردن
    'Amman': 'عمان',
    'Zarqa': 'الزرقاء',
    'Irbid': 'إربد',
    'Aqaba': 'العقبة'
  };

  return cityMap[cityEn] || cityEn;
};

/**
 * الحصول على الموقع الحالي للمستخدم
 * @param {Object} req - كائن الطلب Express
 * @returns {Promise<Object>} معلومات الموقع
 */
const getCurrentLocation = async (req) => {
  try {
    // الحصول على IP من الطلب
    let ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress;
    
    // تنظيف IP (إزالة ::ffff: من IPv6)
    if (ip && ip.includes('::ffff:')) {
      ip = ip.split('::ffff:')[1];
    }
    
    // تجاهل localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return {
        success: false,
        message: 'لا يمكن تحديد الموقع من localhost'
      };
    }

    // الحصول على الموقع من IP
    const locationData = await getLocationFromIP(ip);
    
    if (locationData.success) {
      // تحويل أسماء الدول والمدن إلى العربية
      const countryAr = translateCountryToArabic(locationData.country);
      const cityAr = translateCityToArabic(locationData.city, locationData.country);
      
      return {
        success: true,
        country: countryAr,
        countryEn: locationData.country,
        city: cityAr,
        cityEn: locationData.city,
        countryCode: locationData.countryCode,
        region: locationData.region,
        lat: locationData.lat,
        lon: locationData.lon,
        timezone: locationData.timezone
      };
    }

    return locationData;
  } catch (error) {
    console.error('Error getting current location:', error.message);
    return {
      success: false,
      message: 'خطأ في الحصول على الموقع الحالي',
      error: error.message
    };
  }
};

module.exports = {
  getLocationFromIP,
  getLocationFromCoordinates,
  translateCountryToArabic,
  translateCityToArabic,
  getCurrentLocation
};
