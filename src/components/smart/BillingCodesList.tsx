/**
 * Billing Codes List Component
 *
 * Displays AI-suggested billing codes with confidence and reasoning.
 * Split from RealTimeSmartScribe for better performance.
 */

import React from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EABadge } from '../envision-atlus/EABadge';

interface SuggestedCode {
  code: string;
  type: 'CPT' | 'ICD10' | 'HCPCS';
  description: string;
  confidence: number;
  reasoning?: string;
  missingDocumentation?: string;
}

interface BillingCodesListProps {
  codes: SuggestedCode[];
  showReasoningDetails: boolean;
}

export const BillingCodesList: React.FC<BillingCodesListProps> = React.memo(({
  codes,
  showReasoningDetails,
}) => {
  if (codes.length === 0) return null;

  return (
    <EACard>
      <EACardHeader
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
      >
        <h3 className="text-sm font-medium text-white">Billing Code Suggestions</h3>
        <p className="text-xs text-slate-400">AI-recommended codes based on encounter</p>
      </EACardHeader>
      <EACardContent>
        <div className="space-y-3">
          {codes.map((code, idx) => (
            <div
              key={idx}
              className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-[#00857a]/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-[#33bfb7]">{code.code}</span>
                    <EABadge variant={
                      code.type === 'CPT' ? 'info' :
                      code.type === 'ICD10' ? 'elevated' : 'neutral'
                    } size="sm">
                      {code.type}
                    </EABadge>
                    <span className="text-xs text-slate-500">
                      {Math.round(code.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{code.description}</p>

                  {/* Reasoning - shown based on assistance level */}
                  {showReasoningDetails && code.reasoning && (
                    <div className="mt-2 p-2 bg-slate-800 rounded border-l-2 border-[#00857a]">
                      <p className="text-xs text-slate-400">
                        <span className="text-[#33bfb7] font-medium">Why: </span>
                        {code.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Missing documentation hint */}
                  {showReasoningDetails && code.missingDocumentation && (
                    <div className="mt-2 p-2 bg-amber-900/20 rounded border-l-2 border-amber-500">
                      <p className="text-xs text-amber-300">
                        <span className="font-medium">To strengthen: </span>
                        {code.missingDocumentation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </EACardContent>
    </EACard>
  );
});

BillingCodesList.displayName = 'BillingCodesList';

export default BillingCodesList;
