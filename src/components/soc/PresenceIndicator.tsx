/**
 * Presence Indicator Component
 *
 * Shows online SOC operators in the dashboard header.
 * Displays avatars with status indicators.
 */

import React, { useState } from 'react';
import { SOCPresence } from '../../types/socDashboard';

interface PresenceIndicatorProps {
  operators: SOCPresence[];
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ operators }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const onlineCount = operators.filter((op) => op.status === 'online').length;
  const busyCount = operators.filter((op) => op.status === 'busy').length;

  const getStatusColor = (status: SOCPresence['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'away':
        return 'bg-gray-400';
      default:
        return 'bg-gray-600';
    }
  };

  const getStatusLabel = (status: SOCPresence['status']) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'busy':
        return 'Working on alert';
      case 'away':
        return 'Away';
      default:
        return 'Offline';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        {/* Avatar Stack */}
        <div className="flex -space-x-2">
          {operators.slice(0, 3).map((op) => (
            <div
              key={op.user_id}
              className="relative w-8 h-8 rounded-full bg-teal-600 border-2 border-slate-800 flex items-center justify-center text-xs font-bold"
              title={op.user_name}
            >
              {op.user_name.charAt(0)}
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${getStatusColor(
                  op.status
                )}`}
              />
            </div>
          ))}
          {operators.length > 3 && (
            <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-800 flex items-center justify-center text-xs">
              +{operators.length - 3}
            </div>
          )}
        </div>

        {/* Count */}
        <div className="text-sm">
          <span className="text-green-400">{onlineCount}</span>
          {busyCount > 0 && (
            <>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-yellow-400">{busyCount}</span>
            </>
          )}
          <span className="text-slate-400 ml-1">online</span>
        </div>

        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${
            showDropdown ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown content */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-20">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-white">SOC Team</h3>
              <p className="text-xs text-slate-400">
                {onlineCount} online, {busyCount} working on alerts
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {operators.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400">
                  No operators online
                </div>
              ) : (
                <div className="py-2">
                  {operators.map((op) => (
                    <div
                      key={op.user_id}
                      className="px-4 py-2 hover:bg-slate-700/50 flex items-center gap-3"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center font-bold">
                          {op.user_name.charAt(0)}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${getStatusColor(
                            op.status
                          )}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {op.user_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {getStatusLabel(op.status)}
                        </p>
                      </div>
                      {op.current_alert_id && (
                        <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-sm">
                          On Alert
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PresenceIndicator;
