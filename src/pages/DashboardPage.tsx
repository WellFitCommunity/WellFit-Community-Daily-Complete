// src/components/Dashboard.tsx
import * as React from 'react';
import Card from '../components/ui/PrettyCard';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';
import WeatherWidget from '../components/dashboard/WeatherWidget';
// ✅ Use the component, not the page wrapper
import CheckInTracker from '../components/CheckInTracker';
import DailyScripture from '../components/dashboard/DailyScripture';
import TechTip from '../components/dashboard/TechTip';
import EmergencyContact from '../components/features/EmergencyContact';
import DashMealOfTheDay from '../components/dashboard/DashMealOfTheDay';
// ❌ Do not embed Doctor’s View on the dashboard
// import DoctorsView from '../pages/DoctorsViewPage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import AdminPanel from '../components/admin/AdminPanel'; // Future use

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const branding = useBranding();

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
      <h1
        className="text-2xl sm:text-3xl font-bold text-center mb-6"
        style={{ color: branding.primaryColor }}
      >
        Welcome to {branding.appName} Dashboard
      </h1>

      {/* Return link (hide if you later gate by role) */}
      <button
        onClick={() => navigate('/senior-enrollment')}
        className="text-sm underline mb-4"
        style={{ color: branding.secondaryColor }}
      >
        ← Return to Enrollment
      </button>

      <Card>
        <WeatherWidget />
      </Card>

      {/* ✅ Keep full check-in inline on the dashboard */}
      <Card>
        <CheckInTracker />
      </Card>

      {/* Optional: keep a button to the dedicated check-in page if you still want it */}
      <Card>
        <button
          className="w-full py-3 text-lg font-semibold bg-[#003865] text-white rounded-xl shadow hover:bg-[#8cc63f] transition"
          onClick={() => navigate('/check-in')}
        >
          📝 My Daily Check-in
        </button>
      </Card>

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

      {/* ✅ Doctor’s View is NOT embedded here. Give a clear button to the page. */}
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
