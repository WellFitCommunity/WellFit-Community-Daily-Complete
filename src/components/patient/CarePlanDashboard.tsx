import React, { useState, useEffect } from 'react';
import FHIRService from '../../services/fhirResourceService';
import type { FHIRCarePlan, CarePlanActivity } from '../../types/fhir';
import { CARE_PLAN_CATEGORY_NAMES } from '../../types/fhir';
import CarePlanEntry from './CarePlanEntry';

interface CarePlanDashboardProps {
  userId: string;
  readOnly?: boolean;
}

type TabType = 'all' | 'active' | 'completed';

const CarePlanDashboard: React.FC<CarePlanDashboardProps> = ({ userId, readOnly = false }) => {
  const [carePlans, setCarePlans] = useState<FHIRCarePlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any | null>(null);
  const [filteredPlans, setFilteredPlans] = useState<FHIRCarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<FHIRCarePlan | null>(null);
  const [activitySummaries, setActivitySummaries] = useState<Record<string, any>>({});

  useEffect(() => {
    loadCarePlans();
    loadCurrentPlan();
  }, [userId]);

  useEffect(() => {
    filterPlans();
  }, [activeTab, carePlans]);

  const loadCarePlans = async () => {
    setLoading(true);
    try {
      const data = await FHIRService.CarePlan.getByPatient(userId);
      setCarePlans(data);

      // Load activity summaries for each plan
      const summaries: Record<string, any> = {};
      for (const plan of data) {
        try {
          const summary = await FHIRService.CarePlan.getActivitiesSummary(plan.id);
          summaries[plan.id] = summary;
        } catch (error) {
          console.error(`Failed to load summary for plan ${plan.id}:`, error);
        }
      }
      setActivitySummaries(summaries);
    } catch (error) {
      console.error('Failed to load care plans:', error);
    }
    setLoading(false);
  };

  const loadCurrentPlan = async () => {
    try {
      const current = await FHIRService.CarePlan.getCurrent(userId);
      setCurrentPlan(current);
    } catch (error) {
      console.error('Failed to load current care plan:', error);
    }
  };

  const filterPlans = () => {
    let filtered = carePlans;

    switch (activeTab) {
      case 'active':
        filtered = carePlans.filter(plan => plan.status === 'active');
        break;
      case 'completed':
        filtered = carePlans.filter(plan => plan.status === 'completed');
        break;
      default:
        filtered = carePlans;
    }

    setFilteredPlans(filtered);
  };

  const handleCarePlanCreated = () => {
    loadCarePlans();
    loadCurrentPlan();
    setShowAddForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'revoked':
      case 'entered-in-error':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getActivityStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in-progress':
        return 'text-blue-600';
      case 'not-started':
        return 'text-gray-600';
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryDisplay = (categories: string[]) => {
    return categories.map(cat => CARE_PLAN_CATEGORY_NAMES[cat] || cat).join(', ');
  };

  const getActivityProgress = (planId: string) => {
    const summary = activitySummaries[planId];
    if (!summary || summary.total_activities === 0) return null;

    const completed = summary.completed_activities || 0;
    const total = summary.total_activities || 0;
    const percentage = Math.round((completed / total) * 100);

    return { completed, total, percentage };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (showAddForm) {
    return (
      <CarePlanEntry
        userId={userId}
        onSave={handleCarePlanCreated}
        onCancel={() => setShowAddForm(false)}
      />
    );
  }

  // Stats
  const totalPlans = carePlans.length;
  const activePlans = carePlans.filter(p => p.status === 'active').length;
  const completedPlans = carePlans.filter(p => p.status === 'completed').length;
  const onHoldPlans = carePlans.filter(p => p.status === 'on-hold').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-8 mb-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">📋 Care Plans</h1>
            <p className="text-blue-100">Coordinate and track your healthcare goals and activities</p>
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 font-semibold shadow-lg"
            >
              + New Care Plan
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{totalPlans}</div>
            <div className="text-sm text-blue-100">Total Plans</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{activePlans}</div>
            <div className="text-sm text-blue-100">Active</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{completedPlans}</div>
            <div className="text-sm text-blue-100">Completed</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{onHoldPlans}</div>
            <div className="text-sm text-blue-100">On Hold</div>
          </div>
        </div>
      </div>

      {/* Current Active Plan Highlight */}
      {currentPlan && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 mb-6 shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⭐</span>
                <h2 className="text-xl font-bold text-gray-900">Current Care Plan</h2>
              </div>
              <h3 className="text-2xl font-semibold text-green-900 mb-1">
                {currentPlan.title || 'Untitled Care Plan'}
              </h3>
              <p className="text-sm text-gray-700">{currentPlan.description}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(currentPlan.status)}`}>
              {currentPlan.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Category:</span>{' '}
                {getCategoryDisplay(currentPlan.category)}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Period:</span>{' '}
                {formatDate(currentPlan.period_start)} - {formatDate(currentPlan.period_end)}
              </p>
            </div>
            {currentPlan.care_team_display && (
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Care Team:</span>{' '}
                  {currentPlan.care_team_display}
                </p>
              </div>
            )}
          </div>

          {currentPlan.goal_displays && currentPlan.goal_displays.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Goals:</p>
              <ul className="space-y-1">
                {currentPlan.goal_displays.map((goal: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-green-600">🎯</span>
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => setSelectedPlan(currentPlan)}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            View Full Plan →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Plans ({carePlans.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'active'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active ({activePlans})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'completed'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Completed ({completedPlans})
          </button>
        </div>
      </div>

      {/* Care Plans List */}
      <div className="space-y-4">
        {filteredPlans.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
            <span className="text-6xl mb-4 block">📋</span>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Care Plans Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create a care plan to coordinate your healthcare goals and activities.
            </p>
            {!readOnly && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                + Create Your First Care Plan
              </button>
            )}
          </div>
        ) : (
          filteredPlans.map((plan) => {
            const progress = getActivityProgress(plan.id);

            return (
              <div
                key={plan.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {plan.title || 'Untitled Care Plan'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">{plan.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(plan.status)}`}>
                        {plan.status}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                        {plan.intent}
                      </span>
                      {plan.category.map((cat, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
                          {CARE_PLAN_CATEGORY_NAMES[cat] || cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Period:</span>{' '}
                      {formatDate(plan.period_start)} - {formatDate(plan.period_end)}
                    </p>
                    {plan.author_display && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Author:</span>{' '}
                        {plan.author_display}
                      </p>
                    )}
                  </div>
                  {plan.care_team_display && (
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Care Team:</span>{' '}
                        {plan.care_team_display}
                      </p>
                    </div>
                  )}
                </div>

                {/* Activity Progress */}
                {progress && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Activity Progress</span>
                      <span className="text-sm text-gray-600">
                        {progress.completed} of {progress.total} completed
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-1">{selectedPlan.title || 'Untitled Care Plan'}</h2>
                  <p className="text-blue-100">{selectedPlan.description}</p>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status and Intent */}
              <div className="flex gap-2">
                <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(selectedPlan.status)}`}>
                  {selectedPlan.status}
                </span>
                <span className="px-4 py-2 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                  {selectedPlan.intent}
                </span>
              </div>

              {/* Categories */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPlan.category.map((cat, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-sm">
                      {CARE_PLAN_CATEGORY_NAMES[cat] || cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Period */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Active Period</h3>
                <p className="text-gray-900">
                  {formatDate(selectedPlan.period_start)} - {formatDate(selectedPlan.period_end)}
                </p>
              </div>

              {/* Author and Care Team */}
              {(selectedPlan.author_display || selectedPlan.care_team_display) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPlan.author_display && (
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-1">Author</h3>
                      <p className="text-gray-900">{selectedPlan.author_display}</p>
                    </div>
                  )}
                  {selectedPlan.care_team_display && (
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-1">Care Team</h3>
                      <p className="text-gray-900">{selectedPlan.care_team_display}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Goals */}
              {selectedPlan.goal_displays && selectedPlan.goal_displays.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Goals</h3>
                  <ul className="space-y-2">
                    {selectedPlan.goal_displays.map((goal, index) => (
                      <li key={index} className="flex items-start gap-2 text-gray-900">
                        <span className="text-green-600 mt-1">🎯</span>
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Conditions Addressed */}
              {selectedPlan.addresses_condition_displays && selectedPlan.addresses_condition_displays.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Addresses Conditions</h3>
                  <ul className="space-y-1">
                    {selectedPlan.addresses_condition_displays.map((condition, index) => (
                      <li key={index} className="text-gray-900 text-sm">
                        • {condition}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activities */}
              {selectedPlan.activities && selectedPlan.activities.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Activities</h3>
                  <div className="space-y-3">
                    {selectedPlan.activities.map((activity: CarePlanActivity, index: number) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            {activity.detail?.code_display || `Activity ${index + 1}`}
                          </h4>
                          {activity.status && (
                            <span className={`text-sm font-medium ${getActivityStatusColor(activity.status)}`}>
                              {activity.status}
                            </span>
                          )}
                        </div>
                        {activity.detail?.description && (
                          <p className="text-sm text-gray-600 mb-2">{activity.detail.description}</p>
                        )}
                        {activity.detail?.performer_display && activity.detail.performer_display.length > 0 && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Performer:</span>{' '}
                            {activity.detail.performer_display.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedPlan.note && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedPlan.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarePlanDashboard;
