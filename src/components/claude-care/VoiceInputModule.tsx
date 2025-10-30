// ============================================================================
// Voice Input Module - Voice-to-text for hands-free admin task completion
// ============================================================================

import React, { useState, useRef } from 'react';
import { ClaudeCareAssistant } from '../../services/claudeCareAssistant';

interface Props {
  userRole: string;
  userId?: string;
  onPopulateTaskForm?: (templateId: string, transcription: string) => void;
}

const VoiceInputModule: React.FC<Props> = ({ userRole, userId, onPopulateTaskForm }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [suggestedTemplate, setSuggestedTemplate] = useState<string | undefined>();
  const [confidence, setConfidence] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleStopRecording;

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {

      setError('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const handleStopRecording = async () => {
    if (!mediaRecorderRef.current || !userId) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setLoading(true);

    // Stop all tracks
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

    // Create audio blob
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

    try {
      const result = await ClaudeCareAssistant.processVoiceInput(
        userId,
        userRole,
        audioBlob
      );

      setTranscription(result.transcription);
      setSuggestedTemplate(result.suggestedTemplate);
      setConfidence(result.confidence || 0);
    } catch (err) {

      setError('Failed to process voice input. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    audioChunksRef.current = [];
  };

  const handleUseTranscription = () => {
    if (!suggestedTemplate) {
      alert('No template suggestion available. Please try recording again.');
      return;
    }

    if (onPopulateTaskForm) {
      // Call the parent component's callback to switch to the tasks tab and populate the form
      onPopulateTaskForm(suggestedTemplate, transcription);

      // Clear the transcription after use
      setTranscription('');
      setSuggestedTemplate(undefined);
      setConfidence(0);
    } else {
      // Fallback if no callback is provided
      alert(`Template: ${suggestedTemplate}\n\nTranscription: ${transcription}\n\nPlease switch to the Admin Tasks tab to continue.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Recording Controls */}
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <button
            onClick={isRecording ? handleCancelRecording : handleStartRecording}
            disabled={loading || !userId}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? (
              <svg
                className="animate-spin h-12 w-12 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="h-12 w-12 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </button>

          {isRecording && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
              <span className="inline-block bg-red-500 text-white text-xs px-3 py-1 rounded-full animate-pulse">
                Recording...
              </span>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">
            {isRecording
              ? 'Recording... Click to stop'
              : loading
              ? 'Processing voice input...'
              : 'Click to start recording'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {isRecording
              ? 'Speak clearly into your microphone'
              : 'Describe the administrative task you need to complete'}
          </p>
        </div>

        {!userId && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm">
              User ID required for voice input. Please log in to use this feature.
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Transcription Result */}
      {transcription && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Transcription</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Confidence:</span>
                <span className={`font-semibold ${
                  confidence > 0.8 ? 'text-green-600' : confidence > 0.6 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {(confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <p className="text-gray-800">{transcription}</p>
            </div>
          </div>

          {/* Suggested Template */}
          {suggestedTemplate && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-blue-600 mr-3 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 mb-1">Suggested Task Template</h4>
                  <p className="text-blue-800 text-sm">
                    Based on your transcription, we suggest using the template: {suggestedTemplate}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleUseTranscription}
              className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors"
            >
              Use This Transcription
            </button>
            <button
              onClick={() => {
                setTranscription('');
                setSuggestedTemplate(undefined);
                setConfidence(0);
              }}
              className="px-6 py-3 border border-gray-300 rounded-md font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <h4 className="font-semibold text-gray-900 mb-2">Voice Input Tips</h4>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>• Speak clearly and at a moderate pace</li>
          <li>• Find a quiet environment for best results</li>
          <li>• Medical terminology will be automatically corrected based on your profile</li>
          <li>• Transcription accuracy improves with use</li>
        </ul>
      </div>

      {/* Browser Compatibility Warning */}
      {!navigator.mediaDevices && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800 text-sm">
            Your browser does not support voice input. Please use a modern browser like Chrome,
            Firefox, or Edge.
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceInputModule;
