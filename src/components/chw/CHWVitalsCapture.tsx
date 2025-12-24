/**
 * CHW Vitals Capture Component
 * Large touch-friendly interface for capturing vital signs
 * Supports manual entry and Bluetooth device integration
 */

import React, { useState, useEffect } from 'react';
import { chwService, VitalsData } from '../../services/chwService';

interface CHWVitalsCaptureProps {
  visitId?: string;
  language?: 'en' | 'es';
  onComplete?: () => void;
  onBack?: () => void;
}

export const CHWVitalsCapture: React.FC<CHWVitalsCaptureProps> = ({
  visitId = 'demo-visit-001',
  language = 'en',
  onComplete = () => {},
  onBack = () => {}
}) => {
  const [vitals, setVitals] = useState<Partial<VitalsData>>({
    captured_at: new Date().toISOString(),
    device_type: 'manual'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [criticalAlerts, setCriticalAlerts] = useState<Record<string, string>>({});
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [bluetoothError, setBluetoothError] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const translations = {
    en: {
      title: 'Vital Signs',
      bloodPressure: 'Blood Pressure',
      systolic: 'Systolic (top number)',
      diastolic: 'Diastolic (bottom number)',
      heartRate: 'Heart Rate (bpm)',
      oxygenSat: 'Oxygen Saturation (%)',
      temperature: 'Temperature (°F)',
      weight: 'Weight (lbs)',
      normal: 'Normal',
      elevated: 'Elevated',
      critical: 'CRITICAL',
      save: 'Save Vitals',
      back: 'Back',
      saving: 'Saving...',
      allRequired: 'Please enter at least Blood Pressure and Heart Rate',
      manualEntry: 'Manual Entry',
      bluetoothDevices: 'Bluetooth Devices',
      connectDevice: 'Connect Device'
    },
    es: {
      title: 'Signos Vitales',
      bloodPressure: 'Presión Arterial',
      systolic: 'Sistólica (número superior)',
      diastolic: 'Diastólica (número inferior)',
      heartRate: 'Frecuencia Cardíaca (lpm)',
      oxygenSat: 'Saturación de Oxígeno (%)',
      temperature: 'Temperatura (°F)',
      weight: 'Peso (lbs)',
      normal: 'Normal',
      elevated: 'Elevado',
      critical: 'CRÍTICO',
      save: 'Guardar Signos',
      back: 'Atrás',
      saving: 'Guardando...',
      allRequired: 'Por favor ingrese al menos Presión Arterial y Frecuencia Cardíaca',
      manualEntry: 'Entrada Manual',
      bluetoothDevices: 'Dispositivos Bluetooth',
      connectDevice: 'Conectar Dispositivo'
    }
  };

  const t = translations[language];

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleChange = (field: keyof VitalsData, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) || value === '') {
      setVitals(prev => ({
        ...prev,
        [field]: value === '' ? undefined : numValue
      }));

      // Clear validation error for this field
      if (validationErrors[field]) {
        setValidationErrors(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }

      // Clear critical alert for this field
      if (criticalAlerts[field]) {
        setCriticalAlerts(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  };

  const handleBlur = (field: keyof VitalsData) => {
    const value = vitals[field];
    if (value === undefined || typeof value !== 'number') return;

    // Validation for systolic BP
    if (field === 'systolic') {
      if (value < 60 || value > 250) {
        setValidationErrors(prev => ({
          ...prev,
          systolic: 'Please check this value - normal range is 60-250 mmHg'
        }));
      }

      // Critical high BP
      if (value > 180) {
        setCriticalAlerts(prev => ({
          ...prev,
          systolic: 'CRITICAL - High Blood Pressure. The physician will be notified immediately.'
        }));
      }

      // Critical low BP
      if (value < 90) {
        setCriticalAlerts(prev => ({
          ...prev,
          systolic: 'CRITICAL - Low Blood Pressure (shock risk). The physician will be notified immediately.'
        }));
      }

      // Elevated BP
      if (value >= 160 && value <= 180) {
        setCriticalAlerts(prev => ({
          ...prev,
          systolic: 'Elevated Blood Pressure. Will be reviewed within 4 hours.'
        }));
      }
    }

    // Validation for oxygen saturation
    if (field === 'oxygen_saturation') {
      if (value < 0 || value > 100) {
        setValidationErrors(prev => ({
          ...prev,
          oxygen_saturation: 'Oxygen saturation must be between 0 and 100'
        }));
      }

      // Critical low O2
      if (value < 88 && value >= 0) {
        setCriticalAlerts(prev => ({
          ...prev,
          oxygen_saturation: 'CRITICAL - Low Oxygen Saturation. Patient needs immediate attention.'
        }));
      }
    }
  };

  const handleBluetoothConnect = async () => {
    setBluetoothError('');
    try {
      // Simulated Bluetooth connection failure for testing
      // In production, this would attempt actual Bluetooth connection
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Unable to connect to Bluetooth device')), 1000)
      );

      setBluetoothConnected(true);
      setVitals(prev => ({ ...prev, device_type: 'bluetooth' }));
    } catch (err) {
      setBluetoothError('Unable to connect to Bluetooth device. Please try again or enter values manually.');
      setBluetoothConnected(false);
    }
  };

  const validateVital = (type: 'bp' | 'hr' | 'o2' | 'temp', value?: number) => {
    if (!value) return null;

    switch (type) {
      case 'bp':
        if (value > 180) return 'critical';
        if (value > 140 || value < 90) return 'elevated';
        return 'normal';
      case 'hr':
        if (value > 120 || value < 50) return 'elevated';
        return 'normal';
      case 'o2':
        if (value < 88) return 'critical';
        if (value < 92) return 'elevated';
        return 'normal';
      case 'temp':
        if (value > 103 || value < 95) return 'critical';
        if (value > 100.4 || value < 97) return 'elevated';
        return 'normal';
      default:
        return 'normal';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'elevated':
        return 'border-yellow-500 bg-yellow-50';
      case 'normal':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;

    const colors = {
      critical: 'bg-red-600 text-white',
      elevated: 'bg-yellow-500 text-white',
      normal: 'bg-green-600 text-white'
    };

    const labels = {
      critical: t.critical,
      elevated: t.elevated,
      normal: t.normal
    };

    return (
      <span className={`ml-3 px-4 py-2 rounded-lg text-lg font-bold ${colors[status as keyof typeof colors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const handleSave = async () => {
    // Validate required fields
    if (!vitals.systolic || !vitals.diastolic) {
      setError(t.allRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await chwService.captureVitals(visitId, vitals as VitalsData);
      onComplete();
    } catch (err) {
      setError('Failed to save vitals. Please try again.');
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError('');
    handleSave();
  };

  const bpStatus = validateVital('bp', vitals.systolic);
  const hrStatus = validateVital('hr', vitals.heart_rate);
  const o2Status = validateVital('o2', vitals.oxygen_saturation);
  const tempStatus = validateVital('temp', vitals.temperature);

  const isSubmitDisabled = loading || !vitals.systolic || !vitals.diastolic;

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-green-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <h2 className="text-5xl font-bold text-gray-800 mb-12 text-center">{t.title}</h2>

          {/* Offline Mode Indicator */}
          {isOffline && (
            <div className="mb-8 bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-6 py-4 rounded-xl text-xl">
              <strong>Offline Mode</strong>
              <p className="text-lg mt-2">Data will sync when connection is restored</p>
            </div>
          )}

          {/* Bluetooth Device Section */}
          <div className="mb-8">
            <button
              onClick={handleBluetoothConnect}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white text-2xl font-bold py-6 px-8 rounded-2xl transition-all"
            >
              Connect Bluetooth Device
            </button>
            {bluetoothError && (
              <div className="mt-4 text-red-600 text-xl">{bluetoothError}</div>
            )}
          </div>

          <div className="space-y-8">
            {/* Blood Pressure */}
            <div>
              <label className="flex items-center text-3xl font-medium text-gray-700 mb-4">
                {t.bloodPressure}
                {getStatusBadge(bpStatus)}
              </label>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label htmlFor="systolic-input" className="text-xl text-gray-600 mb-2 block">
                    {t.systolic}
                  </label>
                  <input
                    id="systolic-input"
                    type="number"
                    value={vitals.systolic || ''}
                    onChange={(e) => handleChange('systolic', e.target.value)}
                    onBlur={() => handleBlur('systolic')}
                    disabled={bluetoothConnected}
                    aria-label="Systolic blood pressure"
                    className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-hidden text-center font-bold ${getStatusColor(bpStatus)} disabled:opacity-50`}
                    placeholder="120"
                    min="0"
                    max="300"
                  />
                  {validationErrors.systolic && (
                    <div className="mt-2 text-red-600 text-lg">{validationErrors.systolic}</div>
                  )}
                </div>
                <div>
                  <label htmlFor="diastolic-input" className="text-xl text-gray-600 mb-2 block">
                    {t.diastolic}
                  </label>
                  <input
                    id="diastolic-input"
                    type="number"
                    value={vitals.diastolic || ''}
                    onChange={(e) => handleChange('diastolic', e.target.value)}
                    disabled={bluetoothConnected}
                    aria-label="Diastolic blood pressure"
                    className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-hidden text-center font-bold ${getStatusColor(bpStatus)} disabled:opacity-50`}
                    placeholder="80"
                    min="0"
                    max="200"
                  />
                </div>
              </div>
              {criticalAlerts.systolic && (
                <div role="alert" className="mt-4 bg-red-100 border-2 border-red-500 text-red-900 px-6 py-4 rounded-xl text-xl font-bold">
                  {criticalAlerts.systolic}
                </div>
              )}
            </div>

            {/* Heart Rate */}
            <div>
              <label htmlFor="heart-rate-input" className="flex items-center text-3xl font-medium text-gray-700 mb-4">
                {t.heartRate}
                {getStatusBadge(hrStatus)}
              </label>
              <input
                id="heart-rate-input"
                type="number"
                value={vitals.heart_rate || ''}
                onChange={(e) => handleChange('heart_rate', e.target.value)}
                disabled={bluetoothConnected}
                aria-label="Heart rate"
                className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-hidden text-center font-bold ${getStatusColor(hrStatus)} disabled:opacity-50`}
                placeholder="72"
                min="0"
                max="250"
              />
            </div>

            {/* Oxygen Saturation */}
            <div>
              <label htmlFor="oxygen-saturation-input" className="flex items-center text-3xl font-medium text-gray-700 mb-4">
                {t.oxygenSat}
                {getStatusBadge(o2Status)}
              </label>
              <input
                id="oxygen-saturation-input"
                type="number"
                value={vitals.oxygen_saturation || ''}
                onChange={(e) => handleChange('oxygen_saturation', e.target.value)}
                onBlur={() => handleBlur('oxygen_saturation')}
                disabled={bluetoothConnected}
                aria-label="Oxygen saturation"
                className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-hidden text-center font-bold ${getStatusColor(o2Status)} disabled:opacity-50`}
                placeholder="98"
                min="0"
                max="100"
              />
              {validationErrors.oxygen_saturation && (
                <div className="mt-2 text-red-600 text-lg">{validationErrors.oxygen_saturation}</div>
              )}
              {criticalAlerts.oxygen_saturation && (
                <div role="alert" className="mt-4 bg-red-100 border-2 border-red-500 text-red-900 px-6 py-4 rounded-xl text-xl font-bold">
                  {criticalAlerts.oxygen_saturation}
                </div>
              )}
            </div>

            {/* Temperature */}
            <div>
              <label htmlFor="temperature-input" className="flex items-center text-3xl font-medium text-gray-700 mb-4">
                {t.temperature}
                {getStatusBadge(tempStatus)}
              </label>
              <input
                id="temperature-input"
                type="number"
                step="0.1"
                value={vitals.temperature || ''}
                onChange={(e) => handleChange('temperature', e.target.value)}
                disabled={bluetoothConnected}
                aria-label="Temperature"
                className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-hidden text-center font-bold ${getStatusColor(tempStatus)} disabled:opacity-50`}
                placeholder="98.6"
                min="90"
                max="110"
              />
            </div>

            {/* Weight */}
            <div>
              <label htmlFor="weight-input" className="text-3xl font-medium text-gray-700 mb-4 block">
                {t.weight}
              </label>
              <input
                id="weight-input"
                type="number"
                value={vitals.weight || ''}
                onChange={(e) => handleChange('weight', e.target.value)}
                disabled={bluetoothConnected}
                aria-label="Weight"
                className="w-full text-4xl px-8 py-6 border-4 border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-hidden text-center font-bold bg-white disabled:opacity-50"
                placeholder="150"
                min="0"
                max="1000"
              />
            </div>

            {error && (
              <div className="bg-red-100 border-4 border-red-400 text-red-800 px-6 py-4 rounded-xl text-xl">
                <p className="font-bold mb-2">Failed to save vitals</p>
                <p>{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-6 pt-8">
              <button
                onClick={onBack}
                disabled={loading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
              >
                {t.back}
              </button>

              {error ? (
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
                >
                  Retry
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isSubmitDisabled}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
                >
                  {loading ? t.saving : t.save}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CHWVitalsCapture;
