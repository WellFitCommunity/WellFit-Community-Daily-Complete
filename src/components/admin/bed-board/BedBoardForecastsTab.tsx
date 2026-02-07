/**
 * BedBoardForecastsTab — Forecast cards + AI optimization trigger and report.
 */

import React from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../../envision-atlus';
import { BedBoardAiReport } from './BedBoardAiReport';
import type { BedBoardForecastsTabProps } from './BedBoard.types';

export const BedBoardForecastsTab: React.FC<BedBoardForecastsTabProps> = ({
  forecasts,
  aiReport,
  loadingAiReport,
  aiError,
  onGenerateAiReport,
}) => (
  <div className="space-y-4">
    {/* Forecast Cards */}
    <EACard>
      <EACardHeader icon={<TrendingUp className="w-5 h-5" />}>
        Bed Availability Forecasts
      </EACardHeader>
      <EACardContent className="p-4">
        {forecasts.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No forecasts generated yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Generate forecasts from the Unit Capacity tab
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {forecasts.map((forecast) => (
              <div
                key={forecast.id}
                className="p-4 bg-slate-800 rounded-lg border border-slate-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-white">
                      Forecast for {forecast.forecast_date}
                    </p>
                    <p className="text-sm text-slate-400">
                      Generated: {new Date(forecast.generated_at).toLocaleString()}
                    </p>
                  </div>
                  {forecast.confidence_level && (
                    <span className="px-2 py-1 bg-teal-500/20 text-teal-400 rounded-sm text-sm">
                      {Math.round((forecast.confidence_level ?? 0) * 100)}% confidence
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-slate-400">Predicted Census</p>
                    <p className="text-xl font-bold text-white">{forecast.predicted_census}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Predicted Available</p>
                    <p className="text-xl font-bold text-green-400">{forecast.predicted_available}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Expected Discharges</p>
                    <p className="text-xl font-bold text-blue-400">{forecast.predicted_discharges ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Expected Admissions</p>
                    <p className="text-xl font-bold text-orange-400">{forecast.predicted_admissions ?? '-'}</p>
                  </div>
                </div>
                {forecast.actual_census !== null && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-400">Actual Census:</span>
                      <span className="font-bold text-white">{forecast.actual_census}</span>
                      <span className={`text-sm ${
                        Math.abs(forecast.forecast_error ?? 0) <= 2 ? 'text-green-400' : 'text-orange-400'
                      }`}>
                        ({(forecast.forecast_error ?? 0) > 0 ? '+' : ''}{forecast.forecast_error} variance)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </EACardContent>
    </EACard>

    {/* AI Optimization Section */}
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400" />
            AI-Powered Capacity Optimization
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Using Claude Sonnet for intelligent bed management and capacity forecasting
          </p>
        </div>
        <EAButton
          onClick={onGenerateAiReport}
          disabled={loadingAiReport}
          icon={<Sparkles className="w-4 h-4" />}
        >
          {loadingAiReport ? 'Generating AI Report...' : 'Generate AI Report'}
        </EAButton>
      </div>

      {aiError && <EAAlert variant="critical">{aiError}</EAAlert>}

      {!aiReport && !loadingAiReport && (
        <EACard>
          <EACardContent className="p-12 text-center">
            <Sparkles className="w-16 h-16 text-teal-400/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">AI Optimization Ready</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Click &quot;Generate AI Report&quot; to analyze current bed utilization and receive
              AI-powered recommendations for capacity optimization using Claude Sonnet.
            </p>
          </EACardContent>
        </EACard>
      )}

      {loadingAiReport && (
        <EACard>
          <EACardContent className="p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Analyzing Capacity Data...</h3>
            <p className="text-slate-400">
              Claude Sonnet is analyzing bed utilization patterns and generating recommendations
            </p>
          </EACardContent>
        </EACard>
      )}
    </div>

    {/* AI Report Display */}
    {aiReport && <BedBoardAiReport aiReport={aiReport} />}
  </div>
);

export default BedBoardForecastsTab;
