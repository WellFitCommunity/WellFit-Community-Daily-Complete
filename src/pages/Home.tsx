// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSupabaseClient, useSession } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';

type Profile = {
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
};

export default function Home() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return; // not logged in yet
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, role')
        .eq('id', session.user.id)        // ✅ use id, not user_id
        .maybeSingle();
      if (!error) setProfile(data ?? {});
      setLoading(false);
    })();
  }, [session?.user?.id, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const displayName =
    (profile?.first_name?.trim() || '') +
    (profile?.last_name ? ` ${profile.last_name.trim()}` : '');

  return (
    <div
      className="min-h-screen"
      style={{ background: branding.gradient }}
    >
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#003865]">WellFit</h1>
          <nav className="space-x-4 text-sm">
            <Link className="text-gray-700 hover:text-black" to="/dashboard">Dashboard</Link>
            <Link className="text-gray-700 hover:text-black" to="/self-reporting">Self-Reporting</Link>
            <Link className="text-gray-700 hover:text-black" to="/community">Community</Link>
            <Link className="text-gray-700 hover:text-black" to="/doctors-view">Doctor’s View</Link>
            <Link className="text-gray-700 hover:text-black" to="/admin">Admin</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <section className="md:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-2">
              Welcome{displayName ? `, ${displayName}` : ''}
            </h2>

            {!session ? (
              <p className="text-gray-600">
                You’re not signed in.{' '}
                <Link to="/login" className="text-blue-600 underline">Sign in</Link> to access your dashboard.
              </p>
            ) : loading ? (
              <p className="text-gray-600">Loading your profile…</p>
            ) : (
              <div className="text-gray-700 space-y-2">
                <p><span className="font-medium">Email:</span> {session.user.email}</p>
                <p><span className="font-medium">Role:</span> {profile?.role ?? 'member'} </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to="/dashboard" className="px-4 py-2 rounded-sm bg-[#003865] text-white">Open Dashboard</Link>
                  <Link to="/self-reporting" className="px-4 py-2 rounded-sm bg-gray-900 text-white">Self-Report</Link>
                  <Link to="/community" className="px-4 py-2 rounded-sm bg-gray-200 text-gray-900">Community</Link>
                  <Link to="/doctors-view" className="px-4 py-2 rounded-sm bg-[#8cc63f] text-white">Doctor’s View</Link>
                  <button onClick={handleSignOut} className="px-4 py-2 rounded-sm border border-gray-300">
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link className="text-blue-600 underline" to="/register">Create an account</Link></li>
              <li><Link className="text-blue-600 underline" to="/change-password">Change password</Link></li>
              <li><Link className="text-blue-600 underline" to="/privacy-policy">Privacy Policy</Link></li>
              <li><Link className="text-blue-600 underline" to="/terms">Terms of Service</Link></li>
            </ul>
          </aside>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-500 py-6">
        © {new Date().getFullYear()} WellFit
      </footer>
    </div>
  );
}
