// src/components/Dashboard.tsx
import * as React from 'react';
import Card from '../components/ui/PrettyCard';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';
import WeatherWidget from '../components/dashboard/WeatherWidget';
import CheckInTracker from '../components/CheckInTracker';
import DailyScripture from '../components/dashboard/DailyScripture';
import TechTip from '../components/dashboard/TechTip';
import EmergencyContact from '../components/features/EmergencyContact';
import DashMealOfTheDay from '../components/dashboard/DashMealOfTheDay';
import SimpleFhirAiWidget from '../components/dashboard/SimpleFhirAiWidget';
import { fetchMyProfile, updateMyProfile } from '../data/profile';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import AdminPanel from '../components/admin/AdminPanel'; // Future use

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();

  // NEW: local state for the current user's profile
  const [me, setMe] = React.useState<any>(null);
  const [saving, setSaving] = React.useState(false);

  // Load profile once (uses .eq('user_id', user.id) under the hood)
  React.useEffect(() => {
    (async () => {
      try {
        const profile = await fetchMyProfile();
        setMe(profile);
      } catch (e) {
        console.warn('[Dashboard] fetchMyProfile failed:', (e as Error).message);
      }
    })();
  }, []);

  // Optional example: save email (remove if not needed)
  async function saveEmail() {
    if (!me?.email) return;
    try {
      setSaving(true);
      const updated = await updateMyProfile({ email: me.email });
      setMe(updated);
    } catch (e) {
      console.error('[Dashboard] updateMyProfile failed:', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const isColorDark = (colorStr: string) => {
    if (!colorStr) return true;
    const color = colorStr.startsWith('#') ? colorStr.substring(1) : colorStr;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  const primaryButtonTextColor = isColorDark(branding.primaryColor) ? 'text-white' : 'text-gray-800';
  const secondaryButtonHoverTextColor = isColorDark(branding.secondaryColor) ? 'text-white' : 'text-gray-800';

  return (
    <main className="space-y-6 mt-4 p-4">
      {/* Greeting pulled from profile (falls back to email if you add name later) */}
      <h1
        className="text-2xl sm:text-3xl font-bold text-center mb-2"
        style={{ color: branding.primaryColor }}
      >
        Welcome{me?.email ? `, ${me.email}` : ''} to {branding.appName} Dashboard
      </h1>

      {/* Optional inline email editor (remove if not needed) */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <input
          className="border rounded px-3 py-2 w-64"
          placeholder="your@email.com"
          value={me?.email ?? ''}
          onChange={(e) => setMe((prev: any) => ({ ...(prev || {}), email: e.target.value }))}
        />
        <button
          onClick={saveEmail}
          disabled={saving}
          className="px-4 py-2 rounded bg-[#003865] text-white hover:bg-[#8cc63f] transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Email'}
        </button>
      </div>

      {/* Navigation to community */}
      <button
        onClick={() => navigate('/community')}
        className="text-sm underline mb-4"
        style={{ color: branding.secondaryColor }}
      >
        → View Community Moments
      </button>

      {/* AI Health Widget - Top Priority */}
      <div className="mb-6">
        <SimpleFhirAiWidget />
      </div>

      <Card>
        <WeatherWidget />
      </Card>

      <Card>
        <CheckInTracker />
      </Card>

      {/* Smart Check-in is now handled by AI Widget above */}

      <Card>
        <DailyScripture />
      </Card>

      <Card>
        <DashMealOfTheDay />
      </Card>

      <Card>
        <button
          className={`w-full py-3 text-lg font-semibold rounded-xl shadow transition-colors ${primaryButtonTextColor}`}
          style={{ backgroundColor: branding.primaryColor }}
          onClick={() => navigate('/word-find')}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = branding.secondaryColor;
            e.currentTarget.style.color = secondaryButtonHoverTextColor;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = branding.primaryColor;
            e.currentTarget.style.color = primaryButtonTextColor;
          }}
        >
          🧠 Play Word Find Puzzle
        </button>
      </Card>

      <Card>
        <button
          className="w-full py-3 text-lg font-semibold rounded-xl shadow transition"
          style={{ backgroundColor: '#6B21A8', color: '#FFFFFF' }}
          onClick={() => navigate('/trivia-game')}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#F59E0B';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#6B21A8';
          }}
        >
          🏆 Daily Trivia Challenge
        </button>
      </Card>

      <Card>
        <TechTip />
      </Card>
      <Card>
        <EmergencyContact />
      </Card>

      <section
        className="mt-8 p-6 bg-white shadow-lg rounded-lg border-2 text-center"
        style={{ borderColor: branding.secondaryColor }}
      >
        <h2
          className="text-2xl font-semibold mb-4"
          style={{ color: branding.primaryColor }}
        >
          What My Doctor Sees
        </h2>
        <p className="text-gray-600 mb-4">
          View a summary of your recent check-ins and health info for clinic visits.
        </p>
        <button
          className="px-6 py-3 rounded-xl font-semibold shadow text-white hover:opacity-90"
          style={{ backgroundColor: branding.secondaryColor }}
          onClick={() => navigate('/doctors-view')}
        >
          🩺 Open Doctor’s View
        </button>
      </section>
    </main>
  );
};

export default Dashboard;
