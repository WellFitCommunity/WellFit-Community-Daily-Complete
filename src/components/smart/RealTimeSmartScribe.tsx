// src/components/smart/RealTimeSmartScribe.tsx
// SmartScribe (nurses) & Compass Riley (physicians) - Voice Documentation System
// SmartScribe: Simple transcription for burnout reduction (no billing)
// Compass Riley: Full AI scribe with billing intelligence
// Redesigned with Envision Atlus design system for clinical clarity
// Refactored: Split into memoized child components for performance (2025-12-13)

import React, { useCallback } from 'react';
import { useSmartScribe } from './hooks/useSmartScribe';
import { VoiceLearningService } from '../../services/voiceLearningService';
import { supabase } from '../../lib/supabaseClient';
import { useDemoMode } from '../../contexts/DemoModeContext';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';

// Split components for better performance
import { ScribeHeader } from './ScribeHeader';
import { AssistanceLevelControl } from './AssistanceLevelControl';
import { RecordingButton } from './RecordingButton';
import { LiveTranscript } from './LiveTranscript';
import { BillingCodesList } from './BillingCodesList';
import { SOAPNote } from './SOAPNote';
import { VoiceCorrectionModal } from './VoiceCorrectionModal';
import { ProactiveCorrectionList } from './ProactiveCorrection';

/**
 * Scribe Mode:
 * - 'smartscribe': For nurses - simple transcription, NO billing codes, burnout reduction
 * - 'compass-riley': For physicians/NPs/PAs - full AI scribe with billing intelligence
 */
export type ScribeMode = 'smartscribe' | 'compass-riley';

interface RealTimeSmartScribeProps {
  selectedPatientId?: string;
  selectedPatientName?: string;
  onSessionComplete?: (sessionId: string) => void;
  /** Scribe mode - 'smartscribe' for nurses, 'compass-riley' for physicians (default) */
  mode?: ScribeMode;
}

const RealTimeSmartScribe: React.FC<RealTimeSmartScribeProps> = (props) => {
  const { mode = 'compass-riley' } = props;
  const isSmartScribeMode = mode === 'smartscribe';

  // Check if demo mode is enabled globally (from DemoPage or elsewhere)
  const { isDemo: globalDemoMode, enableDemo, disableDemo } = useDemoMode();

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
    assistanceLevelSaved,
    voiceProfile,
    showCorrectionModal,
    correctionHeard,
    correctionCorrect,
    correctionsAppliedCount,
    assistanceSettings,
    isDemoMode,
    // Proactive confirmation - "Did I understand you to say XYZ?"
    pendingConfirmations,
    setShowCorrectionModal,
    setCorrectionHeard,
    setCorrectionCorrect,
    setVoiceProfile,
    setSelectedTextForCorrection,
    startRecording,
    stopRecording,
    handleAssistanceLevelChange,
    // Proactive confirmation handlers
    handleConfirmCorrect,
    handleProactiveCorrection,
    handleDismissConfirmation,
  } = useSmartScribe({ ...props, forceDemoMode: globalDemoMode || undefined });

  // Handler for saving voice corrections
  const handleSaveCorrection = useCallback(async () => {
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
      } catch {
        // Error handling - user feedback could be added here
      }
    }
  }, [correctionHeard, correctionCorrect, setVoiceProfile, setShowCorrectionModal, setCorrectionHeard, setCorrectionCorrect]);

  // Handler for closing correction modal
  const handleCloseCorrection = useCallback(() => {
    setShowCorrectionModal(false);
    setCorrectionHeard('');
    setCorrectionCorrect('');
  }, [setShowCorrectionModal, setCorrectionHeard, setCorrectionCorrect]);

  // Handler for opening correction modal
  const handleOpenCorrectionModal = useCallback(() => {
    setSelectedTextForCorrection(transcript);
    setShowCorrectionModal(true);
  }, [transcript, setSelectedTextForCorrection, setShowCorrectionModal]);

  // Handler for enabling demo mode
  const handleEnableDemo = useCallback(() => {
    enableDemo({ durationMs: 30 * 60 * 1000 });
  }, [enableDemo]);

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <ScribeHeader
        isDemoMode={isDemoMode}
        isRecording={isRecording}
        status={status}
        elapsedSeconds={elapsedSeconds}
        suggestedCodesCount={isSmartScribeMode ? 0 : suggestedCodes.length}
        onEnableDemo={handleEnableDemo}
        onDisableDemo={disableDemo}
        mode={mode}
      />

      {/* Assistance Level Control */}
      <AssistanceLevelControl
        assistanceLevel={assistanceLevel}
        assistanceLevelLoaded={assistanceLevelLoaded}
        assistanceLevelSaved={assistanceLevelSaved}
        assistanceSettings={assistanceSettings}
        isRecording={isRecording}
        onLevelChange={handleAssistanceLevelChange}
      />

      {/* Recording Button */}
      <RecordingButton
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />

      {/* Riley's Messages */}
      {assistanceSettings.showConversationalMessages && conversationalMessages.length > 0 && (
        <EACard variant="highlight">
          <EACardContent className="py-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00857a] flex items-center justify-center shrink-0">
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
      <LiveTranscript
        transcript={transcript}
        isRecording={isRecording}
        correctionsAppliedCount={correctionsAppliedCount}
        onOpenCorrectionModal={handleOpenCorrectionModal}
      />

      {/* Proactive Confirmation - "Did I hear correctly?" */}
      {pendingConfirmations.length > 0 && (
        <ProactiveCorrectionList
          confirmations={pendingConfirmations}
          onConfirm={handleConfirmCorrect}
          onCorrect={handleProactiveCorrection}
          onDismiss={handleDismissConfirmation}
          maxVisible={2}
        />
      )}

      {/* Billing Codes - Only for Compass Riley (physicians), NOT for SmartScribe (nurses) */}
      {!isSmartScribeMode && (
        <BillingCodesList
          codes={suggestedCodes}
          showReasoningDetails={assistanceSettings.showReasoningDetails}
        />
      )}

      {/* SOAP Note - Only for Compass Riley (physicians) */}
      {!isSmartScribeMode && soapNote && (
        <SOAPNote soapNote={soapNote} />
      )}

      {/* Nursing Note Template - Only for SmartScribe (nurses) */}
      {isSmartScribeMode && transcript && (
        <EACard>
          <EACardHeader icon={<span className="text-blue-400">📋</span>}>
            <h3 className="text-sm font-medium text-white">Nursing Documentation</h3>
          </EACardHeader>
          <EACardContent className="py-3">
            <div className="prose prose-sm prose-invert max-w-none">
              <p className="text-slate-300 whitespace-pre-wrap">{transcript}</p>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              📝 Copy to your chart • Voice corrections improve accuracy over time
            </p>
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
      <VoiceCorrectionModal
        isOpen={showCorrectionModal}
        correctionHeard={correctionHeard}
        correctionCorrect={correctionCorrect}
        voiceProfile={voiceProfile}
        onHeardChange={setCorrectionHeard}
        onCorrectChange={setCorrectionCorrect}
        onSave={handleSaveCorrection}
        onClose={handleCloseCorrection}
      />
    </div>
  );
};

export default RealTimeSmartScribe;
