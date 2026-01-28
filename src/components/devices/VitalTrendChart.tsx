/**
 * VitalTrendChart - Reusable trend chart for vital signs
 *
 * Displays line charts for various vital sign types with:
 * - Time range selection (7/30/90 days)
 * - Reference lines for healthy ranges
 * - Color coding for in-range vs out-of-range values
 */

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

export type TimeRange = '7d' | '30d' | '90d';

export interface ChartDataPoint {
  date: string;
  timestamp: number;
  [key: string]: string | number;
}

export interface ReferenceRange {
  label: string;
  value: number;
  color: string;
  strokeDasharray?: string;
}

export interface DataSeries {
  key: string;
  label: string;
  color: string;
  unit?: string;
}

interface VitalTrendChartProps {
  data: ChartDataPoint[];
  series: DataSeries[];
  title: string;
  referenceLines?: ReferenceRange[];
  height?: number;
  yAxisDomain?: [number, number];
  primaryColor?: string;
}

const VitalTrendChart: React.FC<VitalTrendChartProps> = ({
  data,
  series,
  title,
  referenceLines = [],
  height = 300,
  yAxisDomain,
  primaryColor = '#00857a',
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const filteredData = useMemo(() => {
    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    };

    const cutoff = now - ranges[timeRange];
    return data
      .filter((point) => point.timestamp >= cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data, timeRange]);

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '7d') {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTooltipDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; color: string }>;
    label?: number;
  }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
        <p className="text-sm text-gray-500 mb-2">
          {label ? formatTooltipDate(label) : ''}
        </p>
        {payload.map((entry, index) => {
          const seriesConfig = series.find((s) => s.key === entry.dataKey);
          return (
            <p
              key={index}
              className="text-sm font-semibold"
              style={{ color: entry.color }}
            >
              {seriesConfig?.label || entry.dataKey}: {entry.value}
              {seriesConfig?.unit ? ` ${seriesConfig.unit}` : ''}
            </p>
          );
        })}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <h2
          className="text-2xl font-bold mb-4"
          style={{ color: primaryColor }}
        >
          {title}
        </h2>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>No data available for chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h2
          className="text-2xl font-bold"
          style={{ color: primaryColor }}
        >
          {title}
        </h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={timeRange === range ? { backgroundColor: primaryColor } : {}}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>No readings in selected time range</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={filteredData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#9ca3af"
              fontSize={12}
            />
            <YAxis
              domain={yAxisDomain}
              stroke="#9ca3af"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Reference lines for healthy ranges */}
            {referenceLines.map((ref, index) => (
              <ReferenceLine
                key={index}
                y={ref.value}
                stroke={ref.color}
                strokeDasharray={ref.strokeDasharray || '5 5'}
                label={{
                  value: ref.label,
                  position: 'insideTopRight',
                  fill: ref.color,
                  fontSize: 11,
                }}
              />
            ))}

            {/* Data series */}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 4, fill: s.color }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default VitalTrendChart;
