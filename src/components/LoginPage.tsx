import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
    <div className="max-w-md mx-auto mt-16 p-8 bg-white rounded-xl shadow-md border-2 border-wellfitGreen text-center">
      <h1 className="text-2xl font-bold mb-4 text-wellfit-blue">Senior Login</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="tel"
          placeholder="Phone Number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="4-digit PIN"
          value={pin}
          onChange={e => setPin(e.target.value)}
          maxLength={4}
          className="w-full p-2 border rounded"
        />
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" className="w-full py-2 bg-wellfit-blue text-white font-semibold rounded">
          Log In
        </button>
      </form>
    </div>
  );
};

export default LoginPage;

