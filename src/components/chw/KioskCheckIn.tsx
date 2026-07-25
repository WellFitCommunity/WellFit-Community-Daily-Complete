/**
 * KioskCheckIn - Public check-in flow for shared CHW kiosks
 *
 * Purpose: lets a senior check in at a library/community-center kiosk with
 * no user credentials on the device. All PHI access happens server-side in
 * the chw-kiosk edge function; this component only collects identity fields
 * and a possession/knowledge factor and renders the outcome.
 *
 * Device model (Maria approved 2026-07-23): the kiosk authenticates as a
 * DEVICE. Staff provision the kiosk once with its kiosk ID + device token
 * (issued at registration, hash stored on chw_kiosk_devices); credentials
 * persist in localStorage on the kiosk device only.
 *
 * Identity flow: name + DOB lookup -> SMS one-time code (verified phone) or
 * last-4-of-phone fallback -> privacy consent -> server creates the visit.
 * No SSN — none is stored, by design.
 *
 * HIPAA: 2-minute inactivity timeout clears all entered data.
 * Used by: route /kiosk/check-in (auth 'none').
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { validateName, validateDOB } from '../../utils/kioskValidation';
import { kioskTranslations, KioskLanguage } from './kioskTranslations';

const INACTIVITY_TIMEOUT = 120000; // 2 minutes
const NOTIFICATION_DISPLAY_TIME = 5000;
const SUCCESS_RESET_TIME = 12000;

const STORAGE_KIOSK_ID = 'chw_kiosk_id';
const STORAGE_KIOSK_TOKEN = 'chw_kiosk_token';

type Step = 'setup' | 'language' | 'lookup' | 'privacy' | 'verify' | 'see-staff' | 'success';
type VerifyMethod = 'sms' | 'phone_last4' | 'none';

interface KioskLookupResponse {
  found?: boolean;
  method?: VerifyMethod;
  masked_phone?: string;
  error?: string;
}

interface KioskVerifyResponse {
  verified?: boolean;
  visit_id?: string;
  patient_first_name?: string;
  error?: string;
}

/**
 * Invoke the chw-kiosk edge function. supabase-js surfaces non-2xx responses
 * as FunctionsHttpError with the raw Response on .context — parse it so the
 * UI can distinguish device-auth failure (401) from rate limiting (429).
 */
async function callKiosk<T>(body: Record<string, unknown>): Promise<{ status: number; data: T | null }> {
  const { data, error } = await supabase.functions.invoke('chw-kiosk', { body });
  if (!error) return { status: 200, data: data as T };
  const ctx = (error as { context?: Response }).context;
  if (ctx instanceof Response) {
    try {
      return { status: ctx.status, data: (await ctx.json()) as T };
    } catch {
      return { status: ctx.status, data: null };
    }
  }
  return { status: 0, data: null };
}

interface KioskCheckInProps {
  kioskId?: string;
  locationName?: string;
  onCheckInComplete?: (visitId: string) => void;
}

export const KioskCheckIn: React.FC<KioskCheckInProps> = ({
  kioskId,
  locationName = 'WellFit Kiosk',
  onCheckInComplete = () => {},
}) => {
  const [deviceId, setDeviceId] = useState<string>(() => kioskId ?? localStorage.getItem(STORAGE_KIOSK_ID) ?? '');
  const [deviceToken, setDeviceToken] = useState<string>(() => localStorage.getItem(STORAGE_KIOSK_TOKEN) ?? '');
  const provisioned = Boolean(deviceId && deviceToken);

  const [step, setStep] = useState<Step>(provisioned ? 'language' : 'setup');
  const [language, setLanguage] = useState<KioskLanguage>('en');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [method, setMethod] = useState<VerifyMethod>('none');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [factor, setFactor] = useState('');
  const [patientFirstName, setPatientFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ type: 'info' | 'warning' | 'error'; message: string } | null>(null);

  // Staff provisioning form (setup step)
  const [setupId, setSetupId] = useState('');
  const [setupToken, setSetupToken] = useState('');

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = kioskTranslations[language];

  // Reset all patient-entered state and return to the language screen
  const resetSession = useCallback(() => {
    setStep('language');
    setFirstName('');
    setLastName('');
    setDob('');
    setMethod('none');
    setMaskedPhone('');
    setFactor('');
    setPatientFirstName('');
    setError('');
    setLoading(false);
  }, []);

  // HIPAA: inactivity timeout clears all PHI from the screen
  const resetInactivityTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setNotification({ type: 'warning', message: t.timedOut });
      resetTimeoutRef.current = setTimeout(() => {
        resetSession();
        setNotification(null);
      }, NOTIFICATION_DISPLAY_TIME);
    }, INACTIVITY_TIMEOUT);
  }, [t.timedOut, resetSession]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, [step, resetInactivityTimer]);

  // Success screen auto-resets so the kiosk is ready for the next person
  useEffect(() => {
    if (step !== 'success') return;
    const timer = setTimeout(resetSession, SUCCESS_RESET_TIME);
    return () => clearTimeout(timer);
  }, [step, resetSession]);

  const handleProvision = () => {
    const id = setupId.trim();
    const token = setupToken.trim();
    if (!id || !token) return;
    localStorage.setItem(STORAGE_KIOSK_ID, id);
    localStorage.setItem(STORAGE_KIOSK_TOKEN, token);
    setDeviceId(id);
    setDeviceToken(token);
    setSetupId('');
    setSetupToken('');
    setStep('language');
  };

  const deviceCredentials = { kiosk_id: deviceId, device_token: deviceToken };
  const identityFields = { first_name: firstName.trim(), last_name: lastName.trim(), dob: dob.trim() };

  const failForStatus = useCallback(
    (status: number): string => {
      if (status === 401) return t.kioskUnavailable;
      if (status === 429) return t.tooManyAttempts;
      return t.notFound;
    },
    [t]
  );

  const handleLookup = async () => {
    setError('');

    const firstCheck = validateName(firstName);
    if (!firstCheck.valid) {
      setError(firstCheck.error ?? t.notFound);
      return;
    }
    const lastCheck = validateName(lastName);
    if (!lastCheck.valid) {
      setError(lastCheck.error ?? t.notFound);
      return;
    }
    const dobCheck = validateDOB(dob.trim());
    if (!dobCheck.valid) {
      setError(dobCheck.error ?? t.notFound);
      return;
    }

    setLoading(true);
    try {
      const { status, data } = await callKiosk<KioskLookupResponse>({
        action: 'lookup',
        ...deviceCredentials,
        ...identityFields,
      });

      if (status !== 200 || !data) {
        setError(failForStatus(status));
        return;
      }
      if (!data.found) {
        setError(t.notFound);
        return;
      }
      if (data.method === 'none' || !data.method) {
        setStep('see-staff');
        return;
      }
      setMethod(data.method);
      setMaskedPhone(data.masked_phone ?? '');
      setStep('privacy');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const factorField =
        method === 'sms' ? { code: factor.trim() } : { phone_last4: factor.trim() };
      const { status, data } = await callKiosk<KioskVerifyResponse>({
        action: 'verify',
        ...deviceCredentials,
        ...identityFields,
        ...factorField,
        language,
      });

      if (status === 200 && data?.verified && data.visit_id) {
        setPatientFirstName(data.patient_first_name ?? '');
        setStep('success');
        onCheckInComplete(data.visit_id);
        return;
      }
      if (status === 401 && data?.error === 'Verification failed') {
        setFactor('');
        setError(t.verifyFailed);
        return;
      }
      setError(failForStatus(status));
    } finally {
      setLoading(false);
    }
  };

  const NotificationBanner = () => {
    if (!notification) return null;
    const bgColor = {
      info: 'bg-blue-100 border-blue-500',
      warning: 'bg-yellow-100 border-yellow-500',
      error: 'bg-red-100 border-red-500',
    }[notification.type];
    return (
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 ${bgColor} border-4 px-8 py-6 rounded-2xl shadow-2xl z-50 max-w-2xl`}>
        <p className="text-2xl font-bold text-gray-800">{notification.message}</p>
      </div>
    );
  };

  const Shell: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-green-50 flex items-center justify-center p-8">
      <NotificationBanner />
      <div className={`bg-white rounded-3xl shadow-2xl p-12 ${wide ? 'max-w-3xl' : 'max-w-2xl'} w-full`}>
        {children}
      </div>
    </div>
  );

  const ErrorBox = () =>
    error ? (
      <div role="alert" className="bg-red-100 border-4 border-red-400 text-red-700 px-6 py-4 rounded-xl text-xl">
        {error}
      </div>
    ) : null;

  // ── Staff provisioning (device not yet configured) ─────────────────────
  if (step === 'setup') {
    return (
      <Shell>
        <h1 className="text-4xl font-bold text-gray-800 mb-4 text-center">Kiosk Setup</h1>
        <p className="text-xl text-gray-600 mb-8 text-center">
          Staff only: enter this kiosk’s ID and device token to activate check-in.
        </p>
        <div className="space-y-6">
          <div>
            <label htmlFor="setupKioskId" className="block text-2xl font-medium text-gray-700 mb-3">
              Kiosk ID
            </label>
            <input
              id="setupKioskId"
              type="text"
              value={setupId}
              onChange={(e) => setSetupId(e.target.value)}
              className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-hidden"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="setupKioskToken" className="block text-2xl font-medium text-gray-700 mb-3">
              Device Token
            </label>
            <input
              id="setupKioskToken"
              type="password"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-hidden"
              autoComplete="off"
            />
          </div>
          <button
            onClick={handleProvision}
            disabled={!setupId.trim() || !setupToken.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-2xl font-bold py-6 px-8 rounded-xl transition-all"
          >
            Activate Kiosk
          </button>
        </div>
      </Shell>
    );
  }

  // ── Language selection ─────────────────────────────────────────────────
  if (step === 'language') {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-800 mb-12">{t.welcome}</h1>
          <p className="text-3xl text-gray-600 mb-12">{t.selectLanguage}</p>
          <div className="space-y-6">
            <button
              onClick={() => { setLanguage('en'); setStep('lookup'); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-3xl font-bold py-8 px-12 rounded-2xl shadow-lg transition-all transform hover:scale-105"
            >
              English
            </button>
            <button
              onClick={() => { setLanguage('es'); setStep('lookup'); }}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-3xl font-bold py-8 px-12 rounded-2xl shadow-lg transition-all transform hover:scale-105"
            >
              Español (Spanish)
            </button>
            <button
              onClick={() => { setLanguage('vi'); setStep('lookup'); }}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-3xl font-bold py-8 px-12 rounded-2xl shadow-lg transition-all transform hover:scale-105"
            >
              Tiếng Việt (Vietnamese)
            </button>
          </div>
          <div className="mt-12 text-gray-500 text-xl">Location: {locationName}</div>
          <button
            onClick={() => setStep('setup')}
            className="mt-6 text-gray-400 text-sm underline"
          >
            Staff Setup
          </button>
        </div>
      </Shell>
    );
  }

  // ── Patient lookup (name + DOB) ────────────────────────────────────────
  if (step === 'lookup') {
    return (
      <Shell wide>
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
              className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-hidden"
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
              className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-hidden"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="dob" className="block text-2xl font-medium text-gray-700 mb-3">
              {t.dateOfBirth}
            </label>
            <input
              id="dob"
              type="text"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="YYYY-MM-DD"
              className="w-full text-2xl px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-hidden"
            />
          </div>
          <ErrorBox />
          <div className="flex gap-4 pt-6">
            <button
              onClick={resetSession}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-2xl font-bold py-6 px-8 rounded-xl transition-all"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleLookup}
              disabled={loading || !firstName.trim() || !lastName.trim() || !dob.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-2xl font-bold py-6 px-8 rounded-xl transition-all"
            >
              {loading ? t.checking : t.findMe}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Privacy consent (before any check-in state is created) ─────────────
  if (step === 'privacy') {
    return (
      <Shell wide>
        <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t.privacy}</h2>
        <div className="bg-blue-50 border-4 border-blue-200 rounded-xl p-8 mb-8">
          <p className="text-2xl text-gray-700 leading-relaxed">{t.privacyText}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={resetSession}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-2xl font-bold py-6 px-8 rounded-xl transition-all"
          >
            {t.cancel}
          </button>
          <button
            onClick={() => setStep('verify')}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold py-6 px-8 rounded-xl transition-all"
          >
            {t.agree}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Identity verification (SMS code or last 4 of phone) ───────────────
  if (step === 'verify') {
    return (
      <Shell wide>
        <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t.verifyTitle}</h2>
        <div className="space-y-6">
          {method === 'sms' ? (
            <p className="text-2xl text-gray-700 text-center">
              {t.codeSentTo} <span className="font-bold">{maskedPhone}</span>
            </p>
          ) : (
            <p className="text-2xl text-gray-700 text-center">{t.phoneLast4Help}</p>
          )}
          <div>
            <label htmlFor="factor" className="block text-2xl font-medium text-gray-700 mb-3">
              {method === 'sms' ? t.enterCode : t.enterPhoneLast4}
            </label>
            <input
              id="factor"
              type="text"
              inputMode="numeric"
              value={factor}
              onChange={(e) => setFactor(e.target.value.replace(/\D/g, '').slice(0, method === 'sms' ? 8 : 4))}
              className="w-full text-3xl tracking-widest text-center px-6 py-4 border-4 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-hidden"
              autoComplete="one-time-code"
            />
          </div>
          <ErrorBox />
          <div className="flex gap-4 pt-6">
            <button
              onClick={resetSession}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-2xl font-bold py-6 px-8 rounded-xl transition-all"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleVerify}
              disabled={loading || factor.length < 4}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-2xl font-bold py-6 px-8 rounded-xl transition-all"
            >
              {loading ? t.checking : t.checkIn}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Found, but no unattended verification path ─────────────────────────
  if (step === 'see-staff') {
    return (
      <Shell>
        <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t.seeStaffTitle}</h2>
        <p className="text-2xl text-gray-700 text-center mb-12">{t.seeStaffText}</p>
        <button
          onClick={resetSession}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold py-6 px-8 rounded-xl transition-all"
        >
          {t.startOver}
        </button>
      </Shell>
    );
  }

  // ── Checked in ─────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="text-center">
        <h2 className="text-5xl font-bold text-green-700 mb-8">
          {t.successTitle}
        </h2>
        {patientFirstName && (
          <p className="text-3xl text-gray-800 mb-6 font-bold">{patientFirstName}</p>
        )}
        <p className="text-2xl text-gray-700 mb-12">{t.successText}</p>
        <button
          onClick={resetSession}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold py-6 px-8 rounded-xl transition-all"
        >
          {t.startOver}
        </button>
      </div>
    </Shell>
  );
};

export default KioskCheckIn;
