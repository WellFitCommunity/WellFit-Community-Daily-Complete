// src/components/smart/RealTimeSmartScribe.tsx
// SmartScribe Atlus - AI-Powered Medical Transcription & Revenue Optimization
// Uses Claude Sonnet 4.5 for maximum billing accuracy
// REFACTORED: Business logic extracted to useSmartScribe hook, audio processing lazy-loaded

import React from 'react';
import { useSmartScribe } from './hooks/useSmartScribe';
import { VoiceLearningService } from '../../services/voiceLearningService';
import { supabase } from '../../lib/supabaseClient';

interface RealTimeSmartScribeProps {
  selectedPatientId?: string;
  selectedPatientName?: string;
  onSessionComplete?: (sessionId: string) => void;
}

const RealTimeSmartScribe: React.FC<RealTimeSmartScribeProps> = (props) => {
  // Use custom hook for all business logic
  // Audio processor is lazy-loaded when startRecording is called
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
    setShowCorrectionModal,
    setCorrectionHeard,
    setCorrectionCorrect,
    setVoiceProfile,
    setSelectedTextForCorrection,
    startRecording,
    stopRecording,
    handleAssistanceLevelChange,
  } = useSmartScribe(props);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-xl">
      {/* Header with Recording Status */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🧭 Compass Riley</h2>
            <p className="text-sm text-gray-600 mt-1">{status}</p>
          </div>
          {/* Live Recording Indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full shadow-lg animate-pulse">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="font-bold text-sm">LIVE RECORDING</span>
            </div>
          )}
        </div>
        {/* Documentation Quality Indicator */}
        {suggestedCodes.length > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg shadow-lg">
            <div className="text-center">
              <div className="text-xs font-medium text-blue-700">Documentation Quality</div>
              <div className="text-2xl font-bold text-blue-900">{suggestedCodes.length} codes captured</div>
            </div>
          </div>
        )}
      </div>

      {/* Assistance Level Control - Simplified 3-Level Design */}
      <div className={`mb-6 p-5 rounded-xl border-2 ${assistanceSettings.borderColor} ${assistanceSettings.bgColor}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span>🎚️</span>
              Riley Assistance Level
            </h3>
            <p className={`text-sm ${assistanceSettings.color} font-medium mt-1`}>
              {assistanceSettings.label}: {assistanceSettings.description}
            </p>
          </div>
          {assistanceLevelLoaded && (
            <span className="text-green-600 font-semibold flex items-center gap-1 text-sm">
              <span>✓</span>
              <span>Saved</span>
            </span>
          )}
        </div>

        {/* Three-Button Selection */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleAssistanceLevelChange(3)}
            disabled={isRecording || !assistanceLevelLoaded}
            className={`p-4 rounded-xl border-2 transition-all ${
              assistanceLevel <= 4
                ? 'bg-gray-100 border-gray-400 ring-2 ring-gray-400 ring-offset-2'
                : 'bg-white border-gray-200 hover:border-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-2xl mb-2">🤫</div>
            <div className="font-bold text-gray-900">Concise</div>
            <div className="text-xs text-gray-600 mt-1">Codes only, minimal chat</div>
          </button>

          <button
            onClick={() => handleAssistanceLevelChange(5)}
            disabled={isRecording || !assistanceLevelLoaded}
            className={`p-4 rounded-xl border-2 transition-all ${
              assistanceLevel >= 5 && assistanceLevel <= 7
                ? 'bg-green-100 border-green-400 ring-2 ring-green-400 ring-offset-2'
                : 'bg-white border-gray-200 hover:border-green-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-2xl mb-2">⚖️</div>
            <div className="font-bold text-gray-900">Balanced</div>
            <div className="text-xs text-gray-600 mt-1">Helpful suggestions & tips</div>
          </button>

          <button
            onClick={() => handleAssistanceLevelChange(8)}
            disabled={isRecording || !assistanceLevelLoaded}
            className={`p-4 rounded-xl border-2 transition-all ${
              assistanceLevel >= 8
                ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-400 ring-offset-2'
                : 'bg-white border-gray-200 hover:border-blue-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-2xl mb-2">📚</div>
            <div className="font-bold text-gray-900">Detailed</div>
            <div className="text-xs text-gray-600 mt-1">Full explanations & coaching</div>
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-600 bg-white p-3 rounded border border-gray-200">
          <strong>Note:</strong> Assistance level controls Riley's conversational coaching only.
          <strong className="text-blue-700"> All billing codes remain accurate regardless of this setting.</strong>
        </div>
      </div>

      {/* Conversational Messages - Scribe Chat */}
      {assistanceSettings.showConversationalMessages && conversationalMessages.length > 0 && (
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="text-3xl">💬</div>
            <div className="flex-1 space-y-2">
              {conversationalMessages.slice(-3).map((msg, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-semibold text-blue-900">Riley:</span>
                  <span className="text-blue-800 ml-2">{msg.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Proactive Suggestions */}
      {assistanceSettings.showSuggestions && scribeSuggestions.length > 0 && (
        <div className="mb-6 bg-amber-50 rounded-xl p-4 border-2 border-amber-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 mb-2">Quick Suggestions</h4>
              <ul className="space-y-1">
                {scribeSuggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-amber-800 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recording Timer */}
      {isRecording && (
        <div className="flex items-center justify-center gap-6 mb-6 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏱️</span>
            <div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Recording Duration</div>
              <div className="text-3xl font-mono font-bold text-gray-900">
                {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          {elapsedSeconds >= 1200 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 border-2 border-green-500 rounded-lg animate-pulse">
              <span className="text-green-600 text-xl">✓</span>
              <span className="text-sm font-semibold text-green-900">CCM Eligible (20+ min)</span>
            </div>
          )}

          {elapsedSeconds >= 2400 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 border-2 border-blue-500 rounded-lg">
              <span className="text-blue-600 text-xl">⬆</span>
              <span className="text-sm font-semibold text-blue-900">Extended CCM (40+ min)</span>
            </div>
          )}
        </div>
      )}

      {/* Recording Button */}
      <div className="flex justify-center mb-8">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="group relative px-12 py-6 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl hover:from-red-600 hover:to-red-700 text-xl font-bold shadow-2xl transition-all transform hover:scale-105"
          >
            <span className="flex items-center gap-3">
              <span className="text-3xl">🔴</span>
              Start Recording Visit
            </span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-12 py-6 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-2xl hover:from-gray-700 hover:to-gray-800 text-xl font-bold shadow-2xl transition-all"
          >
            <span className="flex items-center gap-3">
              <span className="text-3xl">⏹️</span>
              Stop Recording
            </span>
          </button>
        )}
      </div>

      {/* Live Transcript */}
      {transcript && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className={isRecording ? 'animate-pulse' : ''}>📝</span>
                Live Transcript
                {isRecording && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">CAPTURING</span>}
              </h3>
              {correctionsAppliedCount > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                  ✓ {correctionsAppliedCount} corrections applied
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                {transcript.split(' ').length} words
              </div>
              <button
                onClick={() => {
                  setSelectedTextForCorrection(transcript);
                  setShowCorrectionModal(true);
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-all"
                title="Teach Riley a voice correction"
              >
                🎓 Teach Correction
              </button>
            </div>
          </div>
          <div className={`rounded-xl p-6 max-h-96 overflow-y-auto border-2 shadow-inner ${
            isRecording
              ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-300 animate-pulse-slow'
              : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
          }`}>
            <p className="text-lg leading-relaxed text-gray-900 font-medium">{transcript}</p>
          </div>
        </div>
      )}

      {/* Show placeholder when recording but no transcript yet */}
      {isRecording && !transcript && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-3">
            <span className="animate-pulse">📝</span>
            Live Transcript
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">LISTENING</span>
          </h3>
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-blue-300">
            <div className="flex items-center justify-center gap-3 text-gray-500">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
              </div>
              <p className="text-base italic">Waiting for speech...</p>
            </div>
          </div>
        </div>
      )}

      {/* Billing Code Suggestions - With Reasoning */}
      {suggestedCodes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>🎯</span>
            Billing Opportunities (Precision-Matched)
          </h3>
          <div className="space-y-4">
            {suggestedCodes.map((code, idx) => (
              <div
                key={idx}
                className="p-5 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-2 border-green-300 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl font-bold text-green-900">{code.code}</span>
                      <span className="px-3 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">
                        {code.type}
                      </span>
                      <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                        {Math.round(code.confidence * 100)}% confident
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium mb-2">{code.description}</p>

                    {/* Reasoning - Shows based on assistance level */}
                    {assistanceSettings.showReasoningDetails && code.reasoning && (
                      <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                        <p className="text-sm text-blue-900">
                          <span className="font-bold">💭 Why this fits: </span>
                          {code.reasoning}
                        </p>
                      </div>
                    )}

                    {assistanceSettings.showReasoningDetails && code.missingDocumentation && (
                      <div className="mt-3 p-3 bg-amber-100 border-l-4 border-amber-400 rounded">
                        <p className="text-sm text-amber-900">
                          <span className="font-bold">📝 To strengthen this code: </span>
                          {code.missingDocumentation}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="px-3 py-2 bg-white border-2 border-green-300 rounded-lg">
                      <div className="text-xs text-green-700 font-medium">Billable</div>
                      <div className="text-sm text-green-900 font-semibold">{code.type}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOAP Note Display - CLINICAL DOCUMENTATION */}
      {soapNote && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>📋</span>
              Clinical Documentation (SOAP Note)
            </h3>
            <button
              onClick={async () => {
                const soapText = `SUBJECTIVE:\n${soapNote.subjective}\n\nOBJECTIVE:\n${soapNote.objective}\n\nASSESSMENT:\n${soapNote.assessment}\n\nPLAN:\n${soapNote.plan}`;
                await navigator.clipboard.writeText(soapText);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 transition-all"
            >
              <span>📋</span>
              Copy to Clipboard
            </button>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-300 shadow-lg overflow-hidden">
            {/* Subjective */}
            <div className="border-b-2 border-gray-200">
              <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h4 className="font-bold text-lg text-blue-900">S - SUBJECTIVE</h4>
              </div>
              <div className="px-6 py-4">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{soapNote.subjective}</p>
              </div>
            </div>

            {/* Objective */}
            <div className="border-b-2 border-gray-200">
              <div className="px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50">
                <h4 className="font-bold text-lg text-green-900">O - OBJECTIVE</h4>
              </div>
              <div className="px-6 py-4">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{soapNote.objective}</p>
              </div>
            </div>

            {/* Assessment */}
            <div className="border-b-2 border-gray-200">
              <div className="px-6 py-3 bg-gradient-to-r from-amber-50 to-yellow-50">
                <h4 className="font-bold text-lg text-amber-900">A - ASSESSMENT</h4>
              </div>
              <div className="px-6 py-4">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{soapNote.assessment}</p>
              </div>
            </div>

            {/* Plan */}
            <div>
              <div className="px-6 py-3 bg-gradient-to-r from-purple-50 to-indigo-50">
                <h4 className="font-bold text-lg text-purple-900">P - PLAN</h4>
              </div>
              <div className="px-6 py-4">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{soapNote.plan}</p>
              </div>
            </div>
          </div>

          {/* HPI & ROS Expandable Sections */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <details className="bg-gray-50 rounded-lg border border-gray-300">
              <summary className="px-4 py-3 cursor-pointer font-semibold text-gray-900 hover:bg-gray-100 transition-colors">
                📝 Detailed HPI
              </summary>
              <div className="px-4 py-3 border-t border-gray-300">
                <p className="text-gray-800 text-sm leading-relaxed">{soapNote.hpi}</p>
              </div>
            </details>

            <details className="bg-gray-50 rounded-lg border border-gray-300">
              <summary className="px-4 py-3 cursor-pointer font-semibold text-gray-900 hover:bg-gray-100 transition-colors">
                🔍 Review of Systems
              </summary>
              <div className="px-4 py-3 border-t border-gray-300">
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{soapNote.ros}</p>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* HIPAA Compliance Notice */}
      <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔒</span>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-1">Privacy & Security</h4>
            <p className="text-sm text-blue-800">
              Compass Riley encrypts audio in transit and de-identifies PHI before AI analysis.
              All transcription runs on HIPAA-compliant infrastructure. Your data stays secure.
            </p>
          </div>
        </div>
      </div>

      {/* Voice Correction Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 m-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🎓</span>
              Teach Voice Correction
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Help Riley learn your voice! When the AI mishears a word or medical term, teach the correction here.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What did the AI hear? (incorrect)
              </label>
              <input
                type="text"
                value={correctionHeard}
                onChange={(e) => setCorrectionHeard(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., hyper blue semen"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What did you actually say? (correct)
              </label>
              <input
                type="text"
                value={correctionCorrect}
                onChange={(e) => setCorrectionCorrect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., hyperglycemia"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!correctionHeard.trim() || !correctionCorrect.trim()) {
                    return;
                  }

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
                      // Error handling in hook
                    }
                  }
                }}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-all"
              >
                Save Correction
              </button>
              <button
                onClick={() => {
                  setShowCorrectionModal(false);
                  setCorrectionHeard('');
                  setCorrectionCorrect('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>

            {voiceProfile && voiceProfile.corrections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                  You have {voiceProfile.corrections.length} correction{voiceProfile.corrections.length !== 1 ? 's' : ''} learned.
                  {voiceProfile.totalSessions > 0 && (
                    <> Accuracy improved by {Math.round((voiceProfile.accuracyCurrent - voiceProfile.accuracyBaseline) * 100) / 100}% over {voiceProfile.totalSessions} session{voiceProfile.totalSessions !== 1 ? 's' : ''}.</>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeSmartScribe;
