// src/components/SeniorEnrollmentPage.tsx
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

  const startPreview = () => {
    localStorage.setItem('exploreStartTime', Date.now().toString());
    navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      full_name,
      dob,
      address,
      phone,
      email,
      password,
      confirmPassword,
      pin,
      confirmPin,
      diagnoses,
      race,
      ageRange,
    } = formData;

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

    if (!useEmail) {
      const { error: phoneError } = await supabase
        .from('phone_auth')
        .upsert({ id: userId, phone, pin });
      if (phoneError) {
        alert('Error saving phone login: ' + phoneError.message);
        return;
      }
    }

    localStorage.removeItem('exploreStartTime');
    alert('Enrollment submitted successfully!');
    navigate('/dashboard');
  };

  return (
    <div
      className="
        min-h-screen flex items-center justify-center p-8
        bg-gradient-to-b from-[#003865] via-white to-[#8cc63f]
      "
    >
      <div className="bg-white border-2 border-black max-w-3xl w-full p-8 rounded-lg shadow-lg text-black">
        <ExploreTimer minutes={15} />

        <h2 className="text-2xl font-bold text-center text-[#003865] mb-6">
          Senior Enrollment
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Personal Information */}
          <div>
            <h3 className="text-xl font-semibold text-[#003865] mb-2">Personal Information</h3>
            <label className="block text-black font-semibold text-lg">Full Name</label>
            <input
              name="full_name"
              placeholder="Full Name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
            />

            <label className="block text-black font-semibold text-lg">Date of Birth</label>
            <input
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
            />

            <label className="block text-black font-semibold text-lg">Address</label>
            <input
              name="address"
              placeholder="Address"
              value={formData.address}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
            />

            <label className="block text-black font-semibold text-lg">Phone Number</label>
            <input
              name="phone"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
            />
          </div>

          <hr className="border-t-2 border-gray-300" />

          {/* Login Setup */}
          <div>
            <h3 className="text-xl font-semibold text-[#003865] mb-2">Login Setup</h3>
            <fieldset className="space-y-2">
              <legend className="text-black font-semibold text-lg">Use email for secure login?</legend>
              <div className="flex gap-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="useEmail"
                    onChange={() => setUseEmail(true)}
                    className="mr-2"
                  />{' '}
                  Yes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="useEmail"
                    onChange={() => setUseEmail(false)}
                    className="mr-2"
                  />{' '}
                  No
                </label>
              </div>
            </fieldset>

            {useEmail === true && (
              <>
                <label className="block text-black font-semibold text-lg">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full p-3 border-2 border-black rounded text-lg"
                  required
                />

                <label className="block text-black font-semibold text-lg">Password</label>
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full p-3 border-2 border-black rounded text-lg"
                  required
                />

                <label className="block text-black font-semibold text-lg">Confirm Password</label>
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder="Retype Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full p-3 border-2 border-black rounded text-lg"
                  required
                />
              </>
            )}

            {useEmail === false && (
              <>
                <label className="block text-black font-semibold text-lg">4‑Digit PIN</label>
                <input
                  name="pin"
                  type="password"
                  maxLength={4}
                  placeholder="4‑Digit PIN"
                  value={formData.pin}
                  onChange={handleChange}
                  className="w-full p-3 border-2 border-black rounded text-lg"
                  required
                />

                <label className="block text-black font-semibold text-lg">Confirm PIN</label>
                <input
                  name="confirmPin"
                  type="password"
                  maxLength={4}
                  placeholder="Retype PIN"
                  value={formData.confirmPin}
                  onChange={handleChange}
                  className="w-full p-3 border-2 border-black rounded text-lg"
                  required
                />
              </>
            )}
          </div>

          <hr className="border-t-2 border-gray-300" />

          {/* Demographics */}
          <div>
            <h3 className="text-xl font-semibold text-[#003865] mb-2">Demographics</h3>
            <label className="block text-black font-semibold text-lg">Select Race</label>
            <select
              name="race"
              value={formData.race}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
            >
              <option value="">Select Race</option>
              <option value="Black">Black or African American</option>
              <option value="White">White</option>
              <option value="Hispanic">Hispanic/Latino</option>
              <option value="Asian">Asian</option>
              <option value="Other">Other</option>
            </select>

            <label className="block text-black font-semibold text-lg">Select Age Range</label>
            <select
              name="ageRange"
              value={formData.ageRange}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
            >
              <option value="">Select Age Range</option>
              <option value="55-64">55–64</option>
              <option value="65-74">65–74</option>
              <option value="75-84">75–84</option>
              <option value="85+">85+</option>
            </select>
          </div>

          <hr className="border-t-2 border-gray-300" />

          {/* Known Diagnoses */}
          <div>
            <h3 className="text-xl font-semibold text-[#003865] mb-2">Known Diagnoses</h3>
            <fieldset className="space-y-2">
              <label className="block text-black">
                <input
                  type="checkbox"
                  name="diabetes"
                  checked={formData.diagnoses.diabetes}
                  onChange={handleChange}
                  className="mr-2"
                />
                Diabetes Type I or II
              </label>
              <label className="block text-black">
                <input
                  type="checkbox"
                  name="hypertension"
                  checked={formData.diagnoses.hypertension}
                  onChange={handleChange}
                  className="mr-2"
                />
                High Blood Pressure
              </label>
              <label className="block text-black">
                <input
                  type="checkbox"
                  name="chf"
                  checked={formData.diagnoses.chf}
                  onChange={handleChange}
                  className="mr-2"
                />
                CHF
              </label>
              <label className="block text-black">
                <input
                  type="checkbox"
                  name="respiratory"
                  checked={formData.diagnoses.respiratory}
                  onChange={handleChange}
                  className="mr-2"
                />
                COPD / Asthma
              </label>
              <label className="block text-black">
                <input
                  type="checkbox"
                  name="allergies"
                  checked={formData.diagnoses.allergies}
                  onChange={handleChange}
                  className="mr-2"
                />
                Allergies
              </label>
              {formData.diagnoses.allergies && (
                <>
                  <label className="block text-black font-semibold text-lg mt-2">Please list allergies</label>
                  <input
                    type="text"
                    name="allergyDetails"
                    value={formData.diagnoses.allergyDetails}
                    onChange={handleChange}
                    className="w-full p-3 border-2 border-black rounded text-lg"
                  />
                </>
              )}
            </fieldset>
          </div>

          <hr className="border-t-2 border-gray-300" />

          {/* Actions */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={startPreview}
              className="text-base text-gray-700 underline"
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="bg-[#003865] hover:bg-[#8cc63f] text-white font-bold px-6 py-3 rounded shadow"
            >
              Submit Enrollment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SeniorEnrollmentPage;

