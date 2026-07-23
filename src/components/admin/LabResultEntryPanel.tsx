/**
 * LabResultEntryPanel — manual laboratory result entry (L-1)
 *
 * Purpose: the first working lab-result ingestion path. A clinician enters a
 * result; labResultEntryService persists the full canonical set (lab_results +
 * FHIR observation + diagnostic report for the acknowledgment queue) and runs
 * the escalation engine. Critical flags fire the care-team alert trigger.
 * Used by: admin dashboard, patient-care category (System B — EA components).
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import {
  labResultEntryService,
  LAB_TEST_CATALOG,
  type AbnormalFlag,
  type TestCategory,
  type LabResultEntryOutcome,
} from '../../services/labResultEntryService';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EAAlert } from '../envision-atlus/EAAlert';
import { EABadge } from '../envision-atlus/EABadge';

interface PatientOption {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

const ABNORMAL_FLAGS: Array<{ value: AbnormalFlag; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
  { value: 'critical_low', label: 'Critical LOW' },
  { value: 'critical_high', label: 'Critical HIGH' },
];

const CUSTOM_TEST = '__custom__';

const inputCls =
  'w-full min-h-[44px] rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)]';
const labelCls = 'block text-sm font-medium text-slate-300 mb-1';

const LabResultEntryPanel: React.FC = () => {
  // Patient selection
  const [patientQuery, setPatientQuery] = useState('');
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [searching, setSearching] = useState(false);

  // Test fields
  const [testKey, setTestKey] = useState(LAB_TEST_CATALOG[0].testKey);
  const [customKey, setCustomKey] = useState('');
  const [customDisplay, setCustomDisplay] = useState('');
  const [customLoinc, setCustomLoinc] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState(LAB_TEST_CATALOG[0].unit);
  const [referenceRange, setReferenceRange] = useState(LAB_TEST_CATALOG[0].referenceRange);
  const [abnormalFlag, setAbnormalFlag] = useState<AbnormalFlag>('normal');
  const [collectionDate, setCollectionDate] = useState('');
  const [notes, setNotes] = useState('');

  // Submission state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<LabResultEntryOutcome | null>(null);

  const isCustom = testKey === CUSTOM_TEST;
  const catalogEntry = LAB_TEST_CATALOG.find(t => t.testKey === testKey);

  const searchPatients = async () => {
    if (patientQuery.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const term = patientQuery.trim();
      const { data, error: searchError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
        .limit(10);
      if (searchError) {
        setError('Patient search failed.');
        await auditLogger.error('LAB_ENTRY_PATIENT_SEARCH_FAILED', new Error(searchError.message));
      } else {
        setPatientOptions((data ?? []) as PatientOption[]);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleTestChange = (key: string) => {
    setTestKey(key);
    const entry = LAB_TEST_CATALOG.find(t => t.testKey === key);
    if (entry) {
      setUnit(entry.unit);
      setReferenceRange(entry.referenceRange);
    } else {
      setUnit('');
      setReferenceRange('');
    }
  };

  const canSave =
    patient !== null &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value)) &&
    unit.trim() !== '' &&
    (!isCustom || (customKey.trim() !== '' && customDisplay.trim() !== ''));

  const handleSave = async () => {
    if (!patient || !canSave) return;
    setSaving(true);
    setError(null);
    setOutcome(null);

    const result = await labResultEntryService.saveLabResult({
      patientId: patient.user_id,
      testKey: isCustom ? customKey.trim().toLowerCase() : testKey,
      testDisplay: isCustom ? customDisplay.trim() : (catalogEntry?.testDisplay ?? testKey),
      loincCode: isCustom ? (customLoinc.trim() || undefined) : catalogEntry?.loincCode,
      testCategory: (catalogEntry?.testCategory ?? 'other') as TestCategory,
      valueNumeric: Number(value),
      unit: unit.trim(),
      referenceRange: referenceRange.trim() || undefined,
      abnormalFlag,
      collectionDate: collectionDate ? new Date(collectionDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
    });

    if (result.success) {
      setOutcome(result.data);
      setValue('');
      setNotes('');
      setAbnormalFlag('normal');
    } else {
      setError(result.error.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4" aria-label="Lab Result Entry">
      {outcome && (
        <EAAlert
          variant={outcome.criticalAlertFired ? 'critical' : 'success'}
          title={outcome.criticalAlertFired ? 'Critical result saved — care team alerted' : 'Result saved'}
        >
          The result was recorded, added to the patient&apos;s chart, and queued for
          clinician acknowledgment.
          {outcome.escalations.length > 0 && (
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <span>Escalated to:</span>
              {outcome.escalations.map(rule => (
                <EABadge
                  key={rule.id}
                  variant={rule.severity === 'critical' ? 'critical' : 'high'}
                >
                  {rule.route_to_specialty} ({rule.severity})
                </EABadge>
              ))}
            </span>
          )}
        </EAAlert>
      )}
      {error && (
        <EAAlert variant="critical" title="Save failed" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      <EACard>
        <EACardHeader>
          <h3 className="text-lg font-semibold text-slate-100">Enter Laboratory Result</h3>
        </EACardHeader>
        <EACardContent className="space-y-4">
          {/* Patient */}
          <div>
            <label htmlFor="lab-patient-search" className={labelCls}>Patient</label>
            {patient ? (
              <div className="flex items-center gap-3">
                <span className="text-slate-100">
                  {patient.first_name ?? ''} {patient.last_name ?? ''}
                </span>
                <EAButton variant="ghost" size="sm" onClick={() => setPatient(null)}>
                  Change patient
                </EAButton>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  id="lab-patient-search"
                  className={inputCls}
                  placeholder="Search by first or last name"
                  value={patientQuery}
                  onChange={e => setPatientQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') searchPatients(); }}
                />
                <EAButton onClick={searchPatients} loading={searching} disabled={patientQuery.trim().length < 2}>
                  Search
                </EAButton>
              </div>
            )}
            {!patient && patientOptions.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-700 rounded-md border border-slate-700">
                {patientOptions.map(p => (
                  <li key={p.user_id}>
                    <button
                      type="button"
                      className="w-full min-h-[44px] px-3 py-2 text-left text-slate-200 hover:bg-slate-700"
                      onClick={() => { setPatient(p); setPatientOptions([]); }}
                    >
                      {p.first_name ?? ''} {p.last_name ?? ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Test selection */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="lab-test" className={labelCls}>Test</label>
              <select
                id="lab-test"
                className={inputCls}
                value={testKey}
                onChange={e => handleTestChange(e.target.value)}
              >
                {LAB_TEST_CATALOG.map(t => (
                  <option key={t.testKey} value={t.testKey}>{t.testDisplay}</option>
                ))}
                <option value={CUSTOM_TEST}>Other (custom test)</option>
              </select>
            </div>
            <div>
              <label htmlFor="lab-flag" className={labelCls}>Result flag</label>
              <select
                id="lab-flag"
                className={inputCls}
                value={abnormalFlag}
                onChange={e => setAbnormalFlag(e.target.value as AbnormalFlag)}
              >
                {ABNORMAL_FLAGS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isCustom && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="lab-custom-key" className={labelCls}>Test key (lowercase)</label>
                <input id="lab-custom-key" className={inputCls} value={customKey}
                  onChange={e => setCustomKey(e.target.value)} placeholder="e.g. magnesium" />
              </div>
              <div>
                <label htmlFor="lab-custom-display" className={labelCls}>Display name</label>
                <input id="lab-custom-display" className={inputCls} value={customDisplay}
                  onChange={e => setCustomDisplay(e.target.value)} placeholder="e.g. Magnesium" />
              </div>
              <div>
                <label htmlFor="lab-custom-loinc" className={labelCls}>LOINC code (optional)</label>
                <input id="lab-custom-loinc" className={inputCls} value={customLoinc}
                  onChange={e => setCustomLoinc(e.target.value)} placeholder="e.g. 19123-9" />
              </div>
            </div>
          )}

          {/* Value */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="lab-value" className={labelCls}>Value</label>
              <input id="lab-value" className={inputCls} inputMode="decimal"
                value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 4.2" />
            </div>
            <div>
              <label htmlFor="lab-unit" className={labelCls}>Unit</label>
              <input id="lab-unit" className={inputCls} value={unit}
                onChange={e => setUnit(e.target.value)} />
            </div>
            <div>
              <label htmlFor="lab-range" className={labelCls}>Reference range</label>
              <input id="lab-range" className={inputCls} value={referenceRange}
                onChange={e => setReferenceRange(e.target.value)} />
            </div>
            <div>
              <label htmlFor="lab-collected" className={labelCls}>Collected at</label>
              <input id="lab-collected" type="datetime-local" className={inputCls}
                value={collectionDate} onChange={e => setCollectionDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="lab-notes" className={labelCls}>Notes (optional)</label>
            <textarea id="lab-notes" className={inputCls} rows={2}
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <EAButton onClick={handleSave} loading={saving} disabled={!canSave}>
              Save Result
            </EAButton>
          </div>
        </EACardContent>
      </EACard>
    </div>
  );
};

export default LabResultEntryPanel;
