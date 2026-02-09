/**
 * CardiologyOverview - Patient cardiac overview panel
 * Shows registry info, latest EF, NYHA class, risk scores, and active alerts
 */

import React from 'react';
import type { CardiologyDashboardSummary } from '../../types/cardiology';
import { NYHA_DESCRIPTIONS, interpretLVEF } from '../../types/cardiology';

interface CardiologyOverviewProps {
  summary: CardiologyDashboardSummary;
}

const CardiologyOverview: React.FC<CardiologyOverviewProps> = ({ summary }) => {
  const { registry, latest_echo, latest_ecg, latest_stress_test, rehab_progress } = summary;

  return (
    <div className="space-y-6">
      {/* Registry Summary */}
      {registry && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cardiac Registry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Conditions</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {registry.conditions.map((c) => (
                  <span key={c} className="inline-block px-2 py-1 bg-red-50 text-red-700 rounded text-xs">
                    {c.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">NYHA Class</p>
              <p className="text-xl font-bold text-gray-900">
                {registry.nyha_class || 'Not assessed'}
              </p>
              {registry.nyha_class && (
                <p className="text-xs text-gray-500 mt-1">
                  {NYHA_DESCRIPTIONS[registry.nyha_class]}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">CHA2DS2-VASc</p>
              <p className="text-xl font-bold text-gray-900">
                {registry.cha2ds2_vasc_score ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Latest Echo & EF */}
      {latest_echo && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Echocardiogram</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">LVEF</p>
              <p className="text-2xl font-bold text-gray-900">{latest_echo.lvef_percent}%</p>
              <p className="text-xs text-gray-500">{interpretLVEF(latest_echo.lvef_percent)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">RV Function</p>
              <p className="text-base font-medium text-gray-900">
                {latest_echo.rv_function.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pericardial Effusion</p>
              <p className="text-base font-medium text-gray-900">
                {latest_echo.pericardial_effusion ? 'Present' : 'None'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="text-base text-gray-900">
                {new Date(latest_echo.performed_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Latest ECG */}
      {latest_ecg && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest ECG</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Rhythm</p>
              <p className="text-base font-medium text-gray-900">
                {latest_ecg.rhythm.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Heart Rate</p>
              <p className="text-xl font-bold text-gray-900">{latest_ecg.heart_rate} bpm</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">QTc</p>
              <p className="text-base text-gray-900">
                {latest_ecg.qtc_ms ? `${latest_ecg.qtc_ms} ms` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">STEMI</p>
              <p className={`text-base font-bold ${latest_ecg.is_stemi ? 'text-red-600' : 'text-green-600'}`}>
                {latest_ecg.is_stemi ? 'YES' : 'No'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stress Test */}
      {latest_stress_test && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Stress Test</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Protocol</p>
              <p className="text-base text-gray-900">
                {latest_stress_test.protocol.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">METs</p>
              <p className="text-xl font-bold text-gray-900">{latest_stress_test.mets_achieved}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Result</p>
              <p className={`text-base font-bold ${latest_stress_test.is_positive ? 'text-red-600' : 'text-green-600'}`}>
                {latest_stress_test.is_positive ? 'Positive' : 'Negative'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">% Target HR</p>
              <p className="text-base text-gray-900">
                {latest_stress_test.percent_target_achieved}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rehab Progress */}
      {rehab_progress && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cardiac Rehab Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Phase</p>
              <p className="text-xl font-bold text-gray-900">{rehab_progress.phase}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sessions</p>
              <p className="text-base text-gray-900">
                {rehab_progress.sessions_completed} / {rehab_progress.total_sessions}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Progress</p>
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(rehab_progress.completion_percent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{rehab_progress.completion_percent}%</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Latest METs</p>
              <p className="text-xl font-bold text-gray-900">
                {rehab_progress.latest_mets ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!registry && !latest_echo && !latest_ecg && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No cardiac data available</p>
          <p className="text-sm mt-2">Enroll the patient in the cardiac registry to begin tracking</p>
        </div>
      )}
    </div>
  );
};

export default CardiologyOverview;
