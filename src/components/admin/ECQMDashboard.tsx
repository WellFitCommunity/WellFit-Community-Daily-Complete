/**
 * Electronic Clinical Quality Measures (eCQM) Dashboard
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 * Purpose: Provider view of clinical quality measure performance
 *
 * Features:
 * - View all measure definitions and their performance rates
 * - Track calculation job progress
 * - Export QRDA Category I and III reports
 * - Drill down to patient-level results
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  BarChart3,
  Target,
  Calendar
} from 'lucide-react';
import {
  getMeasureDefinitions,
  getAggregateResults,
  calculateMeasures,
  getCalculationJobStatus,
  type MeasureDefinition,
  type AggregateResult,
  type CalculationJob
} from '../../services/qualityMeasures/ecqmCalculationService';
import { exportQRDAI, exportQRDAIII } from '../../services/qualityMeasures/qrdaExportService';
import { auditLogger } from '../../services/auditLogger';

// =====================================================
// TYPES
// =====================================================

interface ECQMDashboardProps {
  tenantId: string;
  className?: string;
}

interface MeasureWithResults extends MeasureDefinition {
  results?: AggregateResult;
  trend?: 'up' | 'down' | 'stable';
  previousRate?: number;
}

interface ReportingPeriod {
  start: Date;
  end: Date;
  label: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const REPORTING_PERIODS: ReportingPeriod[] = [
  {
    start: new Date('2026-01-01'),
    end: new Date('2026-12-31'),
    label: '2026 Full Year'
  },
  {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    label: '2025 Full Year'
  },
  {
    start: new Date('2026-01-01'),
    end: new Date('2026-03-31'),
    label: 'Q1 2026'
  }
];

// Performance rate thresholds for color coding
const PERFORMANCE_THRESHOLDS = {
  excellent: 0.90,
  good: 0.75,
  fair: 0.50,
  poor: 0.25
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getPerformanceColor(rate: number | null, isInverseMeasure: boolean = false): string {
  if (rate === null) return 'text-slate-400';

  // For inverse measures (like CMS122 - poor control), lower is better
  const effectiveRate = isInverseMeasure ? 1 - rate : rate;

  if (effectiveRate >= PERFORMANCE_THRESHOLDS.excellent) return 'text-green-400';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.good) return 'text-emerald-400';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.fair) return 'text-yellow-400';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.poor) return 'text-orange-400';
  return 'text-red-400';
}

function getPerformanceBgColor(rate: number | null, isInverseMeasure: boolean = false): string {
  if (rate === null) return 'bg-slate-800';

  const effectiveRate = isInverseMeasure ? 1 - rate : rate;

  if (effectiveRate >= PERFORMANCE_THRESHOLDS.excellent) return 'bg-green-900/30';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.good) return 'bg-emerald-900/30';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.fair) return 'bg-yellow-900/30';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.poor) return 'bg-orange-900/30';
  return 'bg-red-900/30';
}

function formatPercentage(rate: number | null): string {
  if (rate === null) return 'N/A';
  return `${(rate * 100).toFixed(1)}%`;
}

function isInverseMeasure(measureId: string): boolean {
  // CMS122 is an inverse measure (poor control - lower is better)
  return measureId === 'CMS122v12';
}

// =====================================================
// COMPONENT
// =====================================================

export const ECQMDashboard: React.FC<ECQMDashboardProps> = ({
  tenantId,
  className = ''
}) => {
  // State
  const [measures, setMeasures] = useState<MeasureWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportingPeriod>(REPORTING_PERIODS[0]);
  const [expandedMeasure, setExpandedMeasure] = useState<string | null>(null);
  const [calculationJob, setCalculationJob] = useState<CalculationJob | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'QRDA_I' | 'QRDA_III' | null>(null);

  // =====================================================
  // DATA LOADING
  // =====================================================

  const loadMeasures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch measure definitions
      const defsResult = await getMeasureDefinitions();
      if (!defsResult.success || !defsResult.data) {
        throw new Error(defsResult.error?.message || 'Failed to load measures');
      }

      // Fetch aggregate results for selected period
      const aggResult = await getAggregateResults(tenantId, selectedPeriod.start);

      // Merge definitions with results
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

      await auditLogger.info('ECQM_DASHBOARD_LOADED', {
        tenantId,
        measureCount: measuresWithResults.length,
        reportingPeriod: selectedPeriod.label
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load eCQM data';
      setError(errorMessage);
      await auditLogger.error(
        'ECQM_DASHBOARD_LOAD_FAILED',
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

  // =====================================================
  // CALCULATION
  // =====================================================

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

      // Poll for job status
      pollJobStatus(result.data.jobId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Calculation failed';
      setError(errorMessage);
      setIsCalculating(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      const result = await getCalculationJobStatus(jobId);

      if (result.success && result.data) {
        setCalculationJob(result.data);

        if (result.data.status === 'completed') {
          setIsCalculating(false);
          loadMeasures(); // Refresh data
        } else if (result.data.status === 'failed') {
          setIsCalculating(false);
          setError(result.data.errorMessage || 'Calculation failed');
        } else {
          // Continue polling
          setTimeout(poll, 2000);
        }
      }
    };

    poll();
  };

  // =====================================================
  // EXPORT
  // =====================================================

  const handleExport = async (type: 'QRDA_I' | 'QRDA_III') => {
    try {
      setIsExporting(true);
      setExportType(type);

      // Note: QRDA I requires patientId - in production, would open a patient selector modal
      // For now, QRDA III (aggregate) is the primary export used from this dashboard
      if (type === 'QRDA_I') {
        // TODO: Implement patient selector for QRDA I export
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

      // Download XML file
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

  // =====================================================
  // CALCULATIONS FOR SUMMARY
  // =====================================================

  const summaryStats = {
    totalMeasures: measures.length,
    measuresWithData: measures.filter(m => m.results).length,
    avgPerformanceRate: measures.reduce((sum, m) => {
      if (m.results?.performanceRate !== null && m.results?.performanceRate !== undefined) {
        return sum + m.results.performanceRate;
      }
      return sum;
    }, 0) / (measures.filter(m => m.results?.performanceRate !== null).length || 1),
    totalPatients: measures.reduce((sum, m) => sum + (m.results?.patientCount || 0), 0),
    measuresAboveThreshold: measures.filter(m =>
      m.results?.performanceRate !== null &&
      m.results !== undefined &&
      (isInverseMeasure(m.measure_id)
        ? m.results.performanceRate < 0.1 // For inverse, lower is better
        : (m.results.performanceRate ?? 0) >= PERFORMANCE_THRESHOLDS.good)
    ).length
  };

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className={`bg-slate-900 rounded-lg p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="ml-3 text-slate-300">Loading eCQM Dashboard...</span>
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
              <h1 className="text-2xl font-bold text-white">eCQM Dashboard</h1>
              <p className="text-slate-400 text-sm">
                Electronic Clinical Quality Measures Performance
              </p>
            </div>
          </div>

          {/* Period Selector */}
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

      {/* Summary Cards */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-900/50 rounded-lg">
              <Target className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Measures</p>
              <p className="text-2xl font-bold text-white">{summaryStats.totalMeasures}</p>
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
              <p className={`text-2xl font-bold ${getPerformanceColor(summaryStats.avgPerformanceRate)}`}>
                {formatPercentage(summaryStats.avgPerformanceRate)}
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
                {summaryStats.totalPatients.toLocaleString()}
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
                {summaryStats.measuresAboveThreshold} / {summaryStats.measuresWithData}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="px-6 pb-4 flex gap-3">
        <button
          onClick={() => handleExport('QRDA_III')}
          disabled={isExporting}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white px-4 py-2 rounded transition-colors"
        >
          {isExporting && exportType === 'QRDA_III' ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export QRDA III (Aggregate)
        </button>
        <button
          onClick={() => handleExport('QRDA_I')}
          disabled={isExporting}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white px-4 py-2 rounded transition-colors"
        >
          {isExporting && exportType === 'QRDA_I' ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Export QRDA I (Patient-Level)
        </button>
      </div>

      {/* Measures Table */}
      <div className="px-6 pb-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-750">
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-slate-300 font-medium">Measure</th>
                <th className="text-center p-4 text-slate-300 font-medium w-24">CMS ID</th>
                <th className="text-center p-4 text-slate-300 font-medium w-32">IP</th>
                <th className="text-center p-4 text-slate-300 font-medium w-32">Denominator</th>
                <th className="text-center p-4 text-slate-300 font-medium w-32">Numerator</th>
                <th className="text-center p-4 text-slate-300 font-medium w-36">Performance</th>
                <th className="text-center p-4 text-slate-300 font-medium w-24">Trend</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {measures.map(measure => (
                <React.Fragment key={measure.id}>
                  <tr
                    className={`border-b border-slate-700 hover:bg-slate-750 cursor-pointer transition-colors ${
                      expandedMeasure === measure.id ? 'bg-slate-750' : ''
                    }`}
                    onClick={() => setExpandedMeasure(
                      expandedMeasure === measure.id ? null : measure.id
                    )}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          measure.results !== undefined && measure.results.performanceRate !== null
                            ? getPerformanceColor(measure.results.performanceRate, isInverseMeasure(measure.measure_id)).replace('text-', 'bg-')
                            : 'bg-slate-600'
                        }`} />
                        <div>
                          <p className="text-white font-medium">{measure.title}</p>
                          <p className="text-slate-400 text-sm">{measure.clinical_focus}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-cyan-400 font-mono">{measure.cms_id}</span>
                    </td>
                    <td className="p-4 text-center text-slate-300">
                      {measure.results?.initialPopulationCount ?? '-'}
                    </td>
                    <td className="p-4 text-center text-slate-300">
                      {measure.results?.denominatorCount ?? '-'}
                    </td>
                    <td className="p-4 text-center text-slate-300">
                      {measure.results?.numeratorCount ?? '-'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`font-bold text-lg ${
                        getPerformanceColor(
                          measure.results?.performanceRate ?? null,
                          isInverseMeasure(measure.measure_id)
                        )
                      }`}>
                        {formatPercentage(measure.results?.performanceRate ?? null)}
                      </span>
                      {isInverseMeasure(measure.measure_id) && (
                        <span className="text-xs text-slate-500 block">(Lower is better)</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {measure.trend === 'up' && (
                        <TrendingUp className="w-5 h-5 text-green-400 mx-auto" />
                      )}
                      {measure.trend === 'down' && (
                        <TrendingDown className="w-5 h-5 text-red-400 mx-auto" />
                      )}
                      {measure.trend === 'stable' && (
                        <span className="text-slate-400">—</span>
                      )}
                      {!measure.trend && (
                        <Clock className="w-5 h-5 text-slate-500 mx-auto" />
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {expandedMeasure === measure.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded Details */}
                  {expandedMeasure === measure.id && (
                    <tr className="bg-slate-800/50">
                      <td colSpan={8} className="p-6">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-slate-300 font-medium mb-2">Description</h4>
                            <p className="text-slate-400 text-sm">{measure.description}</p>

                            <h4 className="text-slate-300 font-medium mt-4 mb-2">Population Criteria</h4>
                            <div className="space-y-2 text-sm">
                              <p className="text-slate-400">
                                <span className="text-slate-300">Initial Population:</span>{' '}
                                {measure.initial_population_description}
                              </p>
                              <p className="text-slate-400">
                                <span className="text-slate-300">Denominator:</span>{' '}
                                {measure.denominator_description}
                              </p>
                              <p className="text-slate-400">
                                <span className="text-slate-300">Numerator:</span>{' '}
                                {measure.numerator_description}
                              </p>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-slate-300 font-medium mb-2">Results Breakdown</h4>
                            {measure.results ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div className={`p-3 rounded ${getPerformanceBgColor(measure.results.performanceRate, isInverseMeasure(measure.measure_id))}`}>
                                  <p className="text-slate-400 text-xs">Initial Population</p>
                                  <p className="text-white text-xl font-bold">
                                    {measure.results.initialPopulationCount}
                                  </p>
                                </div>
                                <div className="bg-slate-700 p-3 rounded">
                                  <p className="text-slate-400 text-xs">Denominator</p>
                                  <p className="text-white text-xl font-bold">
                                    {measure.results.denominatorCount}
                                  </p>
                                </div>
                                <div className="bg-slate-700 p-3 rounded">
                                  <p className="text-slate-400 text-xs">Exclusions</p>
                                  <p className="text-white text-xl font-bold">
                                    {measure.results.denominatorExclusionCount}
                                  </p>
                                </div>
                                <div className="bg-slate-700 p-3 rounded">
                                  <p className="text-slate-400 text-xs">Exceptions</p>
                                  <p className="text-white text-xl font-bold">
                                    {measure.results.denominatorExceptionCount}
                                  </p>
                                </div>
                                <div className="bg-slate-700 p-3 rounded">
                                  <p className="text-slate-400 text-xs">Numerator</p>
                                  <p className="text-white text-xl font-bold">
                                    {measure.results.numeratorCount}
                                  </p>
                                </div>
                                <div className={`p-3 rounded ${getPerformanceBgColor(measure.results.performanceRate, isInverseMeasure(measure.measure_id))}`}>
                                  <p className="text-slate-400 text-xs">Performance Rate</p>
                                  <p className={`text-xl font-bold ${getPerformanceColor(measure.results.performanceRate, isInverseMeasure(measure.measure_id))}`}>
                                    {formatPercentage(measure.results.performanceRate)}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-700 p-4 rounded text-center">
                                <XCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                <p className="text-slate-400">No calculation results available</p>
                                <p className="text-slate-500 text-sm">
                                  Click "Recalculate" to generate results
                                </p>
                              </div>
                            )}

                            <div className="mt-4 flex gap-2">
                              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                                {measure.measure_type}
                              </span>
                              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                                {measure.measure_scoring}
                              </span>
                              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                                v{measure.version}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {measures.length === 0 && (
            <div className="p-8 text-center">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No measures configured</p>
              <p className="text-slate-500 text-sm">
                Contact your administrator to set up quality measures
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 pb-6">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h4 className="text-slate-300 font-medium mb-3">Performance Legend</h4>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-slate-400 text-sm">Excellent (≥90%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-slate-400 text-sm">Good (75-89%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-slate-400 text-sm">Fair (50-74%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-400" />
              <span className="text-slate-400 text-sm">Needs Improvement (25-49%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-slate-400 text-sm">Poor (&lt;25%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ECQMDashboard;
