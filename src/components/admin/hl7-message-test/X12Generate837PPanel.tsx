/**
 * X12Generate837PPanel — Form for generating X12 837P claims
 *
 * Collects subscriber, provider, service line, and diagnosis data
 * matching the X12ClaimData interface. Sends to generate837P() from
 * useHL7X12 hook and displays the generated X12 content.
 *
 * Used by: HL7MessageTestPanel (as a third tab/mode)
 */

import React, { useState, useCallback } from 'react';
import { useHL7X12 } from '../../../hooks/useHL7X12';
import type { X12ClaimData, X12GeneratedClaim } from '../../../services/mcp/mcpHL7X12Client';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../../envision-atlus';
import {
  FileText,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

// =====================================================
// Input field helper
// =====================================================

const Field: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  className?: string;
}> = ({ id, label, value, onChange, placeholder, required, type = 'text', className = '' }) => (
  <div className={className}>
    <label htmlFor={id} className="block text-xs font-medium text-slate-400 mb-1">
      {label}{required && ' *'}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-slate-900 text-slate-200 text-sm px-3 py-2 rounded-md border border-slate-700 focus:border-[#00857a] focus:outline-none"
    />
  </div>
);

// =====================================================
// Initial form state
// =====================================================

interface ServiceLineForm {
  date_from: string;
  date_to: string;
  place_of_service: string;
  cpt_code: string;
  modifiers: string;
  diagnosis_pointers: string;
  units: string;
  charge_amount: string;
}

interface DiagnosisForm {
  code: string;
  type: 'principal' | 'admitting' | 'other';
}

const EMPTY_SERVICE_LINE: ServiceLineForm = {
  date_from: '',
  date_to: '',
  place_of_service: '11',
  cpt_code: '',
  modifiers: '',
  diagnosis_pointers: '1',
  units: '1',
  charge_amount: '',
};

const EMPTY_DIAGNOSIS: DiagnosisForm = {
  code: '',
  type: 'principal',
};

// =====================================================
// Component
// =====================================================

export const X12Generate837PPanel: React.FC = () => {
  // Subscriber fields
  const [subId, setSubId] = useState('');
  const [subFirst, setSubFirst] = useState('');
  const [subLast, setSubLast] = useState('');
  const [subDob, setSubDob] = useState('');
  const [subGender, setSubGender] = useState<'M' | 'F' | 'U'>('M');
  const [subStreet, setSubStreet] = useState('');
  const [subCity, setSubCity] = useState('');
  const [subState, setSubState] = useState('');
  const [subZip, setSubZip] = useState('');
  const [payerId, setPayerId] = useState('');
  const [payerName, setPayerName] = useState('');

  // Provider fields
  const [provNpi, setProvNpi] = useState('');
  const [provName, setProvName] = useState('');
  const [provTaxId, setProvTaxId] = useState('');
  const [provStreet, setProvStreet] = useState('');
  const [provCity, setProvCity] = useState('');
  const [provState, setProvState] = useState('');
  const [provZip, setProvZip] = useState('');

  // Claim metadata
  const [claimId, setClaimId] = useState('');
  const [claimType, setClaimType] = useState<'professional' | 'institutional'>('professional');

  // Service lines + diagnoses
  const [serviceLines, setServiceLines] = useState<ServiceLineForm[]>([{ ...EMPTY_SERVICE_LINE }]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisForm[]>([{ ...EMPTY_DIAGNOSIS }]);

  // Result state
  const { generate837P } = useHL7X12();
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<X12GeneratedClaim | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // =====================================================
  // Service line helpers
  // =====================================================

  const updateServiceLine = useCallback((idx: number, field: keyof ServiceLineForm, value: string) => {
    setServiceLines(prev => prev.map((sl, i) => i === idx ? { ...sl, [field]: value } : sl));
  }, []);

  const addServiceLine = useCallback(() => {
    setServiceLines(prev => [...prev, { ...EMPTY_SERVICE_LINE }]);
  }, []);

  const removeServiceLine = useCallback((idx: number) => {
    setServiceLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }, []);

  // Diagnosis helpers
  const updateDiagnosis = useCallback((idx: number, field: keyof DiagnosisForm, value: string) => {
    setDiagnoses(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }, []);

  const addDiagnosis = useCallback(() => {
    setDiagnoses(prev => [...prev, { ...EMPTY_DIAGNOSIS, type: 'other' }]);
  }, []);

  const removeDiagnosis = useCallback((idx: number) => {
    setDiagnoses(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }, []);

  // =====================================================
  // Generate
  // =====================================================

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    setGeneratedResult(null);

    const totalCharge = serviceLines.reduce(
      (sum, sl) => sum + (parseFloat(sl.charge_amount) || 0) * (parseInt(sl.units, 10) || 1),
      0
    );

    const claimData: X12ClaimData = {
      claim_id: claimId || `CLM-${Date.now()}`,
      claim_type: claimType,
      subscriber: {
        id: subId,
        first_name: subFirst,
        last_name: subLast,
        dob: subDob,
        gender: subGender,
        address: { street: subStreet, city: subCity, state: subState, zip: subZip },
        payer_id: payerId,
        payer_name: payerName,
      },
      provider: {
        npi: provNpi,
        name: provName,
        tax_id: provTaxId,
        address: { street: provStreet, city: provCity, state: provState, zip: provZip },
      },
      services: serviceLines.map((sl, idx) => ({
        line_number: idx + 1,
        date_from: sl.date_from,
        date_to: sl.date_to || undefined,
        place_of_service: sl.place_of_service,
        cpt_code: sl.cpt_code,
        modifiers: sl.modifiers ? sl.modifiers.split(',').map(m => m.trim()).filter(Boolean) : undefined,
        diagnosis_pointers: sl.diagnosis_pointers.split(',').map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n)),
        units: parseInt(sl.units, 10) || 1,
        charge_amount: parseFloat(sl.charge_amount) || 0,
      })),
      diagnoses: diagnoses.map((d, idx) => ({
        code: d.code,
        type: d.type,
        sequence: idx + 1,
      })),
      total_charge: totalCharge,
    };

    const response = await generate837P(claimData);
    if (response?.success && response.data) {
      setGeneratedResult(response.data);
    } else {
      setGenerateError(response?.error || '837P generation failed. Check the MCP server connection and input data.');
    }
    setGenerating(false);
  }, [
    claimId, claimType, subId, subFirst, subLast, subDob, subGender,
    subStreet, subCity, subState, subZip, payerId, payerName,
    provNpi, provName, provTaxId, provStreet, provCity, provState, provZip,
    serviceLines, diagnoses, generate837P,
  ]);

  const handleCopyOutput = useCallback(() => {
    if (generatedResult?.x12_content) {
      navigator.clipboard.writeText(generatedResult.x12_content);
    }
  }, [generatedResult]);

  // =====================================================
  // Render
  // =====================================================

  return (
    <div className="space-y-4">
      {/* Subscriber Section */}
      <EACard>
        <EACardHeader icon={<FileText className="h-4 w-4 text-slate-400" />}>
          <span className="text-sm font-medium text-slate-300">Subscriber Information</span>
        </EACardHeader>
        <EACardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field id="gen-sub-id" label="Subscriber ID" value={subId} onChange={setSubId} placeholder="SUB-001" required />
            <Field id="gen-sub-first" label="First Name" value={subFirst} onChange={setSubFirst} placeholder="Test" required />
            <Field id="gen-sub-last" label="Last Name" value={subLast} onChange={setSubLast} placeholder="Patient" required />
            <Field id="gen-sub-dob" label="Date of Birth" value={subDob} onChange={setSubDob} type="date" required />
            <div>
              <label htmlFor="gen-sub-gender" className="block text-xs font-medium text-slate-400 mb-1">Gender *</label>
              <select
                id="gen-sub-gender"
                value={subGender}
                onChange={e => setSubGender(e.target.value as 'M' | 'F' | 'U')}
                className="w-full bg-slate-900 text-slate-200 text-sm px-3 py-2 rounded-md border border-slate-700 focus:border-[#00857a] focus:outline-none"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Unknown</option>
              </select>
            </div>
            <Field id="gen-sub-street" label="Street" value={subStreet} onChange={setSubStreet} placeholder="123 Test St" />
            <Field id="gen-sub-city" label="City" value={subCity} onChange={setSubCity} placeholder="Test City" />
            <Field id="gen-sub-state" label="State" value={subState} onChange={setSubState} placeholder="TX" />
            <Field id="gen-sub-zip" label="ZIP" value={subZip} onChange={setSubZip} placeholder="75001" />
            <Field id="gen-payer-id" label="Payer ID" value={payerId} onChange={setPayerId} placeholder="PAYER-001" required />
            <Field id="gen-payer-name" label="Payer Name" value={payerName} onChange={setPayerName} placeholder="Test Insurance" required />
          </div>
        </EACardContent>
      </EACard>

      {/* Provider Section */}
      <EACard>
        <EACardHeader icon={<FileText className="h-4 w-4 text-slate-400" />}>
          <span className="text-sm font-medium text-slate-300">Rendering Provider</span>
        </EACardHeader>
        <EACardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field id="gen-prov-npi" label="NPI" value={provNpi} onChange={setProvNpi} placeholder="1234567890" required />
            <Field id="gen-prov-name" label="Provider Name" value={provName} onChange={setProvName} placeholder="Test Provider MD" required />
            <Field id="gen-prov-taxid" label="Tax ID" value={provTaxId} onChange={setProvTaxId} placeholder="12-3456789" required />
            <Field id="gen-prov-street" label="Street" value={provStreet} onChange={setProvStreet} placeholder="456 Medical Blvd" />
            <Field id="gen-prov-city" label="City" value={provCity} onChange={setProvCity} placeholder="Test City" />
            <Field id="gen-prov-state" label="State" value={provState} onChange={setProvState} placeholder="TX" />
            <Field id="gen-prov-zip" label="ZIP" value={provZip} onChange={setProvZip} placeholder="75001" />
          </div>
        </EACardContent>
      </EACard>

      {/* Claim Metadata */}
      <div className="grid grid-cols-2 gap-3">
        <Field id="gen-claim-id" label="Claim ID" value={claimId} onChange={setClaimId} placeholder="CLM-001 (auto-generated if empty)" />
        <div>
          <label htmlFor="gen-claim-type" className="block text-xs font-medium text-slate-400 mb-1">Claim Type *</label>
          <select
            id="gen-claim-type"
            value={claimType}
            onChange={e => setClaimType(e.target.value as 'professional' | 'institutional')}
            className="w-full bg-slate-900 text-slate-200 text-sm px-3 py-2 rounded-md border border-slate-700 focus:border-[#00857a] focus:outline-none"
          >
            <option value="professional">Professional</option>
            <option value="institutional">Institutional</option>
          </select>
        </div>
      </div>

      {/* Diagnoses */}
      <EACard>
        <EACardHeader icon={<FileText className="h-4 w-4 text-slate-400" />}>
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium text-slate-300">Diagnosis Codes</span>
            <button
              type="button"
              onClick={addDiagnosis}
              className="text-xs text-[#00857a] hover:text-[#00a08f] flex items-center gap-1 min-h-[32px]"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-2">
            {diagnoses.map((d, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <Field
                  id={`gen-dx-code-${idx}`}
                  label={`Dx #${idx + 1} Code`}
                  value={d.code}
                  onChange={v => updateDiagnosis(idx, 'code', v)}
                  placeholder="E11.9"
                  required
                  className="flex-1"
                />
                <div className="flex-1">
                  <label htmlFor={`gen-dx-type-${idx}`} className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                  <select
                    id={`gen-dx-type-${idx}`}
                    value={d.type}
                    onChange={e => updateDiagnosis(idx, 'type', e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-sm px-3 py-2 rounded-md border border-slate-700 focus:border-[#00857a] focus:outline-none"
                  >
                    <option value="principal">Principal</option>
                    <option value="admitting">Admitting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {diagnoses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDiagnosis(idx)}
                    className="p-2 text-slate-500 hover:text-red-400 transition min-h-[32px] min-w-[32px]"
                    aria-label={`Remove diagnosis ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </EACardContent>
      </EACard>

      {/* Service Lines */}
      <EACard>
        <EACardHeader icon={<FileText className="h-4 w-4 text-slate-400" />}>
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium text-slate-300">Service Lines</span>
            <button
              type="button"
              onClick={addServiceLine}
              className="text-xs text-[#00857a] hover:text-[#00a08f] flex items-center gap-1 min-h-[32px]"
            >
              <Plus className="h-3 w-3" /> Add Line
            </button>
          </div>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-4">
            {serviceLines.map((sl, idx) => (
              <div key={idx} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">Line {idx + 1}</span>
                  {serviceLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeServiceLine(idx)}
                      className="text-slate-500 hover:text-red-400 transition min-h-[32px] min-w-[32px] flex items-center justify-center"
                      aria-label={`Remove service line ${idx + 1}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Field id={`gen-sl-date-${idx}`} label="Date From" value={sl.date_from} onChange={v => updateServiceLine(idx, 'date_from', v)} type="date" required />
                  <Field id={`gen-sl-dateto-${idx}`} label="Date To" value={sl.date_to} onChange={v => updateServiceLine(idx, 'date_to', v)} type="date" />
                  <Field id={`gen-sl-pos-${idx}`} label="Place of Service" value={sl.place_of_service} onChange={v => updateServiceLine(idx, 'place_of_service', v)} placeholder="11" />
                  <Field id={`gen-sl-cpt-${idx}`} label="CPT Code" value={sl.cpt_code} onChange={v => updateServiceLine(idx, 'cpt_code', v)} placeholder="99213" required />
                  <Field id={`gen-sl-mod-${idx}`} label="Modifiers" value={sl.modifiers} onChange={v => updateServiceLine(idx, 'modifiers', v)} placeholder="25, GT" />
                  <Field id={`gen-sl-dxptr-${idx}`} label="Dx Pointers" value={sl.diagnosis_pointers} onChange={v => updateServiceLine(idx, 'diagnosis_pointers', v)} placeholder="1, 2" />
                  <Field id={`gen-sl-units-${idx}`} label="Units" value={sl.units} onChange={v => updateServiceLine(idx, 'units', v)} placeholder="1" />
                  <Field id={`gen-sl-charge-${idx}`} label="Charge ($)" value={sl.charge_amount} onChange={v => updateServiceLine(idx, 'charge_amount', v)} placeholder="150.00" required />
                </div>
              </div>
            ))}
          </div>
        </EACardContent>
      </EACard>

      {/* Generate Button */}
      <div className="flex justify-end">
        <EAButton
          onClick={handleGenerate}
          disabled={generating}
          icon={generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        >
          {generating ? 'Generating...' : 'Generate 837P'}
        </EAButton>
      </div>

      {/* Error */}
      {generateError && (
        <EAAlert variant="critical">
          <AlertTriangle className="h-4 w-4" />
          <span>{generateError}</span>
        </EAAlert>
      )}

      {/* Generated Result */}
      {generatedResult && (
        <EACard>
          <EACardHeader icon={<CheckCircle className="h-5 w-5 text-[#00857a]" />}>
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-slate-300">
                <span className="font-medium">837P Generated</span>
                <span className="text-slate-500 ml-2">
                  Control #: {generatedResult.control_numbers.isa} | {generatedResult.segment_count} segment(s)
                </span>
              </div>
              <button
                onClick={handleCopyOutput}
                className="text-slate-400 hover:text-white transition p-1 min-h-[32px] min-w-[32px]"
                title="Copy X12 content"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </EACardHeader>
          <EACardContent>
            <pre className="bg-slate-900 rounded-lg p-3 text-xs text-slate-300 overflow-auto max-h-64 border border-slate-700 whitespace-pre-wrap">
              {generatedResult.x12_content}
            </pre>
          </EACardContent>
        </EACard>
      )}
    </div>
  );
};

export default X12Generate837PPanel;
