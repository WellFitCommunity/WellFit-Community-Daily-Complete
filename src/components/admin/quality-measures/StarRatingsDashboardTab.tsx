/**
 * StarRatingsDashboardTab — CMS Star Ratings (1-5)
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 *
 * Displays overall star rating, domain breakdown, measure-level stars,
 * and year-over-year trend.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  RefreshCw,
  BarChart3,
  Calculator,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  getStarRatings,
  calculateStarRatings,
  getDomainSummaries,
} from '../../../services/qualityMeasures/star/starRatingsService';
import type {
  StarRatingScore,
  StarDomainSummary,
} from '../../../services/qualityMeasures/star/starTypes';
import { StarVisualization } from './StarVisualization';
import { formatPercentage } from './helpers';

interface StarRatingsDashboardTabProps {
  tenantId: string;
  reportingYear: number;
}

export const StarRatingsDashboardTab: React.FC<StarRatingsDashboardTabProps> = ({
  tenantId,
  reportingYear,
}) => {
  const [score, setScore] = useState<StarRatingScore | null>(null);
  const [domains, setDomains] = useState<StarDomainSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getStarRatings(tenantId, reportingYear);
      if (result.success && result.data) {
        setScore(result.data);
        setDomains(getDomainSummaries(result.data));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load star ratings');
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

      const result = await calculateStarRatings({ tenantId, reportingYear });
      if (!result.success) {
        throw new Error(result.error?.message || 'Star rating calculation failed');
      }

      setScore(result.data);
      setDomains(getDomainSummaries(result.data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Star rating calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
        <span className="ml-3 text-slate-300">Loading star ratings...</span>
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
          <h3 className="text-white font-medium">CMS Star Ratings — {reportingYear}</h3>
          <p className="text-slate-400 text-sm">Part C quality performance (1-5 stars)</p>
        </div>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white px-4 py-2 rounded transition-colors"
        >
          {calculating ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Calculating...</>
          ) : (
            <><Calculator className="w-4 h-4" /> Calculate Stars</>
          )}
        </button>
      </div>

      {score ? (
        <>
          {/* Overall Star Rating */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
            <p className="text-slate-400 text-sm mb-3">Overall Star Rating</p>
            <StarVisualization rating={score.overallStarRating} size="lg" />

            {/* Trend */}
            {score.trendDirection && (
              <div className="mt-3 flex items-center justify-center gap-2">
                {score.trendDirection === 'up' && (
                  <><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-green-400 text-sm">Up from {score.previousYearRating?.toFixed(1)}</span></>
                )}
                {score.trendDirection === 'down' && (
                  <><TrendingDown className="w-4 h-4 text-red-400" /><span className="text-red-400 text-sm">Down from {score.previousYearRating?.toFixed(1)}</span></>
                )}
                {score.trendDirection === 'stable' && (
                  <><Minus className="w-4 h-4 text-slate-400" /><span className="text-slate-400 text-sm">Stable from {score.previousYearRating?.toFixed(1)}</span></>
                )}
              </div>
            )}

            {/* Summary Stats */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-slate-400 text-xs">Total Rated</p>
                <p className="text-white font-bold">{score.totalMeasuresRated}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">4+ Stars</p>
                <p className="text-green-400 font-bold">{score.measuresAt4Plus}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Below 3</p>
                <p className="text-red-400 font-bold">{score.measuresBelow3}</p>
              </div>
            </div>
          </div>

          {/* Domain Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            {domains.map(domain => (
              <div key={domain.domain} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-white font-medium text-sm">{domain.domain}</h4>
                    <p className="text-slate-500 text-xs">
                      {domain.measureCount} measures &middot; {(domain.weight * 100).toFixed(0)}% weight
                    </p>
                  </div>
                  <StarVisualization rating={domain.score} size="sm" showValue={false} />
                </div>

                <div className="space-y-2">
                  {domain.measures.map(detail => (
                    <div key={detail.measureId} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 text-xs truncate">{detail.title}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-2">
                        <span className="text-slate-400 text-xs">
                          {formatPercentage(detail.performanceRate)}
                        </span>
                        <StarVisualization
                          rating={detail.starRating}
                          size="sm"
                          showValue={false}
                          maxStars={5}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No star ratings calculated</p>
          <p className="text-slate-500 text-sm">Click &quot;Calculate Stars&quot; to generate star ratings</p>
        </div>
      )}
    </div>
  );
};
