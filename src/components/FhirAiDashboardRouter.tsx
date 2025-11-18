// Smart FHIR AI Dashboard Router
// Routes to appropriate dashboard based on user role and context

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import FhirAiDashboard from './admin/FhirAiDashboard';
import FhirAiPatientDashboard from './patient/FhirAiPatientDashboard';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabaseClient';

interface DashboardRouterProps {
  supabaseUrl?: string;
  supabaseKey?: string;
  forceMode?: 'admin' | 'patient'; // Optional prop to force a specific mode
}

interface UserRole {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPatient: boolean;
  roles: string[];
}

const FhirAiDashboardRouter: React.FC<DashboardRouterProps> = ({
  supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '',
  supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '',
  forceMode
}) => {
  const { user } = useAuth();
  const { adminRole, isAdminAuthenticated } = useAdminAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = useState<'admin' | 'patient' | null>(null);

  // Use singleton Supabase client for role checking

  // Determine user roles and capabilities
  const checkUserRoles = React.useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check user roles from database
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesError) {

      }

      // Check profile for patient role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {

      }

      // Determine user capabilities
      const userRoles = roles?.map(r => r.role) || [];
      const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');
      const isSuperAdmin = userRoles.includes('super_admin');
      const isPatient = profile?.role === 'senior' || (!isAdmin && !!user.id);

      const roleInfo: UserRole = {
        isAdmin,
        isSuperAdmin,
        isPatient,
        roles: userRoles
      };

      setUserRole(roleInfo);

      // Determine dashboard mode
      if (forceMode) {
        setDashboardMode(forceMode);
      } else if (isAdminAuthenticated && (isAdmin || isSuperAdmin)) {
        setDashboardMode('admin');
      } else if (isPatient) {
        setDashboardMode('patient');
      } else {
        setDashboardMode('patient'); // Default to patient view
      }

    } catch (error) {

      setError('Unable to determine user permissions');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdminAuthenticated, forceMode]);

  useEffect(() => {
    checkUserRoles();
  }, [checkUserRoles]);

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

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <div>{error}</div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={checkUserRoles}
          >
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Please log in to access your health dashboard.
          </p>
          <Button onClick={() => window.location.href = '/login'}>
            Log In
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Mode selector for users with multiple roles
  if (userRole?.isAdmin && userRole?.isPatient && !forceMode) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Choose Your Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              You have access to both admin and patient dashboards. Which would you like to view?
            </p>
            <div className="flex space-x-4">
              <Button
                onClick={() => setDashboardMode('patient')}
                variant="outline"
                className="flex-1"
              >
                My Health Dashboard
                <span className="text-xs block">View your personal health insights</span>
              </Button>
              <Button
                onClick={() => setDashboardMode('admin')}
                variant="default"
                className="flex-1"
              >
                Admin Dashboard
                <span className="text-xs block">Manage all patients</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render appropriate dashboard
  if (dashboardMode === 'admin' && userRole?.isAdmin && isAdminAuthenticated) {
    return (
      <div className="space-y-4">
        {/* Header with mode info */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">AI-Enhanced FHIR Admin Dashboard</h2>
            <p className="text-sm text-gray-600">
              {adminRole === 'super_admin' ? 'Master Administrator' : 'Administrator'} View
            </p>
          </div>
          {userRole?.isPatient && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDashboardMode('patient')}
            >
              Switch to My Health View
            </Button>
          )}
        </div>

        {/* Admin Dashboard */}
        <FhirAiDashboard
          supabaseUrl={supabaseUrl}
          supabaseKey={supabaseKey}
        />
      </div>
    );
  }

  // Patient dashboard (default)
  return (
    <div className="space-y-4">
      {/* Header with mode info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your AI Health Insights</h2>
          <p className="text-sm text-gray-600">
            Personalized health dashboard powered by AI
          </p>
        </div>
        {userRole?.isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDashboardMode('admin')}
          >
            Switch to Admin View
          </Button>
        )}
      </div>

      {/* Patient Dashboard */}
      <FhirAiPatientDashboard
        supabaseUrl={supabaseUrl}
        supabaseKey={supabaseKey}
      />
    </div>
  );
};

// Higher-order component for easy integration
export const withFhirAiDashboard = (Component: React.ComponentType<any>) => {
  return (props: any) => (
    <div className="space-y-6">
      <Component {...props} />
      <div className="border-t pt-6">
        <FhirAiDashboardRouter />
      </div>
    </div>
  );
};

// Standalone components for specific use cases
export const AdminFhirDashboard: React.FC<{ supabaseUrl?: string; supabaseKey?: string }> = (props) => (
  <FhirAiDashboardRouter {...props} forceMode="admin" />
);

export const PatientFhirDashboard: React.FC<{ supabaseUrl?: string; supabaseKey?: string }> = (props) => (
  <FhirAiDashboardRouter {...props} forceMode="patient" />
);

export default FhirAiDashboardRouter;