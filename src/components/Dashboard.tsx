// src/components/Dashboard.tsx
import React from 'react';
import Card from './Card';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext'; // Import useBranding

import WeatherWidget from './WeatherWidget';
import CheckInTracker from './CheckInTracker';
import DailyScripture from './DailyScripture';
import TechTip from './TechTip';
import EmergencyContact from './EmergencyContact';
import AdminPanel from './AdminPanel';
import DashMealOfTheDay from './DashMealOfTheDay';
import DoctorsView from './DoctorsView'; // Import DoctorsView

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const branding = useBranding(); // Get branding object

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
  // For hover, if secondary is dark, text should be light, and vice-versa.
  const secondaryButtonHoverTextColor = isColorDark(branding.secondaryColor) ? 'text-white' : 'text-gray-800';


  return (
    <main className="space-y-6 mt-4 p-4">
      <h1 className="text-3xl font-bold text-center mb-6" style={{ color: branding.primaryColor }}>
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

      <Card><WeatherWidget /></Card>
      <Card><CheckInTracker /></Card>
      <Card><DailyScripture /></Card>

      {/* Meal of the Day preview */}
      <Card>
        <DashMealOfTheDay onSeeDetails={(id) => navigate(`/meal/${id}`)} />
      </Card>

      <Card>
        <button
          className={`w-full py-3 text-lg font-semibold rounded-xl shadow transition-colors ${primaryButtonTextColor}`}
          style={{ backgroundColor: branding.primaryColor }}
          onClick={() => navigate('/wordfind')}
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

      <Card><TechTip /></Card>
      <Card><EmergencyContact /></Card>

      {/* Doctor's View Section */}
      <section className="mt-8 p-6 bg-white shadow-lg rounded-lg border-2" style={{ borderColor: branding.secondaryColor }}>
        <h2 className="text-2xl font-semibold mb-4 text-center" style={{ color: branding.primaryColor }}>
          What My Doctor Sees
        </h2>
        <DoctorsView />
      </section>
      
      {/* Admin Panel might be better placed at the end or in a separate admin route */}
      <Card><AdminPanel /></Card> 
    </main>
  );
};

export default Dashboard;
