/**
 * ResultDisplay — Shared result renderers for HL7/X12 message operations
 *
 * Contains InfoChip helper and typed renderers for parse results,
 * validation results, FHIR conversions, and message type reference.
 *
 * Used by: HL7MessageTestPanel (main shell)
 */

import React from 'react';
import type {
  HL7ParsedMessage,
  HL7ValidationResult,
  X12ParsedClaim,
  X12ValidationResult,
  FHIRBundle,
  FHIRClaim,
  MessageTypeInfo,
} from '../../../services/mcp/mcpHL7X12Client';
import { CheckCircle, XCircle } from 'lucide-react';

// =====================================================
// Helper Components
// =====================================================

export const InfoChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-800/50 rounded px-3 py-2 border border-slate-700">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-sm text-white font-mono truncate" title={value}>{value}</div>
  </div>
);

// =====================================================
// HL7 Parse Result
// =====================================================

export const HL7ParseResultDisplay: React.FC<{ data: HL7ParsedMessage }> = ({ data }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <InfoChip label="Type" value={`${data.message_type}^${data.event_type}`} />
      <InfoChip label="Version" value={data.version} />
      <InfoChip label="Control ID" value={data.control_id} />
      <InfoChip label="Segments" value={String(data.segments.length)} />
    </div>
    {data.patient && (
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Patient</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <InfoChip label="ID" value={data.patient.id} />
          <InfoChip label="Name" value={`${data.patient.name.family}, ${data.patient.name.given}`} />
          {data.patient.dob && <InfoChip label="DOB" value={data.patient.dob} />}
          {data.patient.gender && <InfoChip label="Gender" value={data.patient.gender} />}
        </div>
      </div>
    )}
    {data.encounter && (
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Encounter</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <InfoChip label="ID" value={data.encounter.id} />
          <InfoChip label="Class" value={data.encounter.class} />
          {data.encounter.location && <InfoChip label="Location" value={data.encounter.location} />}
        </div>
      </div>
    )}
  </div>
);

// =====================================================
// Validation Result (shared between HL7 and X12)
// =====================================================

export const ValidationResultDisplay: React.FC<{
  data: HL7ValidationResult | X12ValidationResult;
}> = ({ data }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      {data.valid ? (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="h-5 w-5" />
          <span className="font-semibold">Valid</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-red-400">
          <XCircle className="h-5 w-5" />
          <span className="font-semibold">Invalid</span>
        </div>
      )}
      {'segment_count' in data && data.segment_count !== undefined && (
        <span className="text-xs text-slate-400">({data.segment_count} segments)</span>
      )}
    </div>
    {data.errors.length > 0 && (
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-red-400">Errors</h4>
        {data.errors.map((err, i) => (
          <div key={i} className="text-sm text-red-300 bg-red-900/20 rounded px-3 py-1.5 border border-red-800/30">
            {err}
          </div>
        ))}
      </div>
    )}
    {data.warnings.length > 0 && (
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-amber-400">Warnings</h4>
        {data.warnings.map((warn, i) => (
          <div key={i} className="text-sm text-amber-300 bg-amber-900/20 rounded px-3 py-1.5 border border-amber-800/30">
            {warn}
          </div>
        ))}
      </div>
    )}
  </div>
);

// =====================================================
// X12 Parse Result
// =====================================================

export const X12ParseResultDisplay: React.FC<{ data: X12ParsedClaim }> = ({ data }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <InfoChip label="Control #" value={data.control_number} />
      <InfoChip label="Type" value={data.transaction_type} />
      <InfoChip label="Segments" value={String(data.segment_count)} />
      <InfoChip label="Loops" value={String(data.loop_count)} />
    </div>
    {data.claims.map((claim, i) => (
      <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          Claim: {claim.claim_id} — ${(claim.total_charge ?? 0).toFixed(2)}
        </h4>
        <div className="space-y-1">
          {claim.service_lines.map((line, j) => (
            <div key={j} className="text-sm text-slate-400 flex justify-between">
              <span>Line {line.line_number}: {line.cpt_code}</span>
              <span>${(line.charge_amount ?? 0).toFixed(2)} x{line.units}</span>
            </div>
          ))}
        </div>
        {claim.diagnoses.length > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            Dx: {claim.diagnoses.join(', ')}
          </div>
        )}
      </div>
    ))}
  </div>
);

// =====================================================
// FHIR Result (shared between HL7-to-FHIR and X12-to-FHIR)
// =====================================================

export const FHIRResultDisplay: React.FC<{ data: FHIRBundle | FHIRClaim }> = ({ data }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <InfoChip label="Resource Type" value={data.resourceType} />
      {'type' in data && typeof data.type === 'string' && (
        <InfoChip label="Bundle Type" value={data.type} />
      )}
      {'total' in data && typeof data.total === 'number' && (
        <InfoChip label="Entries" value={String(data.total)} />
      )}
    </div>
    <pre className="bg-slate-900 rounded-lg p-3 text-xs text-slate-300 overflow-auto max-h-64 border border-slate-700">
      {JSON.stringify(data, null, 2)}
    </pre>
  </div>
);

// =====================================================
// Message Types Reference
// =====================================================

export const MessageTypesDisplay: React.FC<{ data: MessageTypeInfo }> = ({ data }) => (
  <div className="space-y-4">
    <div>
      <h4 className="text-sm font-semibold text-slate-300 mb-2">HL7 v2.x Message Types</h4>
      <div className="space-y-2">
        {data.hl7_types.map((type, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="font-medium text-white">{type.type}</div>
            <div className="text-xs text-slate-400">{type.description}</div>
            <div className="text-xs text-slate-500 mt-1">Events: {type.events.join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
    <div>
      <h4 className="text-sm font-semibold text-slate-300 mb-2">X12 Transaction Types</h4>
      <div className="space-y-2">
        {data.x12_types.map((type, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="font-medium text-white">{type.type}</div>
            <div className="text-xs text-slate-400">{type.description}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
