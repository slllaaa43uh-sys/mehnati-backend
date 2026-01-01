const express = require('express');
const router = express.Router();
const { getCurrentLocation } = require('../services/locationService');

/**
 * @route   GET /api/v1/location/current
 * @desc    الحصول على الموقع الحالي للمستخدم بناءً على IP
 * @access  Public
 */
router.get('/current', async (req, res) => {
  try {
    const locationData = await getCurrentLocation(req);
    
    if (locationData.success) {
      return res.status(200).json({
        success: true,
        location: {
          country: locationData.country,
          countryEn: locationData.countryEn,
          city: locationData.city,
          cityEn: locationData.cityEn,
          countryCode: locationData.countryCode,
          region: locationData.region,
          coordinates: {
            lat: locationData.lat,
            lon: locationData.lon
          },
          timezone: locationData.timezone
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: locationData.message || 'فشل في الحصول على الموقع'
      });
    }
  } catch (error) {
    console.error('Error in /location/current:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/location/from-coordinates
 * @desc    الحصول على الموقع من إحداثيات GPS
 * @access  Public
 */
router.post('/from-coordinates', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تقديم إحداثيات صحيحة (lat, lon)'
      });
    }

    const { getLocationFromCoordinates, translateCountryToArabic, translateCityToArabic } = require('../services/locationService');
    const locationData = await getLocationFromCoordinates(parseFloat(lat), parseFloat(lon));
    
    if (locationData.success) {
      const countryAr = translateCountryToArabic(locationData.country);
      const cityAr = translateCityToArabic(locationData.city, locationData.country);
      
      return res.status(200).json({
        success: true,
        location: {
          country: countryAr,
          countryEn: locationData.country,
          city: cityAr,
          cityEn: locationData.city,
          countryCode: locationData.countryCode,
          region: locationData.region,
          coordinates: {
            lat: locationData.lat,
            lon: locationData.lon
          }
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: locationData.message || 'فشل في الحصول على الموقع'
      });
    }
  } catch (error) {
    console.error('Error in /location/from-coordinates:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

module.exports = router;
