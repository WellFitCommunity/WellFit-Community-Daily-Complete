/**
 * DemoPersonaSwitcher - Quick-login persona buttons for demo mode
 *
 * Purpose: Provides one-tap login for demo personas on the login page.
 *          Auto-fills credentials and submits the login form using real
 *          Supabase auth (no security bypass).
 *
 * Used by: LoginPage.tsx (when VITE_DEMO_MODE=true)
 */

import React, { useState } from 'react';

interface DemoPersona {
  label: string;
  role: string;
  loginType: 'phone' | 'email';
  credential: string;
  password: string;
  icon: string;
  color: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    label: 'Patient (Floyd)',
    role: 'Senior / Patient',
    loginType: 'phone',
    credential: '+19728025786',
    password: 'Password123!',
    icon: '\u{1F9D3}', // older person emoji
    color: '#2563eb', // blue
  },
  {
    label: 'Nurse',
    role: 'James Rodriguez, RN',
    loginType: 'email',
    credential: 'james.rodriguez@demo.wellfit.com',
    password: 'DemoStaff2026!',
    icon: '\u{1FA7A}', // stethoscope emoji
    color: '#059669', // green
  },
  {
    label: 'Physician',
    role: 'Dr. Sarah Williams',
    loginType: 'email',
    credential: 'dr.williams@demo.wellfit.com',
    password: 'DemoStaff2026!',
    icon: '\u{1F469}\u{200D}\u{2695}\u{FE0F}', // woman health worker
    color: '#7c3aed', // purple
  },
  {
    label: 'Case Manager',
    role: 'Lisa Park, MSW',
    loginType: 'email',
    credential: 'lisa.park@demo.wellfit.com',
    password: 'DemoStaff2026!',
    icon: '\u{1F4CB}', // clipboard
    color: '#d97706', // amber
  },
];

interface DemoPersonaSwitcherProps {
  onSelectPersona: (persona: {
    loginType: 'phone' | 'email';
    credential: string;
    password: string;
  }) => void;
  disabled?: boolean;
}

export const DemoPersonaSwitcher: React.FC<DemoPersonaSwitcherProps> = ({
  onSelectPersona,
  disabled = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSelect = (persona: DemoPersona, index: number) => {
    if (disabled) return;
    setSelectedIndex(index);
    onSelectPersona({
      loginType: persona.loginType,
      credential: persona.credential,
      password: persona.password,
    });
  };

  return (
    <div className="mb-6">
      {/* Demo mode banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
        <p className="text-amber-800 text-sm font-semibold text-center">
          Demo Mode — Tap a persona to log in
        </p>
        <p className="text-amber-600 text-xs text-center mt-1">
          Staff PIN: 1234
        </p>
      </div>

      {/* Persona grid */}
      <div className="grid grid-cols-2 gap-2">
        {DEMO_PERSONAS.map((persona, index) => (
          <button
            key={persona.label}
            type="button"
            onClick={() => handleSelect(persona, index)}
            disabled={disabled}
            className={`
              relative flex flex-col items-center justify-center
              min-h-[80px] p-3 rounded-lg border-2 transition-all
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md active:scale-95 cursor-pointer'}
              ${selectedIndex === index ? 'ring-2 ring-offset-1' : ''}
            `}
            style={{
              borderColor: persona.color,
              backgroundColor: selectedIndex === index ? `${persona.color}15` : 'white',
              ...(selectedIndex === index ? { ringColor: persona.color } : {}),
            }}
            aria-label={`Log in as ${persona.label}: ${persona.role}`}
          >
            <span className="text-2xl mb-1" role="img" aria-hidden="true">
              {persona.icon}
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: persona.color }}
            >
              {persona.label}
            </span>
            <span className="text-xs text-gray-500 mt-0.5 text-center leading-tight">
              {persona.role}
            </span>
            {selectedIndex === index && disabled && (
              <span className="absolute top-1 right-1 text-xs animate-pulse">
                ...
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DemoPersonaSwitcher;
