/**
 * Physician Panel Components - Barrel Export
 * Central export point for physician panel UI components
 *
 * REFACTORED: 2025-11-04
 * - Extracted from monolithic PhysicianPanel.tsx (1,114 lines → 4 modules)
 * - Modular architecture for better maintainability
 * - Follows Strangler Fig Pattern for zero breaking changes
 */

// Export types
export type { PatientListItem, PatientVitals, PatientSummary, QuickStat } from './types';

// Export components
export { CollapsibleSection } from './CollapsibleSection';
export { PatientSelector } from './PatientSelector';
export { PatientSummaryCard } from './PatientSummaryCard';
