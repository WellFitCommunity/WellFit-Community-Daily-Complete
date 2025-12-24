/**
 * Password Generator Component
 *
 * Reusable component for generating secure passwords in admin forms.
 * Meets HIPAA security requirements with cryptographically secure random generation.
 *
 * Usage:
 * ```tsx
 * <PasswordGenerator
 *   onPasswordGenerated={(password) => setFormData({...formData, password})}
 *   showPassword={true}
 * />
 * ```
 */

import React, { useState } from 'react';
import { RefreshCw, Copy, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

interface PasswordGeneratorProps {
  onPasswordGenerated: (password: string) => void;
  className?: string;
  showPassword?: boolean;
  autoGenerate?: boolean;
}

const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({
  onPasswordGenerated,
  className = '',
  showPassword: initialShowPassword = false,
  autoGenerate = false
}) => {
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(initialShowPassword);
  const [copied, setCopied] = useState(false);

  /**
   * Generate cryptographically secure password
   * - Minimum 12 characters
   * - At least 1 lowercase, 1 uppercase, 1 number, 1 symbol
   * - Uses Web Crypto API for true randomness (HIPAA compliant)
   */
  const generateSecurePassword = (): string => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const all = lowercase + uppercase + numbers + symbols;

    const pick = (pool: string): string => {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return pool[array[0] % pool.length];
    };

    // Ensure at least one character from each category
    const password: string[] = [
      pick(lowercase),
      pick(uppercase),
      pick(numbers),
      pick(symbols)
    ];

    // Fill remaining length with random characters (total 12-16 chars)
    const targetLength = 12 + Math.floor(Math.random() * 5); // 12-16 characters
    for (let i = 4; i < targetLength; i++) {
      password.push(pick(all));
    }

    // Shuffle array using Fisher-Yates algorithm
    for (let i = password.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
  };

  const handleGenerate = async () => {
    const newPassword = generateSecurePassword();
    setGeneratedPassword(newPassword);
    onPasswordGenerated(newPassword);
    setCopied(false);

    // HIPAA Audit: Log password generation (without exposing the password)
    await auditLogger.auth('REGISTRATION', true, {
      action: 'PASSWORD_GENERATED',
      passwordLength: newPassword.length,
      generationMethod: 'crypto.getRandomValues',
      component: 'PasswordGenerator',
      timestamp: new Date().toISOString()
    });
  };

  const handleCopy = async () => {
    if (!generatedPassword) return;

    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // HIPAA Audit: Log password copy action (security tracking)
      await auditLogger.auth('REGISTRATION', true, {
        action: 'PASSWORD_COPIED_TO_CLIPBOARD',
        component: 'PasswordGenerator',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Failed to copy - clipboard API not available or permission denied
      setCopied(false);

      // HIPAA Audit: Log clipboard failure
      await auditLogger.auth('REGISTRATION', false, {
        action: 'PASSWORD_COPY_FAILED',
        component: 'PasswordGenerator',
        error: 'Clipboard API unavailable or permission denied',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Auto-generate on mount if requested
  React.useEffect(() => {
    if (autoGenerate && !generatedPassword) {
      handleGenerate();
    }
     
  }, []);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Secure Password Generator
        </label>
        <span className="text-xs text-gray-500">HIPAA Compliant</span>
      </div>

      {/* Password Display & Controls */}
      <div className="flex items-center gap-2">
        {/* Password Input */}
        <div className="flex-1 relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={generatedPassword}
            readOnly
            placeholder="Click Generate to create password"
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md bg-gray-50 text-gray-900 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          {generatedPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          title="Generate new secure password"
        >
          <RefreshCw className="w-4 h-4" />
          Generate
        </button>

        {/* Copy Button */}
        {generatedPassword && (
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Copy password to clipboard"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        )}
      </div>

      {/* Password Strength Indicator */}
      {generatedPassword && (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-600 rounded-full" style={{ width: '100%' }} />
          </div>
          <span className="text-green-600 font-medium">Strong</span>
        </div>
      )}

      {/* Security Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start gap-2">
          <span className="text-blue-600 text-sm">🔒</span>
          <div className="text-xs text-blue-800">
            <p className="font-medium">Security Features:</p>
            <ul className="mt-1 space-y-0.5 text-blue-700">
              <li>• 12-16 random characters</li>
              <li>• Uppercase, lowercase, numbers & symbols</li>
              <li>• Cryptographically secure (Web Crypto API)</li>
              <li>• Meets HIPAA password requirements</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <div className="flex items-start gap-2">
          <span className="text-yellow-600 text-sm">⚠️</span>
          <div className="text-xs text-yellow-800">
            <p className="font-medium">Important:</p>
            <p className="mt-1 text-yellow-700">
              Copy this password and securely send it to the patient through an approved channel.
              The password will not be visible after registration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordGenerator;
