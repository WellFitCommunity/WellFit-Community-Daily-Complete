/**
 * Allergies Page - Patient-facing allergy management
 *
 * Wraps AllergyManager component with user context and page layout.
 * Part of MyHealthHub patient health records suite.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import AllergyManager from '../components/patient/AllergyManager';

const AllergiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useBranding();

  if (!user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Please log in to view your allergies.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: branding.gradient }}
    >
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/my-health')}
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4"
          >
            <span>←</span> Back to My Health Records
          </button>
          <div className="flex items-center gap-4">
            <span className="text-5xl">⚠️</span>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">
                My Allergies
              </h1>
              <p className="text-lg text-white/90 mt-1">
                Track your allergies and intolerances for safer care
              </p>
            </div>
          </div>
        </div>

        {/* Allergy Manager Component */}
        <AllergyManager userId={user.id} />
      </div>
    </div>
  );
};

export default AllergiesPage;
