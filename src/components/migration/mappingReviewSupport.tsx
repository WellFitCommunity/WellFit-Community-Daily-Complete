/**
 * Shared helpers + presentational bits for the Migration Mapping Review UI.
 * Extracted from MappingReviewUI to keep that component under the 600-line rule.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unmapped';

export const getConfidenceLevel = (confidence: number): ConfidenceLevel => {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  if (confidence > 0) return 'low';
  return 'unmapped';
};

export const getConfidenceColor = (level: ConfidenceLevel): string => {
  switch (level) {
    case 'high': return 'bg-green-100 border-green-500 text-green-800';
    case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
    case 'low': return 'bg-orange-100 border-orange-500 text-orange-800';
    case 'unmapped': return 'bg-red-100 border-red-500 text-red-800';
  }
};

export const getConfidenceBadgeColor = (level: ConfidenceLevel): string => {
  switch (level) {
    case 'high': return 'bg-green-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-orange-500';
    case 'unmapped': return 'bg-red-500';
  }
};

// Target schema (matches the actual hc_* tables from the migration) used to
// populate the "Maps To" column dropdowns.
export const TARGET_SCHEMA: Record<string, string[]> = {
  hc_staff: [
    'employee_id', 'first_name', 'middle_name', 'last_name', 'suffix',
    'preferred_name', 'email', 'phone_work', 'phone_mobile', 'phone_home',
    'npi', 'dea_number', 'upin', 'medicare_ptan', 'medicaid_id',
    'hire_date', 'termination_date', 'date_of_birth', 'gender',
    'employment_status', 'employment_type', 'address_line1', 'address_line2',
    'city', 'state', 'zip', 'source_system', 'source_id'
  ],
  hc_staff_license: [
    'license_number', 'state', 'issued_date', 'expiration_date', 'verification_status'
  ],
  hc_staff_credential: [
    'credential_number', 'issued_date', 'expiration_date', 'issuing_institution', 'verification_status'
  ],
  hc_department: [
    'department_code', 'department_name', 'department_type', 'cost_center', 'location'
  ],
  hc_facility: [
    'facility_code', 'facility_name', 'facility_type', 'address_line1', 'address_line2',
    'city', 'state', 'zip', 'phone', 'fax'
  ],
  hc_organization: [
    'organization_name', 'organization_type', 'npi', 'tax_id', 'address_line1',
    'city', 'state', 'zip', 'phone', 'cms_certification_number'
  ]
};

interface StatCardProps {
  label: string;
  value: number;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'gray';
  onClick?: () => void;
  active?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, color, onClick, active }) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700'
  };

  const dotColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    gray: 'bg-gray-500'
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        p-4 rounded-xl border-2 transition-all
        ${colorClasses[color]}
        ${onClick ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
        ${active ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${dotColors[color]}`}></div>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </button>
  );
};
