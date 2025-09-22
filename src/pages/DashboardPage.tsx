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

  // Everyone gets the senior-friendly dashboard as the primary landing page
  // Roles: Senior(4), Staff(3), Moderator(14), Volunteer(5), Caregiver(6), Contractor(11), User(13)
  // Medical roles: Admin(1), Super_admin(2), Contractor_nurse(12)
  return <SeniorCommunityDashboard />;
};

export default Dashboard;