import React, { useState } from 'react';
import {
  SDOHProfile,
  SDOHFactor,
  SDOHCategoryGroup,
  SDOH_INDICATOR_CONFIGS
} from '../../types/sdohIndicators';
import { SDOHIndicatorBadge } from './SDOHIndicatorBadge';
import { SDOHDetailPanel } from './SDOHDetailPanel';

interface SDOHStatusBarProps {
  profile: SDOHProfile;
  compact?: boolean;
  groupByCategory?: boolean;
  showUnassessed?: boolean;
  onFactorClick?: (factor: SDOHFactor) => void;
  className?: string;
}

/**
 * SDOH Status Bar Component
 *
 * A horizontal bar displaying all SDOH indicators for a patient at a glance.
 * This is the main visual component that appears on patient dashboards.
 */
export const SDOHStatusBar: React.FC<SDOHStatusBarProps> = ({
  profile,
  compact = false,
  groupByCategory = true,
  showUnassessed = false,
  onFactorClick,
  className = ''
}) => {
  const [selectedFactor, setSelectedFactor] = useState<SDOHFactor | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Group factors by category group
  const groupedFactors = React.useMemo(() => {
    const groups: Record<SDOHCategoryGroup, SDOHFactor[]> = {
      'core-needs': [],
      'health-behaviors': [],
      'healthcare-access': [],
      'social-support': [],
      'barriers': [],
      'safety': []
    };

    profile.factors.forEach(factor => {
      const config = SDOH_INDICATOR_CONFIGS[factor.category];
      groups[config.group].push(factor);
    });

    return groups;
  }, [profile.factors]);

  // Filter factors based on display preferences
  const shouldShowFactor = (factor: SDOHFactor): boolean => {
    if (!showUnassessed && factor.riskLevel === 'unknown') return false;
    if (!showUnassessed && factor.interventionStatus === 'not-assessed') return false;
    return true;
  };

  // Handle factor click
  const handleFactorClick = (factor: SDOHFactor) => {
    setSelectedFactor(factor);
    setIsPanelOpen(true);
    onFactorClick?.(factor);
  };

  // Get risk summary color
  const getRiskSummaryColor = () => {
    if (profile.overallRiskScore >= 75) return 'text-red-600';
    if (profile.overallRiskScore >= 50) return 'text-orange-500';
    if (profile.overallRiskScore >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Render grouped view
  const renderGroupedView = () => {
    const groupLabels: Record<SDOHCategoryGroup, string> = {
      'core-needs': 'Core Needs',
      'health-behaviors': 'Health Behaviors',
      'healthcare-access': 'Healthcare Access',
      'social-support': 'Social Support',
      'barriers': 'Barriers',
      'safety': 'Safety'
    };

    return (
      <div className="space-y-3">
        {(Object.entries(groupedFactors) as [SDOHCategoryGroup, SDOHFactor[]][]).map(([group, factors]) => {
          const visibleFactors = factors.filter(shouldShowFactor);
          if (visibleFactors.length === 0) return null;

          return (
            <div key={group} className="flex items-center gap-2">
              {!compact && (
                <span className="text-xs font-medium text-gray-500 min-w-[120px]">
                  {groupLabels[group]}
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {visibleFactors.map(factor => (
                  <SDOHIndicatorBadge
                    key={factor.category}
                    category={factor.category}
                    riskLevel={factor.riskLevel}
                    interventionStatus={factor.interventionStatus}
                    onClick={() => handleFactorClick(factor)}
                    size={compact ? 'sm' : 'md'}
                    showLabel={!compact}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render flat view (all badges in one row)
  const renderFlatView = () => {
    const visibleFactors = profile.factors.filter(shouldShowFactor);

    return (
      <div className="flex flex-wrap gap-1.5">
        {visibleFactors.map(factor => (
          <SDOHIndicatorBadge
            key={factor.category}
            category={factor.category}
            riskLevel={factor.riskLevel}
            interventionStatus={factor.interventionStatus}
            onClick={() => handleFactorClick(factor)}
            size={compact ? 'sm' : 'md'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Social Determinants of Health
          </h3>

          {/* Overall Risk Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Overall Risk:</span>
            <span className={`text-sm font-bold ${getRiskSummaryColor()}`}>
              {profile.overallRiskScore}%
            </span>
          </div>

          {/* High Risk Count */}
          {profile.highRiskCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-50 rounded-full">
              <span className="text-xs font-medium text-red-700">
                {profile.highRiskCount} High Risk
              </span>
            </div>
          )}

          {/* Active Interventions */}
          {profile.activeInterventionCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full">
              <span className="text-xs font-medium text-blue-700">
                {profile.activeInterventionCount} Active
              </span>
            </div>
          )}
        </div>

        {/* Last Updated */}
        <div className="text-xs text-gray-500">
          Updated: {new Date(profile.lastUpdated).toLocaleDateString()}
        </div>
      </div>

      {/* Indicators */}
      <div className="p-3">
        {groupByCategory ? renderGroupedView() : renderFlatView()}
      </div>

      {/* Legend (compact mode) */}
      {compact && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm border-2 border-red-500" />
              Critical
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm border-2 border-orange-400" />
              High
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm border border-yellow-400" />
              Moderate
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm border border-green-400" />
              Low
            </span>
          </div>
        </div>
      )}

      {/* Detail Panel (Modal) */}
      {selectedFactor && (
        <SDOHDetailPanel
          factor={selectedFactor}
          isOpen={isPanelOpen}
          onClose={() => {
            setIsPanelOpen(false);
            setSelectedFactor(null);
          }}
          patientId={profile.patientId}
        />
      )}
    </div>
  );
};

export default SDOHStatusBar;
