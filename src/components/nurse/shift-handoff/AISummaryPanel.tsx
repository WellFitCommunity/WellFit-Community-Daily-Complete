// ============================================================================
// Shift Handoff - AI Summary Panel
// ============================================================================
// Displays AI-generated shift handoff summary from ai_shift_handoff_summaries
// Shows: executive summary, critical alerts, medication alerts,
//        behavioral concerns, pending tasks
// Session 2: Added acknowledge, nurse notes, and print button
// ============================================================================

import React, { useState } from 'react';
import type { AISummaryPanelProps } from './types';

export const AISummaryPanel: React.FC<AISummaryPanelProps> = ({
  summary,
  loading,
  onAcknowledge,
  onUpdateNotes,
  onPrint,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

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
  const isAcknowledged = !!summary.acknowledged_at;

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      onAcknowledge(summary.id);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleStartEditNotes = () => {
    setNotesText(summary.handoff_notes || '');
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      onUpdateNotes(summary.id, notesText);
      setEditingNotes(false);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="bg-linear-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-xl mb-6 overflow-hidden shadow-md print:shadow-none print:border print:border-gray-300">
      {/* Collapsible Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-indigo-100/50 transition-colors print:hover:bg-transparent"
        aria-expanded={expanded}
        aria-controls="ai-summary-content"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center print:bg-gray-800">
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
          {isAcknowledged && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
              Acknowledged
            </span>
          )}
          <span className={`text-indigo-500 text-xl transition-transform print:hidden ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div id="ai-summary-content" className="px-4 pb-4 space-y-4 border-t border-indigo-200">
          {/* Action Buttons */}
          <div className="mt-4 flex items-center gap-3 print:hidden">
            {!isAcknowledged && (
              <button
                onClick={handleAcknowledge}
                disabled={acknowledging}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2 min-h-[44px]"
                aria-label="Acknowledge AI shift summary"
              >
                {acknowledging ? 'Acknowledging...' : 'Acknowledge Summary'}
              </button>
            )}
            <button
              onClick={handleStartEditNotes}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 min-h-[44px]"
              aria-label="Add or edit handoff notes"
            >
              {summary.handoff_notes ? 'Edit Notes' : 'Add Notes'}
            </button>
            <button
              onClick={onPrint}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium text-sm flex items-center gap-2 min-h-[44px]"
              aria-label="Print shift handoff summary"
            >
              Print Summary
            </button>
          </div>

          {/* Executive Summary */}
          {summary.executive_summary && (
            <div className="p-3 bg-white rounded-lg border border-indigo-100">
              <h4 className="text-sm font-bold text-indigo-800 mb-1">Executive Summary</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{summary.executive_summary}</p>
            </div>
          )}

          {/* Nurse Notes Section */}
          {editingNotes ? (
            <div className="p-3 bg-white rounded-lg border border-indigo-200 print:hidden">
              <h4 className="text-sm font-bold text-indigo-800 mb-2">Handoff Notes</h4>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                className="w-full h-24 p-2 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Add notes for the receiving nurse..."
                aria-label="Handoff notes text area"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium min-h-[44px]"
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
                <button
                  onClick={() => setEditingNotes(false)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : summary.handoff_notes ? (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="text-sm font-bold text-yellow-800 mb-1">Handoff Notes</h4>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary.handoff_notes}</p>
            </div>
          ) : null}

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
