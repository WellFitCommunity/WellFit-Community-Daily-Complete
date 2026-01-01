/**
 * PatientRiskStrip - Unified Risk Display Component
 *
 * Purpose: Provides a compact, persistent view of key patient risks
 * that appears in the patient header across ALL dashboards.
 *
 * Design: Thin horizontal bar showing 2-3 key risk indicators
 * for quick triage scanning during clinical workflows.
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { EARiskIndicator } from '../envision-atlus';
import {
  AlertTriangle,
  Activity,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export interface PatientRiskData {
  readmission: {
    score: number;           // 0-100
    level: 'low' | 'moderate' | 'high' | 'critical';
    daysUntilPredicted?: number;
    topFactor?: string;
    /** Plain-language explanation at 6th grade reading level */
    plainLanguageExplanation?: string;
  } | null;
  deterioration: {
    score: number;           // 0-100 (MEWS/NEWS normalized)
    level: 'low' | 'moderate' | 'high' | 'critical';
    hoursToReassess?: number;
    trend?: 'improving' | 'stable' | 'worsening';
  } | null;
  noShow: {
    score: number;           // 0-100
    level: 'low' | 'moderate' | 'high' | 'critical';
    nextAppointment?: Date;
  } | null;
  lastUpdated?: Date;
  dataQuality?: 'complete' | 'partial' | 'limited';
}

interface PatientRiskStripProps {
  patientId: string;
  tenantId?: string;
  variant?: 'compact' | 'expanded';
  showLabels?: boolean;
  onRiskClick?: (riskType: 'readmission' | 'deterioration' | 'noShow') => void;
  refreshInterval?: number; // ms, 0 to disable auto-refresh
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function scoreToLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

function levelToDisplay(level: string): string {
  switch (level) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'moderate': return 'Moderate';
    case 'low': return 'Low';
    default: return level;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PatientRiskStrip: React.FC<PatientRiskStripProps> = ({
  patientId,
  tenantId: _tenantId, // Reserved for future tenant-scoped queries
  variant = 'compact',
  showLabels = true,
  onRiskClick,
  refreshInterval = 300000, // 5 minutes default
  className,
}) => {
  const [riskData, setRiskData] = useState<PatientRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  const fetchRiskData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }

    try {
      // Fetch readmission risk
      const { data: readmissionData } = await supabase
        .from('readmission_risk_predictions')
        .select('readmission_risk_score, risk_category, predicted_readmission_window_days, primary_risk_factors')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch shift handoff risk (deterioration)
      const { data: deteriorationData } = await supabase
        .from('shift_handoff_risk_scores')
        .select('auto_composite_score, final_risk_level, auto_early_warning_score')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Build risk data object
      // Type the primary_risk_factors as array of objects with factor property
      interface RiskFactor {
        factor?: string;
        [key: string]: unknown;
      }
      const primaryFactors = (readmissionData?.primary_risk_factors ?? []) as RiskFactor[];

      const risks: PatientRiskData = {
        readmission: readmissionData ? {
          score: Math.round((readmissionData.readmission_risk_score ?? 0) * 100),
          level: (readmissionData.risk_category as 'low' | 'moderate' | 'high' | 'critical') || scoreToLevel(Math.round((readmissionData.readmission_risk_score ?? 0) * 100)),
          daysUntilPredicted: readmissionData.predicted_readmission_window_days ?? undefined,
          topFactor: primaryFactors[0]?.factor,
          plainLanguageExplanation: undefined, // Column not available in current schema
        } : null,
        deterioration: deteriorationData ? {
          score: deteriorationData.auto_composite_score ?? 0,
          level: (deteriorationData.final_risk_level?.toLowerCase() as 'low' | 'moderate' | 'high' | 'critical') || scoreToLevel(deteriorationData.auto_composite_score ?? 0),
          hoursToReassess: deteriorationData.final_risk_level === 'CRITICAL' ? 1 :
                          deteriorationData.final_risk_level === 'HIGH' ? 2 : 4,
        } : null,
        noShow: null, // Future: integrate appointment no-show prediction
        lastUpdated: new Date(),
        dataQuality: readmissionData && deteriorationData ? 'complete' :
                    readmissionData || deteriorationData ? 'partial' : 'limited',
      };

      setRiskData(risks);
      setError(null);
    } catch (err: any) {
      auditLogger.error('patient_risk_strip_fetch_failed', err instanceof Error ? err : new Error(err?.message || 'Unknown error'));
      setError('Failed to load risk data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  // Initial fetch
  useEffect(() => {
    fetchRiskData();
  }, [fetchRiskData]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchRiskData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchRiskData]);

  // --------------------------------------------------------------------------
  // RENDER HELPERS
  // --------------------------------------------------------------------------

  const handleRiskClick = (riskType: 'readmission' | 'deterioration' | 'noShow') => {
    if (onRiskClick) {
      onRiskClick(riskType);
    }
  };

  const handleRefresh = () => {
    fetchRiskData(true);
  };

  // --------------------------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg animate-pulse',
        className
      )}>
        <Activity className="h-4 w-4 text-slate-400" />
        <span className="text-xs text-slate-400">Loading risk assessment...</span>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // ERROR STATE
  // --------------------------------------------------------------------------

  if (error || !riskData) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700',
        className
      )}>
        <Info className="h-4 w-4 text-slate-400" />
        <span className="text-xs text-slate-400">Risk data unavailable</span>
        <button
          onClick={handleRefresh}
          className="ml-auto p-1 hover:bg-slate-700 rounded-sm"
          title="Retry"
        >
          <RefreshCw className="h-3 w-3 text-slate-400" />
        </button>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // NO RISKS STATE
  // --------------------------------------------------------------------------

  if (!riskData.readmission && !riskData.deterioration && !riskData.noShow) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700',
        className
      )}>
        <Activity className="h-4 w-4 text-green-400" />
        <span className="text-xs text-slate-300">No active risk alerts</span>
        <span className="text-xs text-slate-500 ml-auto">
          {riskData.lastUpdated && `Updated ${new Date(riskData.lastUpdated).toLocaleTimeString()}`}
        </span>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // COMPACT VARIANT
  // --------------------------------------------------------------------------

  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center gap-3 px-3 py-2 bg-slate-800/80 rounded-lg border border-slate-700',
        className
      )}>
        {/* Readmission Risk */}
        {riskData.readmission && (
          <button
            onClick={() => handleRiskClick('readmission')}
            className="flex items-center gap-2 hover:bg-slate-700/50 px-2 py-1 rounded-sm transition-colors"
            title={`Readmission Risk: ${riskData.readmission.score}%${riskData.readmission.topFactor ? ` - ${riskData.readmission.topFactor}` : ''}`}
          >
            <TrendingUp className="h-4 w-4 text-slate-400" />
            {showLabels && <span className="text-xs text-slate-400">Readmit</span>}
            <EARiskIndicator
              level={riskData.readmission.level}
              score={riskData.readmission.score}
              size="sm"
              variant="badge"
            />
          </button>
        )}

        {/* Deterioration Risk */}
        {riskData.deterioration && (
          <button
            onClick={() => handleRiskClick('deterioration')}
            className="flex items-center gap-2 hover:bg-slate-700/50 px-2 py-1 rounded-sm transition-colors"
            title={`Deterioration Risk: ${riskData.deterioration.score} - Reassess in ${riskData.deterioration.hoursToReassess}h`}
          >
            <AlertTriangle className="h-4 w-4 text-slate-400" />
            {showLabels && <span className="text-xs text-slate-400">Acuity</span>}
            <EARiskIndicator
              level={riskData.deterioration.level}
              score={riskData.deterioration.score}
              size="sm"
              variant="badge"
            />
          </button>
        )}

        {/* No-Show Risk */}
        {riskData.noShow && (
          <button
            onClick={() => handleRiskClick('noShow')}
            className="flex items-center gap-2 hover:bg-slate-700/50 px-2 py-1 rounded-sm transition-colors"
            title={`No-Show Risk: ${riskData.noShow.score}%`}
          >
            <Calendar className="h-4 w-4 text-slate-400" />
            {showLabels && <span className="text-xs text-slate-400">No-Show</span>}
            <EARiskIndicator
              level={riskData.noShow.level}
              score={riskData.noShow.score}
              size="sm"
              variant="badge"
            />
          </button>
        )}

        {/* Expand Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto p-1 hover:bg-slate-700 rounded-sm"
          title={expanded ? 'Collapse' : 'Expand details'}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          className={cn(
            'p-1 hover:bg-slate-700 rounded-sm',
            refreshing && 'animate-spin'
          )}
          title="Refresh risk data"
          disabled={refreshing}
        >
          <RefreshCw className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // EXPANDED VARIANT
  // --------------------------------------------------------------------------

  return (
    <div className={cn(
      'bg-slate-800/80 rounded-lg border border-slate-700 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-400" />
          <span className="text-sm font-medium text-slate-200">Risk Assessment</span>
          {riskData.dataQuality && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-sm',
              riskData.dataQuality === 'complete' ? 'bg-green-900/30 text-green-400' :
              riskData.dataQuality === 'partial' ? 'bg-yellow-900/30 text-yellow-400' :
              'bg-slate-700 text-slate-400'
            )}>
              {riskData.dataQuality}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {riskData.lastUpdated && (
            <span className="text-xs text-slate-500">
              {new Date(riskData.lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            className={cn(
              'p-1 hover:bg-slate-700 rounded-sm',
              refreshing && 'animate-spin'
            )}
            disabled={refreshing}
          >
            <RefreshCw className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Risk Cards */}
      <div className="grid grid-cols-3 gap-4 p-4">
        {/* Readmission Risk Card */}
        <button
          onClick={() => handleRiskClick('readmission')}
          className="text-left p-3 rounded-lg bg-slate-900/50 hover:bg-slate-700/50 transition-colors border border-slate-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">30-Day Readmission</span>
          </div>
          {riskData.readmission ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-slate-100">
                  {riskData.readmission.score}%
                </span>
                <EARiskIndicator
                  level={riskData.readmission.level}
                  size="sm"
                  variant="badge"
                  showIcon={false}
                />
              </div>
              {riskData.readmission.topFactor && (
                <p className="text-xs text-slate-400 truncate">
                  Top factor: {riskData.readmission.topFactor}
                </p>
              )}
              {riskData.readmission.daysUntilPredicted && riskData.readmission.daysUntilPredicted > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Predicted in {riskData.readmission.daysUntilPredicted} days
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">No prediction available</p>
          )}
        </button>

        {/* Plain Language Explanation - Spans full width when available */}
        {riskData.readmission?.plainLanguageExplanation && (
          <div className="col-span-3 p-3 rounded-lg bg-teal-900/20 border border-teal-800/50">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-teal-300 mb-1">
                  In Simple Terms
                </p>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {riskData.readmission.plainLanguageExplanation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deterioration Risk Card */}
        <button
          onClick={() => handleRiskClick('deterioration')}
          className="text-left p-3 rounded-lg bg-slate-900/50 hover:bg-slate-700/50 transition-colors border border-slate-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">Clinical Acuity</span>
          </div>
          {riskData.deterioration ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-slate-100">
                  {riskData.deterioration.score}
                </span>
                <EARiskIndicator
                  level={riskData.deterioration.level}
                  size="sm"
                  variant="badge"
                  showIcon={false}
                />
              </div>
              <p className="text-xs text-slate-400">
                {levelToDisplay(riskData.deterioration.level)} acuity
              </p>
              {riskData.deterioration.hoursToReassess && (
                <p className="text-xs text-slate-500 mt-1">
                  Reassess in {riskData.deterioration.hoursToReassess}h
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">No assessment available</p>
          )}
        </button>

        {/* No-Show Risk Card */}
        <button
          onClick={() => handleRiskClick('noShow')}
          className="text-left p-3 rounded-lg bg-slate-900/50 hover:bg-slate-700/50 transition-colors border border-slate-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">No-Show Risk</span>
          </div>
          {riskData.noShow ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-slate-100">
                  {riskData.noShow.score}%
                </span>
                <EARiskIndicator
                  level={riskData.noShow.level}
                  size="sm"
                  variant="badge"
                  showIcon={false}
                />
              </div>
              {riskData.noShow.nextAppointment && (
                <p className="text-xs text-slate-400">
                  Next: {new Date(riskData.noShow.nextAppointment).toLocaleDateString()}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Coming soon</p>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700 bg-slate-900/30">
        <p className="text-xs text-slate-500 text-center">
          AI-assisted risk assessment for clinical decision support. Click any risk for details.
        </p>
      </div>
    </div>
  );
};

export default PatientRiskStrip;
