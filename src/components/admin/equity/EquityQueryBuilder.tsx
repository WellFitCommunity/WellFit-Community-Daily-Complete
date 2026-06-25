/**
 * EquityQueryBuilder — plain-language box + point-and-click builder. Both produce the same spec.
 *
 * The plain-language box sends the question to the AI translator (which fills a whitelisted spec);
 * the builder lets a user assemble the same spec by hand. Neither can request raw rows — the engine
 * is aggregate-only.
 */

import React, { useMemo, useState } from 'react';
import { EAButton } from '../../envision-atlus/EAButton';
import { EACard } from '../../envision-atlus/EACard';
import type { CatalogSource, EquitySpec } from '../../../services/equityAnalytics/types';

interface EquityQueryBuilderProps {
  catalog: Record<string, CatalogSource>;
  busy: boolean;
  onRun: (spec: EquitySpec) => void;
  onAsk: (question: string) => void;
}

const NONE = '';

const labelCls = 'block text-sm font-semibold text-gray-700 mb-1';
const selectCls =
  'w-full min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-base focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200';

export const EquityQueryBuilder: React.FC<EquityQueryBuilderProps> = ({ catalog, busy, onRun, onAsk }) => {
  const sourceKeys = useMemo(() => Object.keys(catalog), [catalog]);
  const [source, setSource] = useState<string>(sourceKeys[0] ?? 'members');
  const src = catalog[source];

  const [measure, setMeasure] = useState<string>(src?.measures[0]?.key ?? '');
  const [dims, setDims] = useState<string[]>([NONE, NONE, NONE]);
  const [timeGrain, setTimeGrain] = useState<string>(NONE);
  const [minCellSize, setMinCellSize] = useState<string>('');
  const [question, setQuestion] = useState<string>('');

  function changeSource(next: string) {
    setSource(next);
    const ns = catalog[next];
    setMeasure(ns?.measures[0]?.key ?? '');
    setDims([NONE, NONE, NONE]);
    setTimeGrain(NONE);
  }

  function setDim(index: number, value: string) {
    setDims((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  function buildSpec(): EquitySpec {
    const dimensions = dims.filter((d) => d && d !== NONE);
    return {
      source: source as EquitySpec['source'],
      measure,
      dimensions,
      filters: [],
      timeGrain: timeGrain ? (timeGrain as EquitySpec['timeGrain']) : null,
      minCellSize: minCellSize ? Number(minCellSize) : null,
    };
  }

  // Prevent picking the same dimension twice.
  const chosen = new Set(dims.filter((d) => d && d !== NONE));

  return (
    <div className="space-y-5">
      {/* Plain-language box */}
      <EACard variant="highlight" className="p-4">
        <label htmlFor="equity-question" className={labelCls}>
          Ask in plain language
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="equity-question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && question.trim() && !busy) onAsk(question.trim());
            }}
            placeholder="e.g. food insecurity by race for members 75 and older"
            className={selectCls}
            disabled={busy}
          />
          <EAButton
            variant="primary"
            onClick={() => question.trim() && onAsk(question.trim())}
            disabled={busy || !question.trim()}
          >
            Ask
          </EAButton>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          The AI turns your question into a safe, aggregate request — it never sees individual records.
        </p>
      </EACard>

      <div className="flex items-center gap-3 text-sm text-gray-400">
        <span className="flex-1 border-t" />
        or build it
        <span className="flex-1 border-t" />
      </div>

      {/* Builder */}
      <EACard className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="equity-source" className={labelCls}>Data source</label>
            <select id="equity-source" className={selectCls} value={source} onChange={(e) => changeSource(e.target.value)}>
              {sourceKeys.map((k) => (
                <option key={k} value={k}>{catalog[k].label}</option>
              ))}
            </select>
            {src && <p className="mt-1 text-xs text-gray-500">{src.description}</p>}
          </div>
          <div>
            <label htmlFor="equity-measure" className={labelCls}>Measure (the “what”)</label>
            <select id="equity-measure" className={selectCls} value={measure} onChange={(e) => setMeasure(e.target.value)}>
              {src?.measures.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className={labelCls}>Break down by (up to 3)</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <label htmlFor={`equity-dim-${i}`} className="sr-only">Dimension {i + 1}</label>
                <select
                  id={`equity-dim-${i}`}
                  className={selectCls}
                  value={dims[i]}
                  onChange={(e) => setDim(i, e.target.value)}
                >
                  <option value={NONE}>{i === 0 ? '(none — overall total)' : '(none)'}</option>
                  {src?.dimensions
                    .filter((d) => !chosen.has(d.key) || d.key === dims[i])
                    .map((d) => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {src?.timeSeries && (
            <div>
              <label htmlFor="equity-time" className={labelCls}>Trend over time</label>
              <select id="equity-time" className={selectCls} value={timeGrain} onChange={(e) => setTimeGrain(e.target.value)}>
                <option value={NONE}>(no time trend)</option>
                <option value="month">By month</option>
                <option value="quarter">By quarter</option>
                <option value="year">By year</option>
              </select>
            </div>
          )}
          <div>
            <label htmlFor="equity-mincell" className={labelCls}>Hide groups smaller than (optional)</label>
            <input
              id="equity-mincell"
              type="number"
              min={1}
              value={minCellSize}
              onChange={(e) => setMinCellSize(e.target.value)}
              placeholder="show all (small groups flagged, not hidden)"
              className={selectCls}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <EAButton variant="primary" size="lg" onClick={() => onRun(buildSpec())} disabled={busy || !measure}>
            {busy ? 'Running…' : 'Run report'}
          </EAButton>
        </div>
      </EACard>
    </div>
  );
};

export default EquityQueryBuilder;
