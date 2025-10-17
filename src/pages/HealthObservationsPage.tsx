import React from 'react';
import { useUser } from '../contexts/AuthContext';
import ObservationDashboard from '../components/patient/ObservationDashboard';

const HealthObservationsPage: React.FC = () => {
  const user = useUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p>Please log in to view your health observations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ObservationDashboard userId={user.id} />
    </div>
  );
};

export default HealthObservationsPage;
