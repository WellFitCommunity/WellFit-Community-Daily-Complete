/**
 * Propose Workflow - Barrel re-export
 *
 * PR-based code change workflow for Guardian Agent.
 * All code changes go through pull requests — "propose, don't push."
 */

export { ProposeWorkflow, getProposeWorkflow } from './ProposeWorkflow';
export type { GitHubTenantConfig } from './ProposeWorkflow';
export { GitHubIntegration } from './GitHubIntegration';
export type { CodeChangeProposal, CodeChange, TestResult, PRMetadata } from './types';
