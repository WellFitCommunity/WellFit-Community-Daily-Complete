/**
 * ECQMMeasureTable — measure table with drill-down
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  XCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { getPerformanceColor, getPerformanceBgColor, formatPercentage, isInverseMeasure } from './helpers';
import type { MeasureWithResults } from './types';

interface ECQMMeasureTableProps {
  measures: MeasureWithResults[];
}

export const ECQMMeasureTable: React.FC<ECQMMeasureTableProps> = ({ measures }) => {
  const [expandedMeasure, setExpandedMeasure] = useState<string | null>(null);

  return (
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
                      <span className="text-slate-400">&mdash;</span>
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
                                Click &quot;Recalculate&quot; to generate results
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

      {/* Legend */}
      <div className="mt-4 bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h4 className="text-slate-300 font-medium mb-3">Performance Legend</h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-slate-400 text-sm">Excellent (&ge;90%)</span>
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
  );
};
