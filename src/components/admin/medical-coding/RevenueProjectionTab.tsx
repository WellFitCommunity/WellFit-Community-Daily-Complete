/**
 * RevenueProjectionTab - Expected reimbursement calculator
 *
 * Calculates DRG weight x base rate x wage index for different
 * payer types. Also shows charge validation and revenue optimization.
 */

import React, { useState, useCallback } from 'react';
import { Calculator, AlertCircle, TrendingUp, ClipboardCheck, Info } from 'lucide-react';
import {
  getRevenueProjection,
  validateChargeCompleteness,
  optimizeDailyRevenue,
  type MedicalCodingPayerType,
  type RevenueProjection,
  type ChargeValidation,
  type RevenueOptimization,
} from '../../../services/mcp';

type PayerTypeOption = MedicalCodingPayerType;

const PAYER_OPTIONS: { value: PayerTypeOption; label: string }[] = [
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'tricare', label: 'TRICARE' },
  { value: 'workers_comp', label: 'Workers Comp' },
];

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const ALERT_COLORS: Record<string, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  critical: 'bg-red-50 border-red-200 text-red-700',
};

const FINDING_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

export const RevenueProjectionTab: React.FC = () => {
  // Projection state
  const [payerType, setPayerType] = useState<PayerTypeOption>('medicare');
  const [encounterId, setEncounterId] = useState('');
  const [drgCode, setDrgCode] = useState('');
  const [drgWeight, setDrgWeight] = useState('');
  const [projection, setProjection] = useState<RevenueProjection | null>(null);

  // Validation/Optimization state
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [validation, setValidation] = useState<ChargeValidation | null>(null);
  const [optimization, setOptimization] = useState<RevenueOptimization | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'projection' | 'validation' | 'optimization'>('projection');

  const handleProjection = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await getRevenueProjection(payerType, {
      encounterId: encounterId.trim() || undefined,
      drgCode: drgCode.trim() || undefined,
      drgWeight: drgWeight ? Number(drgWeight) : undefined,
    });

    if (res.success && res.data) {
      setProjection(res.data);
    } else {
      setError(res.error || 'Projection failed');
      setProjection(null);
    }
    setLoading(false);
  }, [payerType, encounterId, drgCode, drgWeight]);

  const handleValidation = useCallback(async () => {
    if (!encounterId.trim()) {
      setError('Encounter ID required for validation');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await validateChargeCompleteness(encounterId.trim(), serviceDate);
    if (res.success && res.data) {
      setValidation(res.data);
    } else {
      setError(res.error || 'Validation failed');
      setValidation(null);
    }
    setLoading(false);
  }, [encounterId, serviceDate]);

  const handleOptimization = useCallback(async () => {
    if (!encounterId.trim()) {
      setError('Encounter ID required for optimization');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await optimizeDailyRevenue(encounterId.trim(), serviceDate);
    if (res.success && res.data) {
      setOptimization(res.data);
    } else {
      setError(res.error || 'Optimization failed');
      setOptimization(null);
    }
    setLoading(false);
  }, [encounterId, serviceDate]);

  return (
    <div className="space-y-4">
      {/* Section Toggle */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'projection' as const, label: 'Revenue Projection', icon: Calculator },
          { key: 'validation' as const, label: 'Charge Validation', icon: ClipboardCheck },
          { key: 'optimization' as const, label: 'Revenue Optimization', icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium ${
              activeSection === key ? 'bg-[var(--ea-primary)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Shared Inputs */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label htmlFor="rev-encounter-id" className="block text-sm font-medium text-gray-700 mb-1">
              Encounter ID
            </label>
            <input
              id="rev-encounter-id"
              type="text"
              value={encounterId}
              onChange={(e) => setEncounterId(e.target.value)}
              placeholder="UUID"
              className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border"
            />
          </div>
          {activeSection === 'projection' && (
            <>
              <div>
                <label htmlFor="rev-payer" className="block text-sm font-medium text-gray-700 mb-1">
                  Payer Type
                </label>
                <select
                  id="rev-payer"
                  value={payerType}
                  onChange={(e) => setPayerType(e.target.value as PayerTypeOption)}
                  className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border"
                >
                  {PAYER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rev-drg-code" className="block text-sm font-medium text-gray-700 mb-1">
                  DRG Code
                </label>
                <input
                  id="rev-drg-code"
                  type="text"
                  value={drgCode}
                  onChange={(e) => setDrgCode(e.target.value)}
                  placeholder="e.g. 470"
                  className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border"
                />
              </div>
              <div>
                <label htmlFor="rev-drg-weight" className="block text-sm font-medium text-gray-700 mb-1">
                  DRG Weight
                </label>
                <input
                  id="rev-drg-weight"
                  type="number"
                  value={drgWeight}
                  onChange={(e) => setDrgWeight(e.target.value)}
                  placeholder="e.g. 1.9050"
                  step="0.0001"
                  className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border"
                />
              </div>
            </>
          )}
          {(activeSection === 'validation' || activeSection === 'optimization') && (
            <div>
              <label htmlFor="rev-service-date" className="block text-sm font-medium text-gray-700 mb-1">
                Service Date
              </label>
              <input
                id="rev-service-date"
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border"
              />
            </div>
          )}
        </div>
        <div className="mt-3">
          <button
            onClick={
              activeSection === 'projection' ? handleProjection
              : activeSection === 'validation' ? handleValidation
              : handleOptimization
            }
            disabled={loading}
            className="flex items-center gap-2 bg-[var(--ea-primary)] text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-[var(--ea-primary-hover)] disabled:opacity-50"
          >
            {loading ? 'Processing...' : activeSection === 'projection' ? 'Calculate' : activeSection === 'validation' ? 'Validate' : 'Optimize'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Projection Result */}
      {activeSection === 'projection' && projection && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">Operating Payment</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(projection.operating_payment)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Capital Payment</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(projection.capital_payment)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Total Expected</p>
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(projection.total_expected)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">DRG Weight</p>
              <p className="text-lg font-bold">{projection.drg_weight.toFixed(4)}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500 border-t pt-2 mt-2">
            Base Rate: {formatCurrency(projection.base_rate)} | Wage Index: {projection.wage_index.toFixed(4)} | {projection.methodology}
          </div>
        </div>
      )}

      {/* Validation Result */}
      {activeSection === 'validation' && validation && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Completeness Score</span>
              <span className={`text-2xl font-bold ${
                validation.completeness_score >= 90 ? 'text-green-700'
                : validation.completeness_score >= 70 ? 'text-yellow-700'
                : 'text-red-700'
              }`}>
                {validation.completeness_score}%
              </span>
            </div>
          </div>
          {validation.alerts.length > 0 && (
            <div className="space-y-2">
              {validation.alerts.map((alert, i) => (
                <div key={i} className={`border rounded-lg p-3 text-sm ${ALERT_COLORS[alert.severity] || ALERT_COLORS.info}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{alert.category}</span>
                    <span className="text-xs uppercase font-semibold">{alert.severity}</span>
                  </div>
                  <p className="mt-1">{alert.message}</p>
                  {alert.suggested_codes.length > 0 && (
                    <p className="mt-1 font-mono text-xs">Codes: {alert.suggested_codes.join(', ')}</p>
                  )}
                  {alert.estimated_impact !== null && (
                    <p className="mt-1 text-xs">Impact: {formatCurrency(alert.estimated_impact)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Optimization Result */}
      {activeSection === 'optimization' && optimization && (
        <div className="space-y-3">
          {/* Advisory Banner */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{optimization.advisory_disclaimer}</span>
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Total Findings</p>
                <p className="text-lg font-bold">{optimization.summary.total_findings}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Revenue Impact</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(optimization.summary.estimated_revenue_impact)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Critical Items</p>
                <p className="text-lg font-bold text-red-700">{optimization.summary.critical_items}</p>
              </div>
            </div>
          </div>

          {/* Findings */}
          {optimization.findings.length > 0 && (
            <div className="space-y-2">
              {optimization.findings.map((finding, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">{finding.type.replace(/_/g, ' ')}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${FINDING_COLORS[finding.severity] || ''}`}>
                      {finding.severity}
                    </span>
                  </div>
                  <p className="text-gray-600">{finding.description}</p>
                  <p className="text-[var(--ea-primary)] mt-1">{finding.suggested_action}</p>
                  {finding.estimated_impact !== null && (
                    <p className="text-xs text-green-600 mt-1">Impact: {formatCurrency(finding.estimated_impact)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RevenueProjectionTab;
