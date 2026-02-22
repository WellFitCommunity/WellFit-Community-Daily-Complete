/**
 * Patient Context Service — Barrel Export
 *
 * Re-exports the PatientContextService class and singleton instance.
 * Import from here or from the original `patientContextService.ts` path.
 *
 * @module patient-context
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

export { PatientContextService } from './PatientContextService';
export { fetchSelfReports } from './fetchSelfReports';
import { PatientContextService } from './PatientContextService';

/** Singleton instance — use this for all service calls */
export const patientContextService = new PatientContextService();
