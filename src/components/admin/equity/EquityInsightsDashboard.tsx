/**
 * EquityInsightsDashboard — health-equity & population-health insights.
 *
 * Ask a question in plain language OR build a query by hand; both compile to the same whitelisted
 * spec and return REPORT-GENERATED aggregates (counts/%, distributions, cross-tabs) — never raw rows.
 * Small/underserved groups are surfaced and flagged, not hidden. Route: /admin/equity-insights.
 */

import React, { useEffect, useState } from 'react';
import { EAAlert } from '../../envision-atlus/EAAlert';
import { EABadge } from '../../envision-atlus/EABadge';
import { equityAnalyticsService } from '../../../services/equityAnalytics/equityAnalyticsService';
import type { CatalogSource, EquityReport, EquitySpec } from '../../../services/equityAnalytics/types';
import { EquityQueryBuilder } from './EquityQueryBuilder';
import { EquityResults } from './EquityResults';

export const EquityInsightsDashboard: React.FC = () => {
  const [catalog, setCatalog] = useState<Record<string, CatalogSource> | null>(null);
  const [tier, setTier] = useState<'standard' | 'researcher'>('standard');
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [report, setReport] = useState<EquityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await equityAnalyticsService.getCatalog();
      if (!active) return;
      if (res.success) {
        setCatalog(res.data.catalog);
        setTier(res.data.tier);
      } else {
        setCatalogError(res.error.message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function runSpec(spec: EquitySpec) {
    setBusy(true);
    setError(null);
    setClarification(null);
    const res = await equityAnalyticsService.runQuery(spec);
    if (res.success) setReport(res.data);
    else setError(res.error.message);
    setBusy(false);
  }

  async function ask(question: string) {
    setBusy(true);
    setError(null);
    setClarification(null);
    const res = await equityAnalyticsService.ask(question);
    if (res.success) {
      if (res.data.kind === 'report') {
        setReport(res.data.report);
      } else {
        setClarification(res.data.message);
      }
    } else {
      setError(res.error.message);
    }
    setBusy(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">Equity &amp; Population-Health Insights</h1>
          {tier === 'researcher' && <EABadge variant="info">Researcher tier (de-identified)</EABadge>}
        </div>
        <p className="text-gray-600">
          Aggregate reports across demographics and social determinants of health — counts, rates, and
          cross-tabs. No individual records are ever shown. Small groups are flagged, not hidden, so
          underserved populations stay visible.
        </p>
      </header>

      {catalogError && (
        <EAAlert variant="critical" title="Could not load analytics">{catalogError}</EAAlert>
      )}

      {catalog && (
        <EquityQueryBuilder catalog={catalog} busy={busy} onRun={runSpec} onAsk={ask} />
      )}

      {clarification && (
        <EAAlert variant="warning" title="I need a bit more detail">{clarification}</EAAlert>
      )}

      <section aria-live="polite">
        <EquityResults report={report} loading={busy} error={error} />
      </section>
    </div>
  );
};

export default EquityInsightsDashboard;
