// src/components/smart/RealTimeSmartScribe.tsx
// Compass Riley - AI-Powered Medical Scribe & Billing Assistant
// Redesigned with Envision Atlus design system for clinical clarity

import React from 'react';
import { useSmartScribe } from './hooks/useSmartScribe';
import { VoiceLearningService } from '../../services/voiceLearningService';
import { supabase } from '../../lib/supabaseClient';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';

interface RealTimeSmartScribeProps {
  selectedPatientId?: string;
  selectedPatientName?: string;
  onSessionComplete?: (sessionId: string) => void;
}

const RealTimeSmartScribe: React.FC<RealTimeSmartScribeProps> = (props) => {
  const {
    transcript,
    suggestedCodes,
    isRecording,
    status,
    conversationalMessages,
    scribeSuggestions,
    elapsedSeconds,
    soapNote,
    assistanceLevel,
    assistanceLevelLoaded,
    voiceProfile,
    showCorrectionModal,
    correctionHeard,
    correctionCorrect,
    correctionsAppliedCount,
    assistanceSettings,
    isDemoMode,
    setShowCorrectionModal,
    setCorrectionHeard,
    setCorrectionCorrect,
    setVoiceProfile,
    setSelectedTextForCorrection,
    startRecording,
    stopRecording,
    handleAssistanceLevelChange,
  } = useSmartScribe(props);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <EACard variant="elevated">
        <EACardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00857a] to-[#006d64] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  Compass Riley
                  {isDemoMode && (
                    <EABadge variant="elevated" size="sm">DEMO</EABadge>
                  )}
                  {isRecording && (
                    <EABadge variant="critical" pulse size="sm">LIVE</EABadge>
                  )}
                </h2>
                <p className="text-sm text-slate-400">{status}</p>
              </div>
            </div>

            {/* Timer & CCM Indicator */}
            {isRecording && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-white">{formatTime(elapsedSeconds)}</div>
                  <div className="text-xs text-slate-400">Duration</div>
                </div>
                {elapsedSeconds >= 1200 && (
                  <EABadge variant="normal" size="lg">
                    CCM Eligible
                  </EABadge>
                )}
              </div>
            )}

            {/* Documentation Quality */}
            {suggestedCodes.length > 0 && !isRecording && (
              <div className="flex items-center gap-2">
                <EABadge variant="info" size="lg">
                  {suggestedCodes.length} codes captured
                </EABadge>
              </div>
            )}
          </div>
        </EACardContent>
      </EACard>

      {/* Assistance Level Control */}
      <EACard>
        <EACardHeader
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          }
          action={
            assistanceLevelLoaded && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Saved
              </span>
            )
          }
        >
          <h3 className="text-sm font-medium text-white">Riley Assistance Level</h3>
          <p className="text-xs text-slate-400">{assistanceSettings.label} - {assistanceSettings.description}</p>
        </EACardHeader>
        <EACardContent>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleAssistanceLevelChange(3)}
              disabled={isRecording || !assistanceLevelLoaded}
              className={`p-4 rounded-lg border-2 transition-all ${
                assistanceLevel <= 4
                  ? 'bg-slate-700/50 border-slate-500 ring-2 ring-slate-500/50'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="text-center">
                <svg className="w-6 h-6 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <div className="font-semibold text-white text-sm">Concise</div>
                <div className="text-xs text-slate-400 mt-1">Codes only</div>
              </div>
            </button>

            <button
              onClick={() => handleAssistanceLevelChange(5)}
              disabled={isRecording || !assistanceLevelLoaded}
              className={`p-4 rounded-lg border-2 transition-all ${
                assistanceLevel >= 5 && assistanceLevel <= 7
                  ? 'bg-[#00857a]/20 border-[#00857a] ring-2 ring-[#00857a]/50'
                  : 'bg-slate-800 border-slate-700 hover:border-[#00857a]/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="text-center">
                <svg className="w-6 h-6 mx-auto mb-2 text-[#33bfb7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <div className="font-semibold text-white text-sm">Balanced</div>
                <div className="text-xs text-slate-400 mt-1">With suggestions</div>
              </div>
            </button>

            <button
              onClick={() => handleAssistanceLevelChange(8)}
              disabled={isRecording || !assistanceLevelLoaded}
              className={`p-4 rounded-lg border-2 transition-all ${
                assistanceLevel >= 8
                  ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/50'
                  : 'bg-slate-800 border-slate-700 hover:border-blue-500/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="text-center">
                <svg className="w-6 h-6 mx-auto mb-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div className="font-semibold text-white text-sm">Detailed</div>
                <div className="text-xs text-slate-400 mt-1">Full coaching</div>
              </div>
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500 text-center">
            Assistance level affects coaching only. Billing code accuracy remains unchanged.
          </p>
        </EACardContent>
      </EACard>

      {/* Recording Button */}
      <div className="flex justify-center py-4">
        {!isRecording ? (
          <EAButton
            variant="accent"
            size="lg"
            onClick={startRecording}
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="6" />
              </svg>
            }
            className="px-8 py-4 text-lg"
          >
            Start Recording Visit
          </EAButton>
        ) : (
          <EAButton
            variant="secondary"
            size="lg"
            onClick={stopRecording}
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <rect x="5" y="5" width="10" height="10" rx="1" />
              </svg>
            }
            className="px-8 py-4 text-lg"
          >
            Stop Recording
          </EAButton>
        )}
      </div>

      {/* Riley's Messages */}
      {assistanceSettings.showConversationalMessages && conversationalMessages.length > 0 && (
        <EACard variant="highlight">
          <EACardContent className="py-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00857a] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">R</span>
              </div>
              <div className="flex-1 space-y-2">
                {conversationalMessages.slice(-3).map((msg, idx) => (
                  <p key={idx} className="text-sm text-slate-200">{msg.message}</p>
                ))}
              </div>
            </div>
          </EACardContent>
        </EACard>
      )}

      {/* Suggestions */}
      {assistanceSettings.showSuggestions && scribeSuggestions.length > 0 && (
        <EACard>
          <EACardHeader icon={<span className="text-amber-400">💡</span>}>
            <h3 className="text-sm font-medium text-white">Quick Suggestions</h3>
          </EACardHeader>
          <EACardContent className="py-3">
            <ul className="space-y-1">
              {scribeSuggestions.map((suggestion, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </EACardContent>
        </EACard>
      )}

      {/* Live Transcript */}
      {(transcript || isRecording) && (
        <EACard>
          <EACardHeader
            icon={
              <svg className={`w-5 h-5 ${isRecording ? 'text-red-400 animate-pulse' : 'text-[#33bfb7]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            action={
              <div className="flex items-center gap-3">
                {correctionsAppliedCount > 0 && (
                  <EABadge variant="normal" size="sm">{correctionsAppliedCount} corrections</EABadge>
                )}
                {transcript && (
                  <span className="text-xs text-slate-400">{transcript.split(' ').length} words</span>
                )}
                <EAButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTextForCorrection(transcript);
                    setShowCorrectionModal(true);
                  }}
                >
                  Teach Correction
                </EAButton>
              </div>
            }
          >
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              Live Transcript
              {isRecording && <EABadge variant="critical" pulse size="sm">CAPTURING</EABadge>}
            </h3>
          </EACardHeader>
          <EACardContent>
            {transcript ? (
              <p className="text-slate-200 leading-relaxed">{transcript}</p>
            ) : (
              <div className="flex items-center justify-center gap-3 py-6 text-slate-400">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-[#00857a] rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                  <span className="w-2 h-2 bg-[#00857a] rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                  <span className="w-2 h-2 bg-[#00857a] rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                </div>
                <span className="text-sm">Listening for speech...</span>
              </div>
            )}
          </EACardContent>
        </EACard>
      )}

      {/* Billing Codes */}
      {suggestedCodes.length > 0 && (
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
              {suggestedCodes.map((code, idx) => (
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
                      {assistanceSettings.showReasoningDetails && code.reasoning && (
                        <div className="mt-2 p-2 bg-slate-800 rounded border-l-2 border-[#00857a]">
                          <p className="text-xs text-slate-400">
                            <span className="text-[#33bfb7] font-medium">Why: </span>
                            {code.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Missing documentation hint */}
                      {assistanceSettings.showReasoningDetails && code.missingDocumentation && (
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
      )}

      {/* SOAP Note */}
      {soapNote && (
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
                onClick={async () => {
                  const soapText = `SUBJECTIVE:\n${soapNote.subjective}\n\nOBJECTIVE:\n${soapNote.objective}\n\nASSESSMENT:\n${soapNote.assessment}\n\nPLAN:\n${soapNote.plan}`;
                  await navigator.clipboard.writeText(soapText);
                }}
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
            <div className="border-t border-slate-700 grid grid-cols-2 divide-x divide-slate-700">
              <details className="group">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors">
                  Detailed HPI
                  <span className="ml-2 text-slate-500 group-open:rotate-180 inline-block transition-transform">▼</span>
                </summary>
                <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/30">
                  <p className="text-sm text-slate-300 leading-relaxed">{soapNote.hpi}</p>
                </div>
              </details>

              <details className="group">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors">
                  Review of Systems
                  <span className="ml-2 text-slate-500 group-open:rotate-180 inline-block transition-transform">▼</span>
                </summary>
                <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/30">
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{soapNote.ros}</p>
                </div>
              </details>
            </div>
          </EACardContent>
        </EACard>
      )}

      {/* Privacy Notice */}
      <div className="text-center py-2">
        <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-[#00857a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Audio encrypted in transit • PHI de-identified before AI analysis • HIPAA-compliant
        </p>
      </div>

      {/* Voice Correction Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <EACard className="max-w-md w-full mx-4">
            <EACardHeader
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              }
            >
              <h3 className="text-sm font-medium text-white">Teach Voice Correction</h3>
              <p className="text-xs text-slate-400">Help Riley learn your voice patterns</p>
            </EACardHeader>
            <EACardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    What did the AI hear? (incorrect)
                  </label>
                  <input
                    type="text"
                    value={correctionHeard}
                    onChange={(e) => setCorrectionHeard(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                    placeholder="e.g., hyper blue semen"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    What did you actually say? (correct)
                  </label>
                  <input
                    type="text"
                    value={correctionCorrect}
                    onChange={(e) => setCorrectionCorrect(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                    placeholder="e.g., hyperglycemia"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <EAButton
                    variant="primary"
                    className="flex-1"
                    onClick={async () => {
                      if (!correctionHeard.trim() || !correctionCorrect.trim()) return;

                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        try {
                          await VoiceLearningService.addCorrection(
                            user.id,
                            correctionHeard.trim(),
                            correctionCorrect.trim()
                          );
                          const updated = await VoiceLearningService.loadVoiceProfile(user.id);
                          setVoiceProfile(updated);
                          setShowCorrectionModal(false);
                          setCorrectionHeard('');
                          setCorrectionCorrect('');
                        } catch (error) {
                          // Error handling
                        }
                      }
                    }}
                  >
                    Save Correction
                  </EAButton>
                  <EAButton
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setShowCorrectionModal(false);
                      setCorrectionHeard('');
                      setCorrectionCorrect('');
                    }}
                  >
                    Cancel
                  </EAButton>
                </div>

                {voiceProfile && voiceProfile.corrections.length > 0 && (
                  <div className="pt-3 border-t border-slate-700">
                    <p className="text-xs text-slate-500">
                      {voiceProfile.corrections.length} correction{voiceProfile.corrections.length !== 1 ? 's' : ''} learned
                      {voiceProfile.totalSessions > 0 && (
                        <> • Accuracy improved by {Math.round((voiceProfile.accuracyCurrent - voiceProfile.accuracyBaseline) * 100) / 100}%</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </EACardContent>
          </EACard>
        </div>
      )}
    </div>
  );
};

export default RealTimeSmartScribe;
