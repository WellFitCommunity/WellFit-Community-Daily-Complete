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
  const [patients, setPatients] = useState<CCMPatient[]>([]);
  const [revenue, setRevenue] = useState({ total: 0, breakdown: [] as any[] });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    loadCCMData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const loadCCMData = async () => {
    setLoading(true);
    try {
      const eligiblePatients = await CCMAutopilotService.getEligiblePatients(selectedMonth);
      setPatients(eligiblePatients);

      const revenueData = CCMAutopilotService.calculateCCMRevenue(eligiblePatients);
      setRevenue(revenueData);
    } catch (error) {

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
          <div className="px-6 py-4 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-lg shadow-lg">
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

      {/* Empty State */}
      {!loading && patients.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-600 text-lg">No CCM-eligible patients this month.</p>
          <p className="text-gray-500 text-sm mt-2">
            Patients need 20+ minutes of documented care activities.
          </p>
        </div>
      )}

      {/* Patient List */}
      {!loading && patients.length > 0 && (
        <div className="space-y-4">
          {patients.map((patient) => (
            <div
              key={patient.patient_id}
              className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
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
                      <span className="text-xs px-2 py-1 bg-white rounded font-medium text-gray-700">
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

      {/* Revenue Breakdown */}
      {revenue.breakdown.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-3">Revenue Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            {revenue.breakdown.map((item) => (
              <div key={item.code} className="p-3 bg-white rounded-lg shadow">
                <div className="text-sm text-gray-600">{item.code}</div>
                <div className="text-xl font-bold text-purple-600">${item.revenue.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{item.count} patients</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CCMTimeline;
