/**
 * ============================================
 * Custom Hook for External Jobs API
 * ============================================
 * 
 * A reusable hook for fetching jobs from the backend API
 * that integrates with Adzuna.
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
 *     categories, 
 *     countries 
 *   } = useExternalJobs();
 * 
 *   // Search for jobs
 *   searchJobs({ country: 'us', what: 'developer' });
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
 * @returns {Object} - Hook state and methods
 */
export const useExternalJobs = (options = { autoLoadMetadata: true }) => {
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

  /**
   * Fetch jobs from API
   * @param {Object} params - Search parameters
   */
  const searchJobs = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      
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
  }, []);

  /**
   * Fetch available categories
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
   * Fetch supported countries
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
    
    // Methods
    searchJobs,
    fetchCategories,
    fetchCountries,
    clearJobs,
    goToPage
  };
};

/**
 * Helper function to format salary display
 * @param {Object} salary - Salary object from API
 * @returns {string} - Formatted salary string
 */
export const formatSalary = (salary) => {
  if (!salary) return 'Salary not specified';
  return salary.display || 'Salary not specified';
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

export default useExternalJobs;
