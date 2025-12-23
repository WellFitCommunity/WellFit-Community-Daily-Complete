// ============================================================================
// Voice Command Button - Floating "Hey Vision" Assistant
// ============================================================================
// Purpose: Always-available voice interface for hands-free operation
// Design: Floating button, visual feedback, executes voice commands
// Tagline: "Always listening, always learning" - Envision Atlus
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { voiceCommandService, VoiceCommand, VoiceState } from '../../services/voiceCommandService';

interface VoiceCommandButtonProps {
  onScribeStart?: () => void;
  onScribeStop?: () => void;
  onPatientSelect?: (patientId: string, patientName: string) => void;
}

export const VoiceCommandButton: React.FC<VoiceCommandButtonProps> = ({
  onScribeStart,
  onScribeStop,
  onPatientSelect,
}) => {
  const navigate = useNavigate();
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [patientResults, setPatientResults] = useState<{ id: string; name: string; mrn?: string }[]>([]);
  const [isSupported] = useState(voiceCommandService.isSupported());

  // Handle commands
  const handleCommand = useCallback(async (cmd: VoiceCommand) => {
    setTranscript('');

    switch (cmd.intent) {
      case 'navigate': {
        const destination = cmd.entities.destination || cmd.entities.route;
        const route = cmd.entities.route || voiceCommandService.getNavigationRoute(destination);
        if (route) {
          setFeedback(`Opening ${destination}...`);
          setTimeout(() => {
            navigate(route);
            setFeedback(null);
          }, 500);
        } else {
          setFeedback(`I don't know how to go to "${destination}"`);
          setTimeout(() => setFeedback(null), 3000);
        }
        break;
      }

      case 'find_patient': {
        const query = cmd.entities.patientQuery;
        setFeedback(`Searching for "${query}"...`);
        const results = await voiceCommandService.searchPatient(query);
        if (results.length === 0) {
          setFeedback(`No patients found matching "${query}"`);
          setTimeout(() => setFeedback(null), 3000);
        } else if (results.length === 1) {
          setFeedback(`Found ${results[0].name}`);
          onPatientSelect?.(results[0].id, results[0].name);
          setTimeout(() => {
            navigate(`/patients/${results[0].id}`);
            setFeedback(null);
          }, 1000);
        } else {
          setPatientResults(results);
          setFeedback(`Found ${results.length} patients`);
        }
        break;
      }

      case 'start_scribe':
        setFeedback('Starting Riley...');
        onScribeStart?.();
        navigate('/smart-scribe');
        setTimeout(() => setFeedback(null), 1500);
        break;

      case 'stop_scribe':
        setFeedback('Stopping recording...');
        onScribeStop?.();
        setTimeout(() => setFeedback(null), 1500);
        break;

      case 'open_schedule':
        setFeedback('Opening schedule...');
        setTimeout(() => {
          navigate('/schedule');
          setFeedback(null);
        }, 500);
        break;

      case 'show_tasks':
        setFeedback('Opening tasks...');
        setTimeout(() => {
          navigate('/tasks');
          setFeedback(null);
        }, 500);
        break;

      case 'check_messages':
        setFeedback('Opening messages...');
        setTimeout(() => {
          navigate('/messages');
          setFeedback(null);
        }, 500);
        break;

      case 'help':
        setShowHelp(true);
        setFeedback(null);
        break;

      case 'unknown':
        setFeedback(`I didn't understand "${cmd.rawText}". Say "help" for commands.`);
        setTimeout(() => setFeedback(null), 4000);
        break;
    }
  }, [navigate, onScribeStart, onScribeStop, onPatientSelect]);

  // Setup listeners
  useEffect(() => {
    if (!isSupported) return;

    voiceCommandService.onCommand(handleCommand);
    voiceCommandService.onStateChange(setState);
    voiceCommandService.onTranscript((text, isFinal) => {
      if (!isFinal) setTranscript(text);
    });

    return () => {
      voiceCommandService.stop();
    };
  }, [isSupported, handleCommand]);

  // Toggle listening
  const toggleListening = () => {
    if (state === 'idle') {
      voiceCommandService.start();
    } else {
      voiceCommandService.stop();
    }
  };

  // Select patient from results
  const selectPatient = (patient: { id: string; name: string }) => {
    setPatientResults([]);
    setFeedback(null);
    onPatientSelect?.(patient.id, patient.name);
    navigate(`/patients/${patient.id}`);
  };

  if (!isSupported) {
    return null; // Don't show if not supported
  }

  // State-based styling
  const getButtonStyle = () => {
    switch (state) {
      case 'listening':
        return 'bg-blue-500 hover:bg-blue-600 animate-pulse';
      case 'awake':
        return 'bg-green-500 hover:bg-green-600 ring-4 ring-green-300';
      case 'processing':
        return 'bg-purple-500 hover:bg-purple-600';
      default:
        return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  const getStateIcon = () => {
    switch (state) {
      case 'listening':
        return '🎤';
      case 'awake':
        return '👂';
      case 'processing':
        return '⏳';
      default:
        return '🎙️';
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'listening':
        return 'Say "Hey Vision"...';
      case 'awake':
        return 'Listening for command...';
      case 'processing':
        return 'Processing...';
      default:
        return 'Voice Commands';
    }
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Transcript/Feedback Bubble */}
        {(transcript || feedback) && (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-xs animate-fadeIn">
            {transcript && (
              <p className="text-sm text-gray-600 italic">"{transcript}"</p>
            )}
            {feedback && (
              <p className="text-sm font-medium text-gray-900">{feedback}</p>
            )}
          </div>
        )}

        {/* Patient Results */}
        {patientResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-64 animate-fadeIn">
            <p className="text-xs text-gray-500 mb-2 px-2">Select patient:</p>
            {patientResults.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPatient(p)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <div className="font-medium text-gray-900">{p.name}</div>
                {p.mrn && <div className="text-xs text-gray-500">MRN: {p.mrn}</div>}
              </button>
            ))}
            <button
              onClick={() => setPatientResults([])}
              className="w-full text-center text-xs text-gray-500 mt-2 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {/* State Label */}
        {state !== 'idle' && (
          <div className="bg-gray-900 text-white text-xs px-3 py-1 rounded-full">
            {getStateLabel()}
          </div>
        )}

        {/* Main Button */}
        <button
          onClick={toggleListening}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl transition-all ${getButtonStyle()}`}
          title={state === 'idle' ? 'Start voice commands' : 'Stop listening'}
        >
          {getStateIcon()}
        </button>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>🎤</span> Voice Commands
              </h2>
              <p className="text-blue-100 mt-1">Say "Hey Vision" followed by a command</p>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              {voiceCommandService.getAvailableCommands().map((category, idx) => (
                <div key={idx} className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{category.category}</h3>
                  <ul className="space-y-1">
                    {category.examples.map((ex, i) => (
                      <li key={i} className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded">
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </>
  );
};

export default VoiceCommandButton;
