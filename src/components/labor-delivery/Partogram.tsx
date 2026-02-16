/**
 * Partogram - SVG labor progress visualization
 *
 * Purpose: Clinical partogram chart plotting cervical dilation and fetal station
 *   over time from labor event data. Standard labor monitoring tool.
 * Used by: LaborTab within LaborDeliveryDashboard
 *
 * X-axis: Time (hours since first event)
 * Y-axis left: Cervical dilation (0-10 cm)
 * Y-axis right: Fetal station (-5 to +5)
 * Alert line: Expected dilation rate (1 cm/hr active phase)
 */

import React from 'react';
import type { LDLaborEvent } from '../../types/laborDelivery';

interface PartogramProps {
  laborEvents: LDLaborEvent[];
}

// Chart dimensions
const MARGIN = { top: 24, right: 56, bottom: 40, left: 56 };
const WIDTH = 700;
const HEIGHT = 380;
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

// Y-axis ranges
const DILATION_MIN = 0;
const DILATION_MAX = 10;
const STATION_MIN = -5;
const STATION_MAX = 5;

function hoursFromStart(startMs: number, eventMs: number): number {
  return (eventMs - startMs) / (1000 * 60 * 60);
}

function yForDilation(cm: number): number {
  const fraction = (cm - DILATION_MIN) / (DILATION_MAX - DILATION_MIN);
  return MARGIN.top + PLOT_H * (1 - fraction);
}

function yForStation(station: number): number {
  const fraction = (station - STATION_MIN) / (STATION_MAX - STATION_MIN);
  return MARGIN.top + PLOT_H * (1 - fraction);
}

function xForHours(hours: number, maxHours: number): number {
  const clamped = Math.min(hours, maxHours);
  return MARGIN.left + (clamped / maxHours) * PLOT_W;
}

function buildGridLines(maxHours: number): React.ReactElement[] {
  const lines: React.ReactElement[] = [];

  // Horizontal grid — dilation (every 2 cm)
  for (let d = 0; d <= 10; d += 2) {
    const y = yForDilation(d);
    lines.push(
      <line
        key={`h-${d}`}
        x1={MARGIN.left} y1={y} x2={MARGIN.left + PLOT_W} y2={y}
        stroke="#e5e7eb" strokeWidth={d === 4 ? 1.5 : 0.5}
        strokeDasharray={d === 4 ? '4,2' : undefined}
      />
    );
  }

  // Vertical grid — every hour
  const step = maxHours <= 12 ? 1 : maxHours <= 24 ? 2 : 4;
  for (let h = 0; h <= maxHours; h += step) {
    const x = xForHours(h, maxHours);
    lines.push(
      <line key={`v-${h}`} x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + PLOT_H}
        stroke="#e5e7eb" strokeWidth={0.5}
      />
    );
  }

  return lines;
}

function buildAxisLabels(maxHours: number): React.ReactElement[] {
  const labels: React.ReactElement[] = [];

  // Left Y-axis — dilation
  for (let d = 0; d <= 10; d += 2) {
    labels.push(
      <text key={`ld-${d}`} x={MARGIN.left - 8} y={yForDilation(d) + 4}
        textAnchor="end" className="text-xs fill-gray-600">
        {d}
      </text>
    );
  }

  // Right Y-axis — station
  for (let s = -4; s <= 4; s += 2) {
    labels.push(
      <text key={`rs-${s}`} x={MARGIN.left + PLOT_W + 8} y={yForStation(s) + 4}
        textAnchor="start" className="text-xs fill-blue-600">
        {s > 0 ? `+${s}` : s}
      </text>
    );
  }

  // X-axis — hours
  const step = maxHours <= 12 ? 1 : maxHours <= 24 ? 2 : 4;
  for (let h = 0; h <= maxHours; h += step) {
    labels.push(
      <text key={`xh-${h}`} x={xForHours(h, maxHours)} y={MARGIN.top + PLOT_H + 20}
        textAnchor="middle" className="text-xs fill-gray-600">
        {h}h
      </text>
    );
  }

  // Axis titles
  labels.push(
    <text key="title-dil" x={MARGIN.left - 40} y={MARGIN.top + PLOT_H / 2}
      textAnchor="middle" className="text-xs fill-gray-700 font-medium"
      transform={`rotate(-90,${MARGIN.left - 40},${MARGIN.top + PLOT_H / 2})`}>
      Dilation (cm)
    </text>
  );
  labels.push(
    <text key="title-sta" x={MARGIN.left + PLOT_W + 44} y={MARGIN.top + PLOT_H / 2}
      textAnchor="middle" className="text-xs fill-blue-700 font-medium"
      transform={`rotate(90,${MARGIN.left + PLOT_W + 44},${MARGIN.top + PLOT_H / 2})`}>
      Station
    </text>
  );
  labels.push(
    <text key="title-time" x={MARGIN.left + PLOT_W / 2} y={HEIGHT - 4}
      textAnchor="middle" className="text-xs fill-gray-700 font-medium">
      Time (hours)
    </text>
  );

  return labels;
}

/** Alert line: expected 1cm/hr from 4cm (active phase start) */
function buildAlertLine(maxHours: number, startDilationCm: number, startHour: number): React.ReactElement | null {
  if (startDilationCm >= 10) return null;
  const endHour = startHour + (10 - startDilationCm);
  if (endHour <= startHour) return null;

  return (
    <line
      x1={xForHours(startHour, maxHours)} y1={yForDilation(startDilationCm)}
      x2={xForHours(Math.min(endHour, maxHours), maxHours)} y2={yForDilation(Math.min(10, startDilationCm + (Math.min(endHour, maxHours) - startHour)))}
      stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,3" opacity={0.6}
    />
  );
}

const Partogram: React.FC<PartogramProps> = ({ laborEvents }) => {
  if (laborEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center">
        <p className="text-gray-500">No labor events recorded — partogram will display when labor data is available</p>
      </div>
    );
  }

  const sorted = [...laborEvents].sort(
    (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
  );

  const startMs = new Date(sorted[0].event_time).getTime();
  const endMs = new Date(sorted[sorted.length - 1].event_time).getTime();
  const totalHours = Math.max(hoursFromStart(startMs, endMs), 1);
  const maxHours = Math.ceil(totalHours / 2) * 2; // round to even number

  // Map events to plot points
  const dilationPoints = sorted.map((e) => ({
    x: xForHours(hoursFromStart(startMs, new Date(e.event_time).getTime()), maxHours),
    y: yForDilation(e.dilation_cm),
    cm: e.dilation_cm,
    stage: e.stage,
    time: new Date(e.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  const stationPoints = sorted.map((e) => ({
    x: xForHours(hoursFromStart(startMs, new Date(e.event_time).getTime()), maxHours),
    y: yForStation(e.station),
    station: e.station,
  }));

  // Build polyline paths
  const dilationPath = dilationPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const stationPath = stationPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Find active phase start for alert line
  const activePhaseEvent = sorted.find((e) => e.dilation_cm >= 4);
  const alertLineStartHour = activePhaseEvent
    ? hoursFromStart(startMs, new Date(activePhaseEvent.event_time).getTime())
    : null;

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Partogram</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-pink-600 inline-block" /> Dilation
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Station
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-400 inline-block" style={{ borderBottom: '1px dashed' }} /> Alert (1cm/hr)
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Labor partogram chart">
        {/* Background */}
        <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H} fill="#fafafa" />

        {/* Grid */}
        {buildGridLines(maxHours)}

        {/* Axis border */}
        <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H}
          fill="none" stroke="#d1d5db" strokeWidth={1} />

        {/* Alert line (1cm/hr from active phase) */}
        {alertLineStartHour !== null && activePhaseEvent &&
          buildAlertLine(maxHours, activePhaseEvent.dilation_cm, alertLineStartHour)
        }

        {/* Dilation line */}
        <path d={dilationPath} fill="none" stroke="#db2777" strokeWidth={2.5} strokeLinejoin="round" />

        {/* Station line */}
        <path d={stationPath} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" strokeDasharray="4,2" />

        {/* Dilation data points */}
        {dilationPoints.map((p, i) => (
          <g key={`dp-${i}`}>
            <circle cx={p.x} cy={p.y} r={4} fill="#db2777" stroke="#fff" strokeWidth={1.5} />
            <title>{`${p.time} — ${p.cm} cm (${p.stage.replace(/_/g, ' ')})`}</title>
          </g>
        ))}

        {/* Station data points */}
        {stationPoints.map((p, i) => (
          <g key={`sp-${i}`}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
            <title>{`Station ${p.station > 0 ? '+' : ''}${p.station}`}</title>
          </g>
        ))}

        {/* Axis labels */}
        {buildAxisLabels(maxHours)}
      </svg>
    </div>
  );
};

export default Partogram;
