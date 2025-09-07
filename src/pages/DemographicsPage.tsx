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

    // Basic guards
    if (!formData.first_name || !formData.last_name || !formData.phone || !formData.dob || !formData.address) {
      setError('Please fill out all required fields.');
      return;
    }
    if (!/^\d{4}$/.test(formData.pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    const { first_name, last_name, phone, pin, dob, address, hasEmail } = formData;

    try {
      // Upsert profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        first_name,
        last_name,
        phone,
        dob,
        address,
        onboarded: true,
      });
      if (profileError) throw profileError;

      // ⚠️ SECURITY NOTE: This stores a PIN as plaintext.
      // Replace with an Edge Function that hashes the PIN server-side ASAP.
      const { error: phoneAuthError } = await supabase.from('phone_auth').upsert({
        id: userId,
        phone,
        pin, // TODO: hash via Edge Function
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
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-center text-wellfit-blue">Tell Us About You</h2>
      <p className="text-gray-600 text-center">We’ll use this to personalize your WellFit experience.</p>

      {error && <p className="text-red-500 text-center">{error}</p>}
      {success && (
        <p className="text-green-600 text-center font-bold text-xl my-4">
          Registration Completed! Redirecting…
        </p>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="first_name" className="sr-only">First Name</label>
            <input id="first_name" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} className="w-full p-3 border rounded-md focus:ring-2 focus:ring-indigo-500" aria-required="true" />
          </div>
          <div>
            <label htmlFor="last_name" className="sr-only">Last Name</label>
            <input id="last_name" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} className="w-full p-3 border rounded-md focus:ring-2 focus:ring-indigo-500" aria-required="true" />
          </div>
          <div>
            <label htmlFor="phone" className="sr-only">Phone Number</label>
            <input id="phone" name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleChange} className="w-full p-3 border rounded-md focus:ring-2 focus:ring-indigo-500" aria-required="true" />
          </div>
          <div>
            <label htmlFor="pin" className="sr-only">4-Digit PIN</label>
            <input id="pin" name="pin" type="password" placeholder="Create 4-Digit PIN" maxLength={4} value={formData.pin} onChange={handleChange} className="w-full p-3 border rounded-md focus:ring-2 focus:ring-indigo-500" inputMode="numeric" pattern="\d{4}" aria-required="true" />
          </div>
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input id="dob" name="dob" type="date" placeholder="Date of Birth" value={formData.dob} onChange={handleChange} className="w-full p-3 border rounded-md focus:ring-2 focus:ring-indigo-500" aria-required="true" />
          </div>
          <div>
            <label htmlFor="address" className="sr-only">Address</label>
            <input id="address" name="address" placeholder="Full Address" value={formData.address} onChange={handleChange} className="w-full p-3 border rounded-md focus:ring-2 focus:ring-indigo-500" aria-required="true" />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input type="checkbox" id="hasEmail" name="hasEmail" checked={formData.hasEmail} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <label htmlFor="hasEmail" className="text-sm text-gray-700">
              I have an email and want to use it for login (optional).
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-wellfit-green text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Complete Registration
          </button>
        </form>
      )}
    </div>
  );
};

export default DemographicsPage;
