/**
 * ConsultationPanel - Displays clinical reasoning consultation output
 *
 * Purpose: Render the structured consultation response from Riley's
 *          consultation mode — case presentation, Socratic reasoning,
 *          cannot-miss diagnoses, and confidence calibration.
 * Used by: RealTimeSmartScribe (consultation mode only)
 */

import React, { useState } from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';

/** Session 8 structured cannot-miss diagnosis */
interface CannotMissDiagnosisItem {
  diagnosis: string;
  severity: 'life-threatening' | 'emergent' | 'urgent';
  whyDangerous: string;
  distinguishingFeatures: string[];
  ruleOutTest: string;
  timeframe: string;
}

/** Matches ConsultationResponse from consultationPromptGenerators.ts (Sessions 7-8) */
export interface ConsultationPanelProps {
  response: {
    casePresentation: {
      oneLiner: string;
      hpi: string;
      pastMedicalHistory: string[];
      medications: string[];
      allergies: string[];
      socialHistory: string[];
      familyHistory: string[];
      ros: string[];
      physicalExam: Record<string, string[]>;
      diagnostics: string[];
      assessment: string;
      differentials: Array<{
        diagnosis: string;
        icd10?: string;
        probability: 'high' | 'moderate' | 'low';
        supporting: string[];
        against: string[];
        /** Session 8: Red flag symptoms */
        redFlags?: string[];
        /** Session 8: Key discriminating test */
        keyTest?: string;
        /** Session 8: Brief literature note */
        literatureNote?: string;
      }>;
      plan: string[];
    };
    reasoningSteps: Array<{
      question: string;
      analysis: string;
      considerations: string[];
      pivotPoints: string[];
    }>;
    /** Session 8: Structured or string[] (backwards-compat) */
    cannotMiss: CannotMissDiagnosisItem[] | string[];
    suggestedWorkup: string[];
    guidelineNotes: string[];
    confidenceCalibration: {
      highConfidence: string[];
      uncertain: string[];
      insufficientData: string[];
    };
    groundingFlags: {
      statedCount: number;
      inferredCount: number;
      gapCount: number;
      gaps: string[];
    };
  };
}

/** Type guard: check if cannotMiss items are structured */
function isStructuredCannotMiss(items: unknown[]): items is CannotMissDiagnosisItem[] {
  return items.length > 0 && typeof items[0] === 'object' && items[0] !== null && 'diagnosis' in items[0];
}

type ConsultationSection = 'case' | 'reasoning' | 'safety' | 'workup' | 'confidence';

export const ConsultationPanel: React.FC<ConsultationPanelProps> = React.memo(({ response }) => {
  const [activeSection, setActiveSection] = useState<ConsultationSection>('case');
  const { casePresentation, reasoningSteps, cannotMiss, suggestedWorkup, guidelineNotes, confidenceCalibration, groundingFlags } = response;

  const sections: Array<{ key: ConsultationSection; label: string; icon: string }> = [
    { key: 'case', label: 'Case', icon: '📋' },
    { key: 'reasoning', label: 'Reasoning', icon: '🧠' },
    { key: 'safety', label: 'Safety', icon: '🚨' },
    { key: 'workup', label: 'Workup', icon: '🔬' },
    { key: 'confidence', label: 'Confidence', icon: '📊' },
  ];

  return (
    <div className="space-y-3" data-testid="consultation-panel">
      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg overflow-x-auto">
        {sections.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all min-h-[44px] whitespace-nowrap ${
              activeSection === key
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            aria-pressed={activeSection === key}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Case Presentation Section */}
      {activeSection === 'case' && (
        <EACard>
          <EACardHeader icon={<span className="text-purple-400">📋</span>}>
            <h3 className="text-sm font-medium text-white">Structured Case Presentation</h3>
          </EACardHeader>
          <EACardContent className="py-3 space-y-3">
            {/* One-liner */}
            <div className="p-2 bg-purple-900/30 rounded-md border border-purple-700/30">
              <p className="text-sm font-medium text-purple-300">{casePresentation.oneLiner}</p>
            </div>

            {/* HPI */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">HPI</h4>
              <p className="text-sm text-slate-200">{casePresentation.hpi}</p>
            </div>

            {/* PMH, Meds, Allergies — compact grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <CompactList title="PMH" items={casePresentation.pastMedicalHistory} />
              <CompactList title="Medications" items={casePresentation.medications} />
              <CompactList title="Allergies" items={casePresentation.allergies} />
            </div>

            {/* Social/Family Hx */}
            {(casePresentation.socialHistory.length > 0 || casePresentation.familyHistory.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <CompactList title="Social History" items={casePresentation.socialHistory} />
                <CompactList title="Family History" items={casePresentation.familyHistory} />
              </div>
            )}

            {/* ROS */}
            {casePresentation.ros.length > 0 && (
              <CompactList title="Review of Systems" items={casePresentation.ros} />
            )}

            {/* Physical Exam */}
            {Object.keys(casePresentation.physicalExam).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Physical Exam</h4>
                <div className="space-y-1">
                  {Object.entries(casePresentation.physicalExam).map(([system, findings]) => (
                    <div key={system} className="text-sm">
                      <span className="text-slate-400 font-medium">{system}:</span>{' '}
                      <span className="text-slate-200">{findings.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnostics */}
            {casePresentation.diagnostics.length > 0 && (
              <CompactList title="Diagnostics" items={casePresentation.diagnostics} />
            )}

            {/* Assessment */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Assessment</h4>
              <p className="text-sm text-slate-200">{casePresentation.assessment}</p>
            </div>

            {/* Differential Diagnosis */}
            {casePresentation.differentials.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Differential Diagnosis
                </h4>
                <div className="space-y-2">
                  {casePresentation.differentials.map((dx, idx) => (
                    <DifferentialCard key={idx} differential={dx} rank={idx + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Plan */}
            {casePresentation.plan.length > 0 && (
              <CompactList title="Plan" items={casePresentation.plan} numbered />
            )}
          </EACardContent>
        </EACard>
      )}

      {/* Socratic Reasoning Section */}
      {activeSection === 'reasoning' && (
        <EACard>
          <EACardHeader icon={<span className="text-amber-400">🧠</span>}>
            <h3 className="text-sm font-medium text-white">Clinical Reasoning</h3>
          </EACardHeader>
          <EACardContent className="py-3 space-y-3">
            {reasoningSteps.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No reasoning steps generated yet.</p>
            ) : (
              reasoningSteps.map((step, idx) => (
                <ReasoningStepCard key={idx} step={step} index={idx + 1} />
              ))
            )}
          </EACardContent>
        </EACard>
      )}

      {/* Safety Section (Cannot-Miss + Guidelines) */}
      {activeSection === 'safety' && (
        <div className="space-y-3">
          {cannotMiss.length > 0 && (
            <EACard>
              <EACardHeader icon={<span className="text-red-400">🚨</span>}>
                <h3 className="text-sm font-medium text-white">Cannot-Miss Diagnoses</h3>
              </EACardHeader>
              <EACardContent className="py-3">
                {isStructuredCannotMiss(cannotMiss) ? (
                  <div className="space-y-3" role="list" aria-label="Cannot-miss diagnoses">
                    {cannotMiss.map((item, idx) => (
                      <CannotMissCard key={idx} item={item} />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1.5" role="list" aria-label="Cannot-miss diagnoses">
                    {(cannotMiss as string[]).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                        <span className="text-slate-200">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </EACardContent>
            </EACard>
          )}

          {guidelineNotes.length > 0 && (
            <EACard>
              <EACardHeader icon={<span className="text-blue-400">📖</span>}>
                <h3 className="text-sm font-medium text-white">Guideline Notes</h3>
              </EACardHeader>
              <EACardContent className="py-3">
                <ul className="space-y-1.5">
                  {guidelineNotes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                      <span className="text-slate-200">{note}</span>
                    </li>
                  ))}
                </ul>
              </EACardContent>
            </EACard>
          )}
        </div>
      )}

      {/* Workup Section */}
      {activeSection === 'workup' && (
        <EACard>
          <EACardHeader icon={<span className="text-green-400">🔬</span>}>
            <h3 className="text-sm font-medium text-white">Suggested Additional Workup</h3>
          </EACardHeader>
          <EACardContent className="py-3">
            {suggestedWorkup.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No additional workup suggested.</p>
            ) : (
              <ul className="space-y-1.5">
                {suggestedWorkup.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 mt-0.5 shrink-0">→</span>
                    <span className="text-slate-200">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </EACardContent>
        </EACard>
      )}

      {/* Confidence Calibration Section */}
      {activeSection === 'confidence' && (
        <div className="space-y-3">
          <EACard>
            <EACardHeader icon={<span className="text-emerald-400">📊</span>}>
              <h3 className="text-sm font-medium text-white">Confidence Calibration</h3>
            </EACardHeader>
            <EACardContent className="py-3 space-y-3">
              {confidenceCalibration.highConfidence.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">
                    High Confidence
                  </h4>
                  <ul className="space-y-1">
                    {confidenceCalibration.highConfidence.map((item, idx) => (
                      <li key={idx} className="text-sm text-slate-200 flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {confidenceCalibration.uncertain.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">
                    Uncertain
                  </h4>
                  <ul className="space-y-1">
                    {confidenceCalibration.uncertain.map((item, idx) => (
                      <li key={idx} className="text-sm text-slate-200 flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5 shrink-0">?</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {confidenceCalibration.insufficientData.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">
                    Insufficient Data
                  </h4>
                  <ul className="space-y-1">
                    {confidenceCalibration.insufficientData.map((item, idx) => (
                      <li key={idx} className="text-sm text-slate-200 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </EACardContent>
          </EACard>

          {/* Grounding Flags */}
          <EACard>
            <EACardHeader icon={<span className="text-slate-400">🔍</span>}>
              <h3 className="text-sm font-medium text-white">Grounding Report</h3>
            </EACardHeader>
            <EACardContent className="py-3">
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-400">{groundingFlags.statedCount}</div>
                  <div className="text-xs text-slate-400">Stated</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-400">{groundingFlags.inferredCount}</div>
                  <div className="text-xs text-slate-400">Inferred</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-400">{groundingFlags.gapCount}</div>
                  <div className="text-xs text-slate-400">Gaps</div>
                </div>
              </div>
              {groundingFlags.gaps.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700">
                  <h4 className="text-xs font-semibold text-slate-400 mb-1">Documentation Gaps</h4>
                  <ul className="space-y-0.5">
                    {groundingFlags.gaps.map((gap, idx) => (
                      <li key={idx} className="text-xs text-red-300">• {gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </EACardContent>
          </EACard>
        </div>
      )}
    </div>
  );
});

ConsultationPanel.displayName = 'ConsultationPanel';

/* ────────────────────────────── Sub-components ────────────────────────────── */

/** Compact list with title — reusable for PMH, meds, allergies, etc. */
const CompactList: React.FC<{ title: string; items: string[]; numbered?: boolean }> = ({ title, items, numbered }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{title}</h4>
      {numbered ? (
        <ol className="space-y-0.5 list-decimal list-inside">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-slate-200">{item}</li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-slate-200">• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Differential diagnosis card with probability indicator + Session 8 enhancements */
const DifferentialCard: React.FC<{
  differential: ConsultationPanelProps['response']['casePresentation']['differentials'][0];
  rank: number;
}> = ({ differential, rank }) => {
  const probColor = differential.probability === 'high'
    ? 'text-red-400 bg-red-900/20 border-red-700/30'
    : differential.probability === 'moderate'
      ? 'text-amber-400 bg-amber-900/20 border-amber-700/30'
      : 'text-slate-400 bg-slate-800/50 border-slate-700/30';

  return (
    <div className={`p-2 rounded-md border ${probColor}`} data-testid={`differential-${rank}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold">#{rank}</span>
        <span className="text-sm font-medium">{differential.diagnosis}</span>
        {differential.icd10 && (
          <span className="text-xs opacity-60">({differential.icd10})</span>
        )}
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-black/20 ml-auto">
          {differential.probability}
        </span>
      </div>
      {differential.supporting.length > 0 && (
        <div className="text-xs text-slate-300 mt-1">
          <span className="text-emerald-400">For:</span> {differential.supporting.join('; ')}
        </div>
      )}
      {differential.against.length > 0 && (
        <div className="text-xs text-slate-300">
          <span className="text-red-400">Against:</span> {differential.against.join('; ')}
        </div>
      )}
      {/* Session 8: Red flags */}
      {differential.redFlags && differential.redFlags.length > 0 && (
        <div className="text-xs text-slate-300 mt-1">
          <span className="text-orange-400">Red flags:</span> {differential.redFlags.join('; ')}
        </div>
      )}
      {/* Session 8: Key discriminating test */}
      {differential.keyTest && (
        <div className="text-xs text-slate-300 mt-0.5">
          <span className="text-cyan-400">Key test:</span> {differential.keyTest}
        </div>
      )}
      {/* Session 8: Literature note */}
      {differential.literatureNote && (
        <div className="text-xs text-slate-400 mt-0.5 italic">
          {differential.literatureNote}
        </div>
      )}
    </div>
  );
};

/** Session 8: Structured cannot-miss diagnosis card */
const CannotMissCard: React.FC<{ item: CannotMissDiagnosisItem }> = ({ item }) => {
  const severityColor = item.severity === 'life-threatening'
    ? 'border-red-600/50 bg-red-900/30'
    : item.severity === 'emergent'
      ? 'border-orange-600/50 bg-orange-900/20'
      : 'border-amber-600/50 bg-amber-900/20';
  const severityBadge = item.severity === 'life-threatening'
    ? 'bg-red-600 text-white'
    : item.severity === 'emergent'
      ? 'bg-orange-600 text-white'
      : 'bg-amber-600 text-white';

  return (
    <div className={`p-3 rounded-md border ${severityColor}`} role="listitem" data-testid="cannot-miss-item">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-red-400 shrink-0">⚠</span>
        <span className="text-sm font-medium text-white">{item.diagnosis}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold ml-auto ${severityBadge}`}>
          {item.severity}
        </span>
      </div>
      <p className="text-xs text-slate-300 mb-1.5">{item.whyDangerous}</p>
      {item.distinguishingFeatures.length > 0 && (
        <div className="text-xs text-slate-300 mb-1">
          <span className="text-slate-400">Look for:</span> {item.distinguishingFeatures.join('; ')}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs mt-1.5 pt-1.5 border-t border-white/10">
        <span className="text-cyan-400">Rule out: {item.ruleOutTest}</span>
        <span className="text-amber-300 ml-auto">{item.timeframe}</span>
      </div>
    </div>
  );
};

/** Socratic reasoning step card */
const ReasoningStepCard: React.FC<{
  step: ConsultationPanelProps['response']['reasoningSteps'][0];
  index: number;
}> = ({ step, index }) => (
  <div className="p-3 bg-slate-800/50 rounded-md border border-amber-700/20" data-testid={`reasoning-step-${index}`}>
    <div className="flex items-start gap-2 mb-2">
      <span className="text-amber-400 font-bold text-sm shrink-0">Q{index}.</span>
      <p className="text-sm font-medium text-amber-200">{step.question}</p>
    </div>
    <p className="text-sm text-slate-200 mb-2 ml-6">{step.analysis}</p>
    {step.considerations.length > 0 && (
      <div className="ml-6 mb-1">
        <span className="text-xs text-slate-400">Consider:</span>
        <ul className="mt-0.5 space-y-0.5">
          {step.considerations.map((c, idx) => (
            <li key={idx} className="text-xs text-slate-300">• {c}</li>
          ))}
        </ul>
      </div>
    )}
    {step.pivotPoints.length > 0 && (
      <div className="ml-6">
        <span className="text-xs text-slate-400">Pivot if:</span>
        <ul className="mt-0.5 space-y-0.5">
          {step.pivotPoints.map((p, idx) => (
            <li key={idx} className="text-xs text-purple-300">→ {p}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

export default ConsultationPanel;
