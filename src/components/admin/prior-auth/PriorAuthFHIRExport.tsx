/**
 * PriorAuthFHIRExport — Export prior auth as FHIR Claim resource
 *
 * Button that calls toFhirClaim() and displays the JSON output
 * in a modal overlay. Copy-to-clipboard included.
 *
 * Used by: PriorAuthList (action button per row)
 */

import React, { useState, useCallback } from 'react';
import { X, Download, Copy, Loader2, CheckCircle } from 'lucide-react';
import type { FHIRClaimResource } from '../../../services/mcp/mcpPriorAuthClient';

// =====================================================
// Props
// =====================================================

interface PriorAuthFHIRExportProps {
  priorAuthId: string;
  onExport: (priorAuthId: string) => Promise<FHIRClaimResource | null>;
  onClose: () => void;
}

// =====================================================
// Component
// =====================================================

export const PriorAuthFHIRExport: React.FC<PriorAuthFHIRExportProps> = ({
  priorAuthId,
  onExport,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [fhirData, setFhirData] = useState<FHIRClaimResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await onExport(priorAuthId);
    if (result) {
      setFhirData(result);
    } else {
      setError('Failed to export FHIR Claim resource');
    }
    setLoading(false);
  }, [priorAuthId, onExport]);

  const handleCopy = useCallback(() => {
    if (fhirData) {
      navigator.clipboard.writeText(JSON.stringify(fhirData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [fhirData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="FHIR Claim export">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">FHIR Claim Export</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 transition min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {!fhirData && !error && (
            <div className="text-center py-8">
              <Download className="w-10 h-10 mx-auto mb-3 text-indigo-400" />
              <p className="text-sm text-gray-600 mb-4">
                Export this prior authorization as a FHIR R4 Claim resource
              </p>
              <button
                onClick={handleExport}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export FHIR Claim
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {fhirData && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  FHIR R4 Claim Resource
                </span>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition min-h-[32px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-300 text-xs p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(fhirData, null, 2)}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
