// ============================================================================
// Shift Handoff Dashboard - Header Section
// ============================================================================
// Contains: title, presence avatars, risk filter buttons, shift selector,
//           unit filter, metrics bar, bulk actions bar
// ============================================================================

import React from 'react';
import { PresenceAvatars } from '../../collaboration';
import type { HandoffHeaderProps, ShiftType } from './types';

export const HandoffHeader: React.FC<HandoffHeaderProps> = ({
  shiftType,
  riskFilter,
  metrics,
  selectedCount,
  unitFilter,
  availableUnits,
  otherUsers,
  onShiftChange,
  onRiskFilterChange,
  onAcceptHandoff,
  onBulkConfirm,
  onClearSelection,
  onUnitFilterChange,
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Smart Shift Handoff</h2>
            <PresenceAvatars users={otherUsers} maxDisplay={4} size="sm" />
          </div>
          <p className="text-gray-600">AI-scored patient risks — quick review in 5-10 minutes</p>

          {/* Filter row: risk filter + unit filter */}
          <div className="flex items-center gap-4 mt-2">
            {/* Risk filter buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Risk:</span>
              <button
                onClick={() => onRiskFilterChange('all')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  riskFilter === 'all'
                    ? 'bg-[#1BA39C] text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                All (Shift+A)
              </button>
              <button
                onClick={() => onRiskFilterChange('high')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  riskFilter === 'high'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                High+ (Shift+H)
              </button>
              <button
                onClick={() => onRiskFilterChange('critical')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  riskFilter === 'critical'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Critical (Shift+C)
              </button>
            </div>

            {/* Unit filter dropdown */}
            {availableUnits.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Unit:</span>
                <select
                  value={unitFilter}
                  onChange={(e) => onUnitFilterChange(e.target.value)}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 font-medium min-w-[120px]"
                  aria-label="Filter by hospital unit"
                >
                  <option value="">All Units</option>
                  {availableUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Accept Handoff Button */}
        <button
          onClick={onAcceptHandoff}
          className="mx-4 px-8 py-4 bg-linear-to-r from-green-500 to-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 flex items-center gap-2"
        >
          Accept Handoff
        </button>

        {/* Shift selector */}
        <div className="flex gap-2">
          {(['day', 'evening', 'night'] as ShiftType[]).map(shift => (
            <button
              key={shift}
              onClick={() => onShiftChange(shift)}
              className={`px-4 py-2 rounded-lg font-medium ${
                shiftType === shift
                  ? 'bg-[#1BA39C] text-white font-bold'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {shift.charAt(0).toUpperCase() + shift.slice(1)} Shift
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Bar */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-black hover:border-[#1BA39C] p-3 shadow-md transition-all">
            <div className="text-2xl font-bold text-gray-800">{metrics.total_patients}</div>
            <div className="text-xs text-gray-600">Total Patients</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-700">{metrics.critical_patients}</div>
            <div className="text-xs text-red-700">Critical</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-orange-700">{metrics.high_risk_patients}</div>
            <div className="text-xs text-orange-700">High Risk</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-yellow-700">{metrics.pending_nurse_review}</div>
            <div className="text-xs text-yellow-700">Pending Review</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-700">{metrics.nurse_adjusted_count}</div>
            <div className="text-xs text-purple-700">Nurse Adjusted</div>
          </div>
          <div className="bg-linear-to-br from-[#E0F7F6] to-white border-2 border-[#1BA39C] rounded-lg p-3 shadow-md">
            <div className="text-2xl font-bold text-blue-700">{metrics.avg_auto_score}</div>
            <div className="text-xs text-blue-700">Avg Auto Score</div>
          </div>
          <div className="bg-linear-to-br from-emerald-100 to-teal-50 border-2 border-emerald-500 rounded-lg p-3 shadow-md">
            <div className="text-2xl font-bold text-emerald-700">80%</div>
            <div className="text-xs text-emerald-600 font-medium">Faster than Average</div>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div className="bg-linear-to-r from-[#E0F7F6] to-[#F4FADC] border-2 border-[#1BA39C] rounded-lg p-4 mb-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="text-blue-900 font-medium">
              {selectedCount} patient{selectedCount !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={onBulkConfirm}
                className="px-4 py-2 bg-[#C8E63D] text-[#2D3339] rounded-lg hover:bg-[#D9F05C] font-bold shadow-md hover:shadow-lg transition-all"
              >
                Bulk Confirm
              </button>
              <button
                onClick={onClearSelection}
                className="px-4 py-2 border-2 border-[#1BA39C] text-[#1BA39C] rounded-lg hover:bg-[#E0F7F6] font-bold transition-all"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HandoffHeader;
