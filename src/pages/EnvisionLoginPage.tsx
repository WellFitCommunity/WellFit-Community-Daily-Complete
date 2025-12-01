/**
 * Envision Login Page - Secret Entry Point
 *
 * Private login for Envision VirtualEdge Group super administrators
 * Route: /envision (not publicly linked)
 *
 * Access: Only Envision staff know this URL exists
 * Two-step authentication: Email + Password (step 1), then PIN (step 2)
 * Supports standalone auth (partners, IT, monitors without Supabase accounts)
 * Redirects to Master Panel (/super-admin) with vault animation
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, KeyRound, Phone, Smartphone, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';
import { hashPinForTransmission, hashPasswordForTransmission } from '../services/pinHashingService';

type AuthStep = 'credentials' | 'pin' | 'totp' | 'backup-code' | 'totp-setup' | 'forgot' | 'verify' | 'reset';

interface EnvisionSession {
  sessionToken: string;
  expiresAt: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    permissions: string[];
  };
}

export const EnvisionLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { supabase, user } = useAuth();

  // Auth flow state
  const [step, setStep] = useState<AuthStep>('credentials');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // TOTP state
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{
    secret: string;
    uri: string;
    backupCodes: string[];
  } | null>(null);

  // Reset flow state
  const [resetType, setResetType] = useState<'password' | 'pin'>('password');
  const [smsCode, setSmsCode] = useState('');
  const [newCredential, setNewCredential] = useState('');
  const [confirmCredential, setConfirmCredential] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Check for existing Envision session in localStorage
  useEffect(() => {
    const checkExistingSession = async () => {
      const stored = localStorage.getItem('envision_session');
      if (stored) {
        try {
          const session: EnvisionSession = JSON.parse(stored);
          if (new Date(session.expiresAt) > new Date()) {
            // Valid session exists, redirect to Master Panel
            navigate('/super-admin');
            return;
          } else {
            // Session expired, clear it
            localStorage.removeItem('envision_session');
          }
        } catch {
          localStorage.removeItem('envision_session');
        }
      }

      // Also check if logged in via Supabase (legacy/hybrid users)
      if (user) {
        const { data: superAdmin } = await supabase
          .from('super_admin_users')
          .select('id, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (superAdmin) {
          navigate('/super-admin');
        }
      }
    };

    checkExistingSession();
  }, [user, navigate, supabase]);

  // Step 1: Verify email + password
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // Hash password client-side before transmission
      const hashedPassword = await hashPasswordForTransmission(password);

      const { data, error: fnError } = await supabase.functions.invoke('envision-login', {
        body: { email: email.trim(), password: hashedPassword }
      });

      if (fnError) {
        const errMsg = fnError.message || 'Login failed';
        setError(errMsg);
        return;
      }

      if (data?.error) {
        setError(data.error);
        if (data.warning) setWarning(data.warning);
        if (data.use_supabase_auth) {
          setError('This account uses standard authentication. Please contact your administrator.');
        }
        return;
      }

      if (data?.session_token) {
        setSessionToken(data.session_token);
        setSessionExpiry(data.expires_at);
        setPassword(''); // Clear password from memory

        // Determine which 2FA step to show
        if (data.totp_enabled) {
          // User has TOTP enabled - show authenticator code input
          setTotpEnabled(true);
          setSuccessMsg('Password verified. Please enter your authenticator code.');
          setStep('totp');
        } else if (data.requires_2fa_setup) {
          // User needs to set up 2FA
          setSuccessMsg('Password verified. Please set up two-factor authentication.');
          setStep('totp-setup');
          // Auto-initiate TOTP setup
          handleInitiateTotpSetup(data.session_token);
        } else if (data.requires_pin || data.pin_configured) {
          // Legacy PIN flow
          setSuccessMsg('Password verified. Please enter your PIN.');
          setStep('pin');
        }
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Login failed';
      await auditLogger.error('ENVISION_LOGIN_ERROR', err as Error, { email: email.trim() });
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Initiate TOTP setup
  const handleInitiateTotpSetup = async (token: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('envision-totp-setup', {
        body: { session_token: token }
      });

      if (fnError || data?.error) {
        setError(data?.error || fnError?.message || 'Failed to initiate TOTP setup');
        return;
      }

      if (data?.success) {
        setTotpSetupData({
          secret: data.secret,
          uri: data.totp_uri,
          backupCodes: data.backup_codes
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'TOTP setup failed';
      setError(errMsg);
    }
  };

  // Verify TOTP code during login
  const handleTotpVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setLoading(true);

    if (!sessionToken) {
      setError('Session expired. Please start over.');
      setStep('credentials');
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('envision-totp-verify', {
        body: { session_token: sessionToken, code: totpCode }
      });

      if (fnError) {
        setError(fnError.message || 'TOTP verification failed');
        return;
      }

      if (data?.error) {
        setError(data.error);
        if (data.remaining_attempts !== undefined) {
          setWarning(`${data.remaining_attempts} attempts remaining`);
        }
        return;
      }

      if (data?.success && data?.session_token && data?.user) {
        // Full 2FA complete! Store session and redirect
        const session: EnvisionSession = {
          sessionToken: data.session_token,
          expiresAt: data.expires_at,
          user: data.user
        };
        localStorage.setItem('envision_session', JSON.stringify(session));

        await auditLogger.info('ENVISION_LOGIN_SUCCESS', {
          superAdminId: data.user.id,
          role: data.user.role,
          method: 'totp'
        });

        navigate('/super-admin');
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'TOTP verification failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Use backup code
  const handleBackupCodeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setLoading(true);

    if (!sessionToken) {
      setError('Session expired. Please start over.');
      setStep('credentials');
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('envision-totp-use-backup', {
        body: { session_token: sessionToken, backup_code: backupCode }
      });

      if (fnError) {
        setError(fnError.message || 'Backup code verification failed');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.success && data?.session_token && data?.user) {
        // Store session and redirect
        const session: EnvisionSession = {
          sessionToken: data.session_token,
          expiresAt: data.expires_at,
          user: data.user
        };
        localStorage.setItem('envision_session', JSON.stringify(session));

        if (data.warning) {
          // Show warning about low backup codes but still redirect
          await auditLogger.warn('ENVISION_LOW_BACKUP_CODES', {
            superAdminId: data.user.id,
            remainingCodes: data.remaining_backup_codes
          });
        }

        await auditLogger.info('ENVISION_LOGIN_SUCCESS', {
          superAdminId: data.user.id,
          role: data.user.role,
          method: 'backup_code'
        });

        navigate('/super-admin');
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Backup code verification failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Complete TOTP setup with first code
  const handleTotpSetupVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!sessionToken) {
      setError('Session expired. Please start over.');
      setStep('credentials');
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('envision-totp-verify-setup', {
        body: { session_token: sessionToken, code: totpCode }
      });

      if (fnError) {
        setError(fnError.message || 'TOTP setup verification failed');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.success) {
        // Update backup codes with fresh ones from setup completion
        if (data.backup_codes) {
          setTotpSetupData(prev => prev ? { ...prev, backupCodes: data.backup_codes } : null);
        }
        setSuccessMsg('TOTP enabled! Save your backup codes, then continue to login.');
        setTotpEnabled(true);
        // Show the TOTP verification step now that setup is complete
        setStep('totp');
        setTotpCode(''); // Clear for next entry
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'TOTP setup failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify PIN
  const handlePinVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setLoading(true);

    if (!sessionToken) {
      setError('Session expired. Please start over.');
      setStep('credentials');
      return;
    }

    try {
      // Hash PIN client-side
      const hashedPin = await hashPinForTransmission(pin);

      const { data, error: fnError } = await supabase.functions.invoke('envision-verify-pin', {
        body: { session_token: sessionToken, pin: hashedPin }
      });

      if (fnError) {
        setError(fnError.message || 'PIN verification failed');
        return;
      }

      if (data?.error) {
        setError(data.error);
        if (data.warning) setWarning(data.warning);
        if (data.requires_pin_setup) {
          setError('PIN not configured. Please contact your administrator to set up your PIN.');
        }
        return;
      }

      if (data?.success && data?.session_token && data?.user) {
        // Full 2FA complete! Store session and redirect
        const session: EnvisionSession = {
          sessionToken: data.session_token,
          expiresAt: data.expires_at,
          user: data.user
        };
        localStorage.setItem('envision_session', JSON.stringify(session));

        await auditLogger.info('ENVISION_LOGIN_SUCCESS', {
          superAdminId: data.user.id,
          role: data.user.role
        });

        navigate('/super-admin');
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'PIN verification failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Request password/PIN reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('envision-request-reset', {
        body: { email: email.trim(), reset_type: resetType }
      });

      if (fnError) {
        // Still show success to prevent enumeration
        setSuccessMsg('If this email is registered, a verification code has been sent.');
        setStep('verify');
        return;
      }

      setSuccessMsg(data?.message || 'Verification code sent. Check your phone.');
      setStep('verify');

    } catch (err: unknown) {
      // Still show success to prevent enumeration
      setSuccessMsg('If this email is registered, a verification code has been sent.');
      setStep('verify');
    } finally {
      setLoading(false);
    }
  };

  // Verify SMS code and set new credential
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validate matching credentials
    if (newCredential !== confirmCredential) {
      setError(`${resetType === 'password' ? 'Passwords' : 'PINs'} do not match`);
      return;
    }

    // Validate format
    if (resetType === 'pin' && !/^\d{4,8}$/.test(newCredential)) {
      setError('PIN must be 4-8 digits');
      return;
    }
    if (resetType === 'password' && newCredential.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // Hash the new credential based on type (password uses different hash domain)
      const hashedCredential = resetType === 'password'
        ? await hashPasswordForTransmission(newCredential)
        : await hashPinForTransmission(newCredential);

      const { data, error: fnError } = await supabase.functions.invoke('envision-complete-reset', {
        body: {
          email: email.trim(),
          code: smsCode,
          reset_type: resetType,
          new_credential: hashedCredential
        }
      });

      if (fnError) {
        setError(fnError.message || 'Reset failed');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      // Success! Clear reset state and return to login
      setSuccessMsg(data?.message || `${resetType === 'password' ? 'Password' : 'PIN'} reset successfully! You can now log in.`);
      setSmsCode('');
      setNewCredential('');
      setConfirmCredential('');
      setStep('credentials');

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Reset failed';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Go back to credentials step
  const goBack = () => {
    setStep('credentials');
    setSessionToken(null);
    setSessionExpiry(null);
    setError(null);
    setWarning(null);
    setSuccessMsg(null);
    setPin('');
    setTotpCode('');
    setBackupCode('');
    setTotpSetupData(null);
    setSmsCode('');
    setNewCredential('');
    setConfirmCredential('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/10 rounded-full mb-4 border-2 border-blue-500/30">
            <Shield className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Envision Portal</h1>
          <p className="text-blue-300 text-sm">
            {step === 'credentials' && 'Authorized Personnel Only'}
            {step === 'pin' && 'Step 2: PIN Verification'}
            {step === 'totp' && 'Step 2: Authenticator Code'}
            {step === 'backup-code' && 'Step 2: Backup Code'}
            {step === 'totp-setup' && 'Set Up Two-Factor Authentication'}
            {step === 'forgot' && 'Reset Your Credentials'}
            {step === 'verify' && 'Enter Verification Code'}
            {step === 'reset' && `Set New ${resetType === 'password' ? 'Password' : 'PIN'}`}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">

          {/* Step 1: Email + Password */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="you@envisionvirtualedge.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-blue-100 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 pr-12"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-blue-100 focus:outline-none disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
              {warning && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-200">{warning}</p>
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-200">{successMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Continue
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResetType('password');
                    setStep('forgot');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 underline"
                >
                  Forgot Password or PIN?
                </button>
              </div>
            </form>
          )}

          {/* Step 2: PIN Verification */}
          {step === 'pin' && (
            <form onSubmit={handlePinVerification} className="space-y-6">
              <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-200">
                  Password verified. Enter your PIN to complete login.
                </p>
                {sessionExpiry && (
                  <p className="text-xs text-blue-300/70 mt-1">
                    Session expires: {new Date(sessionExpiry).toLocaleTimeString()}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-blue-100 mb-2">
                  PIN
                </label>
                <div className="relative">
                  <input
                    id="pin"
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                    required
                    autoComplete="one-time-code"
                    disabled={loading}
                    inputMode="numeric"
                    pattern="\d{4,8}"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 pr-12 text-center text-xl tracking-widest font-mono"
                    placeholder="••••"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-blue-100 focus:outline-none disabled:opacity-50"
                  >
                    {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-blue-300/70 mt-1">4-8 digit PIN</p>
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
              {warning && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-200">{warning}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !pin || pin.length < 4}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    Access Master Panel
                  </>
                )}
              </button>

              <div className="flex justify-between text-center">
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetType('pin');
                    setStep('forgot');
                    setError(null);
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 underline"
                >
                  Forgot PIN?
                </button>
              </div>
            </form>
          )}

          {/* Step 2: TOTP Verification */}
          {step === 'totp' && (
            <form onSubmit={handleTotpVerification} className="space-y-6">
              <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                  <p className="text-sm text-blue-200 font-medium">
                    Enter Authenticator Code
                  </p>
                </div>
                <p className="text-xs text-blue-300/70">
                  Open your authenticator app and enter the 6-digit code
                </p>
                {sessionExpiry && (
                  <p className="text-xs text-blue-300/50 mt-1">
                    Session expires: {new Date(sessionExpiry).toLocaleTimeString()}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="totp-code" className="block text-sm font-medium text-blue-100 mb-2">
                  6-Digit Code
                </label>
                <input
                  id="totp-code"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  required
                  autoComplete="one-time-code"
                  disabled={loading}
                  inputMode="numeric"
                  pattern="\d{6}"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
              {warning && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-200">{warning}</p>
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-200">{successMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-5 h-5" />
                    Verify Code
                  </>
                )}
              </button>

              <div className="flex justify-between text-center">
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('backup-code');
                    setError(null);
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 underline flex items-center gap-1"
                >
                  <Key className="w-4 h-4" />
                  Use Backup Code
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Backup Code */}
          {step === 'backup-code' && (
            <form onSubmit={handleBackupCodeVerification} className="space-y-6">
              <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-5 h-5 text-yellow-400" />
                  <p className="text-sm text-yellow-200 font-medium">
                    Emergency Backup Code
                  </p>
                </div>
                <p className="text-xs text-yellow-300/70">
                  Enter one of your 8-character backup codes (format: XXXX-XXXX)
                </p>
              </div>

              <div>
                <label htmlFor="backup-code" className="block text-sm font-medium text-blue-100 mb-2">
                  Backup Code
                </label>
                <input
                  id="backup-code"
                  type="text"
                  value={backupCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                    // Auto-format: insert dash after 4 chars
                    if (val.length === 4 && !val.includes('-')) {
                      setBackupCode(val + '-');
                    } else {
                      setBackupCode(val.slice(0, 9)); // Max length: XXXX-XXXX
                    }
                  }}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-center text-xl tracking-widest font-mono uppercase"
                  placeholder="XXXX-XXXX"
                  autoFocus
                />
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || backupCode.replace(/-/g, '').length !== 8}
                className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Key className="w-5 h-5" />
                    Use Backup Code
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('totp');
                    setError(null);
                    setBackupCode('');
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Authenticator
                </button>
              </div>
            </form>
          )}

          {/* TOTP Setup Flow */}
          {step === 'totp-setup' && (
            <div className="space-y-6">
              <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-green-200 font-medium">
                    Set Up Authenticator App
                  </p>
                </div>
                <p className="text-xs text-green-300/70">
                  Scan the QR code with Google Authenticator, Authy, or similar app
                </p>
              </div>

              {totpSetupData ? (
                <>
                  {/* QR Code placeholder - would need QR library */}
                  <div className="bg-white p-4 rounded-lg text-center">
                    <div className="text-sm text-gray-600 mb-2">
                      Scan this QR code with your authenticator app:
                    </div>
                    <div className="font-mono text-xs break-all text-gray-800 p-2 bg-gray-100 rounded">
                      {totpSetupData.uri}
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      Or enter this secret manually:
                    </div>
                    <div className="font-mono text-lg tracking-widest text-gray-800 p-2 bg-gray-100 rounded mt-1">
                      {totpSetupData.secret}
                    </div>
                  </div>

                  {/* Backup Codes */}
                  <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-200 font-medium mb-2">
                      Save Your Backup Codes!
                    </p>
                    <p className="text-xs text-yellow-300/70 mb-3">
                      These codes can be used if you lose access to your authenticator. Each code works once.
                    </p>
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                      {totpSetupData.backupCodes.map((code, i) => (
                        <div key={i} className="bg-yellow-500/10 px-2 py-1 rounded text-yellow-200 text-center">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Verify first code */}
                  <form onSubmit={handleTotpSetupVerification} className="space-y-4">
                    <div>
                      <label htmlFor="setup-code" className="block text-sm font-medium text-blue-100 mb-2">
                        Enter code from your app to verify setup:
                      </label>
                      <input
                        id="setup-code"
                        type="text"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                        required
                        inputMode="numeric"
                        pattern="\d{6}"
                        disabled={loading}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-center text-2xl tracking-[0.5em] font-mono"
                        placeholder="000000"
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
                      disabled={loading || totpCode.length !== 6}
                      className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Complete Setup
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-blue-300">Generating TOTP secret...</p>
                </div>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cancel Setup
                </button>
              </div>
            </div>
          )}

          {/* Forgot Password/PIN - Request Reset */}
          {step === 'forgot' && (
            <form onSubmit={handleRequestReset} className="space-y-6">
              <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-200">
                  Enter your email address. We'll send a verification code to your registered phone number.
                </p>
              </div>

              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-blue-100 mb-2">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="you@envisionvirtualedge.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-100 mb-2">
                  What do you need to reset?
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setResetType('password')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      resetType === 'password'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/10 border-white/20 text-blue-300 hover:bg-white/20'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetType('pin')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      resetType === 'pin'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/10 border-white/20 text-blue-300 hover:bg-white/20'
                    }`}
                  >
                    PIN
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5" />
                    Send Verification Code
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-blue-300 hover:text-blue-100 flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {/* Verify SMS Code + Set New Credential */}
          {step === 'verify' && (
            <form onSubmit={handleCompleteReset} className="space-y-6">
              <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-200">
                  Enter the verification code sent to your phone, then set your new {resetType}.
                </p>
              </div>

              <div>
                <label htmlFor="sms-code" className="block text-sm font-medium text-blue-100 mb-2">
                  Verification Code
                </label>
                <input
                  id="sms-code"
                  type="text"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                  required
                  inputMode="numeric"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-center text-xl tracking-widest font-mono"
                  placeholder="Enter code"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="new-credential" className="block text-sm font-medium text-blue-100 mb-2">
                  New {resetType === 'password' ? 'Password' : 'PIN'}
                </label>
                <input
                  id="new-credential"
                  type={resetType === 'pin' ? 'text' : 'password'}
                  value={newCredential}
                  onChange={(e) => setNewCredential(
                    resetType === 'pin'
                      ? e.target.value.replace(/[^\d]/g, '').slice(0, 8)
                      : e.target.value
                  )}
                  required
                  inputMode={resetType === 'pin' ? 'numeric' : 'text'}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder={resetType === 'pin' ? 'New PIN (4-8 digits)' : 'New password (8+ characters)'}
                />
              </div>

              <div>
                <label htmlFor="confirm-credential" className="block text-sm font-medium text-blue-100 mb-2">
                  Confirm {resetType === 'password' ? 'Password' : 'PIN'}
                </label>
                <input
                  id="confirm-credential"
                  type={resetType === 'pin' ? 'text' : 'password'}
                  value={confirmCredential}
                  onChange={(e) => setConfirmCredential(
                    resetType === 'pin'
                      ? e.target.value.replace(/[^\d]/g, '').slice(0, 8)
                      : e.target.value
                  )}
                  required
                  inputMode={resetType === 'pin' ? 'numeric' : 'text'}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder={`Confirm ${resetType === 'pin' ? 'PIN' : 'password'}`}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-200">{successMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !smsCode || !newCredential || !confirmCredential}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Reset {resetType === 'password' ? 'Password' : 'PIN'}
                  </>
                )}
              </button>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep('forgot');
                    setSmsCode('');
                    setNewCredential('');
                    setConfirmCredential('');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-sm text-blue-300 hover:text-blue-100 underline"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-blue-300 hover:text-blue-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-blue-300/60 text-center">
              All access attempts are logged and monitored for security purposes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-blue-400/60">
            Envision VirtualEdge Group LLC
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnvisionLoginPage;
