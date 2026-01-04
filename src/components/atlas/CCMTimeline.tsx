// CCM Timeline Component - Shows CCM-eligible patients
// Project Atlus Pillar 2: Chronic Care Management automation

import React, { useEffect, useState } from 'react';
import { CCMAutopilotService } from '../../services/ccmAutopilotService';

interface CCMPatient {
  patient_id: string;
  patient_name?: string;
  total_minutes: number;
  billable_code: '99490' | '99439' | null;
  activities: Array<{
    type: string;
    timestamp: string;
    duration_minutes: number;
  }>;
}

export const CCMTimeline: React.FC = () => {
  interface RevenueBreakdown {
    code: string;
    count: number;
    revenue: number;
  }

  const [patients, setPatients] = useState<CCMPatient[]>([]);
  const [revenue, setRevenue] = useState({ total: 0, breakdown: [] as RevenueBreakdown[] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const eligiblePatients = await CCMAutopilotService.getEligiblePatients(selectedMonth);
        setPatients(eligiblePatients);

        const revenueData = CCMAutopilotService.calculateCCMRevenue(eligiblePatients);
        setRevenue(revenueData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load CCM data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth]);

  const loadCCMData = async () => {
    setLoading(true);
    setError(null);
    try {
      const eligiblePatients = await CCMAutopilotService.getEligiblePatients(selectedMonth);
      setPatients(eligiblePatients);

      const revenueData = CCMAutopilotService.calculateCCMRevenue(eligiblePatients);
      setRevenue(revenueData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CCM data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            ⏱️ CCM Autopilot - Chronic Care Management
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track 20+ minute patient interactions for CCM billing
          </p>
        </div>

        {/* Revenue Counter */}
        {revenue.total > 0 && (
          <div className="px-6 py-4 bg-linear-to-r from-purple-400 to-indigo-500 rounded-lg shadow-lg">
            <div className="text-white text-center">
              <div className="text-xs font-medium">Monthly CCM Revenue</div>
              <div className="text-3xl font-bold">${revenue.total.toFixed(2)}</div>
              <div className="text-xs mt-1">{patients.length} eligible patients</div>
            </div>
          </div>
        )}
      </div>

      {/* Month Selector */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => {
            const newMonth = new Date(selectedMonth);
            newMonth.setMonth(newMonth.getMonth() - 1);
            setSelectedMonth(newMonth);
          }}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
        >
          ← Previous Month
        </button>
        <div className="text-lg font-semibold">
          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button
          onClick={() => {
            const newMonth = new Date(selectedMonth);
            newMonth.setMonth(newMonth.getMonth() + 1);
            setSelectedMonth(newMonth);
          }}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
          disabled={selectedMonth.getMonth() === new Date().getMonth()}
        >
          Next Month →
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"></div>
          <p className="mt-4 text-gray-600">Loading CCM data...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-bold text-red-900 mb-2">Failed to Load CCM Data</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={loadCCMData}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && patients.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-600 text-lg">No CCM-eligible patients this month.</p>
          <p className="text-gray-500 text-sm mt-2">
            Patients need 20+ minutes of documented care activities.
          </p>
        </div>
      )}

      {/* Patient List */}
      {!loading && !error && patients.length > 0 && (
        <div className="space-y-4">
          {patients.map((patient) => (
            <div
              key={patient.patient_id}
              className="p-5 bg-linear-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      Patient ID: {patient.patient_id.slice(0, 8)}...
                    </h3>
                    {patient.billable_code && (
                      <span className="px-3 py-1 text-sm font-bold bg-purple-600 text-white rounded-full">
                        {patient.billable_code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-700">
                    <span className="font-semibold">
                      Total Time: {patient.total_minutes} minutes
                    </span>
                    <span className="text-gray-500">
                      {patient.activities.length} activities
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600">
                    $
                    {patient.billable_code === '99490'
                      ? '42.00'
                      : patient.billable_code === '99439'
                        ? '31.00'
                        : '0.00'}
                  </div>
                  <div className="text-xs text-gray-500">reimbursement</div>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="mt-4 pl-4 border-l-2 border-purple-300">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Activity Timeline:</h4>
                <div className="space-y-2">
                  {patient.activities.slice(0, 5).map((activity, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <span className="text-xs px-2 py-1 bg-white rounded-sm font-medium text-gray-700">
                        {activity.type === 'check_in' ? '✓ Check-in' : '📝 Scribe Session'}
                      </span>
                      <span className="text-gray-600">{formatDate(activity.timestamp)}</span>
                      <span className="text-purple-700 font-semibold">
                        +{activity.duration_minutes} min
                      </span>
                    </div>
                  ))}
                  {patient.activities.length > 5 && (
                    <div className="text-xs text-gray-500 italic">
                      +{patient.activities.length - 5} more activities
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-4 border-t border-purple-200">
                <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors">
                  Generate CCM Claim
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revenue Breakdown removed - Finance department only; see Admin > Financial Reports */}
    </div>
  );
};

export default CCMTimeline;
