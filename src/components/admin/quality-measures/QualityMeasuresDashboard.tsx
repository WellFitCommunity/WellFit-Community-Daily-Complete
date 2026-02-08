/**
 * QualityMeasuresDashboard — Tab container for eCQM, HEDIS, MIPS, Star Ratings
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  RefreshCw,
  BarChart3,
  Calendar
} from 'lucide-react';
import {
  getMeasureDefinitions,
  getAggregateResults,
  calculateMeasures,
  getCalculationJobStatus,
  type CalculationJob
} from '../../../services/qualityMeasures/ecqmCalculationService';
import { exportQRDAIII } from '../../../services/qualityMeasures/qrdaExportService';
import { auditLogger } from '../../../services/auditLogger';
import { QualitySummaryCards } from './QualitySummaryCards';
import { QualityExportPanel } from './QualityExportPanel';
import { ECQMMeasureTable } from './ECQMMeasureTable';
import { HedisDashboardTab } from './HedisDashboardTab';
import { MipsDashboardTab } from './MipsDashboardTab';
import { StarRatingsDashboardTab } from './StarRatingsDashboardTab';
import type { QualityMeasuresDashboardProps, MeasureWithResults, ReportingPeriod } from './types';
import { REPORTING_PERIODS } from './types';

type TabId = 'ecqm' | 'hedis' | 'mips' | 'stars';

interface TabConfig {
  id: TabId;
  label: string;
  description: string;
}

const TABS: TabConfig[] = [
  { id: 'ecqm', label: 'eCQM', description: 'Electronic Clinical Quality Measures' },
  { id: 'hedis', label: 'HEDIS', description: 'Healthcare Effectiveness Data' },
  { id: 'mips', label: 'MIPS', description: 'Merit-based Incentive Payment System' },
  { id: 'stars', label: 'Star Ratings', description: 'CMS Star Ratings (1-5)' },
];

export const QualityMeasuresDashboard: React.FC<QualityMeasuresDashboardProps> = ({
  tenantId,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('ecqm');
  const [measures, setMeasures] = useState<MeasureWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportingPeriod>(REPORTING_PERIODS[0]);
  const [calculationJob, setCalculationJob] = useState<CalculationJob | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'QRDA_I' | 'QRDA_III' | null>(null);

  const loadMeasures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const defsResult = await getMeasureDefinitions();
      if (!defsResult.success || !defsResult.data) {
        throw new Error(defsResult.error?.message || 'Failed to load measures');
      }

      const aggResult = await getAggregateResults(tenantId, selectedPeriod.start);

      const measuresWithResults: MeasureWithResults[] = defsResult.data.map(def => {
        const results = aggResult.success && aggResult.data
          ? aggResult.data.find(r => r.measureId === def.measure_id)
          : undefined;

        return {
          ...def,
          results,
          trend: results?.performanceRate !== null ? 'stable' : undefined
        };
      });

      setMeasures(measuresWithResults);

      await auditLogger.info('QUALITY_DASHBOARD_LOADED', {
        tenantId,
        measureCount: measuresWithResults.length,
        reportingPeriod: selectedPeriod.label
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load quality data';
      setError(errorMessage);
      await auditLogger.error(
        'QUALITY_DASHBOARD_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId }
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedPeriod]);

  useEffect(() => {
    loadMeasures();
  }, [loadMeasures]);

  const handleStartCalculation = async () => {
    try {
      setIsCalculating(true);
      setError(null);

      const result = await calculateMeasures({
        tenantId,
        measureIds: measures.map(m => m.measure_id),
        reportingPeriodStart: selectedPeriod.start,
        reportingPeriodEnd: selectedPeriod.end
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to start calculation');
      }

      pollJobStatus(result.data.jobId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Calculation failed';
      setError(errorMessage);
      setIsCalculating(false);
    }
  };

  const pollJobStatus = (jobId: string) => {
    const poll = async () => {
      const result = await getCalculationJobStatus(jobId);

      if (result.success && result.data) {
        setCalculationJob(result.data);

        if (result.data.status === 'completed') {
          setIsCalculating(false);
          loadMeasures();
        } else if (result.data.status === 'failed') {
          setIsCalculating(false);
          setError(result.data.errorMessage || 'Calculation failed');
        } else {
          setTimeout(poll, 2000);
        }
      }
    };

    poll();
  };

  const handleExport = async (type: 'QRDA_I' | 'QRDA_III') => {
    try {
      setIsExporting(true);
      setExportType(type);

      if (type === 'QRDA_I') {
        await auditLogger.warn('ECQM_EXPORT_SKIPPED', { tenantId, type, reason: 'Patient selection required for QRDA I' });
        throw new Error('QRDA I export requires patient selection. This feature is not yet implemented in this view.');
      }

      const result = await exportQRDAIII({
        tenantId,
        measureIds: measures.map(m => m.measure_id),
        reportingPeriodStart: selectedPeriod.start,
        reportingPeriodEnd: selectedPeriod.end,
        exportType: 'QRDA_III'
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Export failed');
      }

      const blob = new Blob([result.data.xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${selectedPeriod.label.replace(/\s/g, '_')}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await auditLogger.info('ECQM_EXPORT_COMPLETED', {
        tenantId,
        exportType: type,
        reportingPeriod: selectedPeriod.label
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  if (loading) {
    return (
      <div className={`bg-slate-900 rounded-lg p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="ml-3 text-slate-300">Loading Quality Measures Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Quality Measures Dashboard</h1>
              <p className="text-slate-400 text-sm">
                eCQM, HEDIS, MIPS, and Star Ratings Performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              <select
                value={selectedPeriod.label}
                onChange={(e) => {
                  const period = REPORTING_PERIODS.find(p => p.label === e.target.value);
                  if (period) setSelectedPeriod(period);
                }}
                className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-cyan-500"
              >
                {REPORTING_PERIODS.map(period => (
                  <option key={period.label} value={period.label}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleStartCalculation}
              disabled={isCalculating}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white px-4 py-2 rounded transition-colors"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Recalculate
                </>
              )}
            </button>
          </div>
        </div>

        {/* Calculation Progress */}
        {isCalculating && calculationJob && (
          <div className="mt-4 bg-slate-800 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300">
                Processing: {calculationJob.patientsProcessed} / {calculationJob.patientsTotal} patients
              </span>
              <span className="text-cyan-400">{calculationJob.progressPercentage}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${calculationJob.progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 flex border-b border-slate-700">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'ecqm' && (
        <>
          <QualitySummaryCards measures={measures} />
          <QualityExportPanel
            isExporting={isExporting}
            exportType={exportType}
            onExport={handleExport}
          />
          <ECQMMeasureTable measures={measures} />
        </>
      )}

      {activeTab === 'hedis' && (
        <HedisDashboardTab
          tenantId={tenantId}
          reportingPeriodStart={selectedPeriod.start}
          reportingYear={selectedPeriod.start.getFullYear()}
        />
      )}

      {activeTab === 'mips' && (
        <MipsDashboardTab
          tenantId={tenantId}
          reportingYear={selectedPeriod.start.getFullYear()}
        />
      )}

      {activeTab === 'stars' && (
        <StarRatingsDashboardTab
          tenantId={tenantId}
          reportingYear={selectedPeriod.start.getFullYear()}
        />
      )}
    </div>
  );
};

export default QualityMeasuresDashboard;
