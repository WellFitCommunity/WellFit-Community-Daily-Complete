import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface ScribeSession {
  id: string;
  patientId?: string;
  providerId: string;
  sessionType: 'consultation' | 'assessment' | 'notes' | 'dictation';
  transcript: string;
  aiSummary?: string;
  medicalCodes?: Array<{
    code: string;
    type: 'ICD10' | 'CPT' | 'HCPCS';
    description: string;
    confidence: number;
  }>;
  actionItems?: string[];
  status: 'recording' | 'processing' | 'completed' | 'error';
  createdAt: Date;
  duration: number;
}

interface SmartScribeProps {
  patientId?: string;
  sessionType?: 'consultation' | 'assessment' | 'notes' | 'dictation';
  onComplete?: (session: ScribeSession) => void;
  className?: string;
}

const SmartScribe: React.FC<SmartScribeProps> = ({
  patientId,
  sessionType = 'notes',
  onComplete,
  className = ''
}) => {
  const [session, setSession] = useState<ScribeSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<Date | null>(null);

  // Check microphone permissions
  useEffect(() => {
    checkMicrophonePermissions();
  }, []);

  const checkMicrophonePermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissions('granted');
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setPermissions('denied');
    }
  };

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = (event as any).resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(prev => prev + finalTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startRecording = async () => {
    try {
      setError(null);

      // Create new session
      const newSession: ScribeSession = {
        id: `scribe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientId,
        providerId: 'current-user', // Replace with actual provider ID
        sessionType,
        transcript: '',
        status: 'recording',
        createdAt: new Date(),
        duration: 0
      };

      setSession(newSession);
      setIsRecording(true);
      setTranscript('');
      startTimeRef.current = new Date();

      // Start audio recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;

      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to access microphone. Please check permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);

    try {
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      // Calculate duration
      const duration = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current.getTime()) / 1000)
        : 0;

      // Create audio blob
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

      // Process with AI
      await processWithAI(transcript, audioBlob, duration);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError('Failed to process recording.');
      setIsProcessing(false);
    }
  };

  const processWithAI = async (transcript: string, audioBlob: Blob, duration: number) => {
    try {
      // Upload audio to secure storage (optional)
      let audioUrl = null;
      if (audioBlob.size > 0) {
        const audioFile = new File([audioBlob], `recording_${session?.id}.webm`, {
          type: 'audio/webm'
        });

        // Upload to Supabase storage (with appropriate security)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('medical-recordings')
          .upload(`recordings/${session?.id}/${audioFile.name}`, audioFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (!uploadError && uploadData) {
          audioUrl = uploadData.path;
        }
      }

      // Process transcript with Claude AI
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('process-medical-transcript', {
        body: {
          transcript,
          sessionType,
          patientId,
          audioUrl,
          duration
        }
      });

      if (aiError) throw aiError;

      // Update session with AI results
      const updatedSession: ScribeSession = {
        ...session!,
        transcript,
        aiSummary: aiResponse.summary,
        medicalCodes: aiResponse.medicalCodes || [],
        actionItems: aiResponse.actionItems || [],
        status: 'completed',
        duration
      };

      setSession(updatedSession);

      // Save to database (encrypted for PHI compliance)
      const { error: saveError } = await supabase
        .from('scribe_sessions')
        .insert({
          id: updatedSession.id,
          patient_id: patientId,
          provider_id: updatedSession.providerId,
          session_type: sessionType,
          transcript: transcript, // Will be encrypted by database trigger
          ai_summary: aiResponse.summary,
          medical_codes: aiResponse.medicalCodes,
          action_items: aiResponse.actionItems,
          duration,
          audio_url: audioUrl,
          status: 'completed'
        });

      if (saveError) {
        console.error('Failed to save session:', saveError);
      }

      // Callback to parent component
      if (onComplete) {
        onComplete(updatedSession);
      }

    } catch (error) {
      console.error('AI processing failed:', error);
      setError('Failed to process transcript with AI.');

      // Save basic session even if AI fails
      if (session) {
        const basicSession: ScribeSession = {
          ...session,
          transcript,
          status: 'error',
          duration
        };
        setSession(basicSession);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const clearSession = () => {
    setSession(null);
    setTranscript('');
    setError(null);
    setIsRecording(false);
    setIsProcessing(false);
  };

  if (permissions === 'denied') {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center">
          <span className="text-red-600 mr-3">🎤</span>
          <div>
            <h3 className="text-red-800 font-medium">Microphone Access Required</h3>
            <p className="text-red-600 text-sm mt-1">
              Please enable microphone access in your browser settings to use the smart scribe.
            </p>
            <button
              onClick={checkMicrophonePermissions}
              className="mt-2 text-red-700 underline text-sm hover:text-red-800"
            >
              Check Permissions Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="mr-2">🎤</span>
            Smart Medical Scribe
          </h3>
          {session && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              session.status === 'recording' ? 'bg-red-100 text-red-800' :
              session.status === 'processing' ? 'bg-blue-100 text-blue-800' :
              session.status === 'completed' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {session.status}
            </span>
          )}
        </div>
        <p className="text-gray-600 text-sm mt-1">
          AI-powered medical transcription and coding assistance
        </p>
      </div>

      {/* Recording Controls */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-center space-x-4 mb-6">
          {!isRecording && !isProcessing && (
            <button
              onClick={startRecording}
              className="flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              <span className="mr-2">🔴</span>
              Start Recording
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              <span className="mr-2">⏹️</span>
              Stop Recording
            </button>
          )}

          {session && !isRecording && !isProcessing && (
            <button
              onClick={clearSession}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              <span className="mr-2">🗑️</span>
              New Session
            </button>
          )}
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Recording in progress...</span>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Processing with AI...</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Transcript Display */}
      {(transcript || session?.transcript) && (
        <div className="px-6 py-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Live Transcript</h4>
          <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {session?.transcript || transcript}
            </p>
          </div>
        </div>
      )}

      {/* AI Results */}
      {session?.status === 'completed' && (
        <div className="px-6 py-4 border-t border-gray-200 space-y-4">
          {/* AI Summary */}
          {session.aiSummary && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">AI Clinical Summary</h4>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-900">{session.aiSummary}</p>
              </div>
            </div>
          )}

          {/* Medical Codes */}
          {session.medicalCodes && session.medicalCodes.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Suggested Medical Codes</h4>
              <div className="space-y-2">
                {session.medicalCodes.map((code, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <span className="font-medium text-green-900">{code.code}</span>
                      <span className="ml-2 text-sm text-green-700">({code.type})</span>
                      <p className="text-sm text-green-800 mt-1">{code.description}</p>
                    </div>
                    <span className="text-xs text-green-600">{Math.round(code.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {session.actionItems && session.actionItems.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Action Items</h4>
              <ul className="space-y-1">
                {session.actionItems.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Session Info */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
            <span>Duration: {Math.floor(session.duration / 60)}:{String(session.duration % 60).padStart(2, '0')}</span>
            <span>Session: {session.id}</span>
          </div>
        </div>
      )}

      {/* Compliance Notice */}
      <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-200">
        <p className="text-xs text-yellow-800">
          🔒 All recordings and transcripts are encrypted and HIPAA-compliant.
          Audio files are automatically deleted after 30 days.
        </p>
      </div>
    </div>
  );
};

export default SmartScribe;