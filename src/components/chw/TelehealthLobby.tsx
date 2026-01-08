/**
 * Telehealth Lobby Component
 * Waiting room for video calls with equipment check
 */

import React, { useState, useEffect, useRef } from 'react';

interface TelehealthLobbyProps {
  visitId?: string;
  patientName?: string;
  language?: 'en' | 'es';
  onJoinCall?: () => void;
  onCancel?: () => void;
}

export const TelehealthLobby: React.FC<TelehealthLobbyProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitId = 'demo-visit-001',
  patientName = 'Demo Patient',
  language = 'en',
  onJoinCall = () => {},
  onCancel = () => {}
}) => {
  const [deviceCheck, setDeviceCheck] = useState({
    camera: false,
    microphone: false,
    speakers: false
  });
  const [testingDevices, setTestingDevices] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const translations = {
    en: {
      title: 'Telehealth Waiting Room',
      welcome: 'Welcome',
      checkingEquipment: 'Checking your equipment...',
      equipmentCheck: 'Equipment Check',
      camera: 'Camera',
      microphone: 'Microphone',
      speakers: 'Speakers',
      working: 'Working',
      notWorking: 'Not Working',
      testDevices: 'Test Equipment',
      retestDevices: 'Test Again',
      joinCall: 'Join Call',
      cancel: 'Cancel',
      privacyNotice: 'Privacy Notice',
      privacyText: 'This is a secure, HIPAA-compliant video call. Please ensure you are in a private space.',
      emergencyInfo: 'Emergency Contact',
      emergencyText: 'If this is a medical emergency, hang up and call 911',
      speakIntoMic: 'Speak into your microphone to test audio',
      audioLevelGood: 'Audio level good!'
    },
    es: {
      title: 'Sala de Espera de Telesalud',
      welcome: 'Bienvenido',
      checkingEquipment: 'Verificando su equipo...',
      equipmentCheck: 'Verificación de Equipo',
      camera: 'Cámara',
      microphone: 'Micrófono',
      speakers: 'Altavoces',
      working: 'Funcionando',
      notWorking: 'No Funciona',
      testDevices: 'Probar Equipo',
      retestDevices: 'Probar de Nuevo',
      joinCall: 'Unirse a la Llamada',
      cancel: 'Cancelar',
      privacyNotice: 'Aviso de Privacidad',
      privacyText: 'Esta es una videollamada segura y compatible con HIPAA. Asegúrese de estar en un espacio privado.',
      emergencyInfo: 'Contacto de Emergencia',
      emergencyText: 'Si esto es una emergencia médica, cuelgue y llame al 911',
      speakIntoMic: 'Hable en su micrófono para probar el audio',
      audioLevelGood: '¡Nivel de audio bueno!'
    }
  };

  const t = translations[language];

  const testDevices = async () => {
    setTestingDevices(true);

    try {
      // Test camera and microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setCameraStream(stream);

      // Camera test
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setDeviceCheck(prev => ({ ...prev, camera: true }));
      }

      // Microphone test
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);

        if (average > 10) {
          setDeviceCheck(prev => ({ ...prev, microphone: true }));
        }
      };

      const intervalId = setInterval(checkAudioLevel, 100);

      // Speaker test (assume working if audio context created successfully)
      setDeviceCheck(prev => ({ ...prev, speakers: true }));

      // Cleanup after 5 seconds
      setTimeout(() => {
        clearInterval(intervalId);
      }, 5000);

    } catch (err) {

      setDeviceCheck({ camera: false, microphone: false, speakers: false });
    } finally {
      setTestingDevices(false);
    }
  };

  useEffect(() => {
    // Auto-test devices on mount
    testDevices();

    return () => {
      // Cleanup
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const allDevicesWorking = deviceCheck.camera && deviceCheck.microphone && deviceCheck.speakers;

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <h2 className="text-5xl font-bold text-gray-800 mb-4 text-center">{t.title}</h2>
          <p className="text-3xl text-gray-600 mb-12 text-center">
            {t.welcome}, {patientName}
          </p>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Video preview */}
            <div>
              <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-xl aspect-video mb-6">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Audio level indicator */}
              {testingDevices && (
                <div className="mb-6">
                  <p className="text-xl text-gray-600 mb-2">{t.speakIntoMic}</p>
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div
                      className="bg-green-600 h-8 rounded-full transition-all"
                      style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                    />
                  </div>
                  {audioLevel > 10 && (
                    <p className="text-green-600 text-lg mt-2">{t.audioLevelGood}</p>
                  )}
                </div>
              )}

              {/* Device status */}
              <div className="bg-blue-50 rounded-2xl p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{t.equipmentCheck}</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xl text-gray-700">{t.camera}</span>
                    <span className={`px-4 py-2 rounded-lg font-bold ${
                      deviceCheck.camera ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {deviceCheck.camera ? t.working : t.notWorking}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xl text-gray-700">{t.microphone}</span>
                    <span className={`px-4 py-2 rounded-lg font-bold ${
                      deviceCheck.microphone ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {deviceCheck.microphone ? t.working : t.notWorking}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xl text-gray-700">{t.speakers}</span>
                    <span className={`px-4 py-2 rounded-lg font-bold ${
                      deviceCheck.speakers ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {deviceCheck.speakers ? t.working : t.notWorking}
                    </span>
                  </div>
                </div>

                <button
                  onClick={testDevices}
                  disabled={testingDevices}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xl font-bold py-4 px-6 rounded-xl transition-all"
                >
                  {testingDevices ? t.checkingEquipment : t.retestDevices}
                </button>
              </div>
            </div>

            {/* Information panel */}
            <div className="space-y-6">
              {/* Privacy notice */}
              <div className="bg-purple-50 border-4 border-purple-300 rounded-2xl p-6">
                <h3 className="text-2xl font-bold text-purple-800 mb-3">{t.privacyNotice}</h3>
                <p className="text-xl text-gray-700">
                  {t.privacyText}
                </p>
              </div>

              {/* Emergency info */}
              <div className="bg-red-50 border-4 border-red-300 rounded-2xl p-6">
                <h3 className="text-2xl font-bold text-red-800 mb-3">{t.emergencyInfo}</h3>
                <p className="text-xl text-gray-700 mb-3">
                  {t.emergencyText}
                </p>
                <div className="bg-white rounded-xl p-4 text-center">
                  <p className="text-4xl font-bold text-red-600">911</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-4 pt-6">
                <button
                  onClick={onJoinCall}
                  disabled={!allDevicesWorking}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all shadow-lg"
                >
                  {t.joinCall}
                </button>

                <button
                  onClick={onCancel}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 text-2xl font-bold py-6 px-8 rounded-2xl transition-all"
                >
                  {t.cancel}
                </button>
              </div>

              {!allDevicesWorking && (
                <div className="bg-yellow-100 border-4 border-yellow-400 text-yellow-800 px-6 py-4 rounded-xl text-lg">
                  Please ensure all equipment is working before joining the call.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelehealthLobby;
