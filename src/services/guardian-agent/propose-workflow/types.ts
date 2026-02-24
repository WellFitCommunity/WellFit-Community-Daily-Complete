/**
 * Propose Workflow Types
 * Shared type definitions for the PR-based code change workflow.
 */

import { DetectedIssue, HealingAction } from '../types';

/**
 * Code change proposal
 */
export interface CodeChangeProposal {
  id: string;
  createdAt: Date;
  issue: DetectedIssue;
  action: HealingAction;
  changes: CodeChange[];
  branchName: string;
  prNumber?: number;
  prUrl?: string;
  status: 'draft' | 'proposed' | 'approved' | 'rejected' | 'merged' | 'closed';
  reviewers: string[];
  approvedBy?: string[];
  rejectedBy?: string[];
  mergedAt?: Date;
  closedAt?: Date;
  testResults?: TestResult[];
}

/**
 * Individual code change
 */
export interface CodeChange {
  filePath: string;
  operation: 'create' | 'update' | 'delete';
  before?: string;
  after?: string;
  diff?: string;
  reason: string;
}

/**
 * Test result
 */
export interface TestResult {
  testSuite: string;
  passed: boolean;
  duration: number;
  failures?: string[];
}

/**
 * PR metadata
 */
export interface PRMetadata {
  title: string;
  description: string;
  labels: string[];
  assignees: string[];
  reviewers: string[];
}
