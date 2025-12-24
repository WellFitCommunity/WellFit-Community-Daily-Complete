// src/pages/RegisterPage.tsx
// Public Register: role dropdown (labels only), hCaptcha race guard, +1 hint

import React, { useState, useRef, useCallback, FormEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HCaptchaWidget, { HCaptchaRef } from '../components/HCaptchaWidget';
import { useBranding } from '../BrandingContext';

type FormState = {
  phone: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  email: string;
  roleLabel: string; // labels only (server enforces)
};

// Use the dedicated register URL if available, otherwise construct from Supabase URL
// Correct format: https://yourproject.supabase.co/functions/v1/register
const REGISTER_URL =
  import.meta.env.VITE_SUPABASE_REGISTER_URL ||
  (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL && `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/register`) ||
  `${import.meta.env.VITE_SB_URL || import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/register`;

const PUBLIC_ROLES = [
  'Patient',
  'Senior',
  'Volunteer',
  'Caregiver',
  'Contractor',
  'Regular User',
] as const;

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const hcaptchaRef = useRef<HCaptchaRef>(null);
  const { branding } = useBranding();

  const [formData, setFormData] = useState<FormState>({
    phone: '+1 ',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    email: '',
    roleLabel: 'Patient',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hcaptchaToken, setHcaptchaToken] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // submission race guard
  const submitCounterRef = useRef(0);
  const completedRef = useRef(false);
  const tokenResolverRef = useRef<((t: string) => void) | null>(null);

  // ---------- HELPERS ----------
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return phone.startsWith('+') ? phone : (digits ? `+${digits}` : '');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Remove all non-digits to get clean number
    const digits = value.replace(/[^\d]/g, '');

    // If user tries to delete the +1, prevent it
    if (!value.startsWith('+1')) {
      // If they have digits, format with +1
      if (digits.length > 0) {
        // Take only the part after country code if they typed 1
        const phoneDigits = digits.startsWith('1') && digits.length > 1 ? digits.slice(1) : digits;
        value = `+1 ${phoneDigits}`;
      } else {
        // Keep the +1 prefix
        value = '+1 ';
      }
    } else {
      // Format the existing +1 number nicely
      const phoneDigits = digits.startsWith('1') ? digits.slice(1) : digits;
      if (phoneDigits.length > 0) {
        // Format as +1 XXX-XXX-XXXX
        let formatted = '+1 ';
        if (phoneDigits.length > 0) {
          formatted += phoneDigits.slice(0, 3);
        }
        if (phoneDigits.length > 3) {
          formatted += '-' + phoneDigits.slice(3, 6);
        }
        if (phoneDigits.length > 6) {
          formatted += '-' + phoneDigits.slice(6, 10);
        }
        value = formatted;
      } else {
        value = '+1 ';
      }
    }

    setFormData(s => ({ ...s, phone: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';

    const normalizedPhone = normalizePhone(formData.phone);
    if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
      return 'Please enter a valid phone number (e.g., +15555555555)';
    }

    // Email required for caregivers (for emergency notifications)
    if (formData.roleLabel === 'Caregiver' && !formData.email?.trim()) {
      return 'Email is required for caregivers (needed for emergency notifications)';
    }

    if (!formData.password) return 'Password is required';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    if (formData.password.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(formData.password)) {
      return 'Password must contain uppercase, lowercase, number, and special character';
    }

    if (!agreedToTerms) return 'You must agree to the Terms of Service and Privacy Policy';

    return null;
  };

  // map label → code (server also enforces; client is advisory)
  const roleCode = useMemo(() => {
    switch (formData.roleLabel) {
      case 'Senior': return 4;
      case 'Volunteer': return 5;
      case 'Caregiver': return 6;
      case 'Contractor': return 11;
      case 'Regular User': return 13;
      default: return 4;
    }
  }, [formData.roleLabel]);

  // ---------- hCaptcha (resilient + race-guarded) ----------
  const ensureCaptchaToken = useCallback(async (): Promise<string> => {
    if (hcaptchaToken) return hcaptchaToken;

    const mySubmitId = ++submitCounterRef.current;
    const attemptOnce = (timeoutMs: number) =>
      new Promise<string>((resolve, reject) => {
        // Ignore stale events
        const guardedResolve = (t: string) => {
          if (mySubmitId !== submitCounterRef.current || completedRef.current) return;
          resolve(t);
        };
        const guardedReject = (e: Error) => {
          if (mySubmitId !== submitCounterRef.current || completedRef.current) return;
          reject(e);
        };

        tokenResolverRef.current = (t: string) => {
          guardedResolve(t);
        };

        const timer = setTimeout(() => {
          tokenResolverRef.current = null;
          guardedReject(new Error('Security check timed out. Please try again.'));
        }, timeoutMs);

        const orig = tokenResolverRef.current;
        tokenResolverRef.current = (t: string) => {
          clearTimeout(timer);
          (orig as (t: string) => void)(t);
        };

        try {
          hcaptchaRef.current?.execute?.();
        } catch {
          clearTimeout(timer);
          guardedReject(new Error('Security check failed to start. Please refresh and try again.'));
        }
      });

    try {
      return await attemptOnce(45_000);
    } catch {
      return await attemptOnce(45_000);
    }
  }, [hcaptchaToken]);

  // ---------- SUBMIT ----------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    completedRef.current = false; // new submission starts

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const token = await ensureCaptchaToken();
      const normalizedPhone = normalizePhone(formData.phone);

      const payload = {
        phone: normalizedPhone,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email?.trim() || undefined,
        role_code: roleCode, // advisory; server enforces
        hcaptcha_token: token,
      };

      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || data?.error) {
        // Handle "already registered" case - redirect to login
        if (data?.error === 'already_registered' || res.status === 409) {
          completedRef.current = true;
          navigate('/login', {
            state: {
              message: data?.message || 'An account with this phone number already exists. Please log in.',
              phone: normalizedPhone
            },
            replace: true
          });
          return;
        }
        const msg = data?.details || data?.message || data?.error || `Registration failed (${res.status})`;
        throw new Error(String(msg));
      }

      // success → freeze current submission; ignore late captcha timers
      completedRef.current = true;
      navigate('/verify', { state: { phone: normalizedPhone }, replace: true });
    } catch (err: any) {
      if (!completedRef.current) setError(err?.message || 'Registration failed. Please try again.');
      try { if (!completedRef.current) hcaptchaRef.current?.reset?.(); } catch {}
      if (!completedRef.current) setHcaptchaToken('');
    } finally {
      setLoading(false);
    }
  };

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen py-8 px-4" style={{ background: branding.gradient }}>
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6" style={{ color: branding.primaryColor }}>
          Create Account - {branding.appName}
        </h1>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData((s) => ({ ...s, firstName: e.target.value }))}
            className="p-3 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
            required
            aria-label="First Name"
            autoComplete="given-name"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData((s) => ({ ...s, lastName: e.target.value }))}
            className="p-3 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Last Name"
            autoComplete="family-name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="phone">Phone (US)</label>
          <input
            id="phone"
            type="tel"
            placeholder="+1 555-555-5555"
            value={formData.phone}
            onChange={handlePhoneChange}
            className="w-full p-3 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Phone Number"
            autoComplete="tel"
            inputMode="tel"
          />
          <p className="text-xs text-gray-500 mt-1">Tip: Start with “+1” for US numbers.</p>
        </div>

        <input
          type="email"
          placeholder={formData.roleLabel === 'Caregiver' ? 'Email (Required for emergency notifications)' : 'Email (Optional)'}
          value={formData.email}
          onChange={(e) => setFormData((s) => ({ ...s, email: e.target.value }))}
          className="w-full p-3 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
          aria-label={formData.roleLabel === 'Caregiver' ? 'Email (Required)' : 'Email (Optional)'}
          autoComplete="email"
          required={formData.roleLabel === 'Caregiver'}
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData((s) => ({ ...s, password: e.target.value }))}
            className="w-full p-3 pr-12 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Password"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData((s) => ({ ...s, confirmPassword: e.target.value }))}
            className="w-full p-3 pr-12 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Confirm Password"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="role">Role</label>
          <select
            id="role"
            value={formData.roleLabel}
            onChange={(e) => setFormData((s) => ({ ...s, roleLabel: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
            aria-label="Role"
          >
            {PUBLIC_ROLES.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Admins/moderators are created internally only.</p>
        </div>

        {/* Terms, Privacy & Consent Agreement Section */}
        <div className="space-y-3 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
          <h3 className="font-semibold text-gray-800">Important Agreements</h3>

          {/* View Documents Buttons */}
          <div className="flex gap-2">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-3 text-center text-sm font-medium border-2 border-blue-600 text-blue-600 rounded-sm hover:bg-white transition-colors"
            >
              View Terms
            </a>
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-3 text-center text-sm font-medium border-2 border-blue-600 text-blue-600 rounded-sm hover:bg-white transition-colors"
            >
              View Privacy Policy
            </a>
          </div>

          {/* Agreement Checkbox */}
          <div className="flex items-start gap-3 p-3 bg-white rounded-sm border border-gray-200">
            <input
              type="checkbox"
              id="agreedToTerms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-5 h-5 text-blue-600 border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500"
              aria-describedby="terms-text"
            />
            <label htmlFor="agreedToTerms" id="terms-text" className="text-sm text-gray-700 leading-relaxed">
              <span className="font-medium">I acknowledge and agree to the following:</span>
              <ul className="mt-1 ml-4 list-disc text-gray-600 space-y-1">
                <li>I have read and accept the <strong>Terms of Service</strong></li>
                <li>I have read and accept the <strong>Privacy Policy</strong></li>
                <li>I consent to use this application for health and wellness services</li>
                <li>I understand I will be asked to provide additional consent for photo sharing and data use after registration</li>
              </ul>
            </label>
          </div>
        </div>

        <HCaptchaWidget
          ref={hcaptchaRef}
          onVerify={(t: string) => {
            if (completedRef.current) return;
            setHcaptchaToken(t);
            tokenResolverRef.current?.(t);
            tokenResolverRef.current = null;
            setError('');
          }}
          onError={() => {
            if (completedRef.current) return;
            setHcaptchaToken('');
            tokenResolverRef.current = null;
            setError('Security check failed. Please try again.');
          }}
          onExpire={() => {
            if (completedRef.current) return;
            setHcaptchaToken('');
            tokenResolverRef.current = null;
          }}
          size="invisible"
          theme="light"
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-sm" role="alert">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 text-white rounded-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: branding.primaryColor }}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      </div>
    </div>
  );
};

export default RegisterPage;
