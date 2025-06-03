import React, { useState, useEffect } from 'react'; // Add useEffect
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const branding = useBranding();

  useEffect(() => {
    if (localStorage.getItem('wellfitUserId')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  // Helper to determine if a color is dark (similar to Header/Footer)
  const isColorDark = (colorStr: string) => {
    if (!colorStr) return true; // Default to dark if color is not defined
    const color = colorStr.startsWith('#') ? colorStr.substring(1) : colorStr;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  const primaryButtonTextColor = isColorDark(branding.primaryColor) ? 'text-white' : 'text-gray-800';
  const titleTextColor = isColorDark(branding.secondaryColor) ? 'text-white' : 'text-gray-800'; // Assuming title bg might be secondary, or just for general contrast

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || !pin) {
      setError('Please enter both phone number and PIN.');
      return;
    }

    const { data, error } = await supabase
      .from('phone_auth')
      .select('id')
      .eq('phone', phone)
      .eq('pin', pin)
      .single();

    if (error || !data) {
      setError('Invalid phone number or PIN.');
    } else {
      // Save ID in localStorage
      localStorage.setItem('wellfitUserId', data.id);
      setError('');
      navigate('/demographics');
    }
  };

  return (
    <div 
      className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md text-center"
      style={{ borderColor: branding.secondaryColor, borderWidth: '2px' }}
    >
      {branding.logoUrl && (
        <img src={branding.logoUrl} alt={`${branding.appName} Logo`} className="h-16 w-auto mx-auto mb-4" />
      )}
      <h1 className="text-2xl font-bold mb-6" style={{ color: branding.primaryColor }}>
        {branding.appName} - Senior Login
      </h1>
      <form onSubmit={handleLogin} className="space-y-4"> {/* Adjusted space for visible labels */}
        <div>
          <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
            Phone Number
          </label>
          <input
            id="phone-input"
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            aria-required="true"
            aria-invalid={!!error}
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none" // Added focus:outline-none for custom ring
            style={{ borderColor: branding.secondaryColor, '--tw-ring-color': branding.primaryColor } as React.CSSProperties}
            autoComplete="tel"
          />
        </div>
        <div>
          <label htmlFor="pin-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
            4-digit PIN
          </label>
          <input
            id="pin-input"
            type="password" // Use "password" for PINs to mask input
            placeholder="4-digit PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            maxLength={4}
            required
            aria-required="true"
            aria-invalid={!!error}
            inputMode="numeric" // Helpful for numeric PINs on touch devices
            pattern="[0-9]*"    // Allow only numbers
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none" // Added focus:outline-none
            style={{ borderColor: branding.secondaryColor, '--tw-ring-color': branding.primaryColor } as React.CSSProperties}
            autoComplete="one-time-code" // More appropriate for PINs than "current-password"
          />
        </div>
        {error && <p role="alert" className="text-red-500 text-sm font-semibold">{error}</p>}
        <button 
          type="submit" 
          className={`w-full py-3 font-semibold rounded hover:opacity-90 transition-opacity ${primaryButtonTextColor} focus:outline-none focus:ring-2 focus:ring-offset-2`}
          style={{ backgroundColor: branding.primaryColor }}
        >
          Log In
        </button>
      </form>
    </div>
  );
};

export default LoginPage;

