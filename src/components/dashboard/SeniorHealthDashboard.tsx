// Senior-Friendly Health Dashboard
// Ultra-simple interface with large buttons, clear messaging, and minimal clicks

import React from 'react';
import { useNavigate } from 'react-router-dom';
import SimpleFhirAiWidget from './SimpleFhirAiWidget';
import CheckInTracker from '../CheckInTracker';
import DashMealOfTheDay from './DashMealOfTheDay';

const SeniorHealthDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Simple Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Your Health Today
          </h1>
          <p className="text-xl text-gray-600">
            Let's see how you're doing
          </p>
        </div>

        {/* Main AI Health Widget */}
        <SimpleFhirAiWidget />

        {/* Daily Check-in - Essential for health tracking */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <CheckInTracker />
        </div>

        {/* Today's Meal - Social determinant tracking */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <DashMealOfTheDay />
        </div>

        {/* Brain Games - Cognitive health tracking */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-3xl mb-3">🧠</div>
          <div className="text-2xl font-bold text-gray-800 mb-3">Keep Your Mind Sharp</div>
          <div className="text-gray-600 mb-6">
            Daily brain exercises help maintain cognitive health
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => navigate('/word-find')}
              className="bg-blue-600 text-white text-xl px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors"
            >
              🧩 Word Search Puzzle
            </button>
            <button
              onClick={() => navigate('/trivia-game')}
              className="bg-purple-600 text-white text-xl px-8 py-4 rounded-xl hover:bg-purple-700 transition-colors"
            >
              🏆 Daily Trivia
            </button>
          </div>
        </div>

        {/* Doctor's View - Easy access to health summary */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-3xl mb-3">🩺</div>
          <div className="text-2xl font-bold text-gray-800 mb-3">For Your Doctor</div>
          <div className="text-gray-600 mb-4">
            View your health summary to share with your healthcare team
          </div>
          <button
            onClick={() => navigate('/doctors-view')}
            className="bg-green-600 text-white text-xl px-8 py-4 rounded-xl hover:bg-green-700 transition-colors w-full"
          >
            📋 My Health Summary
          </button>
        </div>

        {/* Quick Help */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-3xl mb-3">💬</div>
          <div className="text-2xl font-bold text-gray-800 mb-3">Need Help?</div>
          <div className="text-gray-600 mb-4">
            If you have questions or concerns, we're here to help
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => window.location.href = 'tel:1-800-WELLFIT'}
              className="bg-red-600 text-white text-xl px-8 py-4 rounded-xl hover:bg-red-700 transition-colors"
            >
              📞 Call Support
            </button>
            <button
              onClick={() => navigate('/community')}
              className="bg-orange-600 text-white text-xl px-8 py-4 rounded-xl hover:bg-orange-700 transition-colors"
            >
              👥 Community
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeniorHealthDashboard;