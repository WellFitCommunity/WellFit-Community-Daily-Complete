/**
 * Kiosk Check-In Component
 * Patient lookup and authentication for library/community center kiosks
 * HIPAA COMPLIANT: 2-minute inactivity timeout with auto-logout
 */

import React, { useState, useEffect, useRef } from 'react';
import bcrypt from 'bcryptjs';
import { supabase } from '../../lib/supabaseClient';
import { chwService } from '../../services/chwService';
import { validateName, validateDOB, validateSSNLast4, validatePIN, RateLimiter } from '../../utils/kioskValidation';

interface KioskCheckInProps {
  kioskId?: string;
  locationName?: string;
  onCheckInComplete?: (visitId: string, patientId: string) => void;
}

export const KioskCheckIn: React.FC<KioskCheckInProps> = ({
  kioskId = 'kiosk-web-001',
  locationName = 'Web Kiosk',
  onCheckInComplete = () => {}
}) => {
  const [step, setStep] = useState<'lookup' | 'privacy' | 'language'>('language');
  const [language, setLanguage] = useState<'en' | 'es' | 'vi'>('en');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [lastFourSSN, setLastFourSSN] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState('');
  const [notification, setNotification] = useState<{type: 'info' | 'warning' | 'error', message: string} | null>(null);

  // CRITICAL FIX: Inactivity timeout (2 minutes)
  const INACTIVITY_TIMEOUT = 120000; // 2 minutes in milliseconds
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Rate limiting for failed lookups
  const rateLimiterRef = useRef<RateLimiter>(new RateLimiter(5, 300000)); // 5 attempts per 5 minutes

  // Reset all state and return to language selection
  const resetSession = () => {
    setStep('language');
    setFirstName('');
    setLastName('');
    setDob('');
    setLastFourSSN('');
    setPin('');
    setPatientId('');
    setError('');
    setLoading(false);
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      // Session timed out - clear all PHI and return to start
      setNotification({
        type: 'warning',
        message: language === 'en'
          ? 'Session timed out for security. Please start over.'
          : 'La sesión expiró por seguridad. Por favor, comience de nuevo.'
      });
      // Wait for user to see notification, then reset
      setTimeout(() => {
        resetSession();
        setNotification(null);
      }, 5000);
    }, INACTIVITY_TIMEOUT);
  };

  // Set up inactivity detection
  useEffect(() => {
    // Events that indicate user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Start initial timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, []);  

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
    },
    vi: {
      welcome: 'Chào Mừng Đến Quầy Sức Khỏe WellFit',
      selectLanguage: 'Chọn Ngôn Ngữ Của Bạn',
      english: 'Tiếng Anh',
      spanish: 'Tiếng Tây Ban Nha',
      vietnamese: 'Tiếng Việt',
      patientLookup: 'Tra Cứu Bệnh Nhân',
      firstName: 'Tên',
      lastName: 'Họ',
      dateOfBirth: 'Ngày Sinh',
      lastFour: '4 Số Cuối Của SSN',
      pin: 'Mã PIN (nếu bạn có)',
      findMe: 'Tìm Tôi',
      privacy: 'Đồng Ý Quyền Riêng Tư',
      privacyText: 'Thông tin sức khỏe của bạn được bảo mật và an toàn. Quầy này sử dụng mã hóa và tuân theo hướng dẫn HIPAA. Bằng cách tiếp tục, bạn đồng ý sử dụng quầy này để đăng ký sức khỏe của mình.',
      agree: 'Tôi Đồng Ý',
      cancel: 'Hủy',
      startVisit: 'Bắt Đầu Chuyến Thăm',
      checking: 'Đang tìm kiếm bạn...',
      error: 'Lỗi',
      notFound: 'Không tìm thấy bệnh nhân. Vui lòng kiểm tra thông tin của bạn hoặc liên hệ nhân viên để được hỗ trợ.',
    }
  };

  const t = translations[language];

  const handleLanguageSelect = (lang: 'en' | 'es' | 'vi') => {
    setLanguage(lang);
    setStep('lookup');
  };

  const handleLookup = async () => {
    setLoading(true);
    setError('');

    // FIXED: Comprehensive input validation and rate limiting
    const rateLimitKey = `${kioskId}-lookup`;

    try {

      // Check rate limit
      if (rateLimiterRef.current.isRateLimited(rateLimitKey)) {
        setError(language === 'en'
          ? 'Too many failed attempts. Please wait 5 minutes or contact staff for assistance.'
          : 'Demasiados intentos fallidos. Espere 5 minutos o contacte al personal.');
        await chwService.logSecurityEvent({
          event_type: 'rate_limit_exceeded',
          severity: 'high',
          kiosk_id: kioskId,
          details: { limit_type: 'patient_lookup' }
        });
        setLoading(false);
        return;
      }

      // Validate first name
      const firstNameValidation = validateName(firstName);
      if (!firstNameValidation.valid) {
        setError(firstNameValidation.error || t.notFound);
        setLoading(false);
        return;
      }

      // Validate last name
      const lastNameValidation = validateName(lastName);
      if (!lastNameValidation.valid) {
        setError(lastNameValidation.error || t.notFound);
        setLoading(false);
        return;
      }

      // Validate DOB
      const dobValidation = validateDOB(dob);
      if (!dobValidation.valid) {
        setError(dobValidation.error || t.notFound);
        setLoading(false);
        return;
      }

      // Validate SSN
      const ssnValidation = validateSSNLast4(lastFourSSN);
      if (!ssnValidation.valid) {
        setError(ssnValidation.error || t.notFound);
        setLoading(false);
        return;
      }

      // Validate PIN (if provided)
      const pinValidation = validatePIN(pin);
      if (!pinValidation.valid) {
        setError(pinValidation.error || 'Invalid PIN');
        setLoading(false);
        return;
      }

      // Use sanitized values
      const sanitizedFirstName = firstNameValidation.sanitized;
      const sanitizedLastName = lastNameValidation.sanitized;
      const sanitizedSSN = ssnValidation.sanitized;
      const sanitizedPIN = pinValidation.sanitized;

      // Query profiles table with sanitized inputs
      const { data: patients, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, date_of_birth, ssn_last_four, caregiver_pin_hash')
        .ilike('first_name', sanitizedFirstName)
        .ilike('last_name', sanitizedLastName)
        .limit(5);

      if (error) {
        // Log error without exposing PHI
        await chwService.logSecurityEvent({
          event_type: 'patient_lookup_error',
          severity: 'medium',
          details: { error_code: error.code },
          kiosk_id: kioskId
        });
        setError(t.notFound);
        return;
      }

      if (!patients || patients.length === 0) {
        rateLimiterRef.current.recordAttempt(rateLimitKey);
        await chwService.logSecurityEvent({
          event_type: 'patient_lookup_no_match',
          severity: 'low',
          details: { attempted_name_length: `${sanitizedFirstName.length},${sanitizedLastName.length}` },
          kiosk_id: kioskId
        });
        setError(t.notFound);
        return;
      }

      // Multi-factor verification: DOB + Last 4 SSN
      const matchedPatient = patients.find(p => {
        const dbDOB = new Date(p.date_of_birth).toISOString().split('T')[0];
        const dobMatch = dbDOB === dob;
        const ssnMatch = p.ssn_last_four === sanitizedSSN;
        return dobMatch && ssnMatch;
      });

      if (!matchedPatient) {
        rateLimiterRef.current.recordAttempt(rateLimitKey);
        await chwService.logSecurityEvent({
          event_type: 'patient_lookup_verification_failed',
          severity: 'medium',
          details: { verification_type: 'dob_ssn_mismatch' },
          kiosk_id: kioskId
        });
        setError(t.notFound);
        return;
      }

      // If PIN provided, verify it with bcrypt
      if (sanitizedPIN) {
        if (!matchedPatient.caregiver_pin_hash) {
          rateLimiterRef.current.recordAttempt(rateLimitKey);
          await chwService.logSecurityEvent({
            event_type: 'pin_verification_failed',
            severity: 'medium',
            patient_id: matchedPatient.id,
            details: { reason: 'no_pin_set' },
            kiosk_id: kioskId
          });
          setError('PIN verification failed. Please try without PIN or contact staff.');
          return;
        }

        // FIXED: Actual bcrypt verification
        const pinValid = await bcrypt.compare(sanitizedPIN, matchedPatient.caregiver_pin_hash);

        if (!pinValid) {
          rateLimiterRef.current.recordAttempt(rateLimitKey);
          await chwService.logSecurityEvent({
            event_type: 'pin_verification_failed',
            severity: 'high',
            patient_id: matchedPatient.id,
            details: { reason: 'incorrect_pin' },
            kiosk_id: kioskId
          });
          setError('PIN verification failed. Please check your PIN or contact staff.');
          return;
        }

        await chwService.logSecurityEvent({
          event_type: 'pin_verification_success',
          severity: 'low',
          patient_id: matchedPatient.id,
          kiosk_id: kioskId
        });
      }

      // Success - patient found and verified, clear rate limit
      rateLimiterRef.current.clearAttempts(rateLimitKey);

      await chwService.logSecurityEvent({
        event_type: 'patient_lookup_success',
        severity: 'low',
        patient_id: matchedPatient.id,
        details: { verification_method: sanitizedPIN ? 'dob_ssn_pin' : 'dob_ssn' },
        kiosk_id: kioskId
      });

      setPatientId(matchedPatient.id);
      setStep('privacy');
    } catch (err) {
      // Log error without PHI
      rateLimiterRef.current.recordAttempt(rateLimitKey);
      await chwService.logSecurityEvent({
        event_type: 'patient_lookup_exception',
        severity: 'high',
        details: { error_type: err instanceof Error ? err.name : 'unknown' },
        kiosk_id: kioskId
      });
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

  // Notification component
  const NotificationBanner = () => {
    if (!notification) return null;

    const bgColor = {
      info: 'bg-blue-100 border-blue-500',
      warning: 'bg-yellow-100 border-yellow-500',
      error: 'bg-red-100 border-red-500'
    }[notification.type];

    return (
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 ${bgColor} border-4 px-8 py-6 rounded-2xl shadow-2xl z-50 max-w-2xl`}>
        <p className="text-2xl font-bold text-gray-800">{notification.message}</p>
      </div>
    );
  };

  // Language Selection
  if (step === 'language') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-8">
        <NotificationBanner />
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

            <button
              onClick={() => handleLanguageSelect('vi')}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-3xl font-bold py-8 px-12 rounded-2xl shadow-lg transition-all transform hover:scale-105"
            >
              Tiếng Việt (Vietnamese)
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
        <NotificationBanner />
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-3xl w-full">
          <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t.patientLookup}</h2>

          <div className="space-y-6">
            <div>
              <label htmlFor="firstName" className="block text-2xl font-medium text-gray-700 mb-3">
                {t.firstName}
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-2xl font-medium text-gray-700 mb-3">
                {t.lastName}
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="dob" className="block text-2xl font-medium text-gray-700 mb-3">
                {t.dateOfBirth}
              </label>
              <input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
              />
            </div>

            <div>
              <label htmlFor="lastFourSSN" className="block text-2xl font-medium text-gray-700 mb-3">
                {t.lastFour}
              </label>
              <input
                id="lastFourSSN"
                type="text"
                value={lastFourSSN}
                onChange={(e) => setLastFourSSN(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
                placeholder="1234"
              />
            </div>

            <div>
              <label htmlFor="pin" className="block text-2xl font-medium text-gray-700 mb-3">
                {t.pin}
              </label>
              <input
                id="pin"
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
      <NotificationBanner />
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

export default KioskCheckIn;
