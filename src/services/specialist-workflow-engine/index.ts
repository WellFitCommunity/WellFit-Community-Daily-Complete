/**
 * Specialist Workflow Engine - Main Export
 * Future-proof system for ANY specialist type in rural healthcare
 */

// Core engine
export { SpecialistWorkflowEngine } from './SpecialistWorkflowEngine';
export { FieldVisitManager, fieldVisitManager } from './FieldVisitManager';
export { OfflineDataSync, offlineSync } from './OfflineDataSync';

// Templates and registry
export { workflowRegistry } from './templates';
export {
  chwWorkflow,
  agHealthWorkflow,
  matWorkflow,
  woundCareWorkflow,
  geriatricWorkflow,
  telepsychWorkflow,
  respiratoryWorkflow
} from './templates';

// Types
export * from './types';

// Re-export for convenience
export { WorkflowTemplateRegistry } from './templates';
