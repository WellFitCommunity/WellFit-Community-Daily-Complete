/**
 * Shared HL7 CDA / XML formatting helpers for public-health document generators
 * (NHSN AU/AR and eICR).
 *
 * RF-7 (2026-06-01): these were byte-identical copies in
 * `antimicrobial-surveillance/cdaDocuments.ts` and `ecr/eicrDocument.ts`.
 * Consolidated here; behavior unchanged. Code-system OID maps stay per-domain
 * (they differ — eICR includes CPT), as does eICR's `generateSetId`.
 */

export function generateDocumentId(): string {
  return `2.16.840.1.113883.4.6.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
}

export function formatHL7DateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function formatHL7Date(dateStr: string): string {
  const date = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
