// src/pages/DashboardPage.tsx - Updated to route users to role-appropriate dashboards
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyProfile } from '../data/profile';
import SeniorCommunityDashboard from '../components/dashboard/SeniorCommunityDashboard';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

        // Check if user has a staff role that requires redirection
        const role = userProfile?.role || '';
        const roleCode = userProfile?.role_code || 0;

        console.log('[DashboardPage] User profile:', { role, roleCode, userId: user.id });

        // Staff role names and codes
        // Note: super_admin (role_code=1) is NOT redirected - they can access both dashboards
        const adminRoles = ['admin', 'department_head'];
        const adminRoleCodes = [2, 11]; // Admin(2), Department_head(11) - excludes Super_admin(1)

        const nurseRoles = ['nurse', 'nurse_practitioner', 'clinical_supervisor'];
        const nurseRoleCodes = [3, 8, 10]; // Nurse(3), NP(8), Clinical_supervisor(10)

        const physicianRoles = ['physician', 'doctor', 'physician_assistant'];
        const physicianRoleCodes = [5, 9]; // Physician(5), PA(9)

        // Caregiver: Only check by role name (no role_code check - it conflicts with volunteer=6)
        const caregiverRoles = ['caregiver'];

        // Super admins have access to BOTH dashboards - they should never be auto-redirected
        const isSuperAdmin = role === 'super_admin' || roleCode === 1;

        if (isSuperAdmin) {
          console.log('[Dashboard] Super admin accessing senior dashboard - allowing access');
          setLoading(false);
          return;
        }

        // Redirect OTHER staff to their appropriate dashboards
        if (adminRoles.includes(role) || adminRoleCodes.includes(roleCode)) {
          console.log('[Dashboard] Admin detected - redirecting to admin panel');
          navigate('/admin', { replace: true });
          return;
        }

        // IMPORTANT: Check caregiver BEFORE nurse (in case of any role overlap)
        if (caregiverRoles.includes(role)) {
          console.log('[Dashboard] Caregiver detected - redirecting to caregiver dashboard');
          navigate('/caregiver-dashboard', { replace: true });
          return;
        }

        if (nurseRoles.includes(role) || nurseRoleCodes.includes(roleCode)) {
          console.log('[Dashboard] Nurse detected - redirecting to nurse dashboard');
          navigate('/nurse-dashboard', { replace: true });
          return;
        }

        if (physicianRoles.includes(role) || physicianRoleCodes.includes(roleCode)) {
          console.log('[Dashboard] Physician detected - redirecting to physician dashboard');
          navigate('/physician-dashboard', { replace: true });
          return;
        }

        console.log('[Dashboard] Senior/regular user detected - showing senior dashboard');
      } catch (e) {
        console.warn('[Dashboard] fetchMyProfile failed:', (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, navigate]);

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

  // Regular users (seniors, volunteers, staff without admin role) get the senior-friendly dashboard
  // Roles: Senior(4), Staff(3), Moderator(14), Volunteer(5), Contractor(11), User(13)
  return <SeniorCommunityDashboard />;
};

export default Dashboard;