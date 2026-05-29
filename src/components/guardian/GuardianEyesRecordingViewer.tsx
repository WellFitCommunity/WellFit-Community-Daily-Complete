/**
 * GuardianEyesRecordingViewer
 *
 * Displays the Guardian Eyes recording captured during a review ticket's
 * session as a chronological event timeline. Recordings are event snapshots
 * (not video): each entry captures a type/component/action with optional
 * before/after state and AI analysis.
 *
 * Used by: GuardianApprovalForm — gives the reviewer the system context that
 * led to the proposed fix before they approve it (GRD-6).
 */

import React, { useState } from 'react';
import { GuardianEyesRecording } from '../../types/guardianApproval';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EABadge } from '../envision-atlus/EABadge';

interface GuardianEyesRecordingViewerProps {
  recordings: GuardianEyesRecording[];
  loading: boolean;
}

function severityVariant(severity: string | null): 'critical' | 'high' | 'elevated' | 'normal' {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
    case 'warning':
      return 'elevated';
    default:
      return 'normal';
  }
}

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

/** ai_analysis is a jsonb column (usually a string, sometimes an object). */
function formatAnalysis(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const GuardianEyesRecordingViewer: React.FC<GuardianEyesRecordingViewerProps> = ({
  recordings,
  loading,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  // Nothing to show and not loading → render nothing (keeps the form clean for
  // server-side tickets that have no session recording).
  if (!loading && recordings.length === 0) {
    return null;
  }

  return (
    <EACard>
      <EACardHeader>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={expanded}
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            Guardian Eyes Recording
            {!loading && (
              <span className="text-sm text-slate-400 font-normal">
                ({recordings.length} {recordings.length === 1 ? 'event' : 'events'})
              </span>
            )}
          </h2>
          <span className="text-slate-400 text-sm">{expanded ? 'Hide' : 'View'}</span>
        </button>
      </EACardHeader>

      {expanded && (
        <EACardContent>
          {loading ? (
            <p className="text-slate-400 text-sm py-2">Loading recording…</p>
          ) : (
            <ol className="space-y-2">
              {recordings.map((event) => {
                const isOpen = openEventId === event.id;
                const hasDetail =
                  Boolean(event.ai_analysis) ||
                  Boolean(event.state_before) ||
                  Boolean(event.state_after);
                return (
                  <li key={event.id} className="bg-slate-800 rounded-sm p-3">
                    <button
                      type="button"
                      onClick={() => hasDetail && setOpenEventId(isOpen ? null : event.id)}
                      className={`w-full text-left flex items-start justify-between gap-3 ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
                      aria-expanded={isOpen}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <EABadge variant={severityVariant(event.severity)}>
                            {(event.severity || 'info').toUpperCase()}
                          </EABadge>
                          <span className="text-white font-mono text-sm">{event.type}</span>
                          {event.component && (
                            <span className="text-slate-400 text-sm">· {event.component}</span>
                          )}
                        </div>
                        {event.action && (
                          <p className="text-slate-300 text-sm mt-1">{event.action}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {formatTime(event.timestamp)}
                      </span>
                    </button>

                    {isOpen && hasDetail && (
                      <div className="mt-3 space-y-3 border-t border-slate-700 pt-3">
                        {event.ai_analysis != null && event.ai_analysis !== '' && (
                          <div>
                            <label className="text-xs text-slate-400 uppercase">AI Analysis</label>
                            <p className="text-slate-300 text-sm mt-1 whitespace-pre-wrap">{formatAnalysis(event.ai_analysis)}</p>
                          </div>
                        )}
                        {event.state_before && (
                          <div>
                            <label className="text-xs text-slate-400 uppercase">State Before</label>
                            <pre className="text-xs text-slate-400 bg-slate-900 p-2 rounded-sm overflow-x-auto mt-1">
                              {JSON.stringify(event.state_before, null, 2)}
                            </pre>
                          </div>
                        )}
                        {event.state_after && (
                          <div>
                            <label className="text-xs text-slate-400 uppercase">State After</label>
                            <pre className="text-xs text-slate-400 bg-slate-900 p-2 rounded-sm overflow-x-auto mt-1">
                              {JSON.stringify(event.state_after, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </EACardContent>
      )}
    </EACard>
  );
};

export default GuardianEyesRecordingViewer;
