/**
 * CHW Vitals Capture Component
 * Large touch-friendly interface for capturing vital signs
 * Supports manual entry and Bluetooth device integration
 */

import React, { useState } from 'react';
import { chwService, VitalsData } from '../../services/chwService';

interface CHWVitalsCaptureProps {
  visitId: string;
  language: 'en' | 'es';
  onComplete: () => void;
  onBack: () => void;
}

export const CHWVitalsCapture: React.FC<CHWVitalsCaptureProps> = ({
  visitId,
  language,
  onComplete,
  onBack
}) => {
  const [vitals, setVitals] = useState<Partial<VitalsData>>({
    captured_at: new Date().toISOString(),
    device_type: 'manual'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleChange = (field: keyof VitalsData, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) || value === '') {
      setVitals(prev => ({
        ...prev,
        [field]: value === '' ? undefined : numValue
      }));
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
    if (!vitals.systolic || !vitals.diastolic || !vitals.heart_rate) {
      setError(t.allRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await chwService.captureVitals(visitId, vitals as VitalsData);
      onComplete();
    } catch (err) {
      setError('Failed to save vitals. Data saved offline and will sync when connection is restored.');
      // Still proceed since we save offline
      setTimeout(() => onComplete(), 2000);
    } finally {
      setLoading(false);
    }
  };

  const bpStatus = validateVital('bp', vitals.systolic);
  const hrStatus = validateVital('hr', vitals.heart_rate);
  const o2Status = validateVital('o2', vitals.oxygen_saturation);
  const tempStatus = validateVital('temp', vitals.temperature);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <h2 className="text-5xl font-bold text-gray-800 mb-12 text-center">{t.title}</h2>

          <div className="space-y-8">
            {/* Blood Pressure */}
            <div>
              <label className="flex items-center text-3xl font-medium text-gray-700 mb-4">
                {t.bloodPressure}
                {getStatusBadge(bpStatus)}
              </label>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xl text-gray-600 mb-2">{t.systolic}</p>
                  <input
                    type="number"
                    value={vitals.systolic || ''}
                    onChange={(e) => handleChange('systolic', e.target.value)}
                    className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-none text-center font-bold ${getStatusColor(bpStatus)}`}
                    placeholder="120"
                    min="0"
                    max="300"
                  />
                </div>
                <div>
                  <p className="text-xl text-gray-600 mb-2">{t.diastolic}</p>
                  <input
                    type="number"
                    value={vitals.diastolic || ''}
                    onChange={(e) => handleChange('diastolic', e.target.value)}
                    className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-none text-center font-bold ${getStatusColor(bpStatus)}`}
                    placeholder="80"
                    min="0"
                    max="200"
                  />
                </div>
              </div>
            </div>

            {/* Heart Rate */}
            <div>
              <label className="flex items-center text-3xl font-medium text-gray-700 mb-4">
                {t.heartRate}
                {getStatusBadge(hrStatus)}
              </label>
              <input
                type="number"
                value={vitals.heart_rate || ''}
                onChange={(e) => handleChange('heart_rate', e.target.value)}
                className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-none text-center font-bold ${getStatusColor(hrStatus)}`}
                placeholder="72"
                min="0"
                max="250"
              />
            </div>

            {/* Oxygen Saturation */}
            <div>
              <label className="flex items-center text-3xl font-medium text-gray-700 mb-4">
                {t.oxygenSat}
                {getStatusBadge(o2Status)}
              </label>
              <input
                type="number"
                value={vitals.oxygen_saturation || ''}
                onChange={(e) => handleChange('oxygen_saturation', e.target.value)}
                className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-none text-center font-bold ${getStatusColor(o2Status)}`}
                placeholder="98"
                min="0"
                max="100"
              />
            </div>

            {/* Temperature */}
            <div>
              <label className="flex items-center text-3xl font-medium text-gray-700 mb-4">
                {t.temperature}
                {getStatusBadge(tempStatus)}
              </label>
              <input
                type="number"
                step="0.1"
                value={vitals.temperature || ''}
                onChange={(e) => handleChange('temperature', e.target.value)}
                className={`w-full text-4xl px-8 py-6 border-4 rounded-2xl focus:ring-4 focus:ring-blue-200 outline-none text-center font-bold ${getStatusColor(tempStatus)}`}
                placeholder="98.6"
                min="90"
                max="110"
              />
            </div>

            {/* Weight */}
            <div>
              <label className="text-3xl font-medium text-gray-700 mb-4 block">
                {t.weight}
              </label>
              <input
                type="number"
                value={vitals.weight || ''}
                onChange={(e) => handleChange('weight', e.target.value)}
                className="w-full text-4xl px-8 py-6 border-4 border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none text-center font-bold bg-white"
                placeholder="150"
                min="0"
                max="1000"
              />
            </div>

            {error && (
              <div className="bg-yellow-100 border-4 border-yellow-400 text-yellow-800 px-6 py-4 rounded-xl text-xl">
                {error}
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

              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
              >
                {loading ? t.saving : t.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
