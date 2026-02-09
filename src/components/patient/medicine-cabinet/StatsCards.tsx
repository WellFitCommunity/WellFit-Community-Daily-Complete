/**
 * StatsCards — Medicine Cabinet KPI summary cards
 *
 * Displays 4 stat cards: Active Medications, Adherence Rate, Need Refill, Next 24 Hours.
 */

import React from 'react';
import { Pill, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { StatsCardsProps } from './MedicineCabinet.types';

export const StatsCards: React.FC<StatsCardsProps> = ({
  medicationCount,
  overallAdherence,
  needingRefillCount,
  upcomingDosesCount
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
      <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Active Medications</p>
            <p className="text-3xl font-bold text-gray-900">{medicationCount}</p>
          </div>
          <Pill className="w-12 h-12 text-blue-500 opacity-20" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Adherence Rate</p>
            <p className="text-3xl font-bold text-gray-900">{overallAdherence}%</p>
          </div>
          <TrendingUp className="w-12 h-12 text-green-500 opacity-20" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-orange-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Need Refill</p>
            <p className="text-3xl font-bold text-gray-900">{needingRefillCount}</p>
          </div>
          <AlertTriangle className="w-12 h-12 text-orange-500 opacity-20" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Next 24 Hours</p>
            <p className="text-3xl font-bold text-gray-900">{upcomingDosesCount}</p>
          </div>
          <Clock className="w-12 h-12 text-purple-500 opacity-20" />
        </div>
      </div>
    </div>
  );
};
