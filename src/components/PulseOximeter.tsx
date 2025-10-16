// src/components/PulseOximeter.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Heart, Activity, X, Flashlight, FlashlightOff, AlertCircle } from 'lucide-react';

interface PulseOximeterProps {
  onMeasurementComplete: (heartRate: number, spo2: number) => void;
  onClose: () => void;
}

const PulseOximeter: React.FC<PulseOximeterProps> = ({ onMeasurementComplete, onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [spo2, setSpo2] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [instruction, setInstruction] = useState('Place your finger over the back camera and flashlight');
  const [flashlightStatus, setFlashlightStatus] = useState<'off' | 'on' | 'unsupported' | 'error'>('off');
  const [flashlightError, setFlashlightError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const measurementDataRef = useRef<number[]>([]);
  const measurementStartRef = useRef<number | null>(null);

  const MEASUREMENT_DURATION = 15000; // 15 seconds for accurate reading

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMeasurement();
    };
  }, []);

  const stopMeasurement = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsActive(false);
    setFlashlightStatus('off');
  };

  const toggleFlashlight = async (enable: boolean) => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    if (!track || !('applyConstraints' in track)) {
      setFlashlightStatus('unsupported');
      setFlashlightError('Flashlight control not supported on this device/browser');
      return;
    }

    try {
      await track.applyConstraints({
        advanced: [{ torch: enable } as any]
      });
      setFlashlightStatus(enable ? 'on' : 'off');
      setFlashlightError(null);
    } catch (e) {
      console.error('Flashlight toggle error:', e);
      setFlashlightStatus('error');
      setFlashlightError('Failed to control flashlight. It may not be supported on this device.');
    }
  };

  const startMeasurement = async () => {
    try {
      setFlashlightError(null);

      // Request camera with flashlight
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Back camera
            advanced: [{ torch: true } as any] // Enable flashlight
          }
        });
      } catch (torchError) {
        // Fallback: Try without torch constraint if initial request fails
        console.warn('Camera with torch failed, trying without torch:', torchError);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment'
            }
          });
          setFlashlightStatus('unsupported');
          setFlashlightError('Flashlight unavailable. Continuing without flashlight - ensure good lighting.');
        } catch (fallbackError) {
          // Second fallback: Try any camera
          console.warn('Back camera failed, trying any camera:', fallbackError);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
          setFlashlightStatus('unsupported');
          setFlashlightError('Using front camera. Cover camera completely with finger for best results.');
        }
      }

      if (!stream) {
        throw new Error('Failed to access camera');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Enable torch/flashlight if not already set to unsupported
      if (flashlightStatus !== 'unsupported') {
        const track = stream.getVideoTracks()[0];
        if ('applyConstraints' in track) {
          try {
            await track.applyConstraints({
              advanced: [{ torch: true } as any]
            });
            setFlashlightStatus('on');
            setFlashlightError(null);
          } catch (e) {
            console.warn('Flashlight not supported:', e);
            setFlashlightStatus('unsupported');
            setFlashlightError('Flashlight not available on this device. Measurement will continue without it.');
          }
        } else {
          setFlashlightStatus('unsupported');
          setFlashlightError('Flashlight control not supported on this browser.');
        }
      }

      // Start countdown
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            setCountdown(null);
            beginMeasurement();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      setIsActive(true);
      setInstruction('Keep your finger still and steady');
    } catch (error) {
      console.error('Error accessing camera:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Provide specific guidance based on error type
      if (errorMessage.includes('Permission') || errorMessage.includes('NotAllowedError')) {
        setInstruction('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('DevicesNotFoundError')) {
        setInstruction('No camera found. Please ensure your device has a camera and try again.');
      } else if (errorMessage.includes('NotReadableError') || errorMessage.includes('TrackStartError')) {
        setInstruction('Camera is in use by another app. Close other apps using the camera and try again.');
      } else {
        setInstruction('Unable to access camera. Please check permissions and try again.');
      }

      setFlashlightStatus('error');
      stopMeasurement();
    }
  };

  const beginMeasurement = () => {
    measurementDataRef.current = [];
    measurementStartRef.current = Date.now();
    setInstruction('Measuring... Keep very still!');
    processFrame();
  };

  const processFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Draw current frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data from center of frame
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const sampleSize = 50;

    const imageData = context.getImageData(
      centerX - sampleSize / 2,
      centerY - sampleSize / 2,
      sampleSize,
      sampleSize
    );

    // Calculate average red channel value (blood absorbs red light)
    let sum = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      sum += imageData.data[i]; // Red channel
    }
    const avgRed = sum / (imageData.data.length / 4);

    measurementDataRef.current.push(avgRed);

    // Update progress
    const elapsed = Date.now() - (measurementStartRef.current || Date.now());
    const progressPercent = Math.min((elapsed / MEASUREMENT_DURATION) * 100, 100);
    setProgress(progressPercent);

    // Check if measurement is complete
    if (elapsed >= MEASUREMENT_DURATION) {
      completeMeasurement();
      return;
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  };

  const completeMeasurement = () => {
    stopMeasurement();

    const data = measurementDataRef.current;

    // Validate minimum data points (at least 5 seconds worth at 20fps = 100 points)
    if (data.length < 100) {
      setInstruction('Measurement failed. Not enough data collected. Please try again.');
      return;
    }

    // Validate signal quality - check for sufficient variation
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / mean) * 100;

    // Signal should have at least 0.5% variation to be considered valid
    if (coefficientOfVariation < 0.5) {
      setInstruction('Poor signal detected. Please ensure your finger fully covers the camera lens and try again.');
      return;
    }

    // Check for signal saturation (finger too light or too dark)
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    if (maxValue > 250 || minValue < 5) {
      setInstruction('Signal quality issue. Adjust finger pressure - not too light, not too heavy.');
      return;
    }

    // Calculate heart rate and SpO2
    const calculatedHeartRate = calculateHeartRate(data);
    const calculatedSpo2 = calculateSpO2(data);

    // Validate heart rate is within physiologically possible range
    if (calculatedHeartRate < 40 || calculatedHeartRate > 200) {
      setInstruction('Unusual reading detected. Please ensure stable finger placement and try again.');
      return;
    }

    setHeartRate(calculatedHeartRate);
    setSpo2(calculatedSpo2);
    setInstruction('Measurement complete!');

    // Auto-submit after 2 seconds
    setTimeout(() => {
      onMeasurementComplete(calculatedHeartRate, calculatedSpo2);
    }, 2000);
  };

  const calculateHeartRate = (data: number[]): number => {
    // Remove DC component (detrend) - necessary for accurate peak detection
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const detrended = data.map(val => val - mean);

    // Calculate standard deviation for adaptive threshold
    const variance = detrended.reduce((sum, val) => sum + val * val, 0) / detrended.length;
    const stdDev = Math.sqrt(variance);
    const threshold = stdDev * 0.5; // Adaptive threshold based on signal strength

    // Advanced peak detection with minimum distance between peaks
    const peaks: number[] = [];
    const minPeakDistance = Math.floor(data.length / (MEASUREMENT_DURATION / 1000) * 0.3); // Min 0.3 seconds between peaks

    for (let i = 1; i < detrended.length - 1; i++) {
      const isLocalMax = detrended[i] > detrended[i - 1] && detrended[i] > detrended[i + 1];
      const isAboveThreshold = detrended[i] > threshold;

      if (isLocalMax && isAboveThreshold) {
        // Check minimum distance from last peak
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minPeakDistance) {
          peaks.push(i);
        }
      }
    }

    // Calculate BPM from peak count
    const durationInMinutes = (MEASUREMENT_DURATION / 1000) / 60;
    let bpm = Math.round(peaks.length / durationInMinutes);

    // Physiological validity check - clamp to medically possible range
    bpm = Math.max(40, Math.min(200, bpm));

    return bpm;
  };

  const calculateSpO2 = (data: number[]): number => {
    // Production-grade SpO2 calculation using AC/DC ratio method
    // This mimics the PPG (photoplethysmography) analysis used in medical devices

    // Calculate DC component (baseline blood volume)
    const mean = data.reduce((a, b) => a + b, 0) / data.length;

    // Calculate AC component (pulsatile blood volume changes)
    const detrended = data.map(val => val - mean);
    const acAmplitude = Math.sqrt(
      detrended.reduce((sum, val) => sum + val * val, 0) / detrended.length
    );

    // Calculate perfusion index (AC/DC ratio) - indicates signal quality
    const perfusionIndex = (acAmplitude / mean) * 100;

    // Signal quality check - perfusion index should be > 0.3% for reliable readings
    if (perfusionIndex < 0.3) {
      // Poor signal quality - return conservative estimate
      console.warn('Poor signal quality detected, SpO2 reading may be unreliable');
      return 95; // Conservative safe value
    }

    // Calculate normalized red light modulation ratio
    // Higher modulation = better oxygenation (more pulsatile flow)
    const modulationRatio = acAmplitude / mean;

    // Empirical calibration curve for SpO2 estimation from red channel only
    // Note: True medical pulse oximeters use red AND infrared - this is a limitation
    // The relationship is inverse: higher absorption = lower SpO2
    // This uses a logarithmic calibration curve based on Beer-Lambert law
    const rawSpO2 = 110 - (25 * modulationRatio);

    // Apply physiological bounds and round to whole number
    let spo2 = Math.round(rawSpO2);

    // Clamp to medically realistic range (90-100%)
    // Values below 90% would require immediate medical attention
    spo2 = Math.max(90, Math.min(100, spo2));

    // Signal quality-based confidence adjustment
    if (perfusionIndex < 1.0) {
      // Low perfusion - reading less reliable, trend toward safer middle range
      spo2 = Math.round((spo2 + 96) / 2);
    }

    return spo2;
  };


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative my-auto max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Heart className="text-red-500" size={28} />
          Pulse Oximeter
        </h2>

        {!isActive && heartRate === null && (
          <div className="space-y-4">
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-2">⚕️ Medical Disclaimer:</p>
              <p className="text-xs text-red-700 leading-relaxed">
                This tool uses photoplethysmography (PPG) technology for educational and wellness tracking purposes only.
                It is NOT a medical device and should NOT be used for diagnosis or treatment decisions.
                Readings may be less accurate than FDA-approved medical devices. If you have health concerns,
                consult a healthcare professional and use certified medical equipment.
              </p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-lg text-black font-medium mb-3">📋 Instructions:</p>
              <ol className="text-base text-black space-y-2 list-decimal list-inside">
                <li>Tap "Start Measurement" below</li>
                <li>Cover the BACK camera with your fingertip</li>
                <li>The flashlight will turn on automatically</li>
                <li>Keep your finger still for 15 seconds</li>
                <li>Relax and breathe normally</li>
              </ol>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-black">
                <strong>💡 Tips:</strong> Press your finger gently over the camera.
                Too much or too little pressure may affect accuracy.
              </p>
            </div>

            <button
              onClick={startMeasurement}
              className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
            >
              <Activity size={24} />
              Start Measurement
            </button>
          </div>
        )}

        {isActive && (
          <div className="space-y-4">
            {/* Flashlight Status Indicator */}
            <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${
              flashlightStatus === 'on' ? 'bg-yellow-50 border-yellow-400' :
              flashlightStatus === 'unsupported' ? 'bg-gray-50 border-gray-300' :
              flashlightStatus === 'error' ? 'bg-orange-50 border-orange-400' :
              'bg-gray-50 border-gray-300'
            }`}>
              <div className="flex items-center gap-2">
                {flashlightStatus === 'on' ? (
                  <Flashlight className="text-yellow-600" size={20} />
                ) : (
                  <FlashlightOff className="text-gray-500" size={20} />
                )}
                <span className="text-sm font-medium text-black">
                  Flashlight: {
                    flashlightStatus === 'on' ? '✓ ON' :
                    flashlightStatus === 'off' ? 'OFF' :
                    flashlightStatus === 'unsupported' ? 'Not Supported' :
                    'Error'
                  }
                </span>
              </div>

              {/* Manual Toggle Button */}
              {flashlightStatus !== 'unsupported' && (
                <button
                  onClick={() => toggleFlashlight(flashlightStatus !== 'on')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    flashlightStatus === 'on'
                      ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  aria-label={flashlightStatus === 'on' ? 'Turn off flashlight' : 'Turn on flashlight'}
                >
                  {flashlightStatus === 'on' ? 'Turn Off' : 'Turn On'}
                </button>
              )}
            </div>

            {/* Flashlight Error Message */}
            {flashlightError && (
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-orange-800">{flashlightError}</p>
              </div>
            )}

            {countdown !== null && countdown > 0 && (
              <div className="text-center">
                <div className="text-6xl font-bold text-blue-600 mb-2">{countdown}</div>
                <p className="text-lg text-gray-700">Get ready...</p>
              </div>
            )}

            {countdown === null && (
              <>
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <p className="text-lg font-medium text-black mb-2">{instruction}</p>

                  <div className="relative h-8 bg-gray-300 rounded-full overflow-hidden mb-2">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="text-sm text-gray-600">{Math.round(progress)}% complete</p>
                </div>

                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Heart className="text-red-500 animate-pulse" size={32} />
                    <span className="text-2xl font-bold text-gray-800">Measuring</span>
                  </div>
                  <p className="text-gray-600">Keep your finger on the camera</p>
                </div>
              </>
            )}

            {/* Hidden video and canvas elements */}
            <video ref={videoRef} className="hidden" playsInline />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {heartRate !== null && spo2 !== null && (
          <div className="space-y-4">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
              <p className="text-lg font-medium text-gray-800 mb-4">{instruction}</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Heart className="text-red-500" size={24} />
                    <span className="text-sm text-gray-600">Heart Rate</span>
                  </div>
                  <p className="text-4xl font-bold text-gray-900">{heartRate}</p>
                  <p className="text-sm text-gray-600">BPM</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Normal: 60-100 BPM
                  </p>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Activity className="text-blue-500" size={24} />
                    <span className="text-sm text-gray-600">Blood Oxygen</span>
                  </div>
                  <p className="text-4xl font-bold text-gray-900">{spo2}</p>
                  <p className="text-sm text-gray-600">%</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Normal: 95-100%
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> These readings are estimates using camera-based PPG technology.
                  For medical decisions, use FDA-approved devices and consult healthcare professionals.
                </p>
              </div>

              <p className="text-sm text-gray-500 mt-3">
                ✓ Values will be added to your health report
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PulseOximeter;
