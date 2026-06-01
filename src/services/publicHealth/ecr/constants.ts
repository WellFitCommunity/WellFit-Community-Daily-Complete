/**
 * Electronic Case Reporting (eCR) — constants + code-system OID resolution
 *
 * Extracted from ecrService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim.
 */

// eICR Template IDs
export const EICR_TEMPLATE_IDS = {
  document: '2.16.840.1.113883.10.20.15.2',
  documentVersion: '2017-04-01',
  patientSection: '2.16.840.1.113883.10.20.22.2.6.1',
  problemSection: '2.16.840.1.113883.10.20.22.2.5.1',
  resultsSection: '2.16.840.1.113883.10.20.22.2.3.1',
  socialHistorySection: '2.16.840.1.113883.10.20.22.2.17',
  encounterSection: '2.16.840.1.113883.10.20.22.2.22.1',
};

// AIMS Platform configuration
export const AIMS_CONFIG = {
  name: 'AIMS',
  endpoint: 'https://aims.aphl.org/api/eicr', // Production endpoint
  testEndpoint: 'https://aims-staging.aphl.org/api/eicr',
};

// Code Systems
export const CODE_SYSTEMS = {
  icd10: '2.16.840.1.113883.6.90',
  snomed: '2.16.840.1.113883.6.96',
  loinc: '2.16.840.1.113883.6.1',
  rxnorm: '2.16.840.1.113883.6.88',
  cpt: '2.16.840.1.113883.6.12',
};

export function getCodeSystemOid(codeSystem: string): string {
  const systems: Record<string, string> = {
    'ICD10': CODE_SYSTEMS.icd10,
    'ICD-10': CODE_SYSTEMS.icd10,
    'ICD10-CM': CODE_SYSTEMS.icd10,
    'SNOMED': CODE_SYSTEMS.snomed,
    'SNOMED-CT': CODE_SYSTEMS.snomed,
    'LOINC': CODE_SYSTEMS.loinc,
    'RXNORM': CODE_SYSTEMS.rxnorm,
    'CPT': CODE_SYSTEMS.cpt,
  };
  return systems[codeSystem.toUpperCase()] || CODE_SYSTEMS.snomed;
}
