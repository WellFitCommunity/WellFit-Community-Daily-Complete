import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import ImmunizationDashboard from '../components/patient/ImmunizationDashboard';

const ImmunizationsPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please sign in to view your immunization records.</p>
        </div>
      </div>
    );
  }

  return <ImmunizationDashboard userId={user.id} />;
};

export default ImmunizationsPage;
