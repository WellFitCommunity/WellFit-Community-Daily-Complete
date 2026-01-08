import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/AuthContext';
import FHIRService from '../../services/fhirResourceService';
import type { Observation } from '../../types/fhir';

const HealthObservationsWidget: React.FC = () => {
  const navigate = useNavigate();
  const user = useUser();
  const [latestObservations, setLatestObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLatestObservations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await FHIRService.Observation.getByPatient(user.id);
      if (response.success && response.data) {
        // Get the 3 most recent observations
        setLatestObservations(response.data.slice(0, 3));
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadLatestObservations();
    }
  }, [user?.id, loadLatestObservations]);

  const formatValue = (obs: Observation) => {
    if (obs.components && obs.components.length > 0) {
      const comp = obs.components[0];
      return `${comp.value} ${comp.unit}`;
    }
    if (obs.value_quantity_value !== undefined) {
      return `${obs.value_quantity_value} ${obs.value_quantity_unit || ''}`;
    }
    return 'N/A';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getIcon = (category: string[]) => {
    if (category.includes('vital-signs')) return '💓';
    if (category.includes('laboratory')) return '🔬';
    if (category.includes('social-history')) return '📋';
    return '📊';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-[#003865] mb-4 flex items-center justify-center gap-2">
          <span>📊</span>
          Health Observations
        </h3>

        {latestObservations.length === 0 ? (
          <div className="py-6">
            <div className="text-5xl mb-3">💓</div>
            <p className="text-gray-600 mb-4 text-sm">Track your vitals and lab results</p>
            <button
              onClick={() => navigate('/health-observations')}
              className="w-full p-3 bg-[#8cc63f] text-white rounded-lg hover:bg-[#003865] transition font-semibold"
            >
              Start Tracking
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {latestObservations.map((obs) => (
                <div
                  key={obs.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl">{getIcon(obs.category)}</span>
                    <div className="text-left flex-1">
                      <div className="font-semibold text-sm text-gray-900">{obs.code_display}</div>
                      <div className="text-xs text-gray-500">{formatDate(obs.effective_datetime)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#003865]">{formatValue(obs)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => navigate('/health-observations')}
                className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition font-semibold"
              >
                View All Observations
              </button>
              <button
                onClick={() => navigate('/health-observations?add=true')}
                className="w-full p-3 bg-[#8cc63f] text-white rounded-lg hover:bg-[#003865] transition font-semibold"
              >
                + Add New Reading
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HealthObservationsWidget;
