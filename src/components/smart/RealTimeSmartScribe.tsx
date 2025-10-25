// src/components/smart/RealTimeSmartScribe.tsx
// SmartScribe Atlas - AI-Powered Medical Transcription & Revenue Optimization
// Uses Claude Sonnet 4.5 for maximum billing accuracy
import React, { useState, useRef } from "react";
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

const RealTimeSmartScribe: React.FC = () => {
  const [transcript, setTranscript] = useState("");
  const [suggestedCodes, setSuggestedCodes] = useState<CodeSuggestion[]>([]);
  const [revenueImpact, setRevenueImpact] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [conversationalMessages, setConversationalMessages] = useState<ConversationalMessage[]>([]);
  const [scribeSuggestions, setScribeSuggestions] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

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
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "transcript" && data.isFinal) {
            setTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
          } else if (data.type === "code_suggestion") {
            setSuggestedCodes(Array.isArray(data.codes) ? data.codes : []);
            setRevenueImpact(Number(data.revenueIncrease || 0));

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

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      wsRef.current?.close();
    } finally {
      setIsRecording(false);
      setStatus("Recording stopped");
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
