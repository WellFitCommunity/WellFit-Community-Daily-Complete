import React, { useState, useMemo } from 'react';
import type { Observation } from '../../types/fhir';

interface ObservationTimelineProps {
  observations: Observation[];
  userId: string;
}

interface _TrendPoint {
  date: string;
  value: number;
  interpretation?: string;
}

const ObservationTimeline: React.FC<ObservationTimelineProps> = ({ observations }) => {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  // Get unique observation types for trending
  const observationTypes = useMemo(() => {
    const types = new Map<string, { code: string; display: string; unit?: string; count: number }>();

    observations.forEach(obs => {
      if (obs.value_quantity_value !== undefined && obs.code) {
        const existing = types.get(obs.code);
        if (existing) {
          existing.count++;
        } else {
          types.set(obs.code, {
            code: obs.code,
            display: obs.code_display,
            unit: obs.value_quantity_unit,
            count: 1
          });
        }
      }
    });

    return Array.from(types.values()).sort((a, b) => b.count - a.count);
  }, [observations]);

  // Get trend data for selected observation type
  const trendData = useMemo(() => {
    if (!selectedCode) return [];

    return observations
      .filter(obs => obs.code === selectedCode && obs.value_quantity_value !== undefined)
      .map(obs => ({
        date: obs.effective_datetime || obs.issued || '',
        value: obs.value_quantity_value,
        interpretation: obs.interpretation_display?.[0]
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [observations, selectedCode]);

  // Calculate chart dimensions
  const getChartData = () => {
    if (trendData.length === 0) return null;

    const values = trendData.map(d => d.value).filter((v): v is number => v !== undefined);
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const padding = range * 0.1;

    return {
      min: min - padding,
      max: max + padding,
      range: range + (2 * padding),
      values
    };
  };

  const chartData = getChartData();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const getPointColor = (interpretation?: string) => {
    if (!interpretation) return '#3B82F6'; // blue
    const interp = interpretation.toLowerCase();
    if (interp.includes('normal') || interp === 'n') return '#10B981'; // green
    if (interp.includes('high') || interp === 'h' || interp === 'hh') return '#EF4444'; // red
    if (interp.includes('low') || interp === 'l' || interp === 'll') return '#F59E0B'; // orange
    if (interp.includes('critical')) return '#DC2626'; // dark red
    return '#3B82F6';
  };

  const selectedType = observationTypes.find(t => t.code === selectedCode);

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Observation Trends</h2>
          <p className="text-sm text-gray-600 mt-1">Visualize changes over time</p>
        </div>
      </div>

      {/* Observation Type Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Observation to Trend
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {observationTypes.map((type) => (
            <button
              key={type.code}
              onClick={() => setSelectedCode(type.code)}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                selectedCode === type.code
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold text-gray-900 text-sm">{type.display}</div>
              <div className="text-xs text-gray-500 mt-1">
                {type.count} reading{type.count > 1 ? 's' : ''} • {type.unit || 'N/A'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {selectedCode && trendData.length > 0 && chartData && (
        <div className="space-y-4">
          {/* Chart Container */}
          <div className="bg-linear-to-br from-gray-50 to-blue-50 rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{selectedType?.display} Trend</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">Normal</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-600">High</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-gray-600">Low</span>
                </div>
              </div>
            </div>

            {/* SVG Chart */}
            <div className="relative">
              <svg width="100%" height="300" className="overflow-visible">
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.3" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <g key={i}>
                    <line
                      x1="60"
                      y1={50 + (i * 50)}
                      x2="100%"
                      y2={50 + (i * 50)}
                      stroke="#E5E7EB"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="50"
                      y={54 + (i * 50)}
                      textAnchor="end"
                      className="text-xs fill-gray-600"
                    >
                      {(chartData.max - (i * chartData.range / 4)).toFixed(1)}
                    </text>
                  </g>
                ))}

                {/* Data line and points */}
                {trendData.filter(p => p.value !== undefined).map((point, index) => {
                  if (point.value === undefined) return null;
                  const x = 80 + (index * ((100 / trendData.length) * 8));
                  const y = 250 - ((point.value - chartData.min) / chartData.range) * 200;

                  // Draw line to next point
                  if (index < trendData.length - 1) {
                    const nextPoint = trendData[index + 1];
                    if (nextPoint.value === undefined) return null;
                    const nextX = 80 + ((index + 1) * ((100 / trendData.length) * 8));
                    const nextY = 250 - ((nextPoint.value - chartData.min) / chartData.range) * 200;

                    return (
                      <g key={index}>
                        <line
                          x1={x}
                          y1={y}
                          x2={nextX}
                          y2={nextY}
                          stroke="url(#lineGradient)"
                          strokeWidth="3"
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r="6"
                          fill={getPointColor(point.interpretation)}
                          stroke="white"
                          strokeWidth="2"
                          className="cursor-pointer hover:r-8 transition-all"
                        />
                        <text
                          x={x}
                          y="280"
                          textAnchor="middle"
                          className="text-xs fill-gray-600"
                        >
                          {formatDate(point.date)}
                        </text>
                      </g>
                    );
                  }

                  // Last point
                  return (
                    <g key={index}>
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill={getPointColor(point.interpretation)}
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-8 transition-all"
                      />
                      <text
                        x={x}
                        y="280"
                        textAnchor="middle"
                        className="text-xs fill-gray-600"
                      >
                        {formatDate(point.date)}
                      </text>
                    </g>
                  );
                })}

                {/* Y-axis label */}
                <text
                  x="10"
                  y="150"
                  transform="rotate(-90, 10, 150)"
                  textAnchor="middle"
                  className="text-xs fill-gray-700 font-medium"
                >
                  {selectedType?.unit || 'Value'}
                </text>
              </svg>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interpretation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trendData.slice().reverse().map((point, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(point.date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {point.value} {selectedType?.unit}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {point.interpretation && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium"
                          style={{
                            backgroundColor: `${getPointColor(point.interpretation)}20`,
                            color: getPointColor(point.interpretation)
                          }}
                        >
                          {point.interpretation}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Latest</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">
                {trendData[trendData.length - 1].value} {selectedType?.unit}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-600 font-medium">Average</div>
              <div className="text-2xl font-bold text-green-900 mt-1">
                {(trendData.reduce((sum, p) => sum + (p.value ?? 0), 0) / trendData.length).toFixed(1)} {selectedType?.unit}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-600 font-medium">Maximum</div>
              <div className="text-2xl font-bold text-red-900 mt-1">
                {Math.max(...trendData.map(p => p.value ?? 0)).toFixed(1)} {selectedType?.unit}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-sm text-orange-600 font-medium">Minimum</div>
              <div className="text-2xl font-bold text-orange-900 mt-1">
                {Math.min(...trendData.map(p => p.value ?? 0)).toFixed(1)} {selectedType?.unit}
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedCode && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Observation to View Trends</h3>
          <p className="text-gray-600">Choose an observation type above to see how values change over time</p>
        </div>
      )}

      {selectedCode && trendData.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-5xl mb-4">📉</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Trend Data Available</h3>
          <p className="text-gray-600">Not enough data points to display a trend</p>
        </div>
      )}
    </div>
  );
};

export default ObservationTimeline;
