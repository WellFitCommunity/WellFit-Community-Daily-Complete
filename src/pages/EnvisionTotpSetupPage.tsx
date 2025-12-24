/**
 * Envision TOTP Setup Page
 *
 * Dedicated page for setting up two-factor authentication via authenticator app.
 * Displays QR code for scanning, allows manual secret entry, and confirms first code.
 *
 * Route: /envision-2fa-setup
 * Requires: Valid session_token from password verification (passed via navigation state)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Shield, Smartphone, Key, Copy, Check, AlertCircle, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

interface LocationState {
  session_token?: string;
}

export const EnvisionTotpSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { supabase } = useAuth();

  // Get session token from navigation state or localStorage
  const state = (location.state || {}) as LocationState;
  const sessionToken = state.session_token || localStorage.getItem('envision_session_token') || '';

  // IMPORTANT: dev-safe guard to prevent React StrictMode double-effect from generating 2 secrets
  const beginOnceRef = useRef(false);

  // Setup state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // TOTP data from Edge Function
  const [otpauthUri, setOtpauthUri] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Form state - store digits only
  const [code, setCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackups, setCopiedBackups] = useState(false);
  const [savedBackupCodes, setSavedBackupCodes] = useState(false);

  // Code is digits-only; enable submit at 6 digits
  const canSubmit = useMemo(() => code.length === 6, [code]);

  // Begin TOTP setup on mount
  useEffect(() => {
    let cancelled = false;

    const beginSetup = async () => {
      try {
        setError('');

        if (!sessionToken || sessionToken.trim().length < 10) {
          setLoading(false);
          setError('Missing or invalid session token. Please log in again.');
          return;
        }

        // Persist the session token so refreshes don't break the flow
        localStorage.setItem('envision_session_token', sessionToken);

        // If we already have the QR payload, don't re-begin
        if (otpauthUri || qrDataUrl) {
          setLoading(false);
          return;
        }

        // DEV SAFETY: stop double-begin in StrictMode
        if (beginOnceRef.current) {
          setLoading(false);
          return;
        }
        beginOnceRef.current = true;

        const { data, error: fnErr } = await supabase.functions.invoke('envision-totp-setup', {
          body: { action: 'begin', session_token: sessionToken }
        });

        if (cancelled) return;

        if (fnErr) {
          const msg = fnErr.message || 'Failed to start authenticator setup.';
          await auditLogger.warn('ENVISION_TOTP_SETUP_BEGIN_FAILED', { error: msg });
          throw new Error(msg);
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        // If already configured, don't show QR again
        if (data?.already_configured) {
          navigate('/envision', { replace: true });
          return;
        }

        const uri = String(data?.otpauth_uri || '');
        if (!uri.startsWith('otpauth://')) {
          throw new Error('Setup did not return a valid QR payload. Please try again.');
        }

        setOtpauthUri(uri);
        setSecret(String(data?.secret || ''));
        setBackupCodes(Array.isArray(data?.backup_codes) ? data.backup_codes : []);

        const qrUrl = await QRCode.toDataURL(uri, {
          margin: 2,
          width: 256,
          color: { dark: '#000000', light: '#ffffff' }
        });

        if (cancelled) return;
        setQrDataUrl(qrUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to start authenticator setup.';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    beginSetup();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, supabase.functions, otpauthUri, qrDataUrl, navigate]);

  // Copy secret to clipboard
  const handleCopySecret = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch (err: unknown) {
      const textArea = document.createElement('textarea');
      textArea.value = secret;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  }, [secret]);

  // Copy backup codes to clipboard (optional, only if returned)
  const handleCopyBackupCodes = useCallback(async () => {
    try {
      const text = backupCodes.join('\n');
      await navigator.clipboard.writeText(text);
      setCopiedBackups(true);
      setTimeout(() => setCopiedBackups(false), 2000);
    } catch (err: unknown) {
      const textArea = document.createElement('textarea');
      textArea.value = backupCodes.join('\n');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedBackups(true);
      setTimeout(() => setCopiedBackups(false), 2000);
    }
  }, [backupCodes]);

  // Confirm TOTP setup with first code
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('envision-totp-setup', {
        body: { action: 'confirm', session_token: sessionToken, code }
      });

      if (fnErr) {
        const msg = fnErr.message || 'Authenticator confirmation failed.';
        await auditLogger.warn('ENVISION_TOTP_SETUP_CONFIRM_FAILED', { error: msg });
        throw new Error(msg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.success) {
        throw new Error('Authenticator confirmation failed.');
      }

      // Optional backup codes (if server ever returns them)
      if (Array.isArray(data?.backup_codes)) {
        setBackupCodes(data.backup_codes);
      }

      await auditLogger.info('ENVISION_TOTP_SETUP_COMPLETE', {});

      setSuccessMsg('Authenticator setup complete! You can now log in with your authenticator app.');

      // Hard-stop re-begin behavior if user ever returns here
      setOtpauthUri('');
      setQrDataUrl('');

      setTimeout(() => {
        navigate('/super-admin', { replace: true });
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authenticator confirmation failed.';
      setError(msg);
      // If confirm failed, allow retry without forcing a new begin in dev
      beginOnceRef.current = true;
    } finally {
      setSubmitting(false);
    }
  };

  // Go back to login
  const handleBack = () => {
    localStorage.removeItem('envision_session_token');
    localStorage.removeItem('envision_session_expires');
    navigate('/envision', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 133, 122, 0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 133, 122, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00857a]/10 rounded-full mb-3 border-2 border-[#00857a]/30">
            <Shield className="w-8 h-8 text-[#33bfb7]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Set Up Authenticator</h1>
          <p className="text-teal-300 text-sm">Secure your account with two-factor authentication</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-blue-300">Preparing your authenticator setup...</p>
            </div>
          ) : error && !qrDataUrl && !successMsg ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
              <button
                type="button"
                onClick={handleBack}
                className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Login
              </button>
            </div>
          ) : successMsg ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <p className="text-sm text-green-200">{successMsg}</p>
              </div>
              <p className="text-center text-blue-300 text-sm">Redirecting to portal...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                  <p className="text-sm text-blue-200 font-medium">Step 1: Scan QR Code</p>
                </div>
                <p className="text-xs text-blue-300/70">
                  Open Google Authenticator, Microsoft Authenticator, or Authy and scan this code
                </p>
              </div>

              {qrDataUrl && (
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl">
                    <img src={qrDataUrl} alt="Authenticator QR Code" className="w-48 h-48" />
                  </div>
                </div>
              )}

              <details className="group">
                <summary className="cursor-pointer text-sm text-blue-300 hover:text-blue-100 flex items-center gap-2">
                  <span className="group-open:hidden">Can't scan? Show manual setup</span>
                  <span className="hidden group-open:inline">Hide manual setup</span>
                </summary>
                <div className="mt-3 p-4 bg-slate-700/50 rounded-lg space-y-3">
                  <div>
                    <label className="block text-xs text-blue-200 mb-1">Secret Key</label>
                    <div className="flex items-center gap-2">
                      <code
                        className={`flex-1 text-sm bg-slate-800 px-3 py-2 rounded font-mono text-white break-all ${
                          !showSecret ? 'blur-sm select-none' : ''
                        }`}
                      >
                        {secret || '—'}
                      </code>
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="p-2 text-blue-300 hover:text-blue-100"
                        title={showSecret ? 'Hide secret' : 'Show secret'}
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="p-2 text-blue-300 hover:text-blue-100"
                        title="Copy secret"
                        disabled={!secret}
                      >
                        {copiedSecret ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-blue-300/60">
                    Enter this key manually in your authenticator app. Select "Time-based" (TOTP) when prompted.
                  </p>
                </div>
              </details>

              {backupCodes.length > 0 && (
                <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-yellow-400" />
                      <p className="text-sm text-yellow-200 font-medium">Backup Codes</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyBackupCodes}
                      className="text-xs text-yellow-300 hover:text-yellow-100 flex items-center gap-1"
                    >
                      {copiedBackups ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedBackups ? 'Copied!' : 'Copy all'}
                    </button>
                  </div>
                  <p className="text-xs text-yellow-300/70 mb-3">Save these codes securely. Each code can only be used once.</p>
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {backupCodes.map((backupCode, i) => (
                      <div key={i} className="bg-yellow-500/10 px-2 py-1 rounded text-yellow-200 text-center">
                        {backupCode}
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={savedBackupCodes}
                      onChange={(e) => setSavedBackupCodes(e.target.checked)}
                      className="w-4 h-4 rounded border-yellow-500/50 bg-transparent text-yellow-500 focus:ring-yellow-500"
                    />
                    <span className="text-xs text-yellow-200">I have saved my backup codes securely</span>
                  </label>
                </div>
              )}

              <form onSubmit={handleConfirm} className="space-y-4">
                <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="text-sm text-green-200 font-medium">Step 2: Verify Setup</p>
                  </div>
                  <p className="text-xs text-green-300/70">Enter the 6-digit code from your authenticator app to complete setup</p>
                </div>

                <div>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 6);
                      setCode(digits);
                    }}
                    required
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="\d{6}"
                    disabled={submitting}
                    className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 text-center text-3xl tracking-[0.5em] font-mono"
                    placeholder="000000"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || submitting || (backupCodes.length > 0 && !savedBackupCodes)}
                  className="w-full py-3 px-4 bg-[#00857a] hover:bg-[#006d64] text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#00857a] focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Complete Setup
                    </>
                  )}
                </button>

                {backupCodes.length > 0 && !savedBackupCodes && (
                  <p className="text-xs text-yellow-300 text-center">Please confirm you've saved your backup codes before continuing</p>
                )}
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cancel and Return to Login
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-blue-300/60 text-center">
              Two-factor authentication protects your account from unauthorized access.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-blue-400/60">Envision VirtualEdge Group LLC</p>
        </div>
      </div>
    </div>
  );
};

export default EnvisionTotpSetupPage;
