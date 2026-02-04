/**
 * WelfareCheckReportHistory - Timeline of past welfare check reports
 *
 * Purpose: Shows past welfare check reports for a patient in the dispatch dashboard
 * Used by: ConstableDispatchDashboard (right panel)
 * Design: Envision Atlus dark theme
 */

import React, { useState, useEffect } from 'react';
import { LawEnforcementService } from '../../services/lawEnforcementService';
import type { WelfareCheckReport } from '../../types/lawEnforcement';
import { getOutcomeLabel, getOutcomeSeverity } from '../../types/lawEnforcement';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Loader2,
} from 'lucide-react';

interface WelfareCheckReportHistoryProps {
  patientId: string;
  tenantId: string;
  limit?: number;
}

export const WelfareCheckReportHistory: React.FC<WelfareCheckReportHistoryProps> = ({
  patientId,
  tenantId: _tenantId,
  limit = 10,
}) => {
  const [reports, setReports] = useState<WelfareCheckReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      setLoading(true);
      const data = await LawEnforcementService.getWelfareCheckReports(patientId, limit);
      if (!cancelled) {
        setReports(data);
        setLoading(false);
      }
    };

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [patientId, limit]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatResponseTime = (minutes: number): string => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getSeverityBadgeClasses = (severity: 'success' | 'warning' | 'error'): string => {
    switch (severity) {
      case 'success': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'warning': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'error': return 'bg-red-500/20 text-red-300 border-red-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6" data-testid="report-history-loading">
        <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
        <span className="ml-2 text-sm text-slate-400">Loading reports...</span>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-6" data-testid="report-history-empty">
        <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No reports filed yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="report-history">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-3">
        Past Reports ({reports.length})
      </h4>
      {reports.map((report) => {
        const severity = getOutcomeSeverity(report.outcome);
        const isExpanded = expandedId === report.id;

        return (
          <div
            key={report.id}
            className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden"
          >
            {/* Collapsed row */}
            <button
              type="button"
              onClick={() => toggleExpand(report.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-800 transition-colors"
              aria-expanded={isExpanded}
              aria-label={`Report from ${formatDate(report.checkCompletedAt)}: ${getOutcomeLabel(report.outcome)}`}
            >
              {/* Outcome badge */}
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${getSeverityBadgeClasses(severity)}`}
                data-testid="outcome-badge"
              >
                {getOutcomeLabel(report.outcome)}
              </span>

              {/* Date and officer */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 truncate">
                  {formatDate(report.checkCompletedAt)}
                </p>
              </div>

              {/* Response time */}
              <span className="flex items-center text-xs text-slate-500" data-testid="response-time">
                <Clock className="h-3 w-3 mr-1" />
                {formatResponseTime(report.responseTimeMinutes)}
              </span>

              {/* Expand icon */}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-700/50 space-y-2" data-testid="report-details">
                {/* Officer */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <User className="h-3 w-3" />
                  <span>{report.officerName}</span>
                </div>

                {/* Notes */}
                {report.outcomeNotes && (
                  <p className="text-sm text-slate-300 bg-slate-800 rounded p-2">
                    {report.outcomeNotes}
                  </p>
                )}

                {/* Actions */}
                {(report.emsCalled || report.familyNotified || report.actionsTaken.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {report.emsCalled && (
                      <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded">EMS Called</span>
                    )}
                    {report.familyNotified && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">Family Notified</span>
                    )}
                    {report.actionsTaken.map((action, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                        {action}
                      </span>
                    ))}
                  </div>
                )}

                {/* Transport */}
                {report.transportedTo && (
                  <p className="text-xs text-slate-400">
                    <span className="text-red-300 font-medium">Transported to:</span> {report.transportedTo}
                    {report.transportReason && ` (${report.transportReason})`}
                  </p>
                )}

                {/* Follow-up */}
                {report.followupRequired && (
                  <p className="text-xs text-amber-300">
                    Follow-up: {report.followupDate || 'Date TBD'}
                    {report.followupNotes && ` - ${report.followupNotes}`}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WelfareCheckReportHistory;
