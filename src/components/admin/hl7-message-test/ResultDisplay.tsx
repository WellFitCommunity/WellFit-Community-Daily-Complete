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
      <InfoChip label="Type" value={data.messageType} />
      <InfoChip label="Version" value={data.version} />
      <InfoChip label="Control ID" value={data.messageControlId} />
      <InfoChip label="Segments" value={String(data.segments.length)} />
    </div>
    {data.sendingApplication && (
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Source</h4>
        <div className="grid grid-cols-2 gap-2">
          <InfoChip label="Application" value={data.sendingApplication} />
          <InfoChip label="Facility" value={data.sendingFacility} />
        </div>
      </div>
    )}
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
      {'segmentCount' in data && typeof data.segmentCount === 'number' && (
        <span className="text-xs text-slate-400">({data.segmentCount} segments)</span>
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
      <InfoChip label="Interchange #" value={data.interchangeControlNumber} />
      <InfoChip label="Group #" value={data.groupControlNumber} />
      <InfoChip label="Transaction #" value={data.transactionSetControlNumber} />
      <InfoChip label="Total Charges" value={`$${(data.totalCharges ?? 0).toFixed(2)}`} />
    </div>
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-300 mb-2">
        Claim: {data.claimId}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
        <InfoChip label="Patient" value={data.patientName} />
        <InfoChip label="Payer" value={data.payerName} />
        <InfoChip label="Provider" value={data.providerName} />
      </div>
      {data.serviceDate && (
        <div className="text-xs text-slate-400 mb-2">Service Date: {data.serviceDate}</div>
      )}
      {data.procedures.length > 0 && (
        <div className="space-y-1">
          {data.procedures.map((proc, j) => (
            <div key={j} className="text-sm text-slate-400 flex justify-between">
              <span>{proc.code}</span>
              <span>${(proc.charges ?? 0).toFixed(2)} x{proc.units}</span>
            </div>
          ))}
        </div>
      )}
      {data.diagnoses.length > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          Dx: {data.diagnoses.join(', ')}
        </div>
      )}
    </div>
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
      <h4 className="text-sm font-semibold text-slate-300 mb-2">HL7 v2.x</h4>
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <div className="text-sm text-slate-300 mb-1">Supported Types</div>
        <div className="flex flex-wrap gap-1">
          {data.hl7.supported.map((t) => (
            <span key={t} className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-0.5">{t}</span>
          ))}
        </div>
        <div className="text-sm text-slate-300 mt-2 mb-1">Versions</div>
        <div className="flex flex-wrap gap-1">
          {data.hl7.versions.map((v) => (
            <span key={v} className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-0.5">{v}</span>
          ))}
        </div>
      </div>
    </div>
    <div>
      <h4 className="text-sm font-semibold text-slate-300 mb-2">X12</h4>
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <div className="text-sm text-slate-300 mb-1">Supported Types</div>
        <div className="flex flex-wrap gap-1">
          {data.x12.supported.map((t) => (
            <span key={t} className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-0.5">{t}</span>
          ))}
        </div>
        <div className="text-sm text-slate-300 mt-2 mb-1">Versions</div>
        <div className="flex flex-wrap gap-1">
          {data.x12.versions.map((v) => (
            <span key={v} className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-0.5">{v}</span>
          ))}
        </div>
      </div>
    </div>
    <div>
      <h4 className="text-sm font-semibold text-slate-300 mb-2">FHIR</h4>
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <div className="text-sm text-slate-300 mb-1">Version: {data.fhir.version}</div>
        <div className="flex flex-wrap gap-1">
          {data.fhir.supported.map((t) => (
            <span key={t} className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-0.5">{t}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);
