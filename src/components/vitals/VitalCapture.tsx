/**
 * VitalCapture Component
 * Senior-friendly multi-modal vital sign capture
 *
 * Supports 4 input methods:
 * 1. Manual entry (always available)
 * 2. Live camera scan (no stored image)
 * 3. Photo capture (24h temp storage)
 * 4. Web Bluetooth BLE (Android Chrome / desktop Chrome/Edge)
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  VitalReading,
  VitalType,
  BloodPressureReading,
  validateReading,
  isCriticalReading,
  VITAL_RANGES,
} from './types';
import { useCapabilities, getCapabilityMessage } from './useCapabilities';
import { useBluetooth } from './useBluetooth';
import { useCameraScan } from './useCameraScan';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import {
  Keyboard,
  Camera,
  Image,
  Bluetooth,
  AlertTriangle,
  Check,
  X,
  Edit2,
  Loader2,
  Info,
  ChevronLeft,
} from 'lucide-react';

// Component Props
interface VitalCaptureProps {
  vitalType?: VitalType;
  facilityId?: string;
  onComplete?: (reading: VitalReading) => void;
  onCancel?: () => void;
  showBackButton?: boolean;
}

// Capture method selection
type CaptureMethod = 'select' | 'manual' | 'camera_scan' | 'camera_photo' | 'ble';

// Manual entry form state
interface ManualFormState {
  systolic: string;
  diastolic: string;
  pulse: string;
  glucose: string;
  weight: string;
  heartRate: string;
  temperature: string;
  pulseOximeter: string;
}

const initialFormState: ManualFormState = {
  systolic: '',
  diastolic: '',
  pulse: '',
  glucose: '',
  weight: '',
  heartRate: '',
  temperature: '',
  pulseOximeter: '',
};

export const VitalCapture: React.FC<VitalCaptureProps> = ({
  vitalType = 'blood_pressure',
  facilityId,
  onComplete,
  onCancel,
  showBackButton = true,
}) => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const capabilities = useCapabilities();
  const bluetooth = useBluetooth();
  const cameraScan = useCameraScan();

  // State
  const [method, setMethod] = useState<CaptureMethod>('select');
  const [formState, setFormState] = useState<ManualFormState>(initialFormState);
  const [pendingReading, setPendingReading] = useState<VitalReading | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Photo capture refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Reset to method selection
  const resetToSelection = useCallback(() => {
    setMethod('select');
    setPendingReading(null);
    setIsEditing(false);
    setError(null);
    setFormState(initialFormState);
    cameraScan.stopScanning();
    bluetooth.disconnect();
  }, [cameraScan, bluetooth]);

  // Handle manual form change
  const handleFormChange = useCallback((field: keyof ManualFormState, value: string) => {
    // Only allow numbers and decimal point
    const cleaned = value.replace(/[^\d.]/g, '');
    setFormState(prev => ({ ...prev, [field]: cleaned }));
  }, []);

  // Build reading from manual form
  const buildManualReading = useCallback((): VitalReading | null => {
    switch (vitalType) {
      case 'blood_pressure': {
        const sys = parseInt(formState.systolic, 10);
        const dia = parseInt(formState.diastolic, 10);
        const pul = formState.pulse ? parseInt(formState.pulse, 10) : undefined;

        if (isNaN(sys) || isNaN(dia)) return null;

        return {
          type: 'blood_pressure',
          systolic: sys,
          diastolic: dia,
          pulse: pul && !isNaN(pul) ? pul : undefined,
          unit: 'mmHg',
          source: 'manual',
        };
      }

      case 'glucose': {
        const val = parseInt(formState.glucose, 10);
        if (isNaN(val)) return null;
        return { type: 'glucose', value: val, unit: 'mg/dL', source: 'manual' };
      }

      case 'weight': {
        const val = parseFloat(formState.weight);
        if (isNaN(val)) return null;
        return { type: 'weight', value: val, unit: 'lbs', source: 'manual' };
      }

      case 'heart_rate': {
        const val = parseInt(formState.heartRate, 10);
        if (isNaN(val)) return null;
        return { type: 'heart_rate', value: val, unit: 'bpm', source: 'manual' };
      }

      case 'temperature': {
        const val = parseFloat(formState.temperature);
        if (isNaN(val)) return null;
        return { type: 'temperature', value: val, unit: '°F', source: 'manual' };
      }

      case 'pulse_oximeter': {
        const val = parseInt(formState.pulseOximeter, 10);
        if (isNaN(val)) return null;
        return { type: 'pulse_oximeter', value: val, unit: '%', source: 'manual' };
      }

      default:
        return null;
    }
  }, [formState, vitalType]);

  // Handle manual submit
  const handleManualSubmit = useCallback(() => {
    const reading = buildManualReading();
    if (!reading) {
      setError('Please enter valid values');
      return;
    }

    const validation = validateReading(reading);
    if (!validation.valid) {
      setError(validation.errors.join('. '));
      return;
    }

    setPendingReading(reading);
  }, [buildManualReading]);

  // Handle BLE connect
  const handleBleConnect = useCallback(async () => {
    setMethod('ble');
    setError(null);

    const reading = await bluetooth.connect(vitalType);
    if (reading) {
      setPendingReading(reading);
    } else if (bluetooth.state.error) {
      setError(bluetooth.state.error);
    }
  }, [bluetooth, vitalType]);

  // Handle camera scan
  const handleCameraScan = useCallback(async () => {
    setMethod('camera_scan');
    setError(null);
    await cameraScan.startScanning(vitalType);
  }, [cameraScan, vitalType]);

  // Handle photo capture
  const handlePhotoCapture = useCallback(() => {
    setMethod('camera_photo');
    setError(null);
    fileInputRef.current?.click();
  }, []);

  // Process captured photo
  const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsProcessingPhoto(true);
    setError(null);

    try {
      // Generate unique path
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `${user.id}/${timestamp}_${vitalType}.${ext}`;

      // Upload to temp storage
      const { error: uploadError } = await supabase.storage
        .from('temp_vital_images')
        .upload(storagePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error('Failed to upload image');
      }

      // Create temp_image_job
      const { data: job, error: jobError } = await supabase
        .from('temp_image_jobs')
        .insert({
          user_id: user.id,
          storage_path: storagePath,
          vital_type: vitalType,
          facility_id: facilityId || null,
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error('Failed to create processing job');
      }

      // Call process-vital-image edge function
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'process-vital-image',
        { body: { job_id: job.id } }
      );

      if (processError) {
        throw new Error('Failed to process image');
      }

      if (processResult?.success && processResult?.reading) {
        setPendingReading(processResult.reading);
      } else if (processResult?.error === 'ocr_client_required') {
        // Server OCR not configured - show manual entry fallback
        setError('Image processing is not available. Please enter your numbers manually.');
        setMethod('manual');
      } else {
        throw new Error(processResult?.error || 'Could not read values from image');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to process photo. Please try again or enter manually.');
    } finally {
      setIsProcessingPhoto(false);
      // Clear file input for next use
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [supabase, user, vitalType, facilityId]);

  // Confirm and save reading
  const handleConfirm = useCallback(async () => {
    if (!pendingReading || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Build check-in payload
      const payload: Record<string, unknown> = {
        user_id: user.id,
        timestamp: new Date().toISOString(),
        label: `Vital Reading - ${pendingReading.type.replace('_', ' ')}`,
        is_emergency: isCriticalReading(pendingReading),
        source: pendingReading.source,
        device_label: pendingReading.deviceLabel || null,
        facility_id: facilityId || null,
      };

      // Add vital-specific fields
      if (pendingReading.type === 'blood_pressure') {
        const bp = pendingReading as BloodPressureReading;
        payload.bp_systolic = bp.systolic;
        payload.bp_diastolic = bp.diastolic;
        payload.heart_rate = bp.pulse || null;
      } else if (pendingReading.type === 'glucose') {
        payload.glucose_mg_dl = pendingReading.value;
      } else if (pendingReading.type === 'weight') {
        payload.weight = pendingReading.value;
      } else if (pendingReading.type === 'heart_rate') {
        payload.heart_rate = pendingReading.value;
      } else if (pendingReading.type === 'pulse_oximeter') {
        payload.pulse_oximeter = pendingReading.value;
      } else if (pendingReading.type === 'temperature') {
        payload.temperature = pendingReading.value;
      }

      // Insert into check_ins
      const { error: insertError } = await supabase
        .from('check_ins')
        .insert(payload);

      if (insertError) {
        throw new Error(insertError.message);
      }

      setSuccess(true);
      onComplete?.(pendingReading);

      // Reset after short delay
      setTimeout(() => {
        resetToSelection();
        setSuccess(false);
      }, 2000);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to save reading');
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingReading, user, supabase, facilityId, onComplete, resetToSelection]);

  // Edit reading values
  const handleEdit = useCallback(() => {
    if (!pendingReading) return;

    // Populate form with current values
    if (pendingReading.type === 'blood_pressure') {
      const bp = pendingReading as BloodPressureReading;
      setFormState({
        ...initialFormState,
        systolic: bp.systolic.toString(),
        diastolic: bp.diastolic.toString(),
        pulse: bp.pulse?.toString() || '',
      });
    } else {
      setFormState({
        ...initialFormState,
        [pendingReading.type === 'heart_rate' ? 'heartRate' : pendingReading.type === 'pulse_oximeter' ? 'pulseOximeter' : pendingReading.type]:
          pendingReading.value?.toString() || '',
      });
    }

    setIsEditing(true);
  }, [pendingReading]);

  // Save edited values
  const handleSaveEdit = useCallback(() => {
    const reading = buildManualReading();
    if (!reading) {
      setError('Please enter valid values');
      return;
    }

    const validation = validateReading(reading);
    if (!validation.valid) {
      setError(validation.errors.join('. '));
      return;
    }

    // Preserve original source
    reading.source = pendingReading?.source || 'manual';
    reading.deviceLabel = pendingReading?.deviceLabel;

    setPendingReading(reading);
    setIsEditing(false);
    setError(null);
  }, [buildManualReading, pendingReading]);

  // Get title for vital type
  const getVitalTitle = (type: VitalType): string => {
    switch (type) {
      case 'blood_pressure': return 'Blood Pressure';
      case 'glucose': return 'Blood Sugar';
      case 'weight': return 'Weight';
      case 'heart_rate': return 'Heart Rate';
      case 'temperature': return 'Temperature';
      case 'pulse_oximeter': return 'Oxygen Level';
      default: return 'Vital Reading';
    }
  };

  // Format reading for display
  const formatReading = (reading: VitalReading): string => {
    if (reading.type === 'blood_pressure') {
      const bp = reading as BloodPressureReading;
      return `${bp.systolic} / ${bp.diastolic}${bp.pulse ? `, pulse ${bp.pulse}` : ''}`;
    }
    return `${reading.value} ${reading.unit}`;
  };

  // Render method selection
  const renderMethodSelection = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-100 text-center mb-6">
        How would you like to enter your {getVitalTitle(vitalType)}?
      </h2>

      <div className="grid gap-4">
        {/* Manual Entry - Always available */}
        <button
          onClick={() => setMethod('manual')}
          className="flex items-center gap-4 p-6 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 transition-colors"
        >
          <div className="p-3 bg-teal-900/50 rounded-lg">
            <Keyboard className="w-8 h-8 text-teal-400" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-slate-100">Type my numbers</h3>
            <p className="text-sm text-slate-400">Enter values manually</p>
          </div>
        </button>

        {/* Camera Scan - If camera available */}
        {capabilities.hasCamera && (
          <button
            onClick={handleCameraScan}
            className="flex items-center gap-4 p-6 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 transition-colors"
          >
            <div className="p-3 bg-blue-900/50 rounded-lg">
              <Camera className="w-8 h-8 text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-slate-100">Scan with camera</h3>
              <p className="text-sm text-slate-400">Point at your device screen (no picture saved)</p>
            </div>
          </button>
        )}

        {/* Photo Capture - If camera available */}
        {capabilities.hasCamera && (
          <button
            onClick={handlePhotoCapture}
            className="flex items-center gap-4 p-6 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 transition-colors"
          >
            <div className="p-3 bg-purple-900/50 rounded-lg">
              <Image className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-slate-100">Take a photo instead</h3>
              <p className="text-sm text-slate-400">Snap a picture of your device</p>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Photo kept for max 24 hours, then deleted
              </p>
            </div>
          </button>
        )}

        {/* Bluetooth - If supported */}
        {capabilities.hasWebBluetooth && (
          <button
            onClick={handleBleConnect}
            className="flex items-center gap-4 p-6 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 transition-colors"
          >
            <div className="p-3 bg-cyan-900/50 rounded-lg">
              <Bluetooth className="w-8 h-8 text-cyan-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-slate-100">Connect via Bluetooth</h3>
              <p className="text-sm text-slate-400">Pair with your device directly</p>
              {capabilities.isAndroid && (
                <p className="text-xs text-slate-500 mt-1">Works on Android & desktop Chrome/Edge</p>
              )}
            </div>
          </button>
        )}

        {/* Capability messages */}
        {!capabilities.hasWebBluetooth && !capabilities.isIOS && (
          <p className="text-sm text-slate-500 text-center px-4">
            {getCapabilityMessage('hasWebBluetooth', capabilities)}
          </p>
        )}
      </div>
    </div>
  );

  // Render manual entry form
  const renderManualEntry = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={resetToSelection}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-slate-400" />
        </button>
        <h2 className="text-xl font-bold text-slate-100">Enter {getVitalTitle(vitalType)}</h2>
      </div>

      {vitalType === 'blood_pressure' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Systolic (top number) <span className="text-slate-500">mmHg</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={formState.systolic}
              onChange={(e) => handleFormChange('systolic', e.target.value)}
              placeholder={`${VITAL_RANGES.systolic.min}-${VITAL_RANGES.systolic.max}`}
              className="w-full px-4 py-4 text-2xl bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Diastolic (bottom number) <span className="text-slate-500">mmHg</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={formState.diastolic}
              onChange={(e) => handleFormChange('diastolic', e.target.value)}
              placeholder={`${VITAL_RANGES.diastolic.min}-${VITAL_RANGES.diastolic.max}`}
              className="w-full px-4 py-4 text-2xl bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Pulse <span className="text-slate-500">(optional) bpm</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={formState.pulse}
              onChange={(e) => handleFormChange('pulse', e.target.value)}
              placeholder={`${VITAL_RANGES.pulse.min}-${VITAL_RANGES.pulse.max}`}
              className="w-full px-4 py-4 text-2xl bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      )}

      {vitalType === 'glucose' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Blood Sugar <span className="text-slate-500">mg/dL</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={formState.glucose}
            onChange={(e) => handleFormChange('glucose', e.target.value)}
            placeholder={`${VITAL_RANGES.glucose.min}-${VITAL_RANGES.glucose.max}`}
            className="w-full px-4 py-4 text-2xl bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
      )}

      {vitalType === 'weight' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Weight <span className="text-slate-500">lbs</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={formState.weight}
            onChange={(e) => handleFormChange('weight', e.target.value)}
            placeholder={`${VITAL_RANGES.weight.min}-${VITAL_RANGES.weight.max}`}
            className="w-full px-4 py-4 text-2xl bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
      )}

      {vitalType === 'heart_rate' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Heart Rate <span className="text-slate-500">bpm</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={formState.heartRate}
            onChange={(e) => handleFormChange('heartRate', e.target.value)}
            placeholder={`${VITAL_RANGES.heartRate.min}-${VITAL_RANGES.heartRate.max}`}
            className="w-full px-4 py-4 text-2xl bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
      )}

      {vitalType === 'temperature' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Temperature <span className="text-slate-500">°F</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={formState.temperature}
            onChange={(e) => handleFormChange('temperature', e.target.value)}
            placeholder={`${VITAL_RANGES.temperature.min}-${VITAL_RANGES.temperature.max}`}
            className="w-full px-4 py-4 text-2xl bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
      )}

      {vitalType === 'pulse_oximeter' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Oxygen Saturation <span className="text-slate-500">%</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={formState.pulseOximeter}
            onChange={(e) => handleFormChange('pulseOximeter', e.target.value)}
            placeholder={`${VITAL_RANGES.pulseOximeter.min}-${VITAL_RANGES.pulseOximeter.max}`}
            className="w-full px-4 py-4 text-2xl bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
      )}

      <button
        onClick={isEditing ? handleSaveEdit : handleManualSubmit}
        className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors text-lg"
      >
        {isEditing ? 'Save Changes' : 'Continue'}
      </button>
    </div>
  );

  // Render camera scan view
  const renderCameraScan = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => {
            cameraScan.stopScanning();
            resetToSelection();
          }}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-slate-400" />
        </button>
        <h2 className="text-xl font-bold text-slate-100">Scan Device Screen</h2>
      </div>

      <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
        <video
          ref={cameraScan.videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={cameraScan.canvasRef} className="hidden" />

        {/* Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3/4 h-1/2 border-2 border-teal-400 rounded-lg">
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-teal-400 text-sm bg-slate-900/80 px-3 py-1 rounded">
                Position numbers here
              </p>
            </div>
          </div>
        </div>

        {cameraScan.state.isScanning && (
          <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
              <span className="text-sm text-slate-300">Scanning for numbers...</span>
            </div>
            {cameraScan.state.rawText && (
              <p className="text-xs text-slate-500 mt-1">
                Detected: {cameraScan.state.rawText}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-slate-400 text-center">
        Point your camera at the display showing your reading
      </p>

      <button
        onClick={() => setMethod('manual')}
        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors"
      >
        Enter numbers manually instead
      </button>
    </div>
  );

  // Render BLE connection
  const renderBleConnection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => {
            bluetooth.disconnect();
            resetToSelection();
          }}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-slate-400" />
        </button>
        <h2 className="text-xl font-bold text-slate-100">Connecting Device</h2>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 text-center">
        {bluetooth.state.isConnecting && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
            <p className="text-slate-300">
              {bluetooth.state.deviceName
                ? `Connecting to ${bluetooth.state.deviceName}...`
                : 'Waiting for device selection...'}
            </p>
            <p className="text-sm text-slate-500">
              Select your device from the browser popup
            </p>
          </div>
        )}

        {bluetooth.state.isConnected && !bluetooth.state.lastReading && (
          <div className="space-y-4">
            <Bluetooth className="w-12 h-12 text-cyan-400 mx-auto" />
            <p className="text-slate-300">
              Connected to {bluetooth.state.deviceName}
            </p>
            <p className="text-sm text-slate-500">
              Take a reading on your device now
            </p>
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
          </div>
        )}

        {bluetooth.state.error && (
          <div className="space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <p className="text-slate-300">{bluetooth.state.error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleBleConnect()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => setMethod('manual')}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              >
                Enter Manually
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render confirmation screen
  const renderConfirmation = () => {
    if (!pendingReading) return null;

    const isCritical = isCriticalReading(pendingReading);

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-100 text-center">
          We detected:
        </h2>

        <div className={`p-6 rounded-xl text-center ${
          isCritical ? 'bg-red-900/50 border border-red-500' : 'bg-slate-800'
        }`}>
          <p className="text-4xl font-bold text-slate-100 mb-2">
            {formatReading(pendingReading)}
          </p>
          <p className="text-slate-400 capitalize">
            {pendingReading.type.replace('_', ' ')}
          </p>

          {isCritical && (
            <div className="flex items-center justify-center gap-2 mt-4 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Critical value detected</span>
            </div>
          )}
        </div>

        <p className="text-lg text-slate-300 text-center">
          Is this correct?
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleEdit}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <Edit2 className="w-5 h-5" />
            No, edit it
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 py-4 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            Yes, save this
          </button>
        </div>
      </div>
    );
  };

  // Render success message
  const renderSuccess = () => (
    <div className="text-center space-y-4 py-8">
      <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center mx-auto">
        <Check className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-slate-100">Saved!</h2>
      <p className="text-slate-400">Your reading has been recorded.</p>
    </div>
  );

  // Main render
  return (
    <div className="bg-slate-900 min-h-screen p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        {showBackButton && method === 'select' && onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-300 mb-6 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
        )}

        {/* Error display */}
        {error && method !== 'ble' && !pendingReading && (
          <div className="mb-6 bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-400 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-sm underline mt-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Content based on state */}
        {success ? renderSuccess() : (
          <>
            {pendingReading && !isEditing && renderConfirmation()}
            {isEditing && renderManualEntry()}
            {!pendingReading && !isEditing && (
              <>
                {method === 'select' && renderMethodSelection()}
                {method === 'manual' && renderManualEntry()}
                {method === 'camera_scan' && renderCameraScan()}
                {method === 'camera_photo' && isProcessingPhoto && (
                  <div className="text-center py-12">
                    <Loader2 className="w-12 h-12 text-teal-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-300">Processing your photo...</p>
                  </div>
                )}
                {method === 'ble' && renderBleConnection()}
              </>
            )}
          </>
        )}

        {/* Hidden file input for photo capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default VitalCapture;
