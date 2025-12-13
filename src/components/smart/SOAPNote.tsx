/**
 * SOAP Note Component
 *
 * Displays AI-generated SOAP note with expandable HPI and ROS.
 * Split from RealTimeSmartScribe for better performance.
 */

import React from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';

interface SOAPNoteData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  hpi?: string;
  ros?: string;
}

interface SOAPNoteProps {
  soapNote: SOAPNoteData;
}

export const SOAPNote: React.FC<SOAPNoteProps> = React.memo(({ soapNote }) => {
  const handleCopyToClipboard = async () => {
    const soapText = `SUBJECTIVE:\n${soapNote.subjective}\n\nOBJECTIVE:\n${soapNote.objective}\n\nASSESSMENT:\n${soapNote.assessment}\n\nPLAN:\n${soapNote.plan}`;
    await navigator.clipboard.writeText(soapText);
  };

  return (
    <EACard>
      <EACardHeader
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        action={
          <EAButton
            variant="ghost"
            size="sm"
            onClick={handleCopyToClipboard}
          >
            Copy to Clipboard
          </EAButton>
        }
      >
        <h3 className="text-sm font-medium text-white">SOAP Note</h3>
        <p className="text-xs text-slate-400">AI-generated clinical documentation</p>
      </EACardHeader>
      <EACardContent className="p-0">
        {/* Subjective */}
        <div className="border-b border-slate-700">
          <div className="px-4 py-2 bg-blue-900/20 border-l-4 border-blue-500">
            <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">S - Subjective</h4>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-slate-200 leading-relaxed">{soapNote.subjective}</p>
          </div>
        </div>

        {/* Objective */}
        <div className="border-b border-slate-700">
          <div className="px-4 py-2 bg-green-900/20 border-l-4 border-green-500">
            <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wide">O - Objective</h4>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-slate-200 leading-relaxed">{soapNote.objective}</p>
          </div>
        </div>

        {/* Assessment */}
        <div className="border-b border-slate-700">
          <div className="px-4 py-2 bg-amber-900/20 border-l-4 border-amber-500">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">A - Assessment</h4>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-slate-200 leading-relaxed">{soapNote.assessment}</p>
          </div>
        </div>

        {/* Plan */}
        <div>
          <div className="px-4 py-2 bg-purple-900/20 border-l-4 border-purple-500">
            <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wide">P - Plan</h4>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{soapNote.plan}</p>
          </div>
        </div>

        {/* Expandable HPI & ROS */}
        {(soapNote.hpi || soapNote.ros) && (
          <div className="border-t border-slate-700 grid grid-cols-2 divide-x divide-slate-700">
            {soapNote.hpi && (
              <details className="group">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors">
                  Detailed HPI
                  <span className="ml-2 text-slate-500 group-open:rotate-180 inline-block transition-transform">▼</span>
                </summary>
                <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/30">
                  <p className="text-sm text-slate-300 leading-relaxed">{soapNote.hpi}</p>
                </div>
              </details>
            )}

            {soapNote.ros && (
              <details className="group">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors">
                  Review of Systems
                  <span className="ml-2 text-slate-500 group-open:rotate-180 inline-block transition-transform">▼</span>
                </summary>
                <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/30">
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{soapNote.ros}</p>
                </div>
              </details>
            )}
          </div>
        )}
      </EACardContent>
    </EACard>
  );
});

SOAPNote.displayName = 'SOAPNote';

export default SOAPNote;
