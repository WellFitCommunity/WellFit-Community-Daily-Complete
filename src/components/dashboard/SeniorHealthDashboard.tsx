// Senior-Friendly Health Dashboard
// Ultra-simple interface with large buttons, clear messaging, and minimal clicks

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../BrandingContext';
import CheckInTracker from '../CheckInTracker';
import HealthHistory from '../HealthHistory';
import DashMealOfTheDay from './DashMealOfTheDay';
import WeatherWidget from './WeatherWidget';
import DailyScripture from './DailyScripture';
import TechTip from './TechTip';
import EmergencyContact from '../features/EmergencyContact';
import PositiveAffirmations from './PositiveAffirmations';

const SeniorHealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();

  return (
    <div
      className="min-h-screen"
      style={{ background: branding.gradient }}
    >
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Simple Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Your Health Today
          </h1>
          <p className="text-lg sm:text-xl text-gray-600">
            Let's check in today
          </p>
        </div>

        {/* Grid Layout for Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

          {/* Weather Widget - Stationary */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <WeatherWidget />
          </div>

          {/* Scripture Widget - Stationary */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <DailyScripture />
          </div>

          {/* Daily Check-in - Stationary and Essential */}
          <div className="md:col-span-2 bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <CheckInTracker />
          </div>

          {/* Health History - Shows past check-ins */}
          <div className="md:col-span-2 bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <HealthHistory />
          </div>

          {/* Emergency Contact - Stationary */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <EmergencyContact />
          </div>

          {/* Positive Affirmations - Stationary */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <PositiveAffirmations />
          </div>

          {/* Tech Tips - Stationary */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <TechTip />
          </div>

          {/* Self Report Button - Card with Button */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-center">
            <div className="text-2xl sm:text-3xl mb-3">📋</div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3">
              Self Report
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Share how you're feeling with your care team
            </p>
            <button
              onClick={() => navigate('/self-reporting')}
              className="bg-blue-600 text-white text-lg sm:text-xl px-4 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-blue-700 transition-colors w-full"
            >
              📝 Report Symptoms
            </button>
          </div>

          {/* Today's Meal - Stationary but can open page */}
          <div className="md:col-span-2 bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <DashMealOfTheDay />
          </div>

          {/* Brain Games - Cards with buttons to pages */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-center">
            <div className="text-2xl sm:text-3xl mb-3">🧩</div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3">
              Word Search
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Keep your mind sharp with daily puzzles
            </p>
            <button
              onClick={() => navigate('/word-find')}
              className="bg-blue-600 text-white text-lg sm:text-xl px-4 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-blue-700 transition-colors w-full"
            >
              🧩 Play Puzzle
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-center">
            <div className="text-2xl sm:text-3xl mb-3">🎭</div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3">
              Memory Lane
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Take a trip down memory lane with questions from your era
            </p>
            <button
              onClick={() => navigate('/memory-lane-trivia')}
              className="bg-purple-600 text-white text-lg sm:text-xl px-4 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-purple-700 transition-colors w-full"
            >
              🎭 Visit Memory Lane
            </button>
          </div>

          {/* Doctor's View - Card with button */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-center">
            <div className="text-2xl sm:text-3xl mb-3">🩺</div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3">
              For Your Doctor
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              View your health summary to share with your healthcare team
            </p>
            <button
              onClick={() => navigate('/doctors-view')}
              className="bg-green-600 text-white text-lg sm:text-xl px-4 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-green-700 transition-colors w-full"
            >
              📋 Health Summary
            </button>
          </div>

          {/* Community - Card with button */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-center">
            <div className="text-2xl sm:text-3xl mb-3">👥</div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3">
              Community
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Connect with other community members
            </p>
            <button
              onClick={() => navigate('/community')}
              className="bg-orange-600 text-white text-lg sm:text-xl px-4 sm:px-8 py-3 sm:py-4 rounded-xl hover:bg-orange-700 transition-colors w-full"
            >
              👥 Join Community
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SeniorHealthDashboard;