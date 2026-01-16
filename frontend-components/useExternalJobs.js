/**
 * ============================================
 * Custom Hook for External Jobs API
 * ============================================
 * 
 * A reusable hook for fetching jobs from the backend API
 * that integrates with Adzuna + Pixabay.
 * 
 * Features:
 * - Auto-prioritize jobs based on user's country
 * - Arabic translations for titles and descriptions
 * - High-quality images from Pixabay
 * - Vertical feed display support
 * 
 * Usage:
 * ```jsx
 * import { useExternalJobs } from './useExternalJobs';
 * 
 * function MyComponent() {
 *   const { 
 *     jobs, 
 *     loading, 
 *     error, 
 *     searchJobs,
 *     searchJobsForMe,
 *     categories, 
 *     countries 
 *   } = useExternalJobs({ userCountry: 'السعودية' });
 * 
 *   // Search for jobs based on user's country
 *   searchJobsForMe();
 *   
 *   // Or search with specific params
 *   searchJobs({ country: 'sa', what: 'developer' });
 * }
 * ```
 */

import { useState, useCallback, useEffect } from 'react';

// API Base URL - configure based on your environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Custom hook for external jobs API
 * @param {Object} options - Hook options
 * @param {boolean} options.autoLoadMetadata - Auto-load categories and countries on mount
 * @param {string} options.userCountry - User's country (from profile)
 * @returns {Object} - Hook state and methods
 */
export const useExternalJobs = (options = { autoLoadMetadata: true, userCountry: null }) => {
  // State
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 0,
    total: 0,
    resultsPerPage: 20
  });
  const [isMixedResults, setIsMixedResults] = useState(false);

  /**
   * Fetch jobs from API
   * @param {Object} params - Search parameters
   */
  const searchJobs = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      
      // Add user country if available
      if (options.userCountry && !params.country) {
        queryParams.append('user_country', options.userCountry);
      }
      
      // Add all non-empty params
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });

      const response = await fetch(
        `${API_BASE_URL}/api/v1/external-jobs?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch jobs');
      }

      setJobs(data.jobs || []);
      setIsMixedResults(data.isMixedResults || false);
      setPagination({
        page: data.page || 1,
        totalPages: data.totalPages || 0,
        total: data.total || 0,
        resultsPerPage: data.results_per_page || 20
      });

      return data;
    } catch (err) {
      const errorMessage = err.message || 'An error occurred while fetching jobs';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [options.userCountry]);

  /**
   * Fetch jobs specifically for the user based on their country
   * @param {Object} params - Additional search parameters
   */
  const searchJobsForMe = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      
      // Add user country
      if (options.userCountry) {
        queryParams.append('user_country', options.userCountry);
      }
      
      // Add all non-empty params
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });

      const response = await fetch(
        `${API_BASE_URL}/api/v1/external-jobs/for-me?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch jobs');
      }

      setJobs(data.jobs || []);
      setIsMixedResults(data.isMixedResults || false);
      setPagination({
        page: data.page || 1,
        totalPages: data.totalPages || 0,
        total: data.total || 0,
        resultsPerPage: data.results_per_page || 20
      });

      return data;
    } catch (err) {
      const errorMessage = err.message || 'An error occurred while fetching jobs';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [options.userCountry]);

  /**
   * Fetch available categories (with Arabic translations)
   */
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/external-jobs/categories`);
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.categories || []);
      }
      
      return data.categories || [];
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      return [];
    }
  }, []);

  /**
   * Fetch supported countries (sorted by priority - Gulf first)
   */
  const fetchCountries = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/external-jobs/countries`);
      const data = await response.json();
      
      if (data.success) {
        setCountries(data.countries || []);
      }
      
      return data.countries || [];
    } catch (err) {
      console.error('Failed to fetch countries:', err);
      return [];
    }
  }, []);

  /**
   * Clear current jobs and error
   */
  const clearJobs = useCallback(() => {
    setJobs([]);
    setError(null);
    setIsMixedResults(false);
    setPagination({
      page: 1,
      totalPages: 0,
      total: 0,
      resultsPerPage: 20
    });
  }, []);

  /**
   * Go to specific page
   */
  const goToPage = useCallback(async (page, currentParams = {}) => {
    return searchJobs({ ...currentParams, page });
  }, [searchJobs]);

  // Auto-load metadata on mount
  useEffect(() => {
    if (options.autoLoadMetadata) {
      fetchCategories();
      fetchCountries();
    }
  }, [options.autoLoadMetadata, fetchCategories, fetchCountries]);

  return {
    // State
    jobs,
    loading,
    error,
    categories,
    countries,
    pagination,
    isMixedResults,
    
    // Methods
    searchJobs,
    searchJobsForMe,
    fetchCategories,
    fetchCountries,
    clearJobs,
    goToPage
  };
};

/**
 * Helper function to format salary display (Arabic)
 * @param {Object} salary - Salary object from API
 * @returns {string} - Formatted salary string in Arabic
 */
export const formatSalary = (salary) => {
  if (!salary) return 'الراتب غير محدد';
  return salary.displayAr || salary.display || 'الراتب غير محدد';
};

/**
 * Helper function to get job title (Arabic preferred)
 * @param {Object} title - Title object from API
 * @returns {string} - Job title in Arabic
 */
export const getJobTitle = (title) => {
  if (!title) return 'وظيفة';
  if (typeof title === 'string') return title;
  return title.ar || title.display || title.en || 'وظيفة';
};

/**
 * Helper function to get job description (Arabic preferred)
 * @param {Object} description - Description object from API
 * @returns {string} - Job description in Arabic
 */
export const getJobDescription = (description) => {
  if (!description) return '';
  if (typeof description === 'string') return description;
  return description.ar || description.display || description.en || '';
};

/**
 * Helper function to get job image URL
 * @param {Object} media - Media object from API
 * @returns {string} - Image URL
 */
export const getJobImage = (media) => {
  if (!media) return null;
  return media.url || media.thumbnail || null;
};

/**
 * Helper function to check if media is video
 * @param {Object} media - Media object from API
 * @returns {boolean} - True if video
 */
export const isVideoMedia = (media) => {
  return media?.type === 'video';
};

/**
 * Helper function to get category icon name
 * @param {string} categoryTag - Category tag from API
 * @returns {string} - Icon name for the category
 */
export const getCategoryIcon = (categoryTag) => {
  const iconMap = {
    'accounting-finance-jobs': 'dollar-sign',
    'it-jobs': 'code',
    'sales-jobs': 'megaphone',
    'customer-services-jobs': 'users',
    'engineering-jobs': 'wrench',
    'hr-jobs': 'users',
    'healthcare-nursing-jobs': 'heart-pulse',
    'hospitality-catering-jobs': 'utensils',
    'pr-advertising-marketing-jobs': 'megaphone',
    'logistics-warehouse-jobs': 'truck',
    'teaching-jobs': 'graduation-cap',
    'trade-construction-jobs': 'hard-hat',
    'admin-jobs': 'briefcase',
    'legal-jobs': 'scale',
    'creative-design-jobs': 'palette',
    'graduate-jobs': 'graduation-cap',
    'retail-jobs': 'shopping-bag',
    'consultancy-jobs': 'briefcase',
    'manufacturing-jobs': 'factory',
    'scientific-qa-jobs': 'flask',
    'social-work-jobs': 'heart',
    'travel-jobs': 'plane',
    'energy-oil-gas-jobs': 'zap',
    'property-jobs': 'home',
    'charity-voluntary-jobs': 'heart',
    'domestic-help-cleaning-jobs': 'home',
    'maintenance-jobs': 'wrench',
    'part-time-jobs': 'clock',
    'other-general-jobs': 'briefcase'
  };

  return iconMap[categoryTag] || 'briefcase';
};

/**
 * Example Job Card Component (React Native)
 * Copy this to your frontend and customize as needed
 */
export const ExampleJobCard = `
// ExternalJobCard.jsx - مثال على كارت الوظيفة
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { getJobTitle, getJobDescription, getJobImage, formatSalary, isVideoMedia } from './useExternalJobs';

const { width } = Dimensions.get('window');

const ExternalJobCard = ({ job, onPress }) => {
  const imageUrl = getJobImage(job.media);
  const title = getJobTitle(job.title);
  const description = getJobDescription(job.description);
  const salary = formatSalary(job.salary);
  
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(job)}>
      {/* صورة الوظيفة من Pixabay */}
      {imageUrl && (
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.image}
          resizeMode="cover"
        />
      )}
      
      {/* معلومات الوظيفة */}
      <View style={styles.content}>
        {/* العنوان بالعربية */}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        
        {/* اسم الشركة */}
        {job.company?.name && (
          <View style={styles.companyRow}>
            <Image 
              source={{ uri: job.company.logo || job.company.logoFallback }}
              style={styles.companyLogo}
            />
            <Text style={styles.companyName}>{job.company.name}</Text>
          </View>
        )}
        
        {/* الموقع */}
        <Text style={styles.location}>
          📍 {job.location?.countryAr || job.location?.country}
          {job.location?.display ? ' - ' + job.location.display : ''}
        </Text>
        
        {/* الراتب */}
        <Text style={styles.salary}>{salary}</Text>
        
        {/* التاريخ */}
        <Text style={styles.date}>{job.dates?.postedAr || job.dates?.posted}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'right',
    marginBottom: 8,
  },
  companyRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 8,
  },
  companyLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginLeft: 8,
  },
  companyName: {
    fontSize: 14,
    color: '#666',
  },
  location: {
    fontSize: 14,
    color: '#888',
    textAlign: 'right',
    marginBottom: 4,
  },
  salary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2ecc71',
    textAlign: 'right',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'right',
  },
});

export default ExternalJobCard;
`;

export default useExternalJobs;
