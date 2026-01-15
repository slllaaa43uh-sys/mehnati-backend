/**
 * ============================================
 * Job Card Component with Smart Logo Loading
 * ============================================
 * 
 * This component displays job listings from Adzuna API
 * with intelligent logo handling:
 * 1. Try to load company logo from Clearbit
 * 2. If failed, show category-based fallback icon
 * 
 * Dependencies:
 * - React 18+
 * - Tailwind CSS
 * - lucide-react (for icons)
 */

import React, { useState, useCallback } from 'react';
import {
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Building2,
  Car,
  Stethoscope,
  Code,
  Wrench,
  GraduationCap,
  ShoppingBag,
  Users,
  Megaphone,
  Scale,
  Palette,
  HardHat,
  Plane,
  Zap,
  Home,
  Heart,
  Sparkles,
  ExternalLink,
  Calendar
} from 'lucide-react';

// ============================================
// Category Icons Mapping
// ============================================
const CATEGORY_ICONS = {
  'accounting-finance-jobs': DollarSign,
  'it-jobs': Code,
  'sales-jobs': Megaphone,
  'customer-services-jobs': Users,
  'engineering-jobs': Wrench,
  'hr-jobs': Users,
  'healthcare-nursing-jobs': Stethoscope,
  'hospitality-catering-jobs': ShoppingBag,
  'pr-advertising-marketing-jobs': Megaphone,
  'logistics-warehouse-jobs': Car,
  'teaching-jobs': GraduationCap,
  'trade-construction-jobs': HardHat,
  'admin-jobs': Briefcase,
  'legal-jobs': Scale,
  'creative-design-jobs': Palette,
  'graduate-jobs': GraduationCap,
  'retail-jobs': ShoppingBag,
  'consultancy-jobs': Briefcase,
  'manufacturing-jobs': Wrench,
  'scientific-qa-jobs': Sparkles,
  'social-work-jobs': Heart,
  'travel-jobs': Plane,
  'energy-oil-gas-jobs': Zap,
  'property-jobs': Home,
  'charity-voluntary-jobs': Heart,
  'domestic-help-cleaning-jobs': Home,
  'maintenance-jobs': Wrench,
  'part-time-jobs': Clock,
  'other-general-jobs': Briefcase
};

// ============================================
// Category Colors Mapping
// ============================================
const CATEGORY_COLORS = {
  'accounting-finance-jobs': 'bg-green-500',
  'it-jobs': 'bg-blue-500',
  'sales-jobs': 'bg-orange-500',
  'customer-services-jobs': 'bg-purple-500',
  'engineering-jobs': 'bg-gray-600',
  'hr-jobs': 'bg-pink-500',
  'healthcare-nursing-jobs': 'bg-red-500',
  'hospitality-catering-jobs': 'bg-yellow-500',
  'pr-advertising-marketing-jobs': 'bg-indigo-500',
  'logistics-warehouse-jobs': 'bg-amber-600',
  'teaching-jobs': 'bg-cyan-500',
  'trade-construction-jobs': 'bg-orange-600',
  'admin-jobs': 'bg-slate-500',
  'legal-jobs': 'bg-gray-700',
  'creative-design-jobs': 'bg-fuchsia-500',
  'graduate-jobs': 'bg-teal-500',
  'retail-jobs': 'bg-rose-500',
  'consultancy-jobs': 'bg-violet-500',
  'manufacturing-jobs': 'bg-zinc-600',
  'scientific-qa-jobs': 'bg-emerald-500',
  'social-work-jobs': 'bg-pink-600',
  'travel-jobs': 'bg-sky-500',
  'energy-oil-gas-jobs': 'bg-yellow-600',
  'property-jobs': 'bg-stone-500',
  'charity-voluntary-jobs': 'bg-red-400',
  'domestic-help-cleaning-jobs': 'bg-lime-500',
  'maintenance-jobs': 'bg-neutral-600',
  'part-time-jobs': 'bg-blue-400',
  'other-general-jobs': 'bg-gray-500'
};

// ============================================
// Smart Logo Component
// ============================================
const SmartLogo = ({ company, category }) => {
  const [logoError, setLogoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageError = useCallback(() => {
    setLogoError(true);
    setIsLoading(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Get fallback icon based on category
  const IconComponent = CATEGORY_ICONS[category?.tag] || Building2;
  const bgColor = CATEGORY_COLORS[category?.tag] || 'bg-gray-500';

  // If logo failed or no logo URL, show category icon
  if (logoError || !company?.logo) {
    return (
      <div className={`w-14 h-14 rounded-xl ${bgColor} flex items-center justify-center shadow-md`}>
        <IconComponent className="w-7 h-7 text-white" />
      </div>
    );
  }

  return (
    <div className="relative w-14 h-14">
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 rounded-xl animate-pulse" />
      )}
      
      {/* Company logo */}
      <img
        src={company.logo}
        alt={`${company.name} logo`}
        className={`w-14 h-14 rounded-xl object-contain bg-white border border-gray-100 shadow-sm ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } transition-opacity duration-200`}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </div>
  );
};

// ============================================
// Job Card Component
// ============================================
const JobCard = ({ job, onClick }) => {
  const {
    title,
    company,
    location,
    salary,
    category,
    contract,
    dates,
    url
  } = job;

  return (
    <div 
      className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 cursor-pointer group"
      onClick={() => onClick?.(job)}
    >
      <div className="flex gap-4">
        {/* Logo */}
        <SmartLogo company={company} category={category} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-gray-900 text-lg leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>

          {/* Company */}
          <p className="text-gray-600 mt-1 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">{company?.name || 'Unknown Company'}</span>
          </p>

          {/* Location */}
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">{location?.display || 'Location not specified'}</span>
          </p>
        </div>
      </div>

      {/* Details Row */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100">
        {/* Salary */}
        {salary?.display && salary.display !== 'Salary not specified' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium">
            <DollarSign className="w-4 h-4" />
            {salary.display}
          </span>
        )}

        {/* Contract Type */}
        {contract?.type && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
            <Briefcase className="w-4 h-4" />
            {contract.type}
          </span>
        )}

        {/* Contract Time */}
        {contract?.time && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm">
            <Clock className="w-4 h-4" />
            {contract.time}
          </span>
        )}

        {/* Category */}
        {category?.label && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm">
            {React.createElement(CATEGORY_ICONS[category.tag] || Briefcase, { className: 'w-4 h-4' })}
            {category.label}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4">
        {/* Posted Date */}
        <span className="text-gray-400 text-sm flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          {dates?.posted || 'Recently posted'}
        </span>

        {/* Apply Button */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Apply Now
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};

// ============================================
// Job List Component
// ============================================
const JobList = ({ jobs, loading, onJobClick }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-gray-200 rounded-xl" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600">No jobs found</h3>
        <p className="text-gray-400 mt-1">Try adjusting your search filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onClick={onJobClick} />
      ))}
    </div>
  );
};

export { JobCard, JobList, SmartLogo };
export default JobCard;
