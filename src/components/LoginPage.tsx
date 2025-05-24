import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const branding = useBranding();

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
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="tel"
          placeholder="Phone Number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded focus:ring-2"
          style={{ borderColor: branding.secondaryColor, '--tw-ring-color': branding.primaryColor } as React.CSSProperties}
        />
        <input
          type="password"
          placeholder="4-digit PIN"
          value={pin}
          onChange={e => setPin(e.target.value)}
          maxLength={4}
          className="w-full p-3 border border-gray-300 rounded focus:ring-2"
          style={{ borderColor: branding.secondaryColor, '--tw-ring-color': branding.primaryColor } as React.CSSProperties}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button 
          type="submit" 
          className={`w-full py-3 font-semibold rounded hover:opacity-90 transition-opacity ${primaryButtonTextColor}`}
          style={{ backgroundColor: branding.primaryColor }}
        >
          Log In
        </button>
      </form>
    </div>
  );
};

export default LoginPage;

