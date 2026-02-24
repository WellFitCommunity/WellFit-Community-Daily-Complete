// ============================================================================
// Shift Handoff - AI Summary Panel
// ============================================================================
// Displays AI-generated shift handoff summary from ai_shift_handoff_summaries
// Shows: executive summary, critical alerts, medication alerts,
//        behavioral concerns, and pending tasks
// ============================================================================

import React, { useState } from 'react';
import type { AISummaryPanelProps } from './types';

export const AISummaryPanel: React.FC<AISummaryPanelProps> = ({ summary, loading }) => {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 animate-pulse">
        <div className="h-5 bg-indigo-200 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-indigo-100 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-indigo-100 rounded w-1/2"></div>
      </div>
    );
  }

  if (!summary) return null;

  const alertCount = summary.critical_alerts.length;
  const medAlertCount = summary.medication_alerts.length;
  const behavioralCount = summary.behavioral_concerns.length;
  const taskCount = summary.pending_tasks.length;
  const totalItems = alertCount + medAlertCount + behavioralCount + taskCount;

  return (
    <div className="bg-linear-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-xl mb-6 overflow-hidden shadow-md">
      {/* Collapsible Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-indigo-100/50 transition-colors"
        aria-expanded={expanded}
        aria-controls="ai-summary-content"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg font-bold">AI</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-indigo-900">AI Shift Summary</h3>
            <p className="text-sm text-indigo-600">
              {summary.patient_count} patients analyzed
              {summary.high_risk_patient_count > 0 && (
                <span className="ml-2 text-red-600 font-semibold">
                  ({summary.high_risk_patient_count} high risk)
                </span>
              )}
              {totalItems > 0 && (
                <span className="ml-2 text-indigo-500">
                  — {totalItems} item{totalItems !== 1 ? 's' : ''} to review
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {summary.acknowledged_at && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
              Acknowledged
            </span>
          )}
          <span className={`text-indigo-500 text-xl transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div id="ai-summary-content" className="px-4 pb-4 space-y-4 border-t border-indigo-200">
          {/* Executive Summary */}
          {summary.executive_summary && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-indigo-100">
              <h4 className="text-sm font-bold text-indigo-800 mb-1">Executive Summary</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{summary.executive_summary}</p>
            </div>
          )}

          {/* Critical Alerts */}
          {alertCount > 0 && (
            <div>
              <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1">
                <span>Critical Alerts</span>
                <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{alertCount}</span>
              </h4>
              <div className="space-y-2">
                {summary.critical_alerts.map((alert, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <span className="text-red-600 font-bold text-lg mt-0.5" role="img" aria-label="Alert">!</span>
                    <div>
                      <p className="text-sm font-medium text-red-900">{alert.alert}</p>
                      <div className="flex gap-3 mt-1 text-xs text-red-600">
                        <span>Severity: <span className="font-bold">{alert.severity}</span></span>
                        {alert.timeframe && <span>Timeframe: {alert.timeframe}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medication Alerts */}
          {medAlertCount > 0 && (
            <div>
              <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1">
                <span>Medication Alerts</span>
                <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">{medAlertCount}</span>
              </h4>
              <div className="space-y-2">
                {summary.medication_alerts.map((med, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-900">{med.alert}</p>
                    <p className="text-xs text-amber-700 mt-1">Follow-up: {med.followUp}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavioral Concerns */}
          {behavioralCount > 0 && (
            <div>
              <h4 className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-1">
                <span>Behavioral Concerns</span>
                <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">{behavioralCount}</span>
              </h4>
              <div className="space-y-2">
                {summary.behavioral_concerns.map((concern, i) => (
                  <div key={i} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-purple-900">{concern.concern}</p>
                    <p className="text-xs text-purple-700 mt-1">Intervention: {concern.intervention}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Tasks */}
          {taskCount > 0 && (
            <div>
              <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-1">
                <span>Pending Tasks</span>
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{taskCount}</span>
              </h4>
              <div className="space-y-1">
                {summary.pending_tasks.map((task, i) => (
                  <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-sm text-blue-900">{task.task}</span>
                    <div className="flex gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded font-medium ${
                        task.priority === 'high' ? 'bg-red-100 text-red-700' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {task.priority}
                      </span>
                      {task.deadline && (
                        <span className="text-blue-600">Due: {task.deadline}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated timestamp */}
          <div className="text-xs text-indigo-400 text-right pt-2 border-t border-indigo-100">
            Generated: {new Date(summary.generated_at).toLocaleString()}
            {summary.unit_name && <span className="ml-2">| Unit: {summary.unit_name}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AISummaryPanel;
