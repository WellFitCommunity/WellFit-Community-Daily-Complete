/**
 * Propose Workflow - Barrel re-export (backward compatibility)
 *
 * This file was decomposed from a 1,213-line god file into:
 *   propose-workflow/types.ts           — Shared type definitions
 *   propose-workflow/ProposeWorkflow.ts  — Core workflow class
 *   propose-workflow/GitHubIntegration.ts — GitHub API integration
 *   propose-workflow/index.ts            — Barrel re-export
 *
 * All exports are re-exported here so existing importers are unaffected.
 */

export {
  ProposeWorkflow,
  getProposeWorkflow,
  GitHubIntegration,
} from './propose-workflow';

export type {
  CodeChangeProposal,
  CodeChange,
  TestResult,
  PRMetadata,
  GitHubTenantConfig,
} from './propose-workflow';
