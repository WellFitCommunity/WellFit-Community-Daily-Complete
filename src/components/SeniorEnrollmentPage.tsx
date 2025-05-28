// src/components/SeniorEnrollmentPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ExploreTimer from '../components/ExploreTimer';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '../utils/sendWelcomeEmail';

const SeniorEnrollmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [useEmail, setUseEmail] = useState<boolean | null>(null);
  const [skipCount, setSkipCount] = useState(0);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    pin: '',
    confirmPin: '',
    dob: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    gender: '',
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

  const hashPin = async (pin: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(pin, salt);
  };

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
    if (skipCount >= 2) {
      alert('You can only skip enrollment twice. Please complete the form.');
      return;
    }
    setSkipCount(prev => prev + 1);
    localStorage.setItem('exploreStartTime', Date.now().toString());
    navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      first_name,
      last_name,
      dob,
      address,
      city,
      state,
      zip,
      phone,
      email,
      password,
      confirmPassword,
      pin,
      confirmPin,
      gender,
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
      try {
        await sendWelcomeEmail(email);
      } catch (err) {
        console.error("Error sending welcome email:", err);
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
    first_name,
    last_name,
    dob,
    address: `${address}, ${city}, ${state} ${zip}`,
    phone,
    email: useEmail ? email : null,
    gender,
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
      try {
        const hashedPin = await hashPin(pin);

        const { error: phoneError } = await supabase
          .from('phone_auth')
          .upsert({
            id: userId,
            phone,
            pin_hash: hashedPin,
          });

        if (phoneError) {
          alert('Error saving phone login: ' + phoneError.message);
          return;
        }
      } catch (err) {
        console.error('PIN hashing failed:', err);
        alert('There was a problem securing your PIN. Please try again.');
        return;
      }
    }

    localStorage.removeItem('exploreStartTime');
    alert('Enrollment submitted successfully! Proceeding to consent form...');
    navigate('/consent-photo');
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
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={startPreview}
            className="text-base text-gray-700 underline"
          >
            Skip for now ({2 - skipCount} left)
          </button>
        </div>

        <h2 className="text-2xl font-bold text-center text-[#003865] mb-6">
          Senior Enrollment
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="first_name" className="block text-black font-semibold text-lg">First Name</label>
            <input
              id="first_name"
              name="first_name"
              placeholder="First Name"
              value={formData.first_name}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
              autoComplete="given-name"
            />
          </div>

          <div>
            <label htmlFor="last_name" className="block text-black font-semibold text-lg">Last Name</label>
            <input
              id="last_name"
              name="last_name"
              placeholder="Last Name"
              value={formData.last_name}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
              autoComplete="family-name"
            />
          </div>

          <div>
            <label htmlFor="dob" className="block text-black font-semibold text-lg">Date of Birth</label>
            <input
              id="dob"
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
              autoComplete="bday"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-black font-semibold text-lg">Street Address</label>
            <input
              id="address"
              name="address"
              placeholder="Street Address"
              value={formData.address}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
              autoComplete="street-address"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="city" className="block text-black font-semibold text-lg">City</label>
              <input
                id="city"
                name="city"
                placeholder="City"
                value={formData.city}
                onChange={handleChange}
                className="w-full p-3 border-2 border-black rounded text-lg"
                required
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-black font-semibold text-lg">State</label>
              <input
                id="state"
                name="state"
                placeholder="State"
                value={formData.state}
                onChange={handleChange}
                className="w-full p-3 border-2 border-black rounded text-lg"
                required
                autoComplete="address-level1"
              />
            </div>
            <div>
              <label htmlFor="zip" className="block text-black font-semibold text-lg">ZIP Code</label>
              <input
                id="zip"
                name="zip"
                placeholder="ZIP Code"
                value={formData.zip}
                onChange={handleChange}
                className="w-full p-3 border-2 border-black rounded text-lg"
                required
                autoComplete="postal-code"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-black font-semibold text-lg">Phone Number</label>
            <input
              id="phone"
              name="phone"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-3 border-2 border-black rounded text-lg"
              required
              autoComplete="tel"
            />
          </div>

          <hr className="border-t-2 border-gray-300" />

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
                <div>
                  <label htmlFor="email" className="block text-black font-semibold text-lg">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full p-3 border-2 border-black rounded text-lg"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-black font-semibold text-lg">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full p-3 border-2 border-black rounded text-lg"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-black font-semibold text-lg">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Retype Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full p-3 border-2 border-black rounded text-lg"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            {useEmail === false && (
              <>
                <div>
                  <label htmlFor="pin" className="block text-black font-semibold text-lg">4‑Digit PIN</label>
                  <input
                    id="pin"
                    name="pin"
                    type="password"
                    maxLength={4}
                    placeholder="4‑Digit PIN"
                    value={formData.pin}
                    onChange={handleChange}
                    className="w-full p-3 border-2 border-black rounded text-lg"
                    required
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPin" className="block text-black font-semibold text-lg">Confirm PIN</label>
                  <input
                    id="confirmPin"
                    name="confirmPin"
                    type="password"
                    maxLength={4}
                    placeholder="Retype PIN"
                    value={formData.confirmPin}
                    onChange={handleChange}
                    className="w-full p-3 border-2 border-black rounded text-lg"
                    required
                    autoComplete="off"
                  />
                </div>
              </>
            )}
          </div>

          <hr className="border-t-2 border-gray-300" />

          <div>
            <h3 className="text-xl font-semibold text-[#003865] mb-2">Demographics</h3>
            
            <div>
              <label htmlFor="gender" className="block text-black font-semibold text-lg">Gender</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full p-3 border-2 border-black rounded text-lg"
                required
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label htmlFor="race" className="block text-black font-semibold text-lg">Select Race</label>
              <select
                id="race"
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
            </div>

            <div>
              <label htmlFor="ageRange" className="block text-black font-semibold text-lg">Select Age Range</label>
              <select
                id="ageRange"
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
          </div>

          <hr className="border-t-2 border-gray-300" />

          <div>
            <h3 className="text-xl font-semibold text-[#003865] mb-2">Known Diagnoses</h3>
            <fieldset className="space-y-2">
              <label htmlFor="diabetes" className="block text-black">
                <input
                  id="diabetes"
                  type="checkbox"
                  name="diabetes"
                  checked={formData.diagnoses.diabetes}
                  onChange={handleChange}
                  className="mr-2"
                />
                Diabetes Type I or II
              </label>
              <label htmlFor="hypertension" className="block text-black">
                <input
                  id="hypertension"
                  type="checkbox"
                  name="hypertension"
                  checked={formData.diagnoses.hypertension}
                  onChange={handleChange}
                  className="mr-2"
                />
                High Blood Pressure
              </label>
              <label htmlFor="chf" className="block text-black">
                <input
                  id="chf"
                  type="checkbox"
                  name="chf"
                  checked={formData.diagnoses.chf}
                  onChange={handleChange}
                  className="mr-2"
                />
                CHF
              </label>
              <label htmlFor="respiratory" className="block text-black">
                <input
                  id="respiratory"
                  type="checkbox"
                  name="respiratory"
                  checked={formData.diagnoses.respiratory}
                  onChange={handleChange}
                  className="mr-2"
                />
                COPD / Asthma
              </label>
              <label htmlFor="allergies" className="block text-black">
                <input
                  id="allergies"
                  type="checkbox"
                  name="allergies"
                  checked={formData.diagnoses.allergies}
                  onChange={handleChange}
                  className="mr-2"
                />
                Allergies
              </label>
              {formData.diagnoses.allergies && (
                <div>
                  <label htmlFor="allergyDetails" className="block text-black font-semibold text-lg mt-2">Please list allergies</label>
                  <input
                    id="allergyDetails"
                    type="text"
                    name="allergyDetails"
                    value={formData.diagnoses.allergyDetails}
                    onChange={handleChange}
                    className="w-full p-3 border-2 border-black rounded text-lg"
                  />
                </div>
              )}
            </fieldset>
          </div>

          <hr className="border-t-2 border-gray-300" />

          <div className="flex justify-end">
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