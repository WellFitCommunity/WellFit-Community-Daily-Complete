/**
 * PayerRulesTab - Payer reimbursement rule lookup and management
 *
 * Queries and displays payer-specific reimbursement rules (Medicare DRG rates,
 * Medicaid per diem, commercial case rates). Supports filtering by payer type,
 * fiscal year, state, and acuity tier.
 */

import React, { useState, useCallback } from 'react';
import { Search, DollarSign, AlertCircle } from 'lucide-react';
import {
  getPayerRules,
  type MedicalCodingPayerType,
  type RuleType,
  type PayerRule,
} from '../../../services/mcp';

type PayerTypeOption = MedicalCodingPayerType;

const PAYER_OPTIONS: { value: PayerTypeOption; label: string }[] = [
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'tricare', label: 'TRICARE' },
  { value: 'workers_comp', label: 'Workers Comp' },
];

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  drg_based: 'DRG-Based',
  per_diem: 'Per Diem',
  case_rate: 'Case Rate',
  percent_of_charges: '% of Charges',
  fee_schedule: 'Fee Schedule',
};

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const PayerRulesTab: React.FC = () => {
  const [payerType, setPayerType] = useState<PayerTypeOption>('medicare');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [stateCode, setStateCode] = useState('');
  const [rules, setRules] = useState<PayerRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getPayerRules(payerType, fiscalYear, {
      stateCode: stateCode || undefined,
    });

    if (result.success && result.data) {
      setRules(result.data.rules);
      setTotal(result.data.total);
    } else {
      setError(result.error || 'Failed to fetch payer rules');
      setRules([]);
      setTotal(0);
    }

    setLoading(false);
  }, [payerType, fiscalYear, stateCode]);

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label htmlFor="payer-type" className="block text-sm font-medium text-gray-700 mb-1">
              Payer Type
            </label>
            <select
              id="payer-type"
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
            <label htmlFor="fiscal-year" className="block text-sm font-medium text-gray-700 mb-1">
              Fiscal Year
            </label>
            <input
              id="fiscal-year"
              type="number"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              min={2020}
              max={2030}
              className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border"
            />
          </div>
          <div>
            <label htmlFor="state-code" className="block text-sm font-medium text-gray-700 mb-1">
              State (optional)
            </label>
            <input
              id="state-code"
              type="text"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value.toUpperCase())}
              placeholder="e.g. TX"
              maxLength={2}
              className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Searching...' : 'Search Rules'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {rules.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-2">{total} rule(s) found</p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Rule Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Acuity</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Base Rate</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Capital Rate</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Wage Index</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Per Diem</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Effective</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-green-600" />
                        {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{rule.acuity_tier || '-'}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(rule.base_rate_amount)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(rule.capital_rate_amount)}</td>
                    <td className="px-3 py-2 text-right font-mono">{rule.wage_index_factor.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(rule.per_diem_rate)}</td>
                    <td className="px-3 py-2 text-gray-600">{rule.effective_date}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${rule.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && rules.length === 0 && total === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Select a payer type and fiscal year, then click Search Rules.
        </div>
      )}
    </div>
  );
};

export default PayerRulesTab;
