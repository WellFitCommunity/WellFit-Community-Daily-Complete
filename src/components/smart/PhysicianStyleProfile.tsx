/**
 * PhysicianStyleProfile — Display what Riley has learned about a physician's documentation style
 *
 * Read-only transparency component. Shows verbosity preference, section emphasis,
 * top terminology overrides, and detected specialty.
 *
 * Supports compact (post-session badge) and detailed (settings view) modes.
 *
 * Part of Compass Riley Ambient Learning Session 2.
 */

import React, { useEffect, useState } from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { loadStyleProfile, MIN_SESSIONS_FOR_DISPLAY } from '../../services/physicianStyleProfiler';
import type { PhysicianStyleProfile as StyleProfile } from '../../services/physicianStyleProfiler';

// ============================================================================
// Types
// ============================================================================

interface PhysicianStyleProfileProps {
  providerId: string;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const PhysicianStyleProfile: React.FC<PhysicianStyleProfileProps> = React.memo(({
  providerId,
  compact = false,
}) => {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await loadStyleProfile(providerId);
      if (!cancelled) {
        setProfile(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [providerId]);

  // Don't render until enough sessions analyzed
  if (loading || !profile || profile.sessionsAnalyzed < MIN_SESSIONS_FOR_DISPLAY) {
    return null;
  }

  if (compact) {
    return <CompactView profile={profile} />;
  }

  return <DetailedView profile={profile} />;
});

PhysicianStyleProfile.displayName = 'PhysicianStyleProfile';

// ============================================================================
// Compact View (post-session badge)
// ============================================================================

const CompactView: React.FC<{ profile: StyleProfile }> = ({ profile }) => {
  const specialtyLabel = profile.specialtyDetected
    ? ` | ${capitalize(profile.specialtyDetected)}`
    : '';

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
      <span className="text-slate-500 text-sm">Style:</span>
      <span className="text-sm text-slate-300">
        {capitalize(profile.preferredVerbosity)} verbosity | {profile.sessionsAnalyzed} sessions{specialtyLabel}
      </span>
    </div>
  );
};

// ============================================================================
// Detailed View (settings/transparency)
// ============================================================================

const DetailedView: React.FC<{ profile: StyleProfile }> = ({ profile }) => {
  const topOverrides = [...profile.terminologyOverrides]
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  return (
    <EACard>
      <EACardHeader
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      >
        <h3 className="text-sm font-medium text-white">Riley&apos;s Documentation Style Profile</h3>
        <p className="text-xs text-slate-400">Learned from {profile.sessionsAnalyzed} sessions</p>
      </EACardHeader>
      <EACardContent className="space-y-4">
        {/* Verbosity */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Verbosity Preference</span>
            <span className="text-xs font-medium text-slate-300">{capitalize(profile.preferredVerbosity)}</span>
          </div>
          <VerbosityBar score={profile.verbosityScore} />
        </div>

        {/* Specialty */}
        {profile.specialtyDetected && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Detected Specialty</span>
            <span className="text-xs font-medium text-[#00857a]">{capitalize(profile.specialtyDetected)}</span>
          </div>
        )}

        {/* Section Emphasis */}
        <div>
          <span className="text-xs text-slate-400 block mb-2">Section Preferences</span>
          <div className="space-y-1">
            {(['subjective', 'objective', 'assessment', 'plan'] as const).map(section => {
              const value = profile.sectionEmphasis[section];
              return (
                <SectionEmphasisRow
                  key={section}
                  label={section.charAt(0).toUpperCase()}
                  value={value}
                />
              );
            })}
          </div>
        </div>

        {/* Terminology Overrides */}
        {topOverrides.length > 0 && (
          <div>
            <span className="text-xs text-slate-400 block mb-2">Top Terminology Preferences</span>
            <div className="space-y-1">
              {topOverrides.map((override, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    <span className="line-through">{override.aiTerm}</span>
                    <span className="mx-1 text-slate-600">&rarr;</span>
                    <span className="text-slate-300">{override.physicianPreferred}</span>
                  </span>
                  <span className="text-slate-600">({override.frequency}x)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-700/50">
          Riley adapts note style based on your editing patterns. This data is private to you.
        </p>
      </EACardContent>
    </EACard>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

/** Visual bar showing verbosity score from terse (-100) to verbose (+100) */
const VerbosityBar: React.FC<{ score: number }> = ({ score }) => {
  // Map -100..+100 to 0..100%
  const percent = Math.max(0, Math.min(100, (score + 100) / 2));

  return (
    <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
      <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 via-slate-400 to-purple-500 rounded-full opacity-30 w-full" />
      <div
        className="absolute top-0 w-1.5 h-full bg-white rounded-full shadow-sm"
        style={{ left: `calc(${percent}% - 3px)` }}
      />
      {/* Center marker */}
      <div className="absolute top-0 left-1/2 w-px h-full bg-slate-500" />
    </div>
  );
};

/** Single row showing section emphasis direction */
const SectionEmphasisRow: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const absValue = Math.abs(value);
  const percentStr = `${Math.round(absValue * 100)}%`;

  let indicator: string;
  let colorClass: string;
  if (value > 0.05) {
    indicator = `Expands (+${percentStr})`;
    colorClass = 'text-green-400';
  } else if (value < -0.05) {
    indicator = `Condenses (-${percentStr})`;
    colorClass = 'text-amber-400';
  } else {
    indicator = 'Neutral';
    colorClass = 'text-slate-500';
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400 w-6">{label}:</span>
      <span className={`text-xs ${colorClass}`}>{indicator}</span>
    </div>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default PhysicianStyleProfile;
