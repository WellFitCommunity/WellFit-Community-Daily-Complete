import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const DemographicsPage: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    pin: '',
    dob: '',
    address: '',
    hasEmail: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { first_name, last_name, phone, pin, dob, address, hasEmail } = formData;

    localStorage.setItem('prefersEmail', hasEmail ? 'true' : 'false');
    localStorage.setItem('wellfitPhone', phone);
    localStorage.setItem('wellfitPin', pin);

    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    const userId = user?.id ?? crypto.randomUUID();
    localStorage.setItem('wellfitUserId', userId);
    localStorage.setItem('wellfitName', `${first_name} ${last_name}`);

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      first_name,
      last_name,
      phone,
      dob,
      address,
    });

    const { error: phoneAuthError } = await supabase.from('phone_auth').upsert({
      id: userId,
      phone,
      pin,
    });

    if (profileError || phoneAuthError) {
      setError(profileError?.message || phoneAuthError?.message || 'Unknown error.');
    } else {
      setSuccess(true);
      setError(null);
      hasEmail ? navigate('/supabase-login') : navigate('/dashboard');
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-center text-wellfit-blue">Tell Us About You</h2>
      <p className="text-gray-600 text-center">We’ll use this to personalize your WellFit experience.</p>

      {error && <p className="text-red-500 text-center">{error}</p>}
      {success && <p className="text-green-600 text-center">Profile saved!</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="pin" placeholder="4-Digit PIN" maxLength={4} value={formData.pin} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="dob" type="date" placeholder="Date of Birth" value={formData.dob} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="address" placeholder="Address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded" />

        <div className="flex items-center space-x-2">
          <input type="checkbox" id="hasEmail" name="hasEmail" checked={formData.hasEmail} onChange={handleChange} />
          <label htmlFor="hasEmail" className="text-sm text-gray-700">
            I have an email address and I am willing to use it to log in for security purposes.
          </label>
        </div>

        <button type="submit" className="w-full py-2 bg-wellfit-green text-white rounded hover:bg-green-700">
          Submit
        </button>
      </form>
    </div>
  );
};

export default DemographicsPage;
