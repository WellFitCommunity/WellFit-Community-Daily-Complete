// src/components/Dashboard.tsx
import * as React from 'react';
import Card from '../components/ui/PrettyCard';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';
import WeatherWidget from '../components/dashboard/WeatherWidget';
import CheckInTracker from '../pages/CheckInPage';
import DailyScripture from '../components/dashboard/DailyScripture';
import TechTip from '../components/dashboard/TechTip';
import EmergencyContact from '../components/features/EmergencyContact';
import DashMealOfTheDay from '../components/dashboard/DashMealOfTheDay';
import DoctorsView from '../pages/DoctorsViewPage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import AdminPanel from '../components/admin/AdminPanel'; // Will be used in future enhancements

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const branding = useBranding();

  // Helper to determine if a color is dark
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

      {/* Return link */}
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
      <Card>
        <CheckInTracker />
      </Card>

      {/* Daily Check-in Navigation Card */}
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

      {/* Meal of the Day preview */}
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

      {/* Trivia Game Navigation Card */}
      <Card>
        <button
          className="w-full py-3 text-lg font-semibold bg-[#6B21A8] text-white rounded-xl shadow hover:bg-[#F59E0B] transition"
          onClick={() => navigate('/trivia-game')}
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

      {/* Doctor's View Section */}
      <section
        className="mt-8 p-6 bg-white shadow-lg rounded-lg border-2"
        style={{ borderColor: branding.secondaryColor }}
      >
        <h2
          className="text-2xl font-semibold mb-4 text-center"
          style={{ color: branding.primaryColor }}
        >
          What My Doctor Sees
        </h2>
        <DoctorsView />
      </section>

      {/* Admin Panel might be better placed at the end or in a separate admin route */}
      {/* <Card><AdminPanel /></Card> */}
    </main>
  );
};

export default Dashboard;
