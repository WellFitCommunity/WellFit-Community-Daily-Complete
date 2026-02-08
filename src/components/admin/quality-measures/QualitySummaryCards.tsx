/**
 * QualitySummaryCards — summary stat cards for quality measures
 */

import React from 'react';
import { Activity, Users, CheckCircle, Target } from 'lucide-react';
import { getPerformanceColor, formatPercentage, isInverseMeasure } from './helpers';
import { PERFORMANCE_THRESHOLDS, type MeasureWithResults } from './types';

interface QualitySummaryCardsProps {
  measures: MeasureWithResults[];
}

export const QualitySummaryCards: React.FC<QualitySummaryCardsProps> = ({ measures }) => {
  const totalMeasures = measures.length;
  const measuresWithData = measures.filter(m => m.results).length;

  const avgPerformanceRate = measures.reduce((sum, m) => {
    if (m.results?.performanceRate !== null && m.results?.performanceRate !== undefined) {
      return sum + m.results.performanceRate;
    }
    return sum;
  }, 0) / (measures.filter(m => m.results?.performanceRate !== null).length || 1);

  const totalPatients = measures.reduce((sum, m) => sum + (m.results?.patientCount || 0), 0);

  const measuresAboveThreshold = measures.filter(m =>
    m.results?.performanceRate !== null &&
    m.results !== undefined &&
    (isInverseMeasure(m.measure_id)
      ? m.results.performanceRate < 0.1
      : (m.results.performanceRate ?? 0) >= PERFORMANCE_THRESHOLDS.good)
  ).length;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-900/50 rounded-lg">
            <Target className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Measures</p>
            <p className="text-2xl font-bold text-white">{totalMeasures}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-900/50 rounded-lg">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Avg Performance</p>
            <p className={`text-2xl font-bold ${getPerformanceColor(avgPerformanceRate)}`}>
              {formatPercentage(avgPerformanceRate)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-900/50 rounded-lg">
            <Users className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Patients Evaluated</p>
            <p className="text-2xl font-bold text-white">
              {totalPatients.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-900/50 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Meeting Goal</p>
            <p className="text-2xl font-bold text-white">
              {measuresAboveThreshold} / {measuresWithData}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
