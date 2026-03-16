/**
 * InviteUserForm — Single user invite form
 *
 * Purpose: Collect user details and role, call admin_register edge function
 * Used by: UserProvisioningPanel
 */

import React, { useState } from 'react';
import { UserPlus, Mail, Phone, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { EABadge } from '../../envision-atlus';
import type { InviteUserFormProps, InviteUserInput } from './types';

const DELIVERY_OPTIONS = [
  { value: 'email' as const, label: 'Email', icon: Mail },
  { value: 'sms' as const, label: 'SMS', icon: Phone },
  { value: 'none' as const, label: 'Manual (copy credentials)', icon: Copy },
];

export const InviteUserForm: React.FC<InviteUserFormProps> = ({
  roles,
  saving,
  onInvite,
  lastResult,
  onClearResult,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleCode, setRoleCode] = useState<number | ''>('');
  const [delivery, setDelivery] = useState<'email' | 'sms' | 'none'>('none');
  const [validationError, setValidationError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!firstName.trim() || !lastName.trim()) {
      setValidationError('First name and last name are required');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setValidationError('Either email or phone number is required');
      return;
    }
    if (delivery === 'email' && !email.trim()) {
      setValidationError('Email is required for email delivery');
      return;
    }
    if (delivery === 'sms' && !phone.trim()) {
      setValidationError('Phone number is required for SMS delivery');
      return;
    }
    if (roleCode === '') {
      setValidationError('Please select a role');
      return;
    }

    const input: InviteUserInput = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role_code: roleCode,
      delivery,
    };
    onInvite(input);
  };

  const handleCopyPassword = async () => {
    if (!lastResult?.temporary_password) return;
    try {
      await navigator.clipboard.writeText(lastResult.temporary_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be blocked in some environments
    }
  };

  const handleNewInvite = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRoleCode('');
    setDelivery('none');
    setValidationError('');
    setCopied(false);
    setShowPassword(false);
    onClearResult();
  };

  // Success state — show credentials
  if (lastResult) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600" />
          <h4 className="font-semibold text-green-800">User Created Successfully</h4>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">User ID:</span>
            <p className="font-mono text-xs break-all">{lastResult.user_id}</p>
          </div>
          <div>
            <span className="text-gray-500">Role:</span>
            <p><EABadge variant="info" size="sm">{lastResult.role_slug}</EABadge></p>
          </div>
          <div>
            <span className="text-gray-500">Delivery:</span>
            <p className="capitalize">{lastResult.delivery}</p>
          </div>
          <div>
            <span className="text-gray-500">Info:</span>
            <p>{lastResult.info}</p>
          </div>
        </div>

        {/* Temporary password display */}
        <div className="bg-white border border-green-300 rounded-md p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">Temporary Password</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCopyPassword}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="font-mono text-sm bg-gray-50 px-2 py-1 rounded">
            {showPassword ? lastResult.temporary_password : '\u2022'.repeat(16)}
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Share this password securely. The user must change it on first login.
          </p>
        </div>

        <button
          onClick={handleNewInvite}
          className="w-full px-4 py-2 text-sm font-medium text-[var(--ea-primary)] bg-[var(--ea-primary)]/10 border border-[var(--ea-primary)]/30 rounded-md hover:bg-[var(--ea-primary)]/20"
        >
          Invite Another User
        </button>
      </div>
    );
  }

  const elevatedRoles = roles.filter(r => r.level === 'elevated');
  const publicRoles = roles.filter(r => r.level === 'public');

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Invite User Form">
      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="invite-first-name" className="block text-sm font-medium text-gray-700 mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="invite-first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="invite-last-name" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            id="invite-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
            disabled={saving}
          />
        </div>
      </div>

      {/* Contact fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@facility.org"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="invite-phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            id="invite-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
            disabled={saving}
          />
        </div>
      </div>

      {/* Role selection */}
      <div>
        <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
          Initial Role <span className="text-red-500">*</span>
        </label>
        <select
          id="invite-role"
          value={roleCode}
          onChange={(e) => setRoleCode(e.target.value ? Number(e.target.value) : '')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
          disabled={saving}
        >
          <option value="">Select a role...</option>
          <optgroup label="Elevated Roles">
            {elevatedRoles.map(r => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </optgroup>
          <optgroup label="Public Roles">
            {publicRoles.map(r => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </optgroup>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Clinical roles (physician, pharmacist, etc.) are assigned after creation via Staff Role Management.
        </p>
      </div>

      {/* Delivery method */}
      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">
          Credential Delivery
        </span>
        <div className="flex gap-2">
          {DELIVERY_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDelivery(opt.value)}
                disabled={saving}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                  delivery === opt.value
                    ? 'bg-[var(--ea-primary)]/10 border-[var(--ea-primary)] text-[var(--ea-primary)]'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="text-sm text-red-600">{validationError}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--ea-primary)] text-white text-sm font-medium rounded-md hover:bg-[var(--ea-primary-hover)] disabled:opacity-50 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        {saving ? 'Creating User...' : 'Create User & Generate Credentials'}
      </button>
    </form>
  );
};
