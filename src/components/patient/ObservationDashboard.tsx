import React, { useState, useMemo } from 'react';
import { useObservations } from '../../hooks/useFhirData';
import type { Observation } from '../../types/fhir';
import ObservationTimeline from './ObservationTimeline';
import ObservationEntry from './ObservationEntry';

interface ObservationDashboardProps {
  userId: string;
  readOnly?: boolean;
}

type TabType = 'all' | 'vitals' | 'labs' | 'social';

const ObservationDashboard: React.FC<ObservationDashboardProps> = ({ userId, readOnly = false }) => {
  // Use React Query for data fetching with automatic caching
  const { data: observations = [], isLoading: loading, error } = useObservations(userId);

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null);

  // Filter observations based on active tab (memoized for performance)
  const filteredObservations = useMemo(() => {
    switch (activeTab) {
      case 'vitals':
        return observations.filter(obs => obs.category.includes('vital-signs'));
      case 'labs':
        return observations.filter(obs => obs.category.includes('laboratory'));
      case 'social':
        return observations.filter(obs => obs.category.includes('social-history'));
      default:
        return observations;
    }
  }, [activeTab, observations]);

  const handleObservationCreated = () => {
    // React Query will automatically refetch and update the cache
    setShowAddForm(false);
  };

  const getObservationIcon = (category: string[]) => {
    if (category.includes('vital-signs')) return '💓';
    if (category.includes('laboratory')) return '🔬';
    if (category.includes('social-history')) return '📋';
    if (category.includes('imaging')) return '🏥';
    return '📊';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'final':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'preliminary':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'amended':
      case 'corrected':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled':
      case 'entered-in-error':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getInterpretationBadge = (interpretation?: string[]) => {
    if (!interpretation || interpretation.length === 0) return null;

    const interp = interpretation[0]?.toLowerCase();
    let color = 'bg-gray-100 text-gray-700';
    let icon = '';

    if (interp.includes('normal') || interp === 'n') {
      color = 'bg-green-100 text-green-700';
      icon = '✓';
    } else if (interp.includes('high') || interp === 'h' || interp === 'hh') {
      color = 'bg-red-100 text-red-700';
      icon = '↑';
    } else if (interp.includes('low') || interp === 'l' || interp === 'll') {
      color = 'bg-orange-100 text-orange-700';
      icon = '↓';
    } else if (interp.includes('critical')) {
      color = 'bg-red-200 text-red-900';
      icon = '⚠';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {icon && <span>{icon}</span>}
        {interpretation[0]}
      </span>
    );
  };

  const formatValue = (obs: Observation) => {
    if (obs.components && obs.components.length > 0) {
      // Handle complex observations like blood pressure
      return obs.components.map(comp => `${comp.display}: ${comp.value} ${comp.unit}`).join(', ');
    }

    if (obs.value_quantity_value !== undefined) {
      return `${obs.value_quantity_value} ${obs.value_quantity_unit || ''}`;
    }

    if (obs.value_string) return obs.value_string;
    if (obs.value_codeable_concept_display) return obs.value_codeable_concept_display;
    if (obs.value_boolean !== undefined) return obs.value_boolean ? 'Yes' : 'No';
    if (obs.value_integer !== undefined) return obs.value_integer.toString();

    return 'N/A';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getObservationCount = (category: string) => {
    return observations.filter(obs => obs.category.includes(category)).length;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading observations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Health Observations</h1>
            <p className="text-blue-100 mt-2">Track your vitals, lab results, and clinical observations</p>
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 font-semibold shadow-md transition-all transform hover:scale-105"
            >
              {showAddForm ? '✕ Close' : '+ Add Observation'}
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm font-medium">Total Observations</div>
            <div className="text-3xl font-bold mt-1">{observations.length}</div>
          </div>
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm font-medium">Vital Signs</div>
            <div className="text-3xl font-bold mt-1">{getObservationCount('vital-signs')}</div>
          </div>
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm font-medium">Lab Results</div>
            <div className="text-3xl font-bold mt-1">{getObservationCount('laboratory')}</div>
          </div>
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm font-medium">Social History</div>
            <div className="text-3xl font-bold mt-1">{getObservationCount('social-history')}</div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && !readOnly && (
        <ObservationEntry
          userId={userId}
          onSuccess={handleObservationCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'all' as TabType, label: 'All', icon: '📊' },
              { id: 'vitals' as TabType, label: 'Vital Signs', icon: '💓' },
              { id: 'labs' as TabType, label: 'Lab Results', icon: '🔬' },
              { id: 'social' as TabType, label: 'Social History', icon: '📋' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Observations List */}
        <div className="p-6">
          {filteredObservations.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No observations found</h3>
              <p className="text-gray-600 mb-4">
                {activeTab === 'all'
                  ? "No health observations recorded yet."
                  : `No ${activeTab} observations recorded yet.`}
              </p>
              {!readOnly && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                >
                  + Add Your First Observation
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredObservations.map((obs) => (
                <div
                  key={obs.id}
                  onClick={() => setSelectedObservation(obs)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="text-3xl">{getObservationIcon(obs.category)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{obs.code_display}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(obs.status)}`}>
                            {obs.status}
                          </span>
                          {getInterpretationBadge(obs.interpretation_display)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <span>{formatDate(obs.effective_datetime)}</span>
                          {obs.code && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              Code: {obs.code}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {formatValue(obs)}
                        </div>
                        {obs.reference_range_low !== undefined && obs.reference_range_high !== undefined && (
                          <div className="text-xs text-gray-500 mt-1">
                            Reference: {obs.reference_range_low}-{obs.reference_range_high} {obs.value_quantity_unit}
                          </div>
                        )}
                        {obs.note && (
                          <div className="mt-2 text-sm text-gray-600 italic">
                            Note: {obs.note}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedObservation(obs);
                      }}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline View */}
      {filteredObservations.length > 0 && (
        <ObservationTimeline observations={filteredObservations} userId={userId} />
      )}

      {/* Detail Modal */}
      {selectedObservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Observation Details</h2>
              <button
                onClick={() => setSelectedObservation(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Observation Type</div>
                <div className="text-lg font-semibold">{selectedObservation.code_display}</div>
                <div className="text-xs text-gray-500">LOINC: {selectedObservation.code}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Status</div>
                  <span className={`inline-block px-3 py-1 rounded text-sm font-medium border ${getStatusColor(selectedObservation.status)}`}>
                    {selectedObservation.status}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Category</div>
                  <div className="text-sm font-medium">{selectedObservation.category.join(', ')}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Value</div>
                <div className="text-2xl font-bold text-gray-900">{formatValue(selectedObservation)}</div>
              </div>

              {selectedObservation.interpretation_display && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Interpretation</div>
                  {getInterpretationBadge(selectedObservation.interpretation_display)}
                </div>
              )}

              {(selectedObservation.reference_range_low !== undefined || selectedObservation.reference_range_high !== undefined) && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Reference Range</div>
                  <div className="text-sm">
                    {selectedObservation.reference_range_low} - {selectedObservation.reference_range_high} {selectedObservation.value_quantity_unit}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Effective Date/Time</div>
                  <div className="text-sm">{formatDate(selectedObservation.effective_datetime)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Issued</div>
                  <div className="text-sm">{formatDate(selectedObservation.issued)}</div>
                </div>
              </div>

              {selectedObservation.note && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Notes</div>
                  <div className="text-sm bg-gray-50 p-3 rounded">{selectedObservation.note}</div>
                </div>
              )}

              {selectedObservation.performer_display && selectedObservation.performer_display.length > 0 && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Performed By</div>
                  <div className="text-sm">{selectedObservation.performer_display.join(', ')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObservationDashboard;
