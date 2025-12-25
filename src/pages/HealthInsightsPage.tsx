// Health Insights Page - AI-powered personalized health dashboard
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../BrandingContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyProfile } from '../data/profile';
import FhirAiDashboardRouter from '../components/FhirAiDashboardRouter';

const HealthInsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);

  // Check if user is authenticated
  React.useEffect(() => {
    (async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Verify profile exists
        await fetchMyProfile();
      } catch (e) {
        // Removed console statement.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-white">Loading your health insights...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: branding.gradient }}
    >
      <div className="container mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-white hover:text-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: branding.primaryColor }}
          >
            Welcome to {branding.appName}
          </h1>
          <p className="text-white">
            Your personalized health dashboard
          </p>
        </div>

        {/* Smart Dashboard Router handles all role-based logic */}
        <FhirAiDashboardRouter />
      </div>
    </div>
  );
};

export default HealthInsightsPage;