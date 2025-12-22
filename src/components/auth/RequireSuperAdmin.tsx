// src/components/auth/RequireSuperAdmin.tsx
// SECURITY: Route guard for super-admin only routes
// This component ensures only platform-level super-admins can access protected routes
// Supports both Supabase auth (legacy JWT) and Envision standalone auth

import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, useUser } from '../../contexts/AuthContext';
import { SuperAdminService } from '../../services/superAdminService';
import { auditLogger } from '../../services/auditLogger';

// Envision auth storage keys (must match EnvisionAuthContext)
const ENVISION_SESSION_KEY = 'envision_session';
const ENVISION_USER_KEY = 'envision_user';

interface RequireSuperAdminProps {
  children: ReactNode;
}

export default function RequireSuperAdmin({ children }: RequireSuperAdminProps) {
  const location = useLocation();
  const { loading: authLoading } = useAuth();
  const user = useUser();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      // Check for Envision standalone session first (bypasses Supabase JWT requirement)
      const envisionSession = localStorage.getItem(ENVISION_SESSION_KEY);
      const envisionUser = localStorage.getItem(ENVISION_USER_KEY);

      if (envisionSession && envisionUser) {
        // User has Envision session - they're authenticated via Edge Function
        setIsSuperAdmin(true);
        setIsChecking(false);
        return;
      }

      // Fall back to Supabase auth check
      if (!user) {
        setIsSuperAdmin(false);
        setIsChecking(false);
        return;
      }

      try {
        const result = await SuperAdminService.isSuperAdmin();
        setIsSuperAdmin(result);

        if (!result) {
          // Log unauthorized access attempt
          await auditLogger.security('SUPER_ADMIN_ROUTE_ACCESS_DENIED', 'high', {
            userId: user.id,
            attemptedPath: location.pathname
          });
        }
      } catch (error) {
        await auditLogger.error('SUPER_ADMIN_CHECK_FAILED', error as Error, {
          userId: user.id,
          category: 'SECURITY_EVENT'
        });
        setIsSuperAdmin(false);
      } finally {
        setIsChecking(false);
      }
    };

    if (!authLoading) {
      checkSuperAdmin();
    }
  }, [user, authLoading, location.pathname]);

  // While checking auth or super-admin status
  if (authLoading || isChecking) {
    return (
      <div className="w-full h-[40vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying super admin access...</p>
        </div>
      </div>
    );
  }

  // Check for Envision session OR Supabase user
  const hasEnvisionSession = localStorage.getItem(ENVISION_SESSION_KEY) && localStorage.getItem(ENVISION_USER_KEY);

  // Not signed in via either method → send to Envision login
  if (!user && !hasEnvisionSession) {
    return <Navigate to="/envision" state={{ from: location }} replace />;
  }

  // Has some auth but not a super admin → send to unauthorized page
  if (!isSuperAdmin) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // All good → render protected super-admin content
  return <>{children}</>;
}
