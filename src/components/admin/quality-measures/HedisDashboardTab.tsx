/**
 * HedisDashboardTab — HEDIS Healthcare Effectiveness Data
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 *
 * Displays HEDIS measures grouped by subdomain with benchmark comparison.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { getHedisSummary } from '../../../services/qualityMeasures/hedis/hedisService';
import type { HedisSummary, HedisDomainGroup, HedisMeasureWithResults } from '../../../services/qualityMeasures/hedis/hedisTypes';
import { getPerformanceColor, formatPercentage } from './helpers';

interface HedisDashboardTabProps {
  tenantId: string;
  reportingPeriodStart: Date;
  reportingYear: number;
}

export const HedisDashboardTab: React.FC<HedisDashboardTabProps> = ({
  tenantId,
  reportingPeriodStart,
  reportingYear,
}) => {
  const [summary, setSummary] = useState<HedisSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getHedisSummary(tenantId, reportingPeriodStart, reportingYear);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to load HEDIS data');
      }

      setSummary(result.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load HEDIS data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, reportingPeriodStart, reportingYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
        <span className="ml-3 text-slate-300">Loading HEDIS data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
        </div>
      </div>
    );
  }

  if (!summary || summary.totalMeasures === 0) {
    return (
      <div className="p-8 text-center">
        <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No HEDIS measures configured</p>
        <p className="text-slate-500 text-sm">Assign HEDIS program type to measures to see data here</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">HEDIS Measures</p>
          <p className="text-2xl font-bold text-white">{summary.totalMeasures}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">With Data</p>
          <p className="text-2xl font-bold text-white">{summary.measuresWithData}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Avg Performance</p>
          <p className={`text-2xl font-bold ${getPerformanceColor(summary.averagePerformance, false)}`}>
            {formatPercentage(summary.averagePerformance)}
          </p>
        </div>
      </div>

      {/* Domain Groups */}
      {summary.domains.map(domain => (
        <DomainCard key={domain.domain} domain={domain} />
      ))}
    </div>
  );
};

/** Single HEDIS domain card with measures */
const DomainCard: React.FC<{ domain: HedisDomainGroup }> = ({ domain }) => {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">{domain.domain}</h3>
          <p className="text-slate-400 text-sm">{domain.measureCount} measures</p>
        </div>
        {domain.averagePerformance !== null && (
          <span className={`text-lg font-bold ${getPerformanceColor(domain.averagePerformance, false)}`}>
            {formatPercentage(domain.averagePerformance)}
          </span>
        )}
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left p-3 text-slate-400 text-xs font-medium">Measure</th>
            <th className="text-center p-3 text-slate-400 text-xs font-medium w-20">HEDIS ID</th>
            <th className="text-center p-3 text-slate-400 text-xs font-medium w-28">Performance</th>
            <th className="text-center p-3 text-slate-400 text-xs font-medium w-28">Benchmark</th>
            <th className="text-center p-3 text-slate-400 text-xs font-medium w-20">Gap</th>
          </tr>
        </thead>
        <tbody>
          {domain.measures.map(mwr => (
            <MeasureRow key={mwr.measure.id} mwr={mwr} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Single measure row within a domain */
const MeasureRow: React.FC<{ mwr: HedisMeasureWithResults }> = ({ mwr }) => {
  const rate = mwr.results?.performanceRate ?? null;
  const isInverse = mwr.measure.is_inverse_measure;

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-750 transition-colors">
      <td className="p-3">
        <p className="text-white text-sm">{mwr.measure.title}</p>
        <p className="text-slate-500 text-xs">{mwr.measure.cms_id}</p>
      </td>
      <td className="p-3 text-center">
        <span className="text-cyan-400 font-mono text-sm">
          {mwr.measure.hedis_measure_id || '-'}
        </span>
      </td>
      <td className="p-3 text-center">
        <span className={`font-bold ${getPerformanceColor(rate, isInverse)}`}>
          {formatPercentage(rate)}
        </span>
        {isInverse && (
          <span className="text-xs text-slate-500 block">(Lower is better)</span>
        )}
      </td>
      <td className="p-3 text-center text-slate-300 text-sm">
        {mwr.benchmark !== null ? formatPercentage(mwr.benchmark) : '-'}
      </td>
      <td className="p-3 text-center">
        {mwr.gap !== null ? (
          <span className="flex items-center justify-center gap-1">
            {mwr.gap > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : mwr.gap < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-400" />
            ) : (
              <Minus className="w-4 h-4 text-slate-400" />
            )}
            <span className={`text-sm ${mwr.gap >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(Math.abs(mwr.gap) * 100).toFixed(1)}%
            </span>
          </span>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </td>
    </tr>
  );
};
