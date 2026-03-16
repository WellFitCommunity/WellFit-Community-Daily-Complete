/**
 * ConsolidatedAlertPanel — Clinician-facing consolidated alert view
 *
 * P2-3: Displays consolidated alerts from the Claude-in-Claude
 * consolidate-alerts MCP tool. Shows a single actionable summary
 * with expandable individual alerts and root cause analysis.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P2-3)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useCallback } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  Activity,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { EABadge } from '../envision-atlus/EABadge';
import { EAAlert } from '../envision-atlus/EAAlert';

// ============================================================================
// Types
// ============================================================================

interface RootCause {
  description: string;
  related_alert_ids: string[];
  confidence: number;
  recommended_intervention: string;
}

interface AlertDisposition {
  alert_id: string;
  disposition: string;
  reasoning: string;
  root_cause_index: number | null;
}

export interface ConsolidatedAlertData {
  consolidated_severity: string;
  actionable_summary: string;
  root_causes: RootCause[];
  alert_dispositions: AlertDisposition[];
  total_alerts: number;
  consolidated_count: number;
  requires_review: boolean;
}

interface ConsolidatedAlertPanelProps {
  data: ConsolidatedAlertData | null;
  patientId: string;
  isLoading?: boolean;
  onAcknowledge?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function severityToBadgeVariant(severity: string): 'critical' | 'high' | 'elevated' | 'normal' | 'info' {
  switch (severity) {
    case 'emergency': return 'critical';
    case 'escalate': return 'high';
    case 'notify': return 'elevated';
    case 'monitor': return 'normal';
    default: return 'info';
  }
}

function severityToAlertVariant(severity: string): 'critical' | 'warning' | 'info' {
  switch (severity) {
    case 'emergency':
    case 'escalate':
      return 'critical';
    case 'notify':
      return 'warning';
    default:
      return 'info';
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function RootCauseCard({ cause, index }: { cause: RootCause; index: number }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-800">
          Root Cause {index + 1}
        </h4>
        <EABadge variant="info" size="sm">
          {Math.round(cause.confidence * 100)}% confidence
        </EABadge>
      </div>
      <p className="text-sm text-slate-600 mb-2">{cause.description}</p>
      <div className="flex items-start gap-2 p-2 bg-blue-50 rounded text-sm">
        <Shield className="h-4 w-4 text-[var(--ea-primary)] mt-0.5 shrink-0" />
        <span className="text-blue-800">{cause.recommended_intervention}</span>
      </div>
    </div>
  );
}

function DispositionRow({ disposition }: { disposition: AlertDisposition }) {
  const isConsolidated = disposition.disposition === 'consolidated';
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      {isConsolidated ? (
        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-slate-400 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <span className="text-xs font-mono text-slate-500">{disposition.alert_id.slice(0, 8)}...</span>
        <p className="text-sm text-slate-700">{disposition.reasoning}</p>
      </div>
      <EABadge variant={isConsolidated ? 'normal' : 'neutral'} size="sm">
        {disposition.disposition}
      </EABadge>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const ConsolidatedAlertPanel: React.FC<ConsolidatedAlertPanelProps> = ({
  data,
  patientId,
  isLoading,
  onAcknowledge,
}) => {
  const [expandedSection, setExpandedSection] = useState<'causes' | 'dispositions' | null>(null);

  const toggleSection = useCallback((section: 'causes' | 'dispositions') => {
    setExpandedSection(prev => prev === section ? null : section);
  }, []);

  if (isLoading) {
    return (
      <div className="border border-slate-200 rounded-lg p-6 bg-white animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    );
  }

  if (!data || data.total_alerts === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white text-center">
        <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No active alerts for this patient</p>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden" aria-label="Consolidated Alert Panel">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold text-slate-800">
              Consolidated Alerts
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <EABadge variant={severityToBadgeVariant(data.consolidated_severity)} pulse={data.consolidated_severity === 'emergency'}>
              {data.consolidated_severity}
            </EABadge>
            <span className="text-xs text-slate-500">
              {data.consolidated_count}/{data.total_alerts} merged
            </span>
          </div>
        </div>

        {data.requires_review && (
          <EAAlert variant={severityToAlertVariant(data.consolidated_severity)} title="Requires Review">
            This consolidation needs clinician review before action
          </EAAlert>
        )}
      </div>

      {/* Actionable Summary */}
      <div className="p-4 bg-slate-50">
        <p className="text-sm text-slate-700 leading-relaxed">
          {data.actionable_summary}
        </p>
        <p className="text-xs text-slate-400 mt-1">Patient: {patientId.slice(0, 8)}...</p>
      </div>

      {/* Root Causes (expandable) */}
      {data.root_causes.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => toggleSection('causes')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          >
            <span className="text-sm font-medium text-slate-700">
              Root Causes ({data.root_causes.length})
            </span>
            {expandedSection === 'causes' ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>
          {expandedSection === 'causes' && (
            <div className="px-4 pb-4 space-y-3">
              {data.root_causes.map((cause, i) => (
                <RootCauseCard key={`cause-${i}`} cause={cause} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alert Dispositions (expandable) */}
      {data.alert_dispositions.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => toggleSection('dispositions')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          >
            <span className="text-sm font-medium text-slate-700">
              Individual Alerts ({data.alert_dispositions.length})
            </span>
            {expandedSection === 'dispositions' ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>
          {expandedSection === 'dispositions' && (
            <div className="px-4 pb-4">
              {data.alert_dispositions.map(d => (
                <DispositionRow key={d.alert_id} disposition={d} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Acknowledge Button */}
      {onAcknowledge && (
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onAcknowledge}
            className="w-full min-h-[44px] bg-[var(--ea-primary)] text-white rounded-lg font-medium hover:bg-[var(--ea-primary-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          >
            Acknowledge & Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default ConsolidatedAlertPanel;
