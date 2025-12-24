/**
 * Facility Selector
 *
 * Reusable dropdown component for selecting a facility.
 * Used in encounters, check-ins, and other forms.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Search, X, MapPin } from 'lucide-react';
import { FacilityService } from '../../services/facilityService';
import type { FacilitySummary } from '../../types/facility';
import { getFacilityTypeLabel } from '../../types/facility';

interface FacilitySelectorProps {
  value: string | null;
  onChange: (facilityId: string | null, facility?: FacilitySummary) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  showClear?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const FacilitySelector: React.FC<FacilitySelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select facility...',
  className = '',
  disabled = false,
  required = false,
  showClear = true,
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<FacilitySummary | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load facilities on mount
  useEffect(() => {
    const loadFacilities = async () => {
      setLoading(true);
      const result = await FacilityService.getFacilitySummaries();
      if (result.success) {
        setFacilities(result.data);

        // Find selected facility if value is set
        if (value) {
          const selected = result.data.find((f) => f.id === value);
          setSelectedFacility(selected || null);
        }
      }
      setLoading(false);
    };

    loadFacilities();
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter facilities by search
  const filteredFacilities = facilities.filter((f) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      f.name.toLowerCase().includes(query) ||
      f.facility_code?.toLowerCase().includes(query) ||
      f.city?.toLowerCase().includes(query)
    );
  });

  const handleSelect = (facility: FacilitySummary) => {
    setSelectedFacility(facility);
    onChange(facility.id, facility);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFacility(null);
    onChange(null);
  };

  const sizeClasses = {
    sm: 'py-1.5 px-2 text-sm',
    md: 'py-2 px-3',
    lg: 'py-3 px-4 text-lg',
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 border rounded-lg
          ${sizeClasses[size]}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
          ${isOpen ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-300'}
          transition-colors
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
          {selectedFacility ? (
            <span className="truncate text-gray-900">{selectedFacility.name}</span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showClear && selectedFacility && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search facilities..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
                autoFocus
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
            ) : filteredFacilities.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No facilities found</div>
            ) : (
              filteredFacilities.map((facility) => (
                <button
                  key={facility.id}
                  type="button"
                  onClick={() => handleSelect(facility)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-gray-50 flex items-start gap-3
                    ${facility.id === value ? 'bg-teal-50' : ''}
                  `}
                >
                  <Building2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      facility.is_primary ? 'text-teal-600' : 'text-gray-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{facility.name}</span>
                      {facility.is_primary && (
                        <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-sm">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{getFacilityTypeLabel(facility.facility_type)}</span>
                      {facility.city && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />
                            {facility.city}
                            {facility.state && `, ${facility.state}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Hidden input for form validation */}
      {required && (
        <input
          type="hidden"
          value={value || ''}
          required
          aria-label="Selected facility"
        />
      )}
    </div>
  );
};

export default FacilitySelector;
