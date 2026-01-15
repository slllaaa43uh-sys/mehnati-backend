/**
 * ============================================
 * Global Jobs Search Page Component
 * ============================================
 * 
 * Complete page component for searching and displaying
 * jobs from Adzuna API with filters and pagination.
 * 
 * Dependencies:
 * - React 18+
 * - Tailwind CSS
 * - lucide-react
 * - axios (or fetch)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  MapPin,
  Filter,
  Globe,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  RefreshCw
} from 'lucide-react';
import { JobList } from './JobCard';

// ============================================
// API Configuration
// ============================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ============================================
// Custom Hook for Jobs API
// ============================================
const useJobsAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJobs = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    
    try {
      const queryString = new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
      ).toString();
      
      const response = await fetch(`${API_BASE_URL}/api/v1/external-jobs?${queryString}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch jobs');
      }
      
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/external-jobs/categories`);
    return response.json();
  }, []);

  const fetchCountries = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/external-jobs/countries`);
    return response.json();
  }, []);

  return { fetchJobs, fetchCategories, fetchCountries, loading, error };
};

// ============================================
// Search Filters Component
// ============================================
const SearchFilters = ({ 
  filters, 
  onFilterChange, 
  categories, 
  countries,
  onSearch,
  loading 
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      {/* Main Search Row */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Job title, keywords, or company..."
            value={filters.what}
            onChange={(e) => onFilterChange('what', e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Location Input */}
        <div className="flex-1 relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="City or region..."
            value={filters.where}
            onChange={(e) => onFilterChange('where', e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Country Select */}
        <div className="relative min-w-[180px]">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={filters.country}
            onChange={(e) => onFilterChange('country', e.target.value)}
            className="w-full pl-12 pr-10 py-3 border border-gray-200 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {/* Search Button */}
        <button
          onClick={onSearch}
          disabled={loading}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium transition-colors flex items-center gap-2 justify-center"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
          Search
        </button>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-4 flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm">Advanced Filters</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={filters.category}
              onChange={(e) => onFilterChange('category', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Contract Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contract Type</label>
            <select
              value={filters.contract_type}
              onChange={(e) => onFilterChange('contract_type', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="permanent">Permanent</option>
              <option value="contract">Contract</option>
            </select>
          </div>

          {/* Full Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work Type</label>
            <select
              value={filters.full_time}
              onChange={(e) => onFilterChange('full_time', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="1">Full Time</option>
              <option value="0">Part Time</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={filters.sort_by}
              onChange={(e) => onFilterChange('sort_by', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Most Recent</option>
              <option value="salary">Highest Salary</option>
              <option value="relevance">Relevance</option>
            </select>
          </div>

          {/* Min Salary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Min Salary</label>
            <input
              type="number"
              placeholder="e.g., 30000"
              value={filters.salary_min}
              onChange={(e) => onFilterChange('salary_min', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Max Salary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Salary</label>
            <input
              type="number"
              placeholder="e.g., 100000"
              value={filters.salary_max}
              onChange={(e) => onFilterChange('salary_max', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Pagination Component
// ============================================
const Pagination = ({ currentPage, totalPages, onPageChange, loading }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            1
          </button>
          {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          disabled={loading}
          className={`px-4 py-2 rounded-lg transition-colors ${
            page === currentPage
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || loading}
        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

// ============================================
// Main Jobs Search Page Component
// ============================================
const JobsSearchPage = () => {
  const { fetchJobs, fetchCategories, fetchCountries, loading, error } = useJobsAPI();
  
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const [filters, setFilters] = useState({
    what: '',
    where: '',
    country: 'gb',
    category: '',
    contract_type: '',
    full_time: '',
    sort_by: 'date',
    salary_min: '',
    salary_max: '',
    page: 1,
    results_per_page: 20
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [categoriesData, countriesData] = await Promise.all([
          fetchCategories(),
          fetchCountries()
        ]);
        
        setCategories(categoriesData.categories || []);
        setCountries(countriesData.countries || []);
        
        // Load initial jobs
        handleSearch();
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };

    loadInitialData();
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: key !== 'page' ? 1 : value }));
  }, []);

  const handleSearch = useCallback(async () => {
    try {
      const result = await fetchJobs(filters);
      setJobs(result.jobs || []);
      setTotalJobs(result.total || 0);
      setTotalPages(result.totalPages || 0);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, [filters, fetchJobs]);

  const handlePageChange = useCallback((page) => {
    setFilters(prev => ({ ...prev, page }));
    // Trigger search with new page
    setTimeout(() => handleSearch(), 0);
  }, [handleSearch]);

  const handleJobClick = useCallback((job) => {
    // Open job URL in new tab
    window.open(job.url, '_blank', 'noopener,noreferrer');
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      what: '',
      where: '',
      country: 'gb',
      category: '',
      contract_type: '',
      full_time: '',
      sort_by: 'date',
      salary_min: '',
      salary_max: '',
      page: 1,
      results_per_page: 20
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Global Jobs Search</h1>
          <p className="text-blue-100 text-lg">
            Find your dream job from thousands of opportunities worldwide
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 -mt-6">
        {/* Search Filters */}
        <SearchFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          categories={categories}
          countries={countries}
          onSearch={handleSearch}
          loading={loading}
        />

        {/* Results Header */}
        <div className="flex items-center justify-between mt-8 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {loading ? 'Searching...' : `${totalJobs.toLocaleString()} Jobs Found`}
            </h2>
            {filters.what && (
              <p className="text-gray-500 text-sm mt-1">
                Results for "{filters.what}" {filters.where && `in ${filters.where}`}
              </p>
            )}
          </div>
          
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Clear Filters</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
            <X className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Job List */}
        <JobList 
          jobs={jobs} 
          loading={loading} 
          onJobClick={handleJobClick}
        />

        {/* Pagination */}
        <Pagination
          currentPage={filters.page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          loading={loading}
        />

        {/* Footer Spacing */}
        <div className="h-12" />
      </div>
    </div>
  );
};

export default JobsSearchPage;
