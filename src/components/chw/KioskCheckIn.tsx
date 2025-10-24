/**
 * Kiosk Check-In Component
 * Patient lookup and authentication for library/community center kiosks
 */

import React, { useState } from 'react';
import { chwService } from '../../services/chwService';

interface KioskCheckInProps {
  kioskId: string;
  locationName: string;
  onCheckInComplete: (visitId: string, patientId: string) => void;
}

export const KioskCheckIn: React.FC<KioskCheckInProps> = ({
  kioskId,
  locationName,
  onCheckInComplete
}) => {
  const [step, setStep] = useState<'lookup' | 'privacy' | 'language'>('language');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [lastFourSSN, setLastFourSSN] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState('');

  const translations = {
    en: {
      welcome: 'Welcome to WellFit Health Kiosk',
      selectLanguage: 'Select Your Language',
      english: 'English',
      spanish: 'Spanish',
      patientLookup: 'Patient Lookup',
      firstName: 'First Name',
      lastName: 'Last Name',
      dateOfBirth: 'Date of Birth',
      lastFour: 'Last 4 of SSN',
      pin: 'PIN (if you have one)',
      findMe: 'Find Me',
      privacy: 'Privacy Consent',
      privacyText: 'Your health information is private and secure. This kiosk uses encryption and follows HIPAA guidelines. By continuing, you consent to using this kiosk for your health check-in.',
      agree: 'I Agree',
      cancel: 'Cancel',
      startVisit: 'Start Your Visit',
      checking: 'Looking you up...',
      error: 'Error',
      notFound: 'Patient not found. Please check your information or see staff for assistance.'
    },
    es: {
      welcome: 'Bienvenido al Quiosco de Salud WellFit',
      selectLanguage: 'Seleccione su idioma',
      english: 'Inglés',
      spanish: 'Español',
      patientLookup: 'Búsqueda de Paciente',
      firstName: 'Nombre',
      lastName: 'Apellido',
      dateOfBirth: 'Fecha de Nacimiento',
      lastFour: 'Últimos 4 del SSN',
      pin: 'PIN (si tiene uno)',
      findMe: 'Encuéntrame',
      privacy: 'Consentimiento de Privacidad',
      privacyText: 'Su información de salud es privada y segura. Este quiosco usa encriptación y sigue las pautas de HIPAA. Al continuar, usted consiente en usar este quiosco para su registro de salud.',
      agree: 'Estoy de acuerdo',
      cancel: 'Cancelar',
      startVisit: 'Comenzar su Visita',
      checking: 'Buscándote...',
      error: 'Error',
      notFound: 'Paciente no encontrado. Por favor verifique su información o consulte al personal.'
    }
  };

  const t = translations[language];

  const handleLanguageSelect = (lang: 'en' | 'es') => {
    setLanguage(lang);
    setStep('lookup');
  };

  const handleLookup = async () => {
    setLoading(true);
    setError('');

    try {
      // TODO: Implement actual patient lookup
      // For now, simulate lookup
      const mockPatientId = 'patient-' + Date.now();
      setPatientId(mockPatientId);
      setStep('privacy');
    } catch (err) {
      setError(t.notFound);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyConsent = async () => {
    setLoading(true);

    try {
      // Get GPS location if available
      let location: { latitude: number; longitude: number } | undefined;
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
        } catch {
          // GPS not available, continue without it
        }
      }

      // Start field visit
      const visit = await chwService.startFieldVisit(
        patientId,
        kioskId,
        locationName,
        location
      );

      onCheckInComplete(visit.id, patientId);
    } catch (err) {
      setError('Failed to start visit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Language Selection
  if (step === 'language') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold text-gray-800 mb-12">{t.welcome}</h1>
          <p className="text-3xl text-gray-600 mb-12">{t.selectLanguage}</p>

          <div className="space-y-6">
            <button
              onClick={() => handleLanguageSelect('en')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-3xl font-bold py-8 px-12 rounded-2xl shadow-lg transition-all transform hover:scale-105"
            >
              {t.english}
            </button>

            <button
              onClick={() => handleLanguageSelect('es')}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-3xl font-bold py-8 px-12 rounded-2xl shadow-lg transition-all transform hover:scale-105"
            >
              {t.spanish}
            </button>
          </div>

          <div className="mt-12 text-gray-500 text-xl">
            Location: {locationName}
          </div>
        </div>
      </div>
    );
  }

  // Patient Lookup
  if (step === 'lookup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-3xl w-full">
          <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t.patientLookup}</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-2xl font-medium text-gray-700 mb-3">
                {t.firstName}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-2xl font-medium text-gray-700 mb-3">
                {t.lastName}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-2xl font-medium text-gray-700 mb-3">
                {t.dateOfBirth}
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
              />
            </div>

            <div>
              <label className="block text-2xl font-medium text-gray-700 mb-3">
                {t.lastFour}
              </label>
              <input
                type="text"
                value={lastFourSSN}
                onChange={(e) => setLastFourSSN(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
                placeholder="1234"
              />
            </div>

            <div>
              <label className="block text-2xl font-medium text-gray-700 mb-3">
                {t.pin}
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
                placeholder="Optional"
              />
            </div>

            {error && (
              <div className="bg-red-100 border-4 border-red-400 text-red-700 px-6 py-4 rounded-xl text-xl">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-6">
              <button
                onClick={() => setStep('language')}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-2xl font-bold py-6 px-8 rounded-xl transition-all"
              >
                {t.cancel}
              </button>

              <button
                onClick={handleLookup}
                disabled={loading || !firstName || !lastName || !dob || !lastFourSSN}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-2xl font-bold py-6 px-8 rounded-xl transition-all"
              >
                {loading ? t.checking : t.findMe}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Privacy Consent
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-3xl w-full">
        <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t.privacy}</h2>

        <div className="bg-blue-50 border-4 border-blue-200 rounded-xl p-8 mb-8">
          <p className="text-2xl text-gray-700 leading-relaxed">
            {t.privacyText}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setStep('lookup')}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-2xl font-bold py-6 px-8 rounded-xl transition-all"
          >
            {t.cancel}
          </button>

          <button
            onClick={handlePrivacyConsent}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-2xl font-bold py-6 px-8 rounded-xl transition-all"
          >
            {loading ? t.checking : t.agree}
          </button>
        </div>
      </div>
    </div>
  );
};
