// src/components/DemographicsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient, useSession, useUser } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DemographicsFormData {
  first_name: string;
  last_name: string;
  phone: string;
  pin: string; // 4-digit numeric
  dob: string; // YYYY-MM-DD
  address: string;
  hasEmail: boolean;
}

interface ProfileOnboardingData {
  onboarded?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  dob?: string | null;
  address?: string | null;
}

const DemographicsPage: React.FC = () => {
  const navigate = useNavigate();

  // ✅ Use hooks in a React component
  const supabase = useSupabaseClient();
  const session = useSession();
  const user = useUser();

  const userId = useMemo(() => user?.id ?? session?.user?.id ?? null, [user, session]);

  const [formData, setFormData] = useState<DemographicsFormData>({
    first_name: '',
    last_name: '',
    phone: '',
    pin: '',
    dob: '',
    address: '',
    hasEmail: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // On mount / when user changes: gate access & prefill
  useEffect(() => {
    (async () => {
      if (!userId) {
        // not signed in
        setLoading(false);
        navigate('/');
        return;
      }

      try {
        // Check if already onboarded
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('onboarded, first_name, last_name, phone, dob, address')
          .eq('id', userId)
          .maybeSingle<ProfileOnboardingData>(); // allow null if not found

        if (profileErr) throw profileErr;

        if (profile?.onboarded) {
          navigate('/dashboard');
          return;
        }

        if (profile) {
          setFormData((f) => ({
            ...f,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            phone: profile.phone || '',
            dob: profile.dob || '',
            address: profile.address || '',
          }));
        }
      } catch (e: any) {
        console.error('Error fetching profile:', e);
        setError(e?.message ?? 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, navigate, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError('User not authenticated. Please register or log in again.');
      return;
    }

    // Basic validation with friendly messages
    if (!formData.first_name) {
      setError('Please tell us your first name.');
      return;
    }
    if (!formData.last_name) {
      setError('Please tell us your last name.');
      return;
    }
    if (!formData.phone) {
      setError('Please enter your phone number.');
      return;
    }
    if (!formData.dob) {
      setError('Please tell us when you were born.');
      return;
    }
    if (!formData.address) {
      setError('Please enter your home address.');
      return;
    }
    if (!/^\d{4}$/.test(formData.pin)) {
      setError('Your PIN needs to be exactly 4 numbers (like 1234).');
      return;
    }

    const { first_name, last_name, phone, pin, dob, address, hasEmail } = formData;

    // Normalize data for proper collection format while preserving user input
    const normalizedData = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.replace(/\D/g, '').replace(/^1/, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3'), // Format: (555) 123-4567
      dob, // Keep YYYY-MM-DD format as entered
      address: address.trim(),
      pin: pin.trim(), // Keep as entered for user familiarity
    };

    try {
      // Upsert profile with normalized data
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        first_name: normalizedData.first_name,
        last_name: normalizedData.last_name,
        phone: normalizedData.phone,
        dob: normalizedData.dob,
        address: normalizedData.address,
        onboarded: true,
      });
      if (profileError) throw profileError;

      // ⚠️ SECURITY NOTE: This stores a PIN as plaintext.
      // Replace with an Edge Function that hashes the PIN server-side ASAP.
      const { error: phoneAuthError } = await supabase.from('phone_auth').upsert({
        id: userId,
        phone: normalizedData.phone,
        pin: normalizedData.pin, // TODO: hash via Edge Function
      });
      if (phoneAuthError) throw phoneAuthError;

      setSuccess(true);
      setTimeout(() => {
        hasEmail ? navigate('/supabase-login') : navigate('/dashboard');
      }, 1200);
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error.');
    }
  };

  if (loading) return <div className="text-center mt-8">Loading…</div>;

  return (
    <div className="max-w-xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-md space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-wellfit-blue mb-2">Welcome!</h2>
        <p className="text-lg text-gray-700">Just a few more details to get you started with your health journey.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-center text-lg">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 text-center font-bold text-xl">
            All set! Taking you to your dashboard...
          </p>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="first_name" className="block text-lg font-medium text-gray-700 mb-2">What's your first name?</label>
            <input
              id="first_name"
              name="first_name"
              placeholder="First name"
              value={formData.first_name}
              onChange={handleChange}
              className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-wellfit-green focus:border-wellfit-green"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="last_name" className="block text-lg font-medium text-gray-700 mb-2">What's your last name?</label>
            <input
              id="last_name"
              name="last_name"
              placeholder="Last name"
              value={formData.last_name}
              onChange={handleChange}
              className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-wellfit-green focus:border-wellfit-green"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-lg font-medium text-gray-700 mb-2">Your phone number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-wellfit-green focus:border-wellfit-green"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="pin" className="block text-lg font-medium text-gray-700 mb-2">Create a 4-digit PIN for security</label>
            <p className="text-gray-600 mb-2">This is like a password - just 4 numbers you can remember</p>
            <input
              id="pin"
              name="pin"
              type="password"
              placeholder="1234"
              maxLength={4}
              value={formData.pin}
              onChange={handleChange}
              className="w-full p-4 text-lg text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-wellfit-green focus:border-wellfit-green"
              inputMode="numeric"
              pattern="\d{4}"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="dob" className="block text-lg font-medium text-gray-700 mb-2">When were you born?</label>
            <input
              id="dob"
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleChange}
              className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-wellfit-green focus:border-wellfit-green"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-lg font-medium text-gray-700 mb-2">Your home address</label>
            <p className="text-gray-600 mb-2">This helps us provide local health resources</p>
            <input
              id="address"
              name="address"
              placeholder="123 Main Street, City, State 12345"
              value={formData.address}
              onChange={handleChange}
              className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-wellfit-green focus:border-wellfit-green"
              aria-required="true"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="hasEmail"
                name="hasEmail"
                checked={formData.hasEmail}
                onChange={handleChange}
                className="mt-1 h-5 w-5 text-wellfit-green border-gray-300 rounded focus:ring-wellfit-green"
              />
              <label htmlFor="hasEmail" className="text-lg text-gray-700">
                <strong>Optional:</strong> I have an email address and would like to use it too
                <p className="text-gray-600 text-base mt-1">You can always add this later if you want</p>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 text-xl font-semibold bg-wellfit-green text-white rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wellfit-green transition-colors"
          >
            Complete Setup
          </button>
        </form>
      )}
    </div>
  );
};

export default DemographicsPage;
