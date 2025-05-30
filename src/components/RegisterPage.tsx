// src/components/RegisterPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from './PageLayout';
import Card from './Card';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Basic password rules: at least 8 characters
  const isPasswordValid = (pw: string) => pw.length >= 8;

  // Format phone (US only, for now)
  const formatPhone = (input: string) => {
    let digits = input.replace(/\D/g, '');
    if (digits.length === 10) digits = '1' + digits;
    return digits;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const formattedPhone = formatPhone(phone);
    if (!formattedPhone.match(/^\d{11}$/)) {
      setError('Enter a valid 10-digit US phone number.');
      return;
    }
    if (!isPasswordValid(password)) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    // TODO: Replace with your actual backend registration logic
    // Example: Call your Edge Function for registration
    try {
      // Simulate API call
      await new Promise((res) => setTimeout(res, 1000));
      setLoading(false);
      navigate('/demographics');
    } catch (e) {
      setLoading(false);
      setError('Registration failed. Please try again.');
    }
  };

  return (
    <PageLayout>
      <Card className="max-w-lg w-full p-6 bg-white shadow-xl flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-6 text-[#003865]">Register</h2>
        <form className="w-full" onSubmit={handleRegister}>
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-[#003865]" htmlFor="phone">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              className="w-full p-3 border-2 border-[#003865] rounded text-lg"
              autoComplete="tel"
              placeholder="(555) 555-1234"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-[#003865]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full p-3 border-2 border-[#003865] rounded text-lg"
              autoComplete="new-password"
              placeholder="Create a password"
            />
          </div>
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-[#003865]" htmlFor="confirm">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full p-3 border-2 border-[#003865] rounded text-lg"
              autoComplete="new-password"
              placeholder="Re-enter password"
            />
          </div>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#003865] hover:bg-[#8cc63f] text-white font-bold px-6 py-3 rounded shadow w-full mt-2 transition"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </Card>
    </PageLayout>
  );
};

export default RegisterPage;

