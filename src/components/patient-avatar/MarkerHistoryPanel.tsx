/**
 * MarkerHistoryPanel - Displays marker change history
 *
 * Purpose: Shows timeline of actions for a selected clinical marker
 * Used by: PatientAvatarPage right panel "History" tab
 */

import React, { useState, useEffect } from 'react';
import { PatientAvatarService } from '../../services/patientAvatarService';
import type { PatientMarkerHistory } from '../../types/patientAvatar';

interface MarkerHistoryPanelProps {
  markerId: string | null;
  markerName: string | null;
}

export const MarkerHistoryPanel: React.FC<MarkerHistoryPanelProps> = ({
  markerId,
  markerName,
}) => {
  const [history, setHistory] = useState<PatientMarkerHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!markerId) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    PatientAvatarService.getMarkerHistory(markerId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setHistory(result.data);
      }
      setHistoryLoading(false);
    }).catch(() => {
      if (!cancelled) setHistoryLoading(false);
    });

    return () => { cancelled = true; };
  }, [markerId]);

  if (!markerId) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-500">
        Select a marker to view history
      </div>
    );
  }

  if (historyLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-500">
        No history for {markerName}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-slate-400 uppercase">
        History: {markerName}
      </h4>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {history.map((entry) => (
          <div key={entry.id} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-slate-300 capitalize">
                {entry.action.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-500">
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
            </div>
            {entry.previous_values && (
              <p className="text-slate-500 truncate">
                Changed from: {JSON.stringify(entry.previous_values).slice(0, 60)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarkerHistoryPanel;
