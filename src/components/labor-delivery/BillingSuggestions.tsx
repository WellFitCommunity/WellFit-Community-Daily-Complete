/**
 * BillingSuggestions - Display auto-suggested CPT billing codes
 *
 * Purpose: Show clinician suggested CPT codes based on delivery data
 * Used by: LaborTab (when delivery record exists)
 */

import React from 'react';
import type {
  LDDeliveryRecord,
  LDNewbornAssessment,
  LDFetalMonitoring,
} from '../../types/laborDelivery';
import { suggestBillingCodes } from '../../services/laborDelivery/laborDeliveryBilling';
import type { BillingSuggestion } from '../../services/laborDelivery/laborDeliveryBilling';

interface BillingSuggestionsProps {
  delivery: LDDeliveryRecord;
  newborn?: LDNewbornAssessment | null;
  fetalMonitoring?: LDFetalMonitoring | null;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
};

const BillingSuggestions: React.FC<BillingSuggestionsProps> = ({
  delivery, newborn, fetalMonitoring,
}) => {
  const suggestions: BillingSuggestion[] = suggestBillingCodes({
    delivery,
    newborn,
    fetalMonitoring,
  });

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Billing Code Suggestions</h3>
      <p className="text-xs text-gray-500 mb-4">Auto-generated from delivery record — verify before submission</p>
      <div className="space-y-2">
        {suggestions.map((s, idx) => (
          <div key={`${s.code}-${idx}`} className="flex items-center justify-between border rounded-lg p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-gray-900">{s.code}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${CONFIDENCE_STYLES[s.confidence]}`}>
                  {s.confidence}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-0.5">{s.description}</p>
              <p className="text-xs text-gray-500">{s.basis}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BillingSuggestions;
