// src/pages/DashboardPage.tsx - Updated to use new Senior Community Dashboard
import React from 'react';
import { useBranding } from '../BrandingContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyProfile } from '../data/profile';
import FhirAiDashboardRouter from '../components/FhirAiDashboardRouter';
import SeniorCommunityDashboard from '../components/dashboard/SeniorCommunityDashboard';

const Dashboard: React.FC = () => {
  const { branding } = useBranding();
  const { user } = useAuth();
  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  // Load user profile to determine dashboard type
  React.useEffect(() => {
    (async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const userProfile = await fetchMyProfile();
        setProfile(userProfile);
      } catch (e) {
        console.warn('[Dashboard] fetchMyProfile failed:', (e as Error).message);
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
          <div>Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  // HIPAA-compliant access control based on role codes
  const roleCode = profile?.role_code;
  const roleName = profile?.role;

  // FHIR + Admin access only for medical roles (minimum necessary principle)
  const hasFhirAccess = [1, 2, 12].includes(roleCode) ||
    ['admin', 'super_admin', 'contractor_nurse'].includes(roleName);

  if (hasFhirAccess) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          {/* Page Header */}
          <div className="mb-8 text-center">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: branding.primaryColor }}
            >
              Welcome to {branding.appName}
            </h1>
            <p className="text-gray-600">
              Your personalized health dashboard powered by AI
            </p>
          </div>

          {/* Smart Dashboard Router handles all role-based logic */}
          <FhirAiDashboardRouter />
        </div>
      </div>
    );
  }

  // Everyone else gets the NEW senior community dashboard
  // Roles: Senior(4), Staff(3), Moderator(14), Volunteer(5), Caregiver(6), Contractor(11), User(13)
  return <SeniorCommunityDashboard />;
};

export default Dashboard;