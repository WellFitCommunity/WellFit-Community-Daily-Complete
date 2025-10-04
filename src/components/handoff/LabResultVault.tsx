// Lab Result Vault Display Component
// Shows parsed labs with trending analysis

import React, { useState, useEffect } from 'react';
import LabResultVaultService, { type ParsedLabResult, type LabTrend } from '../../services/labResultVaultService';
import type { HandoffPacket } from '../../types/handoff';

interface LabResultVaultProps {
  packet: HandoffPacket;
}

const LabResultVault: React.FC<LabResultVaultProps> = ({ packet }) => {
  const [parsedLabs, setParsedLabs] = useState<ParsedLabResult[]>([]);
  const [labTrends, setLabTrends] = useState<LabTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    async function loadLabs() {
      setLoading(true);

      // Load auto-populated labs from vault
      const labs = await LabResultVaultService.autoPopulateLabsForPacket(packet.id);
      setParsedLabs(labs);

      // Load trending data if patient MRN available
      if (packet.patient_mrn) {
        const trends = await LabResultVaultService.generateLabTrends(packet.patient_mrn);
        setLabTrends(trends);
      }

      setLoading(false);
    }

    loadLabs();
  }, [packet.id, packet.patient_mrn]);

  if (loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800">🔬 Loading lab results from vault...</p>
      </div>
    );
  }

  if (parsedLabs.length === 0 && labTrends.length === 0) {
    return null; // No labs to display
  }

  const getTrendArrow = (direction: string) => {
    switch (direction) {
      case 'rising':
        return '📈';
      case 'falling':
        return '📉';
      case 'stable':
        return '➡️';
      case 'fluctuating':
        return '📊';
      default:
        return '';
    }
  };

  const getTrendColor = (direction: string, testName: string) => {
    // Red for concerning trends
    const concerningRising = ['creatinine', 'bun', 'potassium', 'troponin', 'wbc', 'glucose'];
    const concerningFalling = ['hemoglobin', 'platelet', 'sodium'];

    if (direction === 'rising' && concerningRising.some(t => testName.toLowerCase().includes(t))) {
      return 'text-red-600 font-bold';
    }

    if (direction === 'falling' && concerningFalling.some(t => testName.toLowerCase().includes(t))) {
      return 'text-red-600 font-bold';
    }

    return 'text-gray-700';
  };

  return (
    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔬</span>
          <div>
            <h3 className="font-bold text-lg text-yellow-900">
              Lab Result Vault - Auto-Populated
            </h3>
            <p className="text-sm text-yellow-800 mt-1">
              {parsedLabs.length} lab values extracted from PDFs • Trending analysis available
            </p>
          </div>
        </div>
        <span className="text-xl text-yellow-900">{isExpanded ? '▼' : '►'}</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Lab Trends - Critical Alerts */}
          {labTrends.length > 0 && (
            <div className="bg-white rounded-lg p-4 border-2 border-orange-300">
              <h4 className="font-semibold text-orange-900 mb-3">
                ⚠️ Lab Trending Analysis (Last 30 Days)
              </h4>
              <div className="space-y-2">
                {labTrends.map((trend, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-orange-50 rounded border border-orange-200"
                  >
                    <span className="text-2xl">{getTrendArrow(trend.trend_direction)}</span>
                    <div className="flex-1">
                      <p className={`font-bold capitalize ${getTrendColor(trend.trend_direction, trend.test_name)}`}>
                        {trend.test_name}: {trend.trend_direction}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {trend.values.map((v, i) => (
                          <span key={i} className={v.abnormal ? 'text-red-600 font-semibold' : ''}>
                            {v.value} {v.unit}
                            {i < trend.values.length - 1 ? ' → ' : ''}
                          </span>
                        ))}
                      </p>
                      {trend.clinical_significance && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-300 rounded">
                          <p className="text-xs text-red-900">{trend.clinical_significance}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Parsed Labs Table */}
          {parsedLabs.length > 0 && (
            <div className="bg-white rounded-lg p-4 border border-gray-300">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">
                  Extracted Lab Values ({parsedLabs.length})
                </h4>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  AI-Extracted • No Manual Entry Required
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="text-left p-2 font-semibold">Test Name</th>
                      <th className="text-left p-2 font-semibold">Value</th>
                      <th className="text-left p-2 font-semibold">Unit</th>
                      <th className="text-left p-2 font-semibold">Reference Range</th>
                      <th className="text-left p-2 font-semibold">Status</th>
                      <th className="text-left p-2 font-semibold text-xs">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedLabs.map((lab, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-gray-200 ${lab.abnormal ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="p-2 font-medium">{lab.test_name}</td>
                        <td className={`p-2 font-bold ${lab.abnormal ? 'text-red-600' : ''}`}>
                          {lab.value}
                          {lab.abnormal && ' ⚠️'}
                        </td>
                        <td className="p-2 text-gray-600">{lab.unit || '-'}</td>
                        <td className="p-2 text-gray-600 text-xs">{lab.reference_range || '-'}</td>
                        <td className="p-2">
                          {lab.abnormal ? (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                              ABNORMAL
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-xs text-gray-500">
                          {lab.source_file && (
                            <span className="block truncate max-w-[150px]" title={lab.source_file}>
                              📄 {lab.source_file}
                            </span>
                          )}
                          {lab.confidence_score !== undefined && (
                            <span className="block text-xs mt-1">
                              {(lab.confidence_score * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Time Savings Notice */}
          <div className="bg-green-50 border border-green-300 rounded-lg p-3">
            <p className="text-sm text-green-900">
              <span className="font-bold">⏱️ Time Saved:</span> Approximately 10-15 minutes by auto-extracting
              {' '}{parsedLabs.length} lab values. No manual data entry required!
            </p>
          </div>

          {/* Patient QR Code Access Note */}
          {packet.patient_mrn && (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <span className="font-bold">📱 Patient Access:</span> QR code generated for patient to access
                their portable lab history. Available in full packet view.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LabResultVault;
