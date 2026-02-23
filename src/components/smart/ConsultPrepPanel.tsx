/**
 * ConsultPrepPanel - Displays peer consultation prep summary
 *
 * Purpose: When a physician requests "prepare a consult for cardiology,"
 *          this panel shows the SBAR-formatted summary tailored to the
 *          receiving specialty. Session 8 of Compass Riley.
 * Used by: RealTimeSmartScribe (consultation mode only)
 */

import React, { useState, useCallback } from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';

/** Supported specialties — matches CONSULT_SPECIALTIES on the server */
export const CONSULT_SPECIALTIES = [
  'Cardiology', 'Pulmonology', 'Neurology', 'Gastroenterology',
  'Nephrology', 'Endocrinology', 'Infectious Disease', 'Hematology/Oncology',
  'Rheumatology', 'Surgery', 'Psychiatry', 'Critical Care',
] as const;

export interface ConsultPrepSummaryData {
  targetSpecialty: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  criticalData: string[];
  consultQuestion: string;
  urgency: 'stat' | 'urgent' | 'routine';
}

export interface ConsultPrepPanelProps {
  /** The generated consult prep summary (null = not yet requested) */
  summary: ConsultPrepSummaryData | null;
  /** Whether a consult prep request is in flight */
  loading: boolean;
  /** Callback to request consult prep for a specialty */
  onRequestConsultPrep: (specialty: string) => void;
  /** Whether there's an active consultation response (enables consult prep) */
  hasConsultationResponse: boolean;
}

export const ConsultPrepPanel: React.FC<ConsultPrepPanelProps> = React.memo(({
  summary,
  loading,
  onRequestConsultPrep,
  hasConsultationResponse,
}) => {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');

  const handleRequest = useCallback(() => {
    if (selectedSpecialty) {
      onRequestConsultPrep(selectedSpecialty);
    }
  }, [selectedSpecialty, onRequestConsultPrep]);

  return (
    <div className="space-y-3" data-testid="consult-prep-panel">
      {/* Specialty Selector */}
      <EACard>
        <EACardHeader icon={<span className="text-blue-400">📞</span>}>
          <h3 className="text-sm font-medium text-white">Peer Consult Prep</h3>
        </EACardHeader>
        <EACardContent className="py-3 space-y-3">
          <p className="text-xs text-slate-400">
            Select a specialty and Riley will generate an SBAR summary tailored for that consultant.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CONSULT_SPECIALTIES.map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all min-h-[36px] ${
                  selectedSpecialty === spec
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                aria-pressed={selectedSpecialty === spec}
              >
                {spec}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleRequest}
            disabled={!selectedSpecialty || loading || !hasConsultationResponse}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium min-h-[44px] transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
            data-testid="request-consult-prep-btn"
          >
            {loading
              ? 'Generating consult summary...'
              : !hasConsultationResponse
                ? 'Run consultation analysis first'
                : selectedSpecialty
                  ? `Prepare ${selectedSpecialty} Consult`
                  : 'Select a specialty'}
          </button>
          {!hasConsultationResponse && (
            <p className="text-xs text-amber-400">
              Record an encounter in consultation mode first — Riley needs the case analysis to generate a consult summary.
            </p>
          )}
        </EACardContent>
      </EACard>

      {/* SBAR Summary */}
      {summary && (
        <EACard>
          <EACardHeader icon={<span className="text-blue-400">📋</span>}>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-white">{summary.targetSpecialty} Consult Summary</h3>
              <UrgencyBadge urgency={summary.urgency} />
            </div>
          </EACardHeader>
          <EACardContent className="py-3 space-y-3">
            {/* SBAR Sections */}
            <SBARSection label="S" title="Situation" content={summary.situation} color="text-blue-400" />
            <SBARSection label="B" title="Background" content={summary.background} color="text-green-400" />
            <SBARSection label="A" title="Assessment" content={summary.assessment} color="text-amber-400" />
            <SBARSection label="R" title="Recommendation" content={summary.recommendation} color="text-red-400" />

            {/* Consult Question */}
            <div className="p-2.5 bg-purple-900/30 rounded-md border border-purple-700/30">
              <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1">
                Specific Question for Consultant
              </h4>
              <p className="text-sm text-white font-medium" data-testid="consult-question">
                {summary.consultQuestion}
              </p>
            </div>

            {/* Critical Data */}
            {summary.criticalData.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Critical Data Points
                </h4>
                <ul className="space-y-0.5">
                  {summary.criticalData.map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                      <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </EACardContent>
        </EACard>
      )}
    </div>
  );
});

ConsultPrepPanel.displayName = 'ConsultPrepPanel';

/* ────────────────────────────── Sub-components ────────────────────────────── */

/** SBAR section with colored label */
const SBARSection: React.FC<{
  label: string;
  title: string;
  content: string;
  color: string;
}> = ({ label, title, content, color }) => (
  <div className="flex items-start gap-2">
    <span className={`${color} font-bold text-lg leading-tight shrink-0 w-5 text-center`}>{label}</span>
    <div className="flex-1">
      <span className={`text-xs font-semibold ${color} uppercase tracking-wide`}>{title}</span>
      <p className="text-sm text-slate-200 mt-0.5">{content}</p>
    </div>
  </div>
);

/** Urgency badge */
const UrgencyBadge: React.FC<{ urgency: 'stat' | 'urgent' | 'routine' }> = ({ urgency }) => {
  const colors = urgency === 'stat'
    ? 'bg-red-600 text-white'
    : urgency === 'urgent'
      ? 'bg-orange-600 text-white'
      : 'bg-slate-600 text-slate-200';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold ${colors}`} data-testid="urgency-badge">
      {urgency}
    </span>
  );
};

export default ConsultPrepPanel;
