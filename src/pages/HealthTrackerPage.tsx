// src/pages/HealthTrackerPage.tsx - AI-Lite Self Reporting Dashboard
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SeniorHealthDashboard from '../components/dashboard/SeniorHealthDashboard';

const HealthTrackerPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>
      <SeniorHealthDashboard />
    </div>
  );
};

export default HealthTrackerPage;