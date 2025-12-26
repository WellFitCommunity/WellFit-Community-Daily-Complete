// TelehealthConsultation.tsx
// Daily.co integrated telehealth with SmartScribe real-time coding
// Supports: Regular visits, ER telehealth, stethoscope audio streaming

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DailyIframe, { DailyCall, DailyEvent, DailyEventObject } from '@daily-co/daily-js';
import { useDaily, DailyProvider } from '@daily-co/daily-react';
import { supabase } from '../../lib/supabaseClient';
import RealTimeSmartScribe from '../smart/RealTimeSmartScribe';
import { TelehealthPatientSidebar } from './TelehealthPatientSidebar';

interface TelehealthConsultationProps {
  patientId: string;
  patientName: string;
  encounterType: 'outpatient' | 'er' | 'urgent-care';
  onEndCall?: () => void;
}

interface ParticipantInfo {
  user_id: string;
  user_name: string;
  session_id: string;
}

interface CallState {
  roomUrl: string | null;
  isJoining: boolean;
  isInCall: boolean;
  error: string | null;
  sessionId: string | null;
  encounterId: string | null;
}

// Main wrapper component
const TelehealthConsultation: React.FC<TelehealthConsultationProps> = (props) => {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);

  useEffect(() => {
    const daily = DailyIframe.createCallObject({
      audioSource: true, // Enable multiple audio sources for stethoscope
      videoSource: true,
    });
    setCallObject(daily);

    return () => {
      daily.destroy();
    };
  }, []);

  if (!callObject) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-lg text-gray-600">Initializing telehealth...</div>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <TelehealthCall {...props} />
    </DailyProvider>
  );
};

// Inner component with Daily.co hooks
const TelehealthCall: React.FC<TelehealthConsultationProps> = ({
  patientId,
  patientName,
  encounterType,
  onEndCall,
}) => {
  const daily = useDaily();
  const [callState, setCallState] = useState<CallState>({
    roomUrl: null,
    isJoining: false,
    isInCall: false,
    error: null,
    sessionId: null,
    encounterId: null,
  });
  const [showScribe, setShowScribe] = useState(false);
  const [showPatientInfo, setShowPatientInfo] = useState(true); // Patient sidebar visible by default
  const [participants, setParticipants] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [stethoscopeConnected, setStethoscopeConnected] = useState(false);

  // Track encounter in database
  const createEncounter = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create FHIR encounter record
      const encounterClass = encounterType === 'er' ? 'emergency' : encounterType;
      const { data: encounter, error: encounterError } = await supabase
        .from('fhir_encounters')
        .insert({
          patient_id: patientId,
          provider_id: user.id,
          class: encounterClass,
          status: 'in-progress',
          period_start: new Date().toISOString(),
          resource: {
            resourceType: 'Encounter',
            status: 'in-progress',
            class: { code: encounterClass },
            subject: { reference: `Patient/${patientId}` },
            participant: [{ individual: { reference: `Practitioner/${user.id}` } }],
            period: { start: new Date().toISOString() }
          }
        })
        .select()
        .single();

      if (encounterError) throw encounterError;

      return encounter.id;
    } catch (error: any) {

      throw error;
    }
  }, [patientId, encounterType]);

  // Create Daily.co room
  const createDailyRoom = useCallback(async () => {
    try {
      setCallState((prev) => ({ ...prev, isJoining: true, error: null }));

      // Create encounter first
      const encounterId = await createEncounter();

      // Call Supabase Edge Function to create Daily room
      const { data, error } = await supabase.functions.invoke('create-telehealth-room', {
        body: {
          encounter_id: encounterId,
          patient_id: patientId,
          encounter_type: encounterType,
        },
      });

      if (error) throw error;

      const { room_url, session_id } = data;

      setCallState((prev) => ({
        ...prev,
        roomUrl: room_url,
        sessionId: session_id,
        encounterId,
      }));

      // Join the room
      if (daily) {
        await daily.join({ url: room_url });
        setCallState((prev) => ({ ...prev, isInCall: true, isJoining: false }));
      }
    } catch (error: any) {

      setCallState((prev) => ({
        ...prev,
        error: error.message || 'Failed to create telehealth session',
        isJoining: false,
      }));
    }
  }, [daily, patientId, encounterType, createEncounter]);

  // Handle call events
  useEffect(() => {
    if (!daily) return;

    const handleParticipantJoined = (event: DailyEventObject) => {

      setParticipants((prev) => [...prev, event.participant?.user_id || 'unknown']);
    };

    const handleParticipantLeft = (event: DailyEventObject) => {

      setParticipants((prev) =>
        prev.filter((id) => id !== event.participant?.user_id)
      );
    };

    const handleError = (event: DailyEventObject) => {

      setCallState((prev) => ({
        ...prev,
        error: event.errorMsg || 'Call error occurred',
      }));
    };

    daily.on('participant-joined', handleParticipantJoined);
    daily.on('participant-left', handleParticipantLeft);
    daily.on('error', handleError);

    return () => {
      daily.off('participant-joined', handleParticipantJoined);
      daily.off('participant-left', handleParticipantLeft);
      daily.off('error', handleError);
    };
  }, [daily]);

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

  // Toggle SmartScribe
  const toggleScribe = useCallback(() => {
    setShowScribe(!showScribe);
  }, [showScribe]);

  // Toggle Patient Info sidebar
  const togglePatientInfo = useCallback(() => {
    setShowPatientInfo(!showPatientInfo);
  }, [showPatientInfo]);

  // End call
  const endCall = useCallback(async () => {
    try {
      if (daily) {
        await daily.leave();
      }

      // Update encounter status
      if (callState.encounterId) {
        await supabase
          .from('fhir_encounters')
          .update({
            status: 'completed',
            period_end: new Date().toISOString(),
          })
          .eq('id', callState.encounterId);

        // Also update telehealth session status
        if (callState.sessionId) {
          await supabase
            .from('telehealth_sessions')
            .update({
              status: 'completed',
              ended_at: new Date().toISOString(),
            })
            .eq('id', callState.sessionId);
        }
      }

      setCallState({
        roomUrl: null,
        isJoining: false,
        isInCall: false,
        error: null,
        sessionId: null,
        encounterId: null,
      });

      if (onEndCall) onEndCall();
    } catch {

    }
  }, [daily, callState.encounterId, onEndCall]);

  // Connect stethoscope audio
  const connectStethoscope = useCallback(async () => {
    try {
      // Request Bluetooth audio device (stethoscope)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');

      // Look for Bluetooth devices (Eko, Littmann, Thinklabs)
      const stethoscope = audioInputs.find(
        (d) =>
          d.label.toLowerCase().includes('eko') ||
          d.label.toLowerCase().includes('littmann') ||
          d.label.toLowerCase().includes('thinklabs') ||
          d.label.toLowerCase().includes('bluetooth')
      );

      if (stethoscope && daily) {
        // Add second audio track for stethoscope
        await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: stethoscope.deviceId },
        });

        // Daily.co supports multiple audio tracks
        await daily.setInputDevicesAsync({
          audioDeviceId: stethoscope.deviceId,
        });

        setStethoscopeConnected(true);
      } else {
        alert('No stethoscope device found. Please ensure your Bluetooth stethoscope is paired.');
      }
    } catch {

      alert('Failed to connect stethoscope. Please check Bluetooth settings.');
    }
  }, [daily]);

  // Render encounter type badge
  const renderEncounterBadge = () => {
    const badges = {
      outpatient: { text: 'Outpatient Visit', color: 'bg-blue-500' },
      er: { text: 'ER TELEHEALTH', color: 'bg-red-600 animate-pulse' },
      'urgent-care': { text: 'Urgent Care', color: 'bg-orange-500' },
    };

    const badge = badges[encounterType];
    return (
      <div className={`${badge.color} text-white px-4 py-2 rounded-lg font-bold text-sm`}>
        {badge.text}
      </div>
    );
  };

  if (!callState.isInCall && !callState.isJoining) {
    return (
      <div className="flex items-center justify-center h-screen bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Start Telehealth Visit</h2>
          <div className="mb-6">
            <div className="text-sm text-gray-600 mb-2">Patient:</div>
            <div className="text-lg font-semibold text-gray-900">{patientName}</div>
          </div>
          <div className="mb-6">{renderEncounterBadge()}</div>

          {encounterType === 'er' && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <h3 className="font-bold text-red-900 mb-1">Emergency Telehealth</h3>
                  <p className="text-sm text-red-800">
                    This is an emergency encounter. Full documentation and coding support will be
                    available during the call.
                  </p>
                </div>
              </div>
            </div>
          )}

          {callState.error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-sm">
              <p className="text-sm text-red-800">{callState.error}</p>
            </div>
          )}

          <button
            onClick={createDailyRoom}
            disabled={callState.isJoining}
            className="w-full py-4 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {callState.isJoining ? 'Connecting...' : 'Start Video Call'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">{patientName}</h1>
          {renderEncounterBadge()}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-300">
            Participants: {participants.length + 1}
          </div>
          {stethoscopeConnected && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-600 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs text-white font-medium">Stethoscope Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Video area */}
        <div className="flex-1 relative bg-gray-900">
          {/* Daily.co manages video automatically via iframe */}
          <div id="daily-video-container" className="w-full h-full" />

          {/* Control bar overlay */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-800 bg-opacity-90 px-6 py-4 rounded-full shadow-2xl">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-all ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all ${
                isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isVideoOff ? 'Turn on video' : 'Turn off video'}
            >
              {isVideoOff ? (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  <line x1="2" y1="2" x2="18" y2="18" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              )}
            </button>

            <button
              onClick={connectStethoscope}
              className={`p-4 rounded-full transition-all ${
                stethoscopeConnected
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Connect stethoscope"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button
              onClick={togglePatientInfo}
              className={`p-4 rounded-full transition-all ${
                showPatientInfo
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Toggle Patient Info"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </button>

            <button
              onClick={toggleScribe}
              className={`p-4 rounded-full transition-all ${
                showScribe
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Toggle SmartScribe"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>

            <button
              onClick={endCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
              title="End call"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Patient Info sidebar - Avatar, Vitals, SDOH */}
        <TelehealthPatientSidebar
          patientId={patientId}
          patientName={patientName}
          isVisible={showPatientInfo}
          onToggle={togglePatientInfo}
        />

        {/* SmartScribe sidebar */}
        {showScribe && (
          <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-900">SmartScribe - Live Coding</h3>
              <p className="text-xs text-gray-600 mt-1">
                Real-time transcription and revenue optimization
              </p>
            </div>
            <div className="p-4">
              <RealTimeSmartScribe />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelehealthConsultation;
