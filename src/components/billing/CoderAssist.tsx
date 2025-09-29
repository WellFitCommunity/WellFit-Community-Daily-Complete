// src/components/billing/CoderAssist.tsx
// Drop-in coding assistant panel for an encounter.
// CRA + Tailwind (no extra libs). Uses your configured Supabase client.

import React, { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type CodingSuggestion = {
  cpt?: Array<{ code: string; modifiers?: string[]; rationale?: string }>;
  hcpcs?: Array<{ code: string; modifiers?: string[]; rationale?: string }>;
  icd10?: Array<{ code: string; rationale?: string; principal?: boolean }>;
  notes?: string;
  confidence?: number; // 0..100
};

type Props = {
  encounterId: string;
  patientId?: string | null;
  // optional: called after we save an accepted suggestion
  onSaved?: (rowId: string) => void;
};

export function CoderAssist({ encounterId, patientId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<CodingSuggestion | null>(null);
  const [rawPreview, setRawPreview] = useState<string>(''); // for debugging if needed

  const disabled = useMemo(() => !encounterId || loading || saving, [encounterId, loading, saving]);

  async function fetchSuggestions() {
    setError(null);
    setLoading(true);
    setSuggestion(null);
    setRawPreview('');

    try {
      // You can pass just the encounter.id.
      // If you have extra non-PHI clinical context client-side, include it here.
      const { data, error } = await supabase.functions.invoke('coding-suggest', {
        body: {
          encounter: {
            id: encounterId,
            // optional, non-PHI hints:
            // diagnoses: [{ term: "hypertension" }],
            // procedures: [{ code: "99213", units: 1 }]
          }
        }
      });

      if (error) throw new Error(error.message || 'Function call failed');

      // data should already match CodingSuggestion shape;
      // but we’ll be defensive and stringify for “rawPreview” pane toggle
      setSuggestion(data as CodingSuggestion);
      setRawPreview(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e?.message || 'Failed to get coding suggestions');
    } finally {
      setLoading(false);
    }
  }

  async function saveSuggestion() {
    if (!suggestion) return;
    setSaving(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('coding_recommendations')
        .insert({
          encounter_id: encounterId,
          patient_id: patientId ?? null,
          payload: suggestion,
          confidence: suggestion.confidence ?? null,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message || 'Insert failed');

      if (onSaved) onSaved(data.id as string);
    } catch (e: any) {
      setError(e?.message || 'Failed to save recommendation');
    } finally {
      setSaving(false);
    }
  }

  function Pill({ label }: { label: string }) {
    return <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{label}</span>;
  }

  function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">{title}</h4>
          {typeof count === 'number' && (
            <span className="text-xs text-gray-500">{count} item{count === 1 ? '' : 's'}</span>
          )}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border bg-white p-4 md:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold">Coder Assist</h3>
          <div className="text-sm text-gray-600">
            Encounter: <Pill label={encounterId.slice(0, 8)} />
            {patientId && <span className="ml-2">Patient: <Pill label={patientId.slice(0, 8)} /></span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSuggestions}
            disabled={disabled}
            className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50"
          >
            {loading ? 'Analyzing…' : 'Get Codes'}
          </button>
          <button
            onClick={saveSuggestion}
            disabled={!suggestion || saving}
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Accept & Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!suggestion && !loading && !error && (
        <div className="text-sm text-gray-600">
          Click <span className="font-medium">Get Codes</span> to generate CPT/HCPCS/ICD-10 suggestions for this encounter.
          Nothing sensitive is sent—only de-identified context and the encounter ID.
        </div>
      )}

      {suggestion && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: CPT */}
          <Section title="CPT" count={suggestion.cpt?.length ?? 0}>
            {suggestion.cpt?.length ? (
              <div className="space-y-2">
                {suggestion.cpt.map((c, idx) => (
                  <div key={`cpt-${idx}`} className="p-2 rounded border bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-semibold">{c.code}</div>
                      {c.modifiers?.length ? (
                        <div className="text-xs text-gray-600">Mod: {c.modifiers.join(', ')}</div>
                      ) : null}
                    </div>
                    {c.rationale && <div className="text-xs text-gray-700 mt-1">{c.rationale}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No CPT suggestions.</div>
            )}
          </Section>

          {/* Middle: HCPCS */}
          <Section title="HCPCS" count={suggestion.hcpcs?.length ?? 0}>
            {suggestion.hcpcs?.length ? (
              <div className="space-y-2">
                {suggestion.hcpcs.map((h, idx) => (
                  <div key={`hcpcs-${idx}`} className="p-2 rounded border bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-semibold">{h.code}</div>
                      {h.modifiers?.length ? (
                        <div className="text-xs text-gray-600">Mod: {h.modifiers.join(', ')}</div>
                      ) : null}
                    </div>
                    {h.rationale && <div className="text-xs text-gray-700 mt-1">{h.rationale}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No HCPCS suggestions.</div>
            )}
          </Section>

          {/* Right: ICD-10 */}
          <Section title="ICD-10" count={suggestion.icd10?.length ?? 0}>
            {suggestion.icd10?.length ? (
              <div className="space-y-2">
                {suggestion.icd10.map((d, idx) => (
                  <div key={`icd-${idx}`} className="p-2 rounded border bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-semibold">{d.code}</div>
                      {d.principal && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded">Principal</span>}
                    </div>
                    {d.rationale && <div className="text-xs text-gray-700 mt-1">{d.rationale}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No ICD-10 suggestions.</div>
            )}
          </Section>
        </div>
      )}

      {/* Footer / meta */}
      {suggestion && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border rounded-lg p-3 bg-blue-50">
            <div className="text-sm text-blue-900">
              <span className="font-medium">Confidence: </span>
              {typeof suggestion.confidence === 'number' ? `${suggestion.confidence}%` : '—'}
            </div>
            {suggestion.notes && (
              <div className="text-sm text-blue-900 mt-1">
                <span className="font-medium">Notes: </span>
                {suggestion.notes}
              </div>
            )}
          </div>

          {/* Optional raw JSON preview (handy for debugging) */}
          {rawPreview && (
            <details className="border rounded-lg p-3 bg-gray-50">
              <summary className="cursor-pointer text-sm text-gray-700">Raw JSON</summary>
              <pre className="mt-2 text-xs overflow-auto max-h-64">{rawPreview}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default CoderAssist;
