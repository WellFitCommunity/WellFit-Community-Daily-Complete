// src/components/smart/RealTimeSmartScribe.tsx
import React, { useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

interface CodeSuggestion {
  code: string;
  type: "CPT" | "ICD10" | "HCPCS";
  description: string;
  reimbursement: number;
  confidence: number;
  missingDocumentation?: string;
}

const RealTimeSmartScribe: React.FC = () => {
  const [transcript, setTranscript] = useState("");
  const [suggestedCodes, setSuggestedCodes] = useState<CodeSuggestion[]>([]);
  const [revenueImpact, setRevenueImpact] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready");

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
          } else if (data.type === "ready") {
            // Deepgram connected
          }
        } catch {
          // ignore non-JSON frames
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
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
      console.error("Recording error:", error);
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
      {/* Header with Revenue Counter */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">💰 Smart Medical Billing Assistant</h2>
          <p className="text-sm text-gray-600 mt-1">{status}</p>
        </div>
        {revenueImpact > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-lg shadow-lg animate-pulse">
            <div className="text-white text-center">
              <div className="text-xs font-medium">Additional Revenue</div>
              <div className="text-2xl font-bold">+${revenueImpact.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

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
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>📝</span>
            Live Transcript
          </h3>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 max-h-80 overflow-y-auto border-2 border-gray-200 shadow-inner">
            <p className="text-base leading-relaxed text-gray-800">{transcript}</p>
          </div>
        </div>
      )}

      {/* Revenue Optimization Suggestions */}
      {suggestedCodes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>💡</span>
            Revenue Optimization Opportunities
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
                        {Math.round(code.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium mb-3">{code.description}</p>

                    {code.missingDocumentation && (
                      <div className="mt-3 p-3 bg-amber-100 border-l-4 border-amber-400 rounded">
                        <p className="text-sm text-amber-900">
                          <span className="font-bold">💬 Suggest to doctor: </span>
                          "{code.missingDocumentation}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">
                      +${code.reimbursement.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">reimbursement</div>
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
            <h4 className="font-semibold text-blue-900 mb-1">HIPAA Compliance</h4>
            <p className="text-sm text-blue-800">
              Audio is encrypted in transit. Transcription runs on HIPAA-eligible services. We
              de-identify before analysis. Configure retention in your policy (defaults recommended).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeSmartScribe;
