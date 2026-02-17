/**
 * SDOHBodyMapPanel - SDOH indicators for the Patient Body Map page
 *
 * Purpose: Displays Social Determinants of Health alongside the 3D anatomy viewer
 * Used by: PatientAvatarPage right panel "SDOH" tab
 *
 * Fetches the patient's SDOH profile and renders the SDOHStatusBar
 * in compact mode, adapted for the dark-themed Body Map page.
 */

import React, { useState, useEffect } from 'react';
import { SDOHStatusBar } from '../sdoh/SDOHStatusBar';
import { SDOHIndicatorService } from '../../services/sdohIndicatorService';
import { auditLogger } from '../../services/auditLogger';
import type { SDOHProfile } from '../../types/sdohIndicators';

interface SDOHBodyMapPanelProps {
  patientId: string;
}

export const SDOHBodyMapPanel: React.FC<SDOHBodyMapPanelProps> = ({ patientId }) => {
  const [profile, setProfile] = useState<SDOHProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      setLoading(true);
      setError(null);
      try {
        const data = await SDOHIndicatorService.getPatientProfile(patientId);
        if (!cancelled) {
          setProfile(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          auditLogger.error(
            'SDOH_BODY_MAP_FETCH_FAILED',
            err instanceof Error ? err : new Error(message),
            { patientId }
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading SDOH indicators...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-1">Failed to load SDOH data</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!profile || profile.factors.length === 0) {
    return (
      <div className="space-y-4">
        <h4 className="text-xs font-medium text-slate-400 uppercase">
          Social Determinants of Health
        </h4>
        <div className="flex items-center justify-center h-32 text-sm text-slate-500">
          <div className="text-center">
            <p>No SDOH assessments recorded</p>
            <p className="text-xs text-slate-600 mt-1">
              Run an SDOH screening to populate indicators
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-slate-400 uppercase">
        Social Determinants of Health
      </h4>

      {/* Overall risk summary */}
      <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="text-center">
          <span className={`text-lg font-bold ${
            profile.overallRiskScore >= 75 ? 'text-red-400' :
            profile.overallRiskScore >= 50 ? 'text-orange-400' :
            profile.overallRiskScore >= 25 ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            {profile.overallRiskScore}
          </span>
          <p className="text-[10px] text-slate-500">Risk Score</p>
        </div>
        <div className="flex-1 text-xs text-slate-400 space-y-0.5">
          <p>Complexity: <span className="text-white capitalize">{profile.complexityTier}</span></p>
          {profile.highRiskCount > 0 && (
            <p className="text-red-400">{profile.highRiskCount} high-risk factor{profile.highRiskCount !== 1 ? 's' : ''}</p>
          )}
          {profile.activeInterventionCount > 0 && (
            <p className="text-blue-400">{profile.activeInterventionCount} active intervention{profile.activeInterventionCount !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* SDOH indicator badges — using light-themed component in a wrapper */}
      <div className="rounded-lg overflow-hidden">
        <SDOHStatusBar
          profile={profile}
          compact
          groupByCategory
          showUnassessed={false}
        />
      </div>

      {/* Last updated */}
      <p className="text-[10px] text-slate-600 text-right">
        Updated: {new Date(profile.lastUpdated).toLocaleDateString()}
      </p>
    </div>
  );
};

export default SDOHBodyMapPanel;
