/**
 * Antimicrobial Surveillance — constants + classification helpers
 *
 * Extracted from antimicrobialSurveillanceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — constants and accessors moved verbatim.
 */

// NHSN Configuration (used by edge function for production submission)
export const NHSN_CONFIG = {
  name: 'CDC_NHSN',
  endpoint: 'https://sams.cdc.gov/nhsn/api/upload', // Production endpoint
  testEndpoint: 'https://nhsn-staging.cdc.gov/api/upload',
};

// Antimicrobial classes and common drugs
export const ANTIMICROBIAL_CLASSES: Record<string, string[]> = {
  'Penicillins': ['Amoxicillin', 'Ampicillin', 'Penicillin G', 'Piperacillin', 'Piperacillin-Tazobactam'],
  'Cephalosporins - 1st Gen': ['Cefazolin', 'Cephalexin'],
  'Cephalosporins - 2nd Gen': ['Cefuroxime', 'Cefoxitin', 'Cefaclor'],
  'Cephalosporins - 3rd Gen': ['Ceftriaxone', 'Cefotaxime', 'Ceftazidime', 'Cefpodoxime'],
  'Cephalosporins - 4th Gen': ['Cefepime'],
  'Cephalosporins - 5th Gen': ['Ceftaroline', 'Ceftobiprole'],
  'Carbapenems': ['Meropenem', 'Imipenem-Cilastatin', 'Ertapenem', 'Doripenem'],
  'Fluoroquinolones': ['Ciprofloxacin', 'Levofloxacin', 'Moxifloxacin', 'Ofloxacin'],
  'Aminoglycosides': ['Gentamicin', 'Tobramycin', 'Amikacin', 'Streptomycin'],
  'Macrolides': ['Azithromycin', 'Clarithromycin', 'Erythromycin'],
  'Tetracyclines': ['Doxycycline', 'Minocycline', 'Tetracycline', 'Tigecycline'],
  'Glycopeptides': ['Vancomycin', 'Teicoplanin', 'Dalbavancin', 'Oritavancin'],
  'Oxazolidinones': ['Linezolid', 'Tedizolid'],
  'Sulfonamides': ['Trimethoprim-Sulfamethoxazole', 'Sulfadiazine'],
  'Nitroimidazoles': ['Metronidazole'],
  'Polymyxins': ['Colistin', 'Polymyxin B'],
  'Antifungals - Azoles': ['Fluconazole', 'Voriconazole', 'Posaconazole', 'Itraconazole'],
  'Antifungals - Echinocandins': ['Caspofungin', 'Micafungin', 'Anidulafungin'],
  'Antifungals - Polyenes': ['Amphotericin B'],
};

// MDRO Types
export const MDRO_TYPES: Record<string, string> = {
  'MRSA': 'Methicillin-resistant Staphylococcus aureus',
  'VRE': 'Vancomycin-resistant Enterococcus',
  'CRE': 'Carbapenem-resistant Enterobacteriaceae',
  'ESBL': 'Extended-Spectrum Beta-Lactamase Producer',
  'CRPA': 'Carbapenem-resistant Pseudomonas aeruginosa',
  'CRAB': 'Carbapenem-resistant Acinetobacter baumannii',
  'C.diff': 'Clostridioides difficile',
  'MDR-TB': 'Multi-drug resistant Tuberculosis',
};

// Code Systems
export const CODE_SYSTEMS = {
  rxnorm: '2.16.840.1.113883.6.88',
  snomed: '2.16.840.1.113883.6.96',
  loinc: '2.16.840.1.113883.6.1',
  icd10: '2.16.840.1.113883.6.90',
};

/**
 * Classify an antimicrobial by name
 */
export function classifyAntimicrobial(medicationName: string): string | null {
  const nameLower = medicationName.toLowerCase();
  for (const [className, drugs] of Object.entries(ANTIMICROBIAL_CLASSES)) {
    if (drugs.some(drug => nameLower.includes(drug.toLowerCase()))) {
      return className;
    }
  }
  return null;
}

/**
 * Get MDRO types reference
 */
export function getMDROTypes(): Record<string, string> {
  return { ...MDRO_TYPES };
}

/**
 * Get antimicrobial classes reference
 */
export function getAntimicrobialClasses(): Record<string, string[]> {
  return { ...ANTIMICROBIAL_CLASSES };
}
