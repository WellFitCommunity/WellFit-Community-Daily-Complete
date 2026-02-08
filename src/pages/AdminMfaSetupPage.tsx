/**
 * Admin MFA Setup Page
 *
 * TOTP enrollment page for WellFit admin and clinical users.
 * Uses Supabase JWT auth (not envision session tokens).
 * Follows same UX pattern as EnvisionTotpSetupPage.
 *
 * Route: /admin-mfa-setup
 * Auth: Requires authenticated Supabase session
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Shield,
  Smartphone,
  Key,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';
import { updateMfaEnabled } from '../services/mfaEnrollmentService';

type SetupStep = 'loading' | 'scan' | 'confirm' | 'backup' | 'done' | 'error';

export const AdminMfaSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, supabase } = useAuth();

  const [step, setStep] = useState<SetupStep>('loading');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [backupsSaved, setBackupsSaved] = useState(false);

  const beginCalled = useRef(false);

  // Begin TOTP setup on mount
  useEffect(() => {
    if (!user || beginCalled.current) return;
    beginCalled.current = true;

    const begin = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          setError('Session expired. Please log in again.');
          setStep('error');
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          'admin-totp-setup',
          {
            body: { action: 'begin' },
          }
        );

        if (fnError) {
          setError(fnError.message || 'Failed to start setup');
          setStep('error');
          return;
        }

        if (data?.already_configured) {
          await auditLogger.info('ADMIN_MFA_ALREADY_CONFIGURED', {
            userId: user.id,
          });
          navigate('/admin/system', { replace: true });
          return;
        }

        if (data?.error) {
          setError(data.error);
          setStep('error');
          return;
        }

        const uri = data?.otpauth_uri || data?.otpauthUri || '';
        const sec = data?.secret || '';

        setSecret(sec);
        setStep('scan');

        // Generate QR code
        if (uri) {
          const url = await QRCode.toDataURL(uri, {
            width: 256,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          });
          setQrDataUrl(url);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStep('error');
      }
    };

    begin();
  }, [user, supabase, navigate]);

  // Confirm TOTP code
  const handleConfirm = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (code.length !== 6 || loading) return;

      setError(null);
      setLoading(true);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'admin-totp-setup',
          {
            body: { action: 'confirm', code },
          }
        );

        if (fnError) {
          setError(fnError.message || 'Verification failed');
          setLoading(false);
          return;
        }

        if (data?.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        if (data?.success) {
          const codes = (data.backup_codes || []) as string[];
          setBackupCodes(codes);

          // Update local enrollment status
          if (user) {
            await updateMfaEnabled(user.id, true, 'totp');
          }

          await auditLogger.info('ADMIN_MFA_SETUP_COMPLETE', {
            userId: user?.id,
            backupCodesGenerated: codes.length,
          });

          setStep('backup');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [code, loading, supabase, user]
  );

  const copySecret = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  }, [secret]);

  const copyBackupCodes = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [backupCodes]);

  const handleDone = useCallback(() => {
    navigate('/admin/system', { replace: true });
  }, [navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Please log in to set up MFA.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4 border-2 border-blue-300">
            <Shield className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Set Up Authenticator
          </h1>
          <p className="text-gray-600 text-base">
            Two-factor authentication is required for your role.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {/* Loading */}
          {step === 'loading' && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-blue-300/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Preparing authenticator setup...</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin-login', { replace: true })}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Login
              </button>
            </div>
          )}

          {/* Step 1: Scan QR Code */}
          {step === 'scan' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-800 font-medium">
                    Step 1: Scan QR Code
                  </p>
                </div>
                <p className="text-sm text-blue-700">
                  Open Google Authenticator, Authy, or a similar app and scan this code.
                </p>
              </div>

              {/* QR Code */}
              {qrDataUrl && (
                <div className="flex justify-center">
                  <img
                    src={qrDataUrl}
                    alt="QR code for authenticator app"
                    className="w-64 h-64 rounded-lg border border-gray-200"
                  />
                </div>
              )}

              {/* Manual secret */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">
                  Or enter this secret manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-gray-200 break-all">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="p-2 text-gray-500 hover:text-blue-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Copy secret"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('confirm');
                  setError(null);
                }}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors min-h-[44px] text-base"
              >
                I&apos;ve scanned the QR code
              </button>
            </div>
          )}

          {/* Step 2: Confirm Code */}
          {step === 'confirm' && (
            <form onSubmit={handleConfirm} className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-800 font-medium">
                    Step 2: Enter Verification Code
                  </p>
                </div>
                <p className="text-sm text-blue-700">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <div>
                <label
                  htmlFor="totp-code"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  6-Digit Code
                </label>
                <input
                  id="totp-code"
                  type="text"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))
                  }
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px] text-base"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Verify & Enable
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('scan');
                  setError(null);
                  setCode('');
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to QR Code
              </button>
            </form>
          )}

          {/* Step 3: Backup Codes */}
          {step === 'backup' && (
            <div className="space-y-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">
                    Authenticator Enabled!
                  </p>
                </div>
                <p className="text-sm text-green-700">
                  Save your backup codes below. Each code can be used once if you
                  lose access to your authenticator.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-yellow-800 font-medium flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Backup Codes
                  </p>
                  <button
                    type="button"
                    onClick={copyBackupCodes}
                    className="text-sm text-yellow-700 hover:text-yellow-900 flex items-center gap-1 min-h-[44px] px-2"
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copy
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((bc, i) => (
                    <div
                      key={i}
                      className="bg-white px-3 py-2 rounded border border-yellow-200 text-center text-gray-800"
                    >
                      {bc}
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupsSaved}
                  onChange={(e) => setBackupsSaved(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  I have saved my backup codes in a secure location
                </span>
              </label>

              <button
                type="button"
                onClick={handleDone}
                disabled={!backupsSaved}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 min-h-[44px] text-base"
              >
                Continue to Admin Panel
              </button>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Setup Complete
              </p>
              <p className="text-gray-600 mb-6">Redirecting to admin panel...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Two-factor authentication protects your account from unauthorized access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminMfaSetupPage;
