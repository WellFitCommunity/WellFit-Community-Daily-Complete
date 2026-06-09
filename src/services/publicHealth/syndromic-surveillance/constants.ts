/**
 * Syndromic Surveillance — Constants
 *
 * Transmission config + ICD-10-based surveillance category map.
 * Extracted from syndromicSurveillanceService.ts (god-file decomposition).
 */

import type { TransmissionConfig } from './types';

// Texas DSHS syndromic surveillance configuration
export const TX_DSHS_CONFIG: TransmissionConfig = {
  agency: 'TX_DSHS',
  endpoint: 'https://syndromic.dshs.texas.gov/hl7', // Production endpoint
  sendingApplication: 'WELLFIT_EHR',
  receivingApplication: 'ESSENCE',
  receivingFacility: 'TX_DSHS',
  hl7Version: '2.5.1',
};

// Surveillance categories based on chief complaint / diagnosis
export const SURVEILLANCE_CATEGORIES: Record<string, string[]> = {
  'Respiratory': ['J00', 'J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J09', 'J10', 'J11', 'J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18', 'J20', 'J21', 'J22', 'R05', 'R06'],
  'Gastrointestinal': ['A00', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'K52', 'R11', 'R19'],
  'Fever': ['R50'],
  'Neurological': ['G00', 'G01', 'G02', 'G03', 'G04', 'G05', 'R40', 'R41', 'R56'],
  'Rash': ['R21', 'B01', 'B05', 'B06', 'B08', 'B09'],
  'Hemorrhagic': ['D65', 'D68', 'R58'],
  'Sepsis': ['A40', 'A41', 'R65'],
};
