/**
 * MipsDashboardTab — MIPS Composite Score Dashboard
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 *
 * Displays four MIPS category gauges, IA attestation checklist,
 * composite score, and payment adjustment projection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  RefreshCw,
  BarChart3,
  Calculator,
  CheckCircle2,
  Circle,
  DollarSign,
} from 'lucide-react';
import {
  getMipsComposite,
  calculateMipsComposite,
  getImprovementActivities,
} from '../../../services/qualityMeasures/mips/mipsCompositeService';
import type {
  MipsCompositeScore,
  MipsImprovementActivity,
} from '../../../services/qualityMeasures/mips/mipsTypes';
import { ScoreGauge } from './ScoreGauge';
import { getPerformanceColor, formatPercentage } from './helpers';

interface MipsDashboardTabProps {
  tenantId: string;
  reportingYear: number;
}

export const MipsDashboardTab: React.FC<MipsDashboardTabProps> = ({
  tenantId,
  reportingYear,
}) => {
  const [composite, setComposite] = useState<MipsCompositeScore | null>(null);
  const [activities, setActivities] = useState<MipsImprovementActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [compResult, iaResult] = await Promise.all([
        getMipsComposite(tenantId, reportingYear),
        getImprovementActivities(tenantId, reportingYear),
      ]);

      if (compResult.success) setComposite(compResult.data);
      if (iaResult.success) setActivities(iaResult.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load MIPS data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, reportingYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCalculate = async () => {
    try {
      setCalculating(true);
      setError(null);

      const result = await calculateMipsComposite({ tenantId, reportingYear });
      if (!result.success) {
        throw new Error(result.error?.message || 'Calculation failed');
      }

      setComposite(result.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'MIPS calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
        <span className="ml-3 text-slate-300">Loading MIPS data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
        </div>
      )}

      {/* Calculate Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">MIPS Composite Score — {reportingYear}</h3>
          <p className="text-slate-400 text-sm">Quality + Cost + Improvement Activities + Promoting Interoperability</p>
        </div>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white px-4 py-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
        >
          {calculating ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Calculating...</>
          ) : (
            <><Calculator className="w-4 h-4" /> Calculate MIPS</>
          )}
        </button>
      </div>

      {composite ? (
        <>
          {/* Four Category Gauges */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center">
              <ScoreGauge
                score={composite.qualityScore}
                label="Quality"
                weight={composite.qualityWeight}
              />
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center">
              <ScoreGauge
                score={composite.costScore}
                label="Cost"
                weight={composite.costWeight}
              />
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center">
              <ScoreGauge
                score={composite.improvementActivitiesScore}
                label="Improvement"
                weight={composite.improvementActivitiesWeight}
              />
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center">
              <ScoreGauge
                score={composite.promotingInteroperabilityScore}
                label="Promoting IT"
                weight={composite.promotingInteroperabilityWeight}
              />
            </div>
          </div>

          {/* Composite + Payment Adjustment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
              <BarChart3 className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Final Composite Score</p>
              <p className={`text-4xl font-bold mt-1 ${getPerformanceColor(composite.finalCompositeScore / 100, false)}`}>
                {composite.finalCompositeScore.toFixed(1)}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {composite.qualityMeasuresReported} quality measures reported
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
              <DollarSign className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Payment Adjustment</p>
              <p className={`text-4xl font-bold mt-1 ${
                composite.paymentAdjustmentPercent > 0 ? 'text-green-400' :
                composite.paymentAdjustmentPercent < 0 ? 'text-red-400' :
                'text-slate-300'
              }`}>
                {composite.paymentAdjustmentPercent > 0 ? '+' : ''}{composite.paymentAdjustmentPercent.toFixed(1)}%
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {composite.benchmarkDecile !== null
                  ? `Benchmark decile: ${composite.benchmarkDecile}`
                  : 'No benchmark data'}
              </p>
            </div>
          </div>

          {/* Quality Measure Scores Table */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h4 className="text-white font-medium">Quality Measure Scores</h4>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-3 text-slate-400 text-xs font-medium">Measure</th>
                  <th className="text-center p-3 text-slate-400 text-xs font-medium w-28">Performance</th>
                  <th className="text-center p-3 text-slate-400 text-xs font-medium w-20">Decile</th>
                  <th className="text-center p-3 text-slate-400 text-xs font-medium w-24">Points</th>
                  <th className="text-center p-3 text-slate-400 text-xs font-medium w-20">Priority</th>
                </tr>
              </thead>
              <tbody>
                {composite.qualityMeasureScores.map(qs => (
                  <tr key={qs.measureId} className="border-b border-slate-700/50">
                    <td className="p-3">
                      <p className="text-white text-sm">{qs.title}</p>
                      <p className="text-slate-500 text-xs">{qs.cmsId}</p>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-bold ${getPerformanceColor(qs.performanceRate, false)}`}>
                        {formatPercentage(qs.performanceRate)}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-300 text-sm">
                      {qs.benchmarkDecile ?? '-'}
                    </td>
                    <td className="p-3 text-center text-slate-300 text-sm">
                      {qs.points}/{qs.maxPoints}
                    </td>
                    <td className="p-3 text-center">
                      {qs.isHighPriority && (
                        <span className="px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded text-xs">
                          High
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No MIPS composite score calculated</p>
          <p className="text-slate-500 text-sm">Click &quot;Calculate MIPS&quot; to generate your composite score</p>
        </div>
      )}

      {/* Improvement Activities */}
      {activities.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h4 className="text-white font-medium">Improvement Activities</h4>
            <p className="text-slate-400 text-sm">
              {activities.filter(a => a.isAttested).length} of {activities.length} attested
              {' '}({activities.filter(a => a.isAttested).reduce((s, a) => s + a.points, 0)} points)
            </p>
          </div>
          <div className="divide-y divide-slate-700/50">
            {activities.map(activity => (
              <div key={activity.id} className="p-3 flex items-center gap-3">
                {activity.isAttested ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${activity.isAttested ? 'text-white' : 'text-slate-400'}`}>
                    {activity.title}
                  </p>
                  {activity.category && (
                    <p className="text-slate-500 text-xs">{activity.category}</p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  activity.weight === 'high'
                    ? 'bg-amber-900/30 text-amber-400'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {activity.points}pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
