/**
 * DRGGrouperTab - AI-powered DRG grouping with 3-pass MS-DRG methodology
 *
 * Allows running the DRG grouper against an encounter or retrieving
 * existing DRG results. All suggestions are advisory only.
 */

import React, { useState, useCallback } from 'react';
import { Brain, Search, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  runDRGGrouper,
  getDRGResult,
  type DRGResult,
} from '../../../services/mcp';

const SEVERITY_COLORS: Record<string, string> = {
  base: 'bg-gray-100 text-gray-700',
  cc: 'bg-yellow-100 text-yellow-800',
  mcc: 'bg-red-100 text-red-800',
};

export const DRGGrouperTab: React.FC = () => {
  const [encounterId, setEncounterId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [principalDx, setPrincipalDx] = useState('');
  const [additionalDx, setAdditionalDx] = useState('');
  const [procedures, setProcedures] = useState('');
  const [result, setResult] = useState<DRGResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'run' | 'lookup'>('run');

  const handleRun = useCallback(async () => {
    if (!encounterId.trim() || !patientId.trim()) {
      setError('Encounter ID and Patient ID are required');
      return;
    }
    setLoading(true);
    setError(null);

    const addDx = additionalDx.trim()
      ? additionalDx.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const procCodes = procedures.trim()
      ? procedures.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const res = await runDRGGrouper(encounterId.trim(), patientId.trim(), {
      principalDiagnosis: principalDx.trim() || undefined,
      additionalDiagnoses: addDx,
      procedureCodes: procCodes,
    });

    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setError(res.error || 'DRG grouper failed');
      setResult(null);
    }
    setLoading(false);
  }, [encounterId, patientId, principalDx, additionalDx, procedures]);

  const handleLookup = useCallback(async () => {
    if (!encounterId.trim()) {
      setError('Encounter ID is required');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await getDRGResult(encounterId.trim());
    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setError(res.error || 'No DRG result found');
      setResult(null);
    }
    setLoading(false);
  }, [encounterId]);

  return (
    <div className="space-y-4" aria-label="DRG Grouper">
      {/* Advisory Banner */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          <strong>Advisory Only:</strong> DRG suggestions are AI-generated and must be reviewed by a certified coder before use.
          Never auto-filed.
        </span>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('run')}
          className={`px-4 py-2 rounded-md text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)] ${
            mode === 'run' ? 'bg-[var(--ea-primary)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Brain className="w-4 h-4 inline mr-1" /> Run Grouper
        </button>
        <button
          onClick={() => setMode('lookup')}
          className={`px-4 py-2 rounded-md text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)] ${
            mode === 'lookup' ? 'bg-[var(--ea-primary)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Search className="w-4 h-4 inline mr-1" /> Lookup Result
        </button>
      </div>

      {/* Input Form */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="drg-encounter-id" className="block text-sm font-medium text-gray-700 mb-1">
              Encounter ID *
            </label>
            <input
              id="drg-encounter-id"
              type="text"
              value={encounterId}
              onChange={(e) => setEncounterId(e.target.value)}
              placeholder="UUID"
              className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            />
          </div>
          {mode === 'run' && (
            <>
              <div>
                <label htmlFor="drg-patient-id" className="block text-sm font-medium text-gray-700 mb-1">
                  Patient ID *
                </label>
                <input
                  id="drg-patient-id"
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="UUID"
                  className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                />
              </div>
              <div>
                <label htmlFor="drg-principal-dx" className="block text-sm font-medium text-gray-700 mb-1">
                  Principal Diagnosis
                </label>
                <input
                  id="drg-principal-dx"
                  type="text"
                  value={principalDx}
                  onChange={(e) => setPrincipalDx(e.target.value)}
                  placeholder="e.g. J18.9"
                  className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                />
              </div>
              <div>
                <label htmlFor="drg-additional-dx" className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Diagnoses (comma-separated)
                </label>
                <input
                  id="drg-additional-dx"
                  type="text"
                  value={additionalDx}
                  onChange={(e) => setAdditionalDx(e.target.value)}
                  placeholder="e.g. E11.9, I10"
                  className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="drg-procedures" className="block text-sm font-medium text-gray-700 mb-1">
                  Procedure Codes (comma-separated)
                </label>
                <input
                  id="drg-procedures"
                  type="text"
                  value={procedures}
                  onChange={(e) => setProcedures(e.target.value)}
                  placeholder="e.g. 0BJ08ZZ, 5A1D70Z"
                  className="w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                />
              </div>
            </>
          )}
        </div>
        <div className="mt-3">
          <button
            onClick={mode === 'run' ? handleRun : handleLookup}
            disabled={loading}
            className="flex items-center gap-2 bg-[var(--ea-primary)] text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-[var(--ea-primary-hover)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          >
            {mode === 'run' ? <Brain className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            {loading ? 'Processing...' : mode === 'run' ? 'Run DRG Grouper' : 'Lookup Result'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* DRG Result */}
      {result && (
        <div className="space-y-4">
          {/* Main DRG Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  MS-DRG {result.drg_code}
                </h4>
                <p className="text-sm text-gray-600 mt-1">{result.drg_description}</p>
                <p className="text-xs text-gray-400 mt-1">MDC: {result.mdc} | Grouper: {result.grouper_version}</p>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${SEVERITY_COLORS[result.severity] || 'bg-gray-100'}`}>
                  {result.severity.toUpperCase()}
                </span>
                <p className="text-2xl font-bold text-green-700 mt-1">{result.drg_weight.toFixed(4)}</p>
                <p className="text-xs text-gray-500">DRG Weight</p>
              </div>
            </div>
          </div>

          {/* 3-Pass Analysis */}
          {result.analysis && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">3-Pass Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: 'Base DRG', data: result.analysis.base_drg, selected: result.analysis.selected === 'base' },
                  { label: 'CC DRG', data: result.analysis.cc_drg, selected: result.analysis.selected === 'cc' },
                  { label: 'MCC DRG', data: result.analysis.mcc_drg, selected: result.analysis.selected === 'mcc' },
                ].map(({ label, data, selected }) => (
                  <div
                    key={label}
                    className={`rounded-lg p-3 border ${
                      selected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-500">{label}</span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    </div>
                    {data ? (
                      <>
                        <p className="font-mono text-sm font-bold">{data.code}</p>
                        <p className="text-xs text-gray-600 truncate">{data.description}</p>
                        <p className="text-sm font-semibold mt-1">Weight: {data.weight.toFixed(4)}</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Not applicable</p>
                    )}
                  </div>
                ))}
              </div>
              {result.analysis.rationale && (
                <p className="text-sm text-gray-600 mt-3 italic">{result.analysis.rationale}</p>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 italic">{result.advisory_disclaimer}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !result && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Enter an encounter ID and run the DRG grouper or look up an existing result.
        </div>
      )}
    </div>
  );
};

export default DRGGrouperTab;
