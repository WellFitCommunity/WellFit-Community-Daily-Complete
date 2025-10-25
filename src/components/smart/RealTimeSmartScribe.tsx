// src/components/smart/RealTimeSmartScribe.tsx
// SmartScribe Atlas - AI-Powered Medical Transcription & Revenue Optimization
// Uses Claude Sonnet 4.5 for maximum billing accuracy
import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { auditLogger } from "../../services/auditLogger";

interface CodeSuggestion {
  code: string;
  type: "CPT" | "ICD10" | "HCPCS";
  description: string;
  reimbursement: number;
  confidence: number;
  reasoning?: string;
  missingDocumentation?: string;
}

interface ConversationalMessage {
  type: 'scribe' | 'system';
  message: string;
  timestamp: Date;
  context?: 'greeting' | 'suggestion' | 'code' | 'reminder';
}

interface RealTimeSmartScribeProps {
  selectedPatientId?: string;
  selectedPatientName?: string;
  onSessionComplete?: (sessionId: string) => void;
}

const RealTimeSmartScribe: React.FC<RealTimeSmartScribeProps> = ({
  selectedPatientId,
  selectedPatientName,
  onSessionComplete
}) => {
  const [transcript, setTranscript] = useState("");
  const [suggestedCodes, setSuggestedCodes] = useState<CodeSuggestion[]>([]);
  const [revenueImpact, setRevenueImpact] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [conversationalMessages, setConversationalMessages] = useState<ConversationalMessage[]>([]);
  const [scribeSuggestions, setScribeSuggestions] = useState<string[]>([]);

  // Timer state for recording duration
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // SOAP Note state
  interface SOAPNote {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    hpi: string;
    ros: string;
  }

  const [soapNote, setSoapNote] = useState<SOAPNote | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Timer effect - updates every second during recording
  useEffect(() => {
    if (!isRecording || !recordingStartTime) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - recordingStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  const startRecording = async () => {
    try {
      setStatus("Requesting microphone access…");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      setStatus("Connecting to server…");

      // IMPORTANT: pass access_token in query for WS auth
      const base = (process.env.REACT_APP_SUPABASE_URL ?? "").replace("https://", "wss://");
      const wsUrl = `${base}/functions/v1/realtime-medical-transcription?access_token=${encodeURIComponent(
        session.access_token
      )}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("🔴 Recording in progress…");
        setIsRecording(true);
        setRecordingStartTime(Date.now());
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "transcript" && data.isFinal) {
            setTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
          } else if (data.type === "code_suggestion") {
            setSuggestedCodes(Array.isArray(data.codes) ? data.codes : []);
            setRevenueImpact(Number(data.revenueIncrease || 0));

            // Update SOAP note if present
            if (data.soapNote) {
              setSoapNote({
                subjective: data.soapNote.subjective || '',
                objective: data.soapNote.objective || '',
                assessment: data.soapNote.assessment || '',
                plan: data.soapNote.plan || '',
                hpi: data.soapNote.hpi || '',
                ros: data.soapNote.ros || ''
              });
            }

            // Add conversational note if present
            if (data.conversational_note) {
              setConversationalMessages(prev => [...prev, {
                type: 'scribe',
                message: data.conversational_note,
                timestamp: new Date(),
                context: 'code'
              }]);
            }

            // Add suggestions if present
            if (data.suggestions && Array.isArray(data.suggestions)) {
              setScribeSuggestions(data.suggestions);
            }
          } else if (data.type === "ready") {
            // Deepgram connected - send greeting
            setConversationalMessages([{
              type: 'scribe',
              message: "Hey! I'm Riley, your AI scribe. Listening and ready to help with documentation and billing. Just focus on the patient - I've got the charting.",
              timestamp: new Date(),
              context: 'greeting'
            }]);
          }
        } catch {
          // ignore non-JSON frames
        }
      };

      ws.onerror = (err) => {
        // HIPAA Audit: Log transcription connection failures
        auditLogger.error('SCRIBE_WEBSOCKET_ERROR', err instanceof Error ? err : new Error('WebSocket connection failed'), {
          component: 'RealTimeSmartScribe',
          wsUrl: wsUrl
        });
        setStatus("Connection error");
      };

      ws.onclose = () => {
        setIsRecording(false);
        setStatus("Recording stopped");
      };

      // Use MediaRecorder (webm/opus) but send as ArrayBuffer over WS
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });

      mr.ondataavailable = async (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN && e.data && e.data.size > 0) {
          // Convert Blob -> ArrayBuffer for consistent server handling
          const buf = await e.data.arrayBuffer();
          wsRef.current.send(buf);
        }
      };

      mr.start(250); // 250ms chunks
      mediaRecorderRef.current = mr;
    } catch (error: any) {
      setStatus("Error: " + (error?.message ?? "Failed to start"));
      // HIPAA Audit: Log medical transcription recording failures
      auditLogger.error('SCRIBE_RECORDING_FAILED', error, {
        component: 'RealTimeSmartScribe',
        operation: 'startRecording'
      });
    }
  };

  const stopRecording = async () => {
    try {
      const endTime = Date.now();
      const durationSeconds = recordingStartTime
        ? Math.floor((endTime - recordingStartTime) / 1000)
        : 0;

      // Stop media recorder
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      wsRef.current?.close();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        auditLogger.error('SCRIBE_SAVE_NO_USER', new Error('No authenticated user'));
        setStatus('Recording stopped (not saved - no user)');
        setIsRecording(false);
        setRecordingStartTime(null);
        setElapsedSeconds(0);
        return;
      }

      // Validate patient context
      if (!selectedPatientId) {
        auditLogger.error('SCRIBE_SAVE_NO_PATIENT', new Error('No patient selected'));
        setStatus('Recording stopped (not saved - no patient selected)');
        setIsRecording(false);
        setRecordingStartTime(null);
        setElapsedSeconds(0);
        return;
      }

      // Save scribe session to database
      const { data: session, error } = await supabase
        .from('scribe_sessions')
        .insert({
          patient_id: selectedPatientId,
          created_by: user.id,
          provider_id: user.id,
          recording_started_at: new Date(recordingStartTime!).toISOString(),
          recording_ended_at: new Date(endTime).toISOString(),
          recording_duration_seconds: durationSeconds,
          transcription_text: transcript || '',
          transcription_status: transcript ? 'completed' : 'empty',
          transcription_completed_at: new Date().toISOString(),
          ai_note_subjective: soapNote?.subjective || null,
          ai_note_objective: soapNote?.objective || null,
          ai_note_assessment: soapNote?.assessment || null,
          ai_note_plan: soapNote?.plan || null,
          ai_note_hpi: soapNote?.hpi || null,
          ai_note_ros: soapNote?.ros || null,
          suggested_cpt_codes: suggestedCodes.filter(c => c.type === 'CPT').map(c => ({
            code: c.code,
            description: c.description,
            reimbursement: c.reimbursement,
            confidence: c.confidence
          })),
          suggested_icd10_codes: suggestedCodes.filter(c => c.type === 'ICD10').map(c => ({
            code: c.code,
            description: c.description,
            confidence: c.confidence
          })),
          clinical_time_minutes: Math.floor(durationSeconds / 60),
          is_ccm_eligible: durationSeconds >= 1200,
          ccm_complexity: durationSeconds >= 2400 ? 'complex' : durationSeconds >= 1200 ? 'moderate' : null,
          model_version: 'claude-sonnet-4-5-20250929'
        })
        .select()
        .single();

      if (error) {
        auditLogger.error('SCRIBE_SESSION_SAVE_FAILED', error, {
          patientId: selectedPatientId,
          duration: durationSeconds
        });
        setStatus('Error saving session: ' + error.message);
      } else {
        auditLogger.clinical('SCRIBE_SESSION_COMPLETED', true, {
          sessionId: session.id,
          patientId: selectedPatientId,
          durationSeconds,
          codesGenerated: suggestedCodes.length,
          ccmEligible: durationSeconds >= 1200
        });
        setStatus(`✓ Session saved (${Math.floor(durationSeconds / 60)} min, ${suggestedCodes.length} codes)`);

        // Call parent callback if provided
        onSessionComplete?.(session.id);
      }
    } catch (error: any) {
      auditLogger.error('SCRIBE_STOP_RECORDING_FAILED', error);
      setStatus('Error: ' + (error?.message ?? 'Failed to save'));
    } finally {
      setIsRecording(false);
      setRecordingStartTime(null);
      setElapsedSeconds(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-xl">
      {/* Header with Revenue Counter and Recording Status */}
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
        {revenueImpact > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-lg shadow-lg animate-pulse">
            <div className="text-white text-center">
              <div className="text-xs font-medium">Revenue Captured</div>
              <div className="text-2xl font-bold">+${revenueImpact.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Conversational Messages - Scribe Chat */}
      {conversationalMessages.length > 0 && (
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
      {scribeSuggestions.length > 0 && (
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
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className={isRecording ? 'animate-pulse' : ''}>📝</span>
              Live Transcript
              {isRecording && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">CAPTURING</span>}
            </h3>
            <div className="text-sm text-gray-600">
              {transcript.split(' ').length} words
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

                    {/* Reasoning - NEW! */}
                    {code.reasoning && (
                      <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                        <p className="text-sm text-blue-900">
                          <span className="font-bold">💭 Why this fits: </span>
                          {code.reasoning}
                        </p>
                      </div>
                    )}

                    {code.missingDocumentation && (
                      <div className="mt-3 p-3 bg-amber-100 border-l-4 border-amber-400 rounded">
                        <p className="text-sm text-amber-900">
                          <span className="font-bold">📝 To strengthen this code: </span>
                          {code.missingDocumentation}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {code.reimbursement > 0 ? (
                      <>
                        <div className="text-3xl font-bold text-green-600">
                          +${code.reimbursement.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">estimated</div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        varies by<br />payer
                      </div>
                    )}
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
              onClick={() => {
                const soapText = `SUBJECTIVE:\n${soapNote.subjective}\n\nOBJECTIVE:\n${soapNote.objective}\n\nASSESSMENT:\n${soapNote.assessment}\n\nPLAN:\n${soapNote.plan}`;
                navigator.clipboard.writeText(soapText);
                setStatus('✓ SOAP note copied to clipboard!');
                setTimeout(() => setStatus('Ready'), 3000);
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
    </div>
  );
};

export default RealTimeSmartScribe;
