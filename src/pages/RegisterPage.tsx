// src/pages/RegisterPage.tsx — INVISIBLE hCaptcha (ready to paste)
import React, { useState, useRef, useCallback, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';
import HCaptchaWidget, { HCaptchaRef } from '../components/HCaptchaWidget';

type FormState = {
  phone: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  email: string;
};

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const hcaptchaRef = useRef<HCaptchaRef>(null);

  const [formData, setFormData] = useState<FormState>({
    phone: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    email: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hcaptchaToken, setHcaptchaToken] = useState<string>('');

  // We'll resolve this when onVerify fires (works whether a challenge pops or not)
  const tokenResolverRef = useRef<((t: string) => void) | null>(null);

  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return phone.startsWith('+') ? phone : (digits ? `+${digits}` : '');
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';

    const normalizedPhone = normalizePhone(formData.phone);
    if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
      return 'Please enter a valid phone number (e.g., 555-555-5555 or +15555555555)';
    }

    if (!formData.password) return 'Password is required';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    if (formData.password.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(formData.password)) {
      return 'Password must contain uppercase, lowercase, number, and special character';
    }
    return null;
  };

  // Ask hCaptcha for a token in invisible mode. If it needs a challenge, it will show it.
  const ensureCaptchaToken = useCallback(async (): Promise<string> => {
    // Already have a token from a previous verify
    if (hcaptchaToken) return hcaptchaToken;

    // Prepare to wait for onVerify
    const tokenPromise = new Promise<string>((resolve, reject) => {
      tokenResolverRef.current = resolve;
      // Safety timeout (15s); if hCaptcha never responds, we fail gracefully
      const timer = setTimeout(() => {
        tokenResolverRef.current = null;
        reject(new Error('Security check timed out. Please try again.'));
      }, 15000);
      // Wrap resolve to clear timeout
      const originalResolve = resolve;
      tokenResolverRef.current = (t: string) => {
        clearTimeout(timer);
        originalResolve(t);
      };
    });

    // Trigger the invisible challenge
    try {
      await hcaptchaRef.current?.execute?.();
    } catch {
      // If execute() is unavailable, surface a clear error
      throw new Error('Security check failed to start. Please refresh and try again.');
    }

    // Wait for onVerify to provide the token
    const token = await tokenPromise;
    return token;
  }, [hcaptchaToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      // Always acquire/refresh token in invisible mode at submit time
      const token = await ensureCaptchaToken();

      const normalizedPhone = normalizePhone(formData.phone);
      const { error: regError } = await supabase.functions.invoke('register', {
        body: {
          phone: normalizedPhone,
          password: formData.password,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email?.trim() || undefined,
          hcaptcha_token: token,
        },
      });

      if (regError) {
        throw new Error(regError.message || 'Registration failed');
      }

      navigate('/verify', { state: { phone: normalizedPhone }, replace: true });
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ||
        'Registration failed. Please try again.';
      setError(message);

      // Reset captcha to allow a clean retry
      try { hcaptchaRef.current?.reset?.(); } catch {}
      setHcaptchaToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData((s) => ({ ...s, firstName: e.target.value }))}
            className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            required
            aria-label="First Name"
            autoComplete="given-name"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData((s) => ({ ...s, lastName: e.target.value }))}
            className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Last Name"
            autoComplete="family-name"
          />
        </div>

        <input
          type="tel"
          placeholder="Phone Number"
          value={formData.phone}
          onChange={(e) => setFormData((s) => ({ ...s, phone: e.target.value }))}
          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          required
          aria-label="Phone Number"
          autoComplete="tel"
          inputMode="tel"
        />

        <input
          type="email"
          placeholder="Email (Optional)"
          value={formData.email}
          onChange={(e) => setFormData((s) => ({ ...s, email: e.target.value }))}
          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          aria-label="Email (Optional)"
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => setFormData((s) => ({ ...s, password: e.target.value }))}
          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          required
          aria-label="Password"
          autoComplete="new-password"
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData((s) => ({ ...s, confirmPassword: e.target.value }))}
          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          required
          aria-label="Confirm Password"
          autoComplete="new-password"
        />

        {/* Invisible hCaptcha (no checkbox). It will run on submit via execute(). */}
        <HCaptchaWidget
          ref={hcaptchaRef}
          onVerify={(t: string) => {
            setHcaptchaToken(t);
            // If someone is awaiting the token, resolve it
            tokenResolverRef.current?.(t);
            tokenResolverRef.current = null;
            setError('');
          }}
          onError={() => {
            setHcaptchaToken('');
            tokenResolverRef.current = null;
            setError('Security check failed. Please try again.');
          }}
          onExpire={() => {
            setHcaptchaToken('');
            tokenResolverRef.current = null;
          }}
          size="invisible"
          theme="light"
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded" role="alert">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
};

export default RegisterPage;
