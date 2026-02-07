/**
 * BedBoardAiReport — Renders the full AI optimization report with score cards,
 * insights, shift forecasts, unit breakdown, and discharge recommendations.
 */

import React from 'react';
import {
  AlertTriangle,
  TrendingUp,
  BarChart3,
  UserMinus,
  ArrowRight,
} from 'lucide-react';
import { EACard, EACardHeader, EACardContent } from '../../envision-atlus';
import type { BedBoardAiReportProps } from './BedBoard.types';

export const BedBoardAiReport: React.FC<BedBoardAiReportProps> = ({ aiReport }) => (
  <div className="space-y-6 mt-6">
    {/* Score Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <EACard>
        <EACardContent className="p-4 text-center">
          <p className="text-sm text-slate-400">Capacity Score</p>
          <p className={`text-3xl font-bold ${
            aiReport.overallCapacityScore >= 80 ? 'text-green-400' :
            aiReport.overallCapacityScore >= 60 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {aiReport.overallCapacityScore}
          </p>
          <p className="text-xs text-slate-500">Out of 100</p>
        </EACardContent>
      </EACard>
      <EACard>
        <EACardContent className="p-4 text-center">
          <p className="text-sm text-slate-400">Efficiency Score</p>
          <p className={`text-3xl font-bold ${
            aiReport.overallEfficiencyScore >= 80 ? 'text-green-400' :
            aiReport.overallEfficiencyScore >= 60 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {aiReport.overallEfficiencyScore}
          </p>
          <p className="text-xs text-slate-500">Out of 100</p>
        </EACardContent>
      </EACard>
      <EACard>
        <EACardContent className="p-4 text-center">
          <p className="text-sm text-slate-400">Current Occupancy</p>
          <p className="text-3xl font-bold text-white">
            {Math.round(aiReport.currentOccupancyRate * 100)}%
          </p>
          <p className="text-xs text-slate-500">Target: {Math.round(aiReport.targetOccupancyRate * 100)}%</p>
        </EACardContent>
      </EACard>
      <EACard>
        <EACardContent className="p-4 text-center">
          <p className="text-sm text-slate-400">AI Cost</p>
          <p className="text-3xl font-bold text-teal-400">${aiReport.totalAiCost.toFixed(3)}</p>
          <p className="text-xs text-slate-500">This report</p>
        </EACardContent>
      </EACard>
    </div>

    {/* Capacity Insights */}
    {aiReport.insights.length > 0 && (
      <EACard>
        <EACardHeader icon={<AlertTriangle className="w-5 h-5" />}>
          Capacity Insights & Alerts
        </EACardHeader>
        <EACardContent className="p-4 space-y-3">
          {aiReport.insights.map((insight, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg border ${
                insight.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                insight.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className={`font-medium ${
                    insight.severity === 'critical' ? 'text-red-400' :
                    insight.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {insight.title}
                  </h4>
                  <p className="text-sm text-slate-300 mt-1">{insight.description}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs uppercase ${
                  insight.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                  insight.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {insight.insightType}
                </span>
              </div>
              {insight.recommendations.length > 0 && (
                <div className="mt-3 space-y-2">
                  {insight.recommendations.map((rec, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm">
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-300">{rec.action}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        rec.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                        rec.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-600 text-slate-400'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </EACardContent>
      </EACard>
    )}

    {/* Shift Forecasts */}
    {aiReport.forecasts.length > 0 && (
      <EACard>
        <EACardHeader icon={<TrendingUp className="w-5 h-5" />}>
          AI Capacity Forecasts (Next 3 Shifts)
        </EACardHeader>
        <EACardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiReport.forecasts.map((forecast, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  forecast.riskLevel === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                  forecast.riskLevel === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                  forecast.riskLevel === 'moderate' ? 'bg-yellow-500/10 border-yellow-500/30' :
                  'bg-green-500/10 border-green-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-white capitalize">{forecast.shiftPeriod} Shift</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    forecast.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                    forecast.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    forecast.riskLevel === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {forecast.riskLevel} risk
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Predicted Census</span>
                    <span className="text-white font-medium">{forecast.predictedCensus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected Discharges</span>
                    <span className="text-green-400">{forecast.predictedDischarges}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected Admissions</span>
                    <span className="text-blue-400">{forecast.predictedAdmissions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Available Beds</span>
                    <span className="text-teal-400 font-medium">{forecast.predictedAvailableBeds}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-500">
                    Confidence: {Math.round(forecast.confidenceLevel * 100)}%
                  </p>
                </div>
                {forecast.recommendations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 mb-1">Recommendations:</p>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {forecast.recommendations.slice(0, 2).map((rec, j) => (
                        <li key={j}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </EACardContent>
      </EACard>
    )}

    {/* Unit Breakdown */}
    {aiReport.unitBreakdown.length > 0 && (
      <EACard>
        <EACardHeader icon={<BarChart3 className="w-5 h-5" />}>
          Unit-by-Unit Analysis
        </EACardHeader>
        <EACardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 pr-4">Unit</th>
                  <th className="pb-3 pr-4">Occupancy</th>
                  <th className="pb-3 pr-4">Efficiency</th>
                  <th className="pb-3 pr-4">Bottlenecks</th>
                  <th className="pb-3">Opportunities</th>
                </tr>
              </thead>
              <tbody>
                {aiReport.unitBreakdown.map((unit, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className="py-3 pr-4 font-medium text-white">{unit.unitName}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              unit.occupancy > 0.95 ? 'bg-red-500' :
                              unit.occupancy > 0.85 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, unit.occupancy * 100)}%` }}
                          />
                        </div>
                        <span className="text-slate-300">{Math.round(unit.occupancy * 100)}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`${
                        unit.efficiency >= 80 ? 'text-green-400' :
                        unit.efficiency >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {Math.round(unit.efficiency)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {unit.bottlenecks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {unit.bottlenecks.map((b, j) => (
                            <span key={j} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-sm text-xs">{b}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">None</span>
                      )}
                    </td>
                    <td className="py-3">
                      {unit.opportunities.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {unit.opportunities.map((o, j) => (
                            <span key={j} className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-sm text-xs">{o}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EACardContent>
      </EACard>
    )}

    {/* Discharge Recommendations */}
    {aiReport.dischargeRecommendations.length > 0 && (
      <EACard>
        <EACardHeader icon={<UserMinus className="w-5 h-5" />}>
          AI Discharge Recommendations
        </EACardHeader>
        <EACardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 pr-4">Patient</th>
                  <th className="pb-3 pr-4">Bed</th>
                  <th className="pb-3 pr-4">LOS</th>
                  <th className="pb-3 pr-4">Readiness</th>
                  <th className="pb-3 pr-4">Confidence</th>
                  <th className="pb-3">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {aiReport.dischargeRecommendations.slice(0, 10).map((rec, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className="py-3 pr-4 font-medium text-white">{rec.patientName}</td>
                    <td className="py-3 pr-4 text-slate-300">{rec.bedLabel}</td>
                    <td className="py-3 pr-4 text-slate-300">{rec.currentLOS} days</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        rec.dischargeReadiness === 'ready' ? 'bg-green-500/20 text-green-400' :
                        rec.dischargeReadiness === 'likely_today' ? 'bg-teal-500/20 text-teal-400' :
                        rec.dischargeReadiness === 'likely_tomorrow' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-600 text-slate-400'
                      }`}>
                        {rec.dischargeReadiness.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{Math.round(rec.confidence * 100)}%</td>
                    <td className="py-3 text-slate-400 text-xs max-w-xs truncate">{rec.aiRationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EACardContent>
      </EACard>
    )}

    {/* Report Footer */}
    <div className="text-center text-sm text-slate-500">
      Report generated at {new Date(aiReport.generatedAt).toLocaleString()} &bull;
      Model: {aiReport.aiModel}
    </div>
  </div>
);

export default BedBoardAiReport;
