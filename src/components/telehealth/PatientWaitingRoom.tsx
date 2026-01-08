// PatientWaitingRoom.tsx
// Patient-facing telehealth waiting room
// Connects to Daily.co room created by provider

import React, { useState, useEffect, useCallback } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { useDaily, DailyProvider } from '@daily-co/daily-react';
import { supabase } from '../../lib/supabaseClient';

interface PatientWaitingRoomProps {
  sessionId: string;
  patientName: string;
  onCallEnded?: () => void;
}

interface RoomState {
  isLoading: boolean;
  isWaiting: boolean;
  isInCall: boolean;
  error: string | null;
  providerName: string | null;
}

// Wrapper component
const PatientWaitingRoom: React.FC<PatientWaitingRoomProps> = (props) => {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);

  useEffect(() => {
    const daily = DailyIframe.createCallObject();
    setCallObject(daily);

    return () => {
      daily.destroy();
    };
  }, []);

  if (!callObject) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <PatientWaitingRoomInner {...props} />
    </DailyProvider>
  );
};

// Inner component
const PatientWaitingRoomInner: React.FC<PatientWaitingRoomProps> = ({
  sessionId,
  patientName,
  onCallEnded,
}) => {
  const daily = useDaily();
  const [roomState, setRoomState] = useState<RoomState>({
    isLoading: true,
    isWaiting: false,
    isInCall: false,
    error: null,
    providerName: null,
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Join room
  const joinRoom = useCallback(async () => {
    try {
      setRoomState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Get session details from database
      const { data: session, error: sessionError } = await supabase
        .from('telehealth_sessions')
        .select(
          `
          *,
          provider:provider_id (
            full_name,
            email
          )
        `
        )
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      if (!session) {
        throw new Error('Telehealth session not found');
      }

      // Create patient token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'create-patient-telehealth-token',
        {
          body: {
            session_id: sessionId,
            patient_name: patientName,
          },
        }
      );

      if (tokenError) throw tokenError;

      const providerName =
        session.provider?.full_name || session.provider?.email || 'Your Provider';

      setRoomState((prev) => ({
        ...prev,
        providerName,
      }));

      // Join Daily.co room
      if (daily) {
        await daily.join({
          url: `${session.room_url}?t=${tokenData.token}`,
        });

        // Check if provider is already in the room
        const participants = daily.participants();
        const providerInRoom = Object.values(participants).some(
          (p) => p.user_id !== daily.participants().local.user_id
        );

        setRoomState((prev) => ({
          ...prev,
          isLoading: false,
          isWaiting: !providerInRoom,
          isInCall: providerInRoom,
        }));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join telehealth session';
      setRoomState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [daily, sessionId, patientName]);

  // Listen for provider joining
  useEffect(() => {
    if (!daily) return;

    const handleParticipantJoined = () => {
      setRoomState((prev) => ({
        ...prev,
        isWaiting: false,
        isInCall: true,
      }));
    };

    const handleParticipantLeft = () => {
      const participants = daily.participants();
      const othersInRoom = Object.values(participants).filter(
        (p) => p.user_id !== daily.participants().local.user_id
      ).length;

      if (othersInRoom === 0) {
        // Provider left - end call
        handleCallEnded();
      }
    };

    daily.on('participant-joined', handleParticipantJoined);
    daily.on('participant-left', handleParticipantLeft);

    return () => {
      daily.off('participant-joined', handleParticipantJoined);
      daily.off('participant-left', handleParticipantLeft);
    };
  }, [daily]);

  // Join on mount
  useEffect(() => {
    joinRoom();
  }, [joinRoom]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (daily) {
      daily.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [daily, isMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (daily) {
      daily.setLocalVideo(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  }, [daily, isVideoOff]);

  // Handle call ended
  const handleCallEnded = useCallback(async () => {
    try {
      if (daily) {
        await daily.leave();
      }

      setRoomState({
        isLoading: false,
        isWaiting: false,
        isInCall: false,
        error: null,
        providerName: null,
      });

      if (onCallEnded) onCallEnded();
    } catch (error) {

    }
  }, [daily, onCallEnded]);

  // Loading state
  if (roomState.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />
          <p className="text-lg text-gray-700">Connecting to your provider...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (roomState.error) {
    return (
      <div className="flex items-center justify-center h-screen bg-linear-to-br from-red-50 to-pink-100">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-red-900 mb-2">Connection Error</h2>
            <p className="text-gray-700">{roomState.error}</p>
          </div>
          <button
            onClick={joinRoom}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Waiting room
  if (roomState.isWaiting) {
    return (
      <div className="flex items-center justify-center h-screen bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">👨‍⚕️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Waiting Room</h2>
            <p className="text-gray-600 mb-4">
              {roomState.providerName} will join your visit shortly
            </p>
            <div className="flex justify-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-100" />
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-200" />
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">While you wait:</h3>
            <ul className="text-sm text-left text-blue-800 space-y-1">
              <li>✓ Check your audio and video settings</li>
              <li>✓ Ensure you're in a quiet, private location</li>
              <li>✓ Have your medication list ready if needed</li>
            </ul>
          </div>

          {/* Test controls */}
          <div className="flex justify-center gap-4">
            <button
              onClick={toggleMute}
              className={`p-3 rounded-full transition-all ${
                isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-all ${
                isVideoOff ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700'
              }`}
              title={isVideoOff ? 'Turn on video' : 'Turn off video'}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // In call
  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">
          Telehealth Visit with {roomState.providerName}
        </h1>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-600 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs text-white font-medium">Connected</span>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative bg-gray-900">
        {/* Daily.co manages video automatically */}
        <div id="daily-video-container-patient" className="w-full h-full" />

        {/* Control bar */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-800 bg-opacity-90 px-6 py-4 rounded-full shadow-2xl">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all ${
              isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isVideoOff ? 'Turn on video' : 'Turn off video'}
          >
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          </button>

          <button
            onClick={handleCallEnded}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
            title="Leave call"
          >
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* HIPAA notice */}
      <div className="bg-blue-900 px-6 py-3 text-center">
        <p className="text-sm text-blue-100">
          🔒 This telehealth session is encrypted and HIPAA-compliant
        </p>
      </div>
    </div>
  );
};

export default PatientWaitingRoom;
