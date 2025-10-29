import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/AuthContext';
import FHIRService from '../../services/fhirResourceService';
import type { FHIRCarePlan } from '../../types/fhir';

const CarePlansWidget: React.FC = () => {
  const navigate = useNavigate();
  const user = useUser();
  const [currentPlan, setCurrentPlan] = useState<any | null>(null);
  const [activePlans, setActivePlans] = useState<FHIRCarePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadCarePlans();
    }
  }, [user?.id]);

  const loadCarePlans = async () => {
    if (!user?.id) return;

    try {
      const [currentResult, activeResult] = await Promise.all([
        FHIRService.CarePlan.getCurrent(user.id),
        FHIRService.CarePlan.getActive(user.id),
      ]);

      if (currentResult.success && currentResult.data) {
        setCurrentPlan(currentResult.data);
      }
      if (activeResult.success && activeResult.data) {
        setActivePlans(activeResult.data);
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getActivityProgress = (plan: any) => {
    if (!plan.activities || plan.activities.length === 0) return null;

    const completed = plan.activities.filter((a: any) => a.status === 'completed').length;
    const total = plan.activities.length;
    const percentage = Math.round((completed / total) * 100);

    return { completed, total, percentage };
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
          <span>📋</span>
          Care Plans
        </h3>

        {!currentPlan && activePlans.length === 0 ? (
          <div className="py-6">
            <div className="text-5xl mb-3">🎯</div>
            <p className="text-gray-600 mb-4 text-sm">Coordinate your healthcare goals</p>
            <button
              onClick={() => navigate('/care-plans')}
              className="w-full p-3 bg-[#8cc63f] text-white rounded-lg hover:bg-[#003865] transition font-semibold"
            >
              View Care Plans
            </button>
          </div>
        ) : (
          <>
            {/* Current Active Plan */}
            {currentPlan && (
              <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xl">⭐</span>
                  <div className="text-left flex-1">
                    <div className="font-bold text-sm text-green-900">
                      {currentPlan.title || 'Current Care Plan'}
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      {currentPlan.description}
                    </div>
                    <div className="text-xs text-green-600 mt-2">
                      {formatDate(currentPlan.period_start)} - {formatDate(currentPlan.period_end)}
                    </div>

                    {/* Activity Progress */}
                    {(() => {
                      const progress = getActivityProgress(currentPlan);
                      if (progress) {
                        return (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-green-800 mb-1">
                              <span>Progress</span>
                              <span>{progress.completed}/{progress.total} activities</span>
                            </div>
                            <div className="w-full bg-green-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Active Plans Count */}
            {activePlans.length > 1 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-900">
                  <span className="font-semibold">{activePlans.length}</span> active care plans
                </div>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => navigate('/care-plans')}
                className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition font-semibold"
              >
                View All Plans
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CarePlansWidget;
