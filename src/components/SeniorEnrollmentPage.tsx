import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ExploreTimer from '../components/ExploreTimer';

const SeniorEnrollmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [useEmail, setUseEmail] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    pin: '',
    confirmPin: '',
    dob: '',
    address: '',
    race: '',
    ageRange: '',
    diagnoses: {
      diabetes: false,
      hypertension: false,
      chf: false,
      respiratory: false,
      allergies: false,
      allergyDetails: '',
    },
  });

  // Start preview mode
  const startPreview = () => {
    localStorage.setItem('exploreStartTime', Date.now().toString());
    navigate('/dashboard');
  };

  // Unified change handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked;

    if (name in formData.diagnoses) {
      setFormData(prev => ({
        ...prev,
        diagnoses: {
          ...prev.diagnoses,
          [name]: type === 'checkbox' ? checked : value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  // Supabase‐connected submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      full_name, dob, address, phone,
      email, password, confirmPassword,
      pin, confirmPin, diagnoses,
      race, ageRange,
    } = formData;

    // Validate match
    if (useEmail === false && pin !== confirmPin) {
      alert('PINs do not match.');
      return;
    }
    if (useEmail === true && password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    let userId: string;
    if (useEmail) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError || !signUpData.user) {
        alert('Sign-up failed: ' + (signUpError?.message || 'Unknown error.'));
        return;
      }
      if (!signUpData.session) {
        alert('A confirmation email has been sent. Please confirm your email before continuing.');
        return;
      }
      userId = signUpData.user.id;
    } else {
      userId = crypto.randomUUID();
    }

    // Upsert profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name,
        dob,
        address,
        phone,
        email: useEmail ? email : null,
        race,
        age_range: ageRange,
        diagnosis_diabetes: diagnoses.diabetes,
        diagnosis_hypertension: diagnoses.hypertension,
        diagnosis_chf: diagnoses.chf,
        diagnosis_respiratory: diagnoses.respiratory,
        diagnosis_allergies: diagnoses.allergies,
        allergy_notes: diagnoses.allergyDetails,
      });

    if (profileError) {
      alert('Error saving profile: ' + profileError.message);
      return;
    }

    // Upsert phone_auth if PIN
    if (!useEmail) {
      const { error: phoneError } = await supabase
        .from('phone_auth')
        .upsert({ id: userId, phone, pin });
      if (phoneError) {
        alert('Error saving phone login: ' + phoneError.message);
        return;
      }
    }

    // Clear preview & redirect
    localStorage.removeItem('exploreStartTime');
    alert('Enrollment submitted successfully!');
    navigate('/dashboard');
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl shadow space-y-6">
      <ExploreTimer minutes={15} />

      <h2 className="text-2xl font-bold text-center text-wellfit-blue">Senior Enrollment</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <input
          name="full_name"
          placeholder="Full Name"
          value={formData.full_name}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />

        {/* Date of Birth */}
        <input
          name="dob"
          type="date"
          value={formData.dob}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />

        {/* Address */}
        <input
          name="address"
          placeholder="Address"
          value={formData.address}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />

        {/* Phone */}
        <input
          name="phone"
          placeholder="Phone Number"
          value={formData.phone}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />

        {/* Secure Login Choice */}
        <label className="block font-semibold mt-4">
          Do you have an email address you'd like to use for a more secure login?
        </label>
        <div className="flex gap-6 pl-1">
          <label>
            <input type="radio" name="useEmail" onChange={() => setUseEmail(true)} /> Yes
          </label>
          <label>
            <input type="radio" name="useEmail" onChange={() => setUseEmail(false)} /> No
          </label>
        </div>

        {/* Email/Password Fields */}
        {useEmail === true && (
          <>
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
            <input
              name="confirmPassword"
              type="password"
              placeholder="Retype Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </>
        )}

        {/* PIN Fields */}
        {useEmail === false && (
          <>
            <input
              name="pin"
              type="password"
              placeholder="4-Digit PIN"
              maxLength={4}
              value={formData.pin}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
            <input
              name="confirmPin"
              type="password"
              placeholder="Retype PIN"
              maxLength={4}
              value={formData.confirmPin}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </>
        )}

        {/* Race */}
        <select
          name="race"
          value={formData.race}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select Race</option>
          <option value="Black">Black or African American</option>
          <option value="White">White</option>
          <option value="Hispanic">Hispanic/Latino</option>
          <option value="Asian">Asian</option>
          <option value="Other">Other</option>
        </select>

        {/* Age Range */}
        <select
          name="ageRange"
          value={formData.ageRange}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select Age Range</option>
          <option value="55-64">55–64</option>
          <option value="65-74">65–74</option>
          <option value="75-84">75–84</option>
          <option value="85+">85+</option>
        </select>

        {/* Known Diagnosis */}
        <fieldset className="border p-3 rounded">
          <legend className="font-semibold">Known Diagnosis:</legend>
          <label className="block">
            <input
              type="checkbox"
              name="diabetes"
              checked={formData.diagnoses.diabetes}
              onChange={handleChange}
            />{' '}
            Diabetes Type I or II
          </label>
          <label className="block">
            <input
              type="checkbox"
              name="hypertension"
              checked={formData.diagnoses.hypertension}
              onChange={handleChange}
            />{' '}
            High Blood Pressure
          </label>
          <label className="block">
            <input
              type="checkbox"
              name="chf"
              checked={formData.diagnoses.chf}
              onChange={handleChange}
            />{' '}
            Congestive Heart Failure (CHF)
          </label>
          <label className="block">
            <input
              type="checkbox"
              name="respiratory"
              checked={formData.diagnoses.respiratory}
              onChange={handleChange}
            />{' '}
            Respiratory Illness (COPD, Asthma)
          </label>
          <label className="block">
            <input
              type="checkbox"
              name="allergies"
              checked={formData.diagnoses.allergies}
              onChange={handleChange}
            />{' '}
            Allergies
            <input
              type="text"
              name="allergyDetails"
              value={formData.diagnoses.allergyDetails}
              onChange={handleChange}
              placeholder="Please list allergies"
              className="block mt-1 p-1 border rounded w-full"
            />
          </label>
        </fieldset>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={startPreview}
            className="text-sm text-gray-500 underline"
          >
            Skip for now
          </button>
          <button
            type="submit"
            className="bg-wellfit-blue hover:bg-wellfit-green text-white font-semibold px-6 py-2 rounded shadow"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default SeniorEnrollmentPage;
