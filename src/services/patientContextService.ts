/**
 * Patient Context Service — Re-export Barrel
 *
 * CANONICAL ENTRY POINT for all patient data access.
 *
 * This file re-exports from the decomposed `patient-context/` directory.
 * All existing imports (`from '../services/patientContextService'`) continue to work.
 *
 * @module patientContextService
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

export { patientContextService, PatientContextService } from './patient-context';
