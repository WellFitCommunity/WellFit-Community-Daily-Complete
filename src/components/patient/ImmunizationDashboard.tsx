import React, { useState, useEffect } from 'react';
import FHIRService from '../../services/fhirResourceService';
import type { FHIRImmunization } from '../../types/fhir';
import { VACCINE_NAMES, SENIOR_VACCINE_CODES } from '../../types/fhir';
import ImmunizationTimeline from './ImmunizationTimeline';
import ImmunizationEntry from './ImmunizationEntry';

interface ImmunizationDashboardProps {
  userId: string;
  readOnly?: boolean;
}

type TabType = 'all' | 'completed' | 'gaps';

interface VaccineGap {
  vaccine_code: string;
  vaccine_name: string;
  last_received_date: string | null;
  months_since_last: number | null;
  recommendation: string;
}

const ImmunizationDashboard: React.FC<ImmunizationDashboardProps> = ({ userId, readOnly = false }) => {
  const [immunizations, setImmunizations] = useState<FHIRImmunization[]>([]);
  const [vaccineGaps, setVaccineGaps] = useState<VaccineGap[]>([]);
  const [filteredImmunizations, setFilteredImmunizations] = useState<FHIRImmunization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedImmunization, setSelectedImmunization] = useState<FHIRImmunization | null>(null);

  useEffect(() => {
    loadImmunizations();
    loadVaccineGaps();
  }, [userId]);

  useEffect(() => {
    filterImmunizations();
  }, [activeTab, immunizations]);

  const loadImmunizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await FHIRService.Immunization.getByPatient(userId);
      setImmunizations(data);
    } catch (error: any) {
      console.error('Failed to load immunizations:', error);
      setError(error?.message || 'Failed to load immunization records. Please try again later.');
    }
    setLoading(false);
  };

  const loadVaccineGaps = async () => {
    try {
      const gaps = await FHIRService.Immunization.getVaccineGaps(userId);
      setVaccineGaps(gaps);
    } catch (error: any) {
      console.error('Failed to load vaccine gaps:', error);
      // Don't set main error for vaccine gaps - it's not critical
    }
  };

  const filterImmunizations = () => {
    let filtered = immunizations;

    switch (activeTab) {
      case 'completed':
        filtered = immunizations.filter(imm => imm.status === 'completed');
        break;
      case 'gaps':
        // Show gaps in separate section
        filtered = [];
        break;
      default:
        filtered = immunizations;
    }

    setFilteredImmunizations(filtered);
  };

  const handleImmunizationCreated = () => {
    loadImmunizations();
    loadVaccineGaps();
    setShowAddForm(false);
  };

  const getVaccineIcon = (vaccineCode: string) => {
    if (vaccineCode === SENIOR_VACCINE_CODES.FLU) return '💉';
    if (vaccineCode === SENIOR_VACCINE_CODES.COVID) return '🦠';
    if (vaccineCode === SENIOR_VACCINE_CODES.SHINGLES) return '🛡️';
    if (vaccineCode === SENIOR_VACCINE_CODES.PCV13 || vaccineCode === SENIOR_VACCINE_CODES.PPSV23) return '🫁';
    if (vaccineCode === SENIOR_VACCINE_CODES.TDAP || vaccineCode === SENIOR_VACCINE_CODES.TD) return '💪';
    return '💉';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'not-done':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'entered-in-error':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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

  const getDoseInfo = (imm: FHIRImmunization) => {
    if (imm.protocol_dose_number_positive_int && imm.protocol_series_doses_positive_int) {
      return `Dose ${imm.protocol_dose_number_positive_int} of ${imm.protocol_series_doses_positive_int}`;
    }
    return null;
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
      <ImmunizationEntry
        userId={userId}
        onSave={handleImmunizationCreated}
        onCancel={() => setShowAddForm(false)}
      />
    );
  }

  if (showTimeline) {
    return (
      <ImmunizationTimeline
        userId={userId}
        onBack={() => setShowTimeline(false)}
      />
    );
  }

  // Stats
  const totalImmunizations = immunizations.length;
  const completedCount = immunizations.filter(i => i.status === 'completed').length;
  const gapsCount = vaccineGaps.length;
  const recentCount = immunizations.filter(i => {
    if (!i.occurrence_datetime) return false;
    const date = new Date(i.occurrence_datetime);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return date >= oneYearAgo;
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start">
            <span className="text-3xl mr-4">⚠️</span>
            <div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Immunization Records</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={loadImmunizations}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-8 mb-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">💉 Immunization Records</h1>
            <p className="text-purple-100">Track your vaccination history and stay up-to-date</p>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowTimeline(true)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-all duration-200 font-medium"
              >
                📊 Timeline
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-white text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200 font-semibold"
              >
                + Add Vaccine
              </button>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{totalImmunizations}</div>
            <div className="text-sm text-purple-100">Total Records</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{completedCount}</div>
            <div className="text-sm text-purple-100">Completed</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{recentCount}</div>
            <div className="text-sm text-purple-100">Last 12 Months</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-300">{gapsCount}</div>
            <div className="text-sm text-purple-100">Care Gaps</div>
          </div>
        </div>
      </div>

      {/* Care Gaps Alert */}
      {gapsCount > 0 && activeTab !== 'gaps' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-lg">
          <div className="flex items-start">
            <span className="text-2xl mr-3">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 mb-1">
                {gapsCount} Vaccine{gapsCount > 1 ? 's' : ''} Due or Overdue
              </h3>
              <p className="text-sm text-yellow-700 mb-2">
                Stay protected! You have recommended vaccines that need attention.
              </p>
              <button
                onClick={() => setActiveTab('gaps')}
                className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
              >
                View Care Gaps →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Vaccines ({immunizations.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'completed'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setActiveTab('gaps')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'gaps'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Care Gaps ({gapsCount})
          </button>
        </div>
      </div>

      {/* Care Gaps View */}
      {activeTab === 'gaps' && (
        <div className="space-y-4">
          {vaccineGaps.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
              <span className="text-4xl mb-3 block">✅</span>
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                All Caught Up!
              </h3>
              <p className="text-green-700">
                You're up-to-date with all recommended vaccines for your age group.
              </p>
            </div>
          ) : (
            vaccineGaps.map((gap, index) => (
              <div
                key={index}
                className="bg-white border border-yellow-300 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{getVaccineIcon(gap.vaccine_code)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {gap.vaccine_name}
                        </h3>
                        <p className="text-sm text-gray-600">{gap.recommendation}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {gap.last_received_date && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Last received:</span>{' '}
                          {formatDate(gap.last_received_date)}
                          {gap.months_since_last && (
                            <span className="text-yellow-700 ml-2">
                              ({gap.months_since_last} months ago)
                            </span>
                          )}
                        </p>
                      )}
                      {!gap.last_received_date && (
                        <p className="text-sm text-yellow-700 font-medium">
                          No previous record found
                        </p>
                      )}
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      Record Vaccine
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Immunizations List */}
      {activeTab !== 'gaps' && (
        <div className="space-y-4">
          {filteredImmunizations.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
              <span className="text-6xl mb-4 block">💉</span>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Immunization Records Yet
              </h3>
              <p className="text-gray-600 mb-6">
                Start tracking your vaccination history to stay healthy and protected.
              </p>
              {!readOnly && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  + Add Your First Vaccine
                </button>
              )}
            </div>
          ) : (
            filteredImmunizations.map((immunization) => (
              <div
                key={immunization.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => setSelectedImmunization(immunization)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{getVaccineIcon(immunization.vaccine_code)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {immunization.vaccine_display}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {formatDate(immunization.occurrence_datetime)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(immunization.status)}`}>
                        {immunization.status}
                      </span>
                      {getDoseInfo(immunization) && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                          {getDoseInfo(immunization)}
                        </span>
                      )}
                      {immunization.lot_number && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                          Lot: {immunization.lot_number}
                        </span>
                      )}
                    </div>

                    {immunization.performer_actor_display && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Administered by:</span>{' '}
                        {immunization.performer_actor_display}
                      </p>
                    )}
                    {immunization.location_display && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Location:</span>{' '}
                        {immunization.location_display}
                      </p>
                    )}
                    {immunization.site_display && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Site:</span>{' '}
                        {immunization.site_display}
                        {immunization.route_display && ` (${immunization.route_display})`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedImmunization && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-1">{selectedImmunization.vaccine_display}</h2>
                  <p className="text-purple-100">{formatDate(selectedImmunization.occurrence_datetime)}</p>
                </div>
                <button
                  onClick={() => setSelectedImmunization(null)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Status</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedImmunization.status)}`}>
                  {selectedImmunization.status}
                </span>
              </div>

              {selectedImmunization.lot_number && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Lot Number</h3>
                  <p className="text-gray-900">{selectedImmunization.lot_number}</p>
                </div>
              )}

              {selectedImmunization.manufacturer && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Manufacturer</h3>
                  <p className="text-gray-900">{selectedImmunization.manufacturer}</p>
                </div>
              )}

              {getDoseInfo(selectedImmunization) && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Dose Information</h3>
                  <p className="text-gray-900">{getDoseInfo(selectedImmunization)}</p>
                </div>
              )}

              {selectedImmunization.dose_quantity_value && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Dose Quantity</h3>
                  <p className="text-gray-900">
                    {selectedImmunization.dose_quantity_value} {selectedImmunization.dose_quantity_unit}
                  </p>
                </div>
              )}

              {selectedImmunization.performer_actor_display && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Administered By</h3>
                  <p className="text-gray-900">{selectedImmunization.performer_actor_display}</p>
                </div>
              )}

              {selectedImmunization.location_display && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Location</h3>
                  <p className="text-gray-900">{selectedImmunization.location_display}</p>
                </div>
              )}

              {selectedImmunization.site_display && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Administration Site</h3>
                  <p className="text-gray-900">{selectedImmunization.site_display}</p>
                </div>
              )}

              {selectedImmunization.route_display && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Route</h3>
                  <p className="text-gray-900">{selectedImmunization.route_display}</p>
                </div>
              )}

              {selectedImmunization.note && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-gray-900">{selectedImmunization.note}</p>
                </div>
              )}

              {selectedImmunization.primary_source !== undefined && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Primary Source</h3>
                  <p className="text-gray-900">
                    {selectedImmunization.primary_source ? 'Yes - directly observed' : 'No - reported by patient'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImmunizationDashboard;
