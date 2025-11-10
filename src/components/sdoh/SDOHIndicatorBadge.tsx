import React from 'react';
import {
  SDOHCategory,
  SDOHRiskLevel,
  SDOHInterventionStatus,
  SDOH_INDICATOR_CONFIGS,
  getSDOHRiskColor
} from '../../types/sdohIndicators';

interface SDOHIndicatorBadgeProps {
  category: SDOHCategory;
  riskLevel: SDOHRiskLevel;
  interventionStatus?: SDOHInterventionStatus;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * SDOH Indicator Badge Component
 *
 * A subtle, color-coded badge that displays a single SDOH factor.
 * Clicking the badge reveals more details about the factor.
 */
export const SDOHIndicatorBadge: React.FC<SDOHIndicatorBadgeProps> = ({
  category,
  riskLevel,
  interventionStatus = 'not-assessed',
  onClick,
  size = 'md',
  showLabel = false,
  className = ''
}) => {
  const config = SDOH_INDICATOR_CONFIGS[category];
  const backgroundColor = getSDOHRiskColor(category, riskLevel);
  const isClickable = !!onClick;
  const isUnassessed = riskLevel === 'unknown' || interventionStatus === 'not-assessed';

  // Size configurations
  const sizeClasses = {
    sm: 'h-6 min-w-[24px] text-xs px-1',
    md: 'h-8 min-w-[32px] text-sm px-2',
    lg: 'h-10 min-w-[40px] text-base px-3'
  };

  const iconSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  // Risk level border styling
  const getBorderStyle = () => {
    if (isUnassessed) return 'border-gray-300 border-dashed';

    switch (riskLevel) {
      case 'critical':
        return 'border-red-500 border-2';
      case 'high':
        return 'border-orange-400 border-2';
      case 'moderate':
        return 'border-yellow-400 border';
      case 'low':
        return 'border-green-400 border';
      case 'none':
        return 'border-green-300 border';
      default:
        return 'border-gray-300 border';
    }
  };

  // Intervention status indicator (small dot)
  const getInterventionDot = () => {
    if (isUnassessed) return null;

    const dotColors = {
      'not-assessed': 'bg-gray-400',
      'identified': 'bg-yellow-500',
      'referral-made': 'bg-blue-500',
      'in-progress': 'bg-indigo-500',
      'resolved': 'bg-green-500',
      'declined': 'bg-gray-500'
    };

    return (
      <span
        className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dotColors[interventionStatus]}`}
        title={`Status: ${interventionStatus.replace('-', ' ')}`}
      />
    );
  };

  return (
    <div
      className={`
        relative inline-flex items-center justify-center gap-1
        rounded-md ${sizeClasses[size]} ${getBorderStyle()}
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''}
        transition-all duration-200
        ${isUnassessed ? 'opacity-50' : 'opacity-100'}
        ${className}
      `}
      style={{ backgroundColor }}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      title={`${config.label}: ${riskLevel}`}
      aria-label={`${config.label}: ${riskLevel} risk${interventionStatus !== 'not-assessed' ? `, ${interventionStatus}` : ''}`}
    >
      {/* Icon */}
      <span className={`${iconSizes[size]}`} role="img" aria-hidden="true">
        {config.icon}
      </span>

      {/* Label (optional) */}
      {showLabel && (
        <span className="font-medium text-gray-700">
          {config.shortLabel}
        </span>
      )}

      {/* Intervention status dot */}
      {getInterventionDot()}
    </div>
  );
};

export default SDOHIndicatorBadge;
