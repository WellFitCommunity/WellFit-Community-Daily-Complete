/**
 * Immunization Registry — Helper functions
 *
 * HL7 date/time formatting, message control IDs, and code-to-text maps.
 * Extracted from immunizationRegistryService.ts (god-file decomposition).
 */

export function generateMessageControlId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `WF${timestamp}${random}`.toUpperCase();
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

export function getRelationshipText(code: string): string {
  const relationships: Record<string, string> = {
    'MTH': 'Mother',
    'FTH': 'Father',
    'GRD': 'Guardian',
    'SEL': 'Self',
    'SPO': 'Spouse',
    'OTH': 'Other',
  };
  return relationships[code] || 'Other';
}

export function mapFundingSourceToVFC(source: string): string {
  const mapping: Record<string, string> = {
    'VFC': 'V01',
    'Private': 'V02',
    'State': 'V03',
    'Military': 'V04',
    'Indian Health': 'V05',
    'Not Insured': 'V06',
    'Unknown': 'V00',
  };
  return mapping[source] || 'V00';
}

export function getFundingSourceText(code: string): string {
  const texts: Record<string, string> = {
    'V00': 'Unknown',
    'V01': 'Not VFC eligible',
    'V02': 'VFC eligible - Medicaid/Medicaid Managed Care',
    'V03': 'VFC eligible - Uninsured',
    'V04': 'VFC eligible - American Indian/Alaska Native',
    'V05': 'VFC eligible - Federally Qualified Health Center Patient',
    'V06': 'Not VFC eligible',
  };
  return texts[code] || 'Unknown';
}
