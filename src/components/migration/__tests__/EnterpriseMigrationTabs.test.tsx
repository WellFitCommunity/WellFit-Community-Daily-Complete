/**
 * Tests for the Enterprise Migration tab components (Quality / Duplicates /
 * Rollback / Retries / Lineage). Real components + real EA design system — no
 * mocks. Behavior tests: each asserts a user-visible outcome or a callback fired
 * from a real click, and fails if the component logic were removed.
 *
 * Synthetic test data only (Rule 15).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  QualityScore,
  DedupCandidate,
  MigrationSnapshot,
  RetryQueueItem,
} from '../../../services/enterprise-migration/types';
import type { LineageRecord } from '../enterpriseMigrationHelpers';
import {
  EnterpriseMigrationQualityTab,
  EnterpriseMigrationDuplicatesTab,
  EnterpriseMigrationRollbackTab,
  EnterpriseMigrationRetriesTab,
  EnterpriseMigrationLineageTab,
} from '../EnterpriseMigrationTabs';

describe('EnterpriseMigrationQualityTab', () => {
  const score: QualityScore = {
    overallScore: 88,
    completenessScore: 90,
    accuracyScore: 85,
    consistencyScore: 92,
    uniquenessScore: 80,
    grade: 'B+',
    recommendations: ['Normalize phone formats'],
    readyForProduction: true,
  };

  it('prompts to select a batch when there is no score', () => {
    render(<EnterpriseMigrationQualityTab qualityScore={null} />);
    expect(screen.getByText(/Select a migration batch to view quality scores/)).toBeInTheDocument();
  });

  it('shows the overall score, grade, breakdown, and recommendations', () => {
    render(<EnterpriseMigrationQualityTab qualityScore={score} />);
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('B+')).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Normalize phone formats')).toBeInTheDocument();
  });

  it('shows Production Ready vs Needs Review based on readyForProduction', () => {
    const ready = render(<EnterpriseMigrationQualityTab qualityScore={score} />);
    expect(ready.getByText('Production Ready')).toBeInTheDocument();
    ready.unmount();

    render(<EnterpriseMigrationQualityTab qualityScore={{ ...score, readyForProduction: false }} />);
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
  });
});

describe('EnterpriseMigrationDuplicatesTab', () => {
  const dup: DedupCandidate = {
    candidateId: 'cand-1',
    recordAId: 'a1',
    recordAData: { name: 'Test Patient Alpha' },
    recordBId: 'b1',
    recordBData: { name: 'Test Patient Alpha' },
    overallSimilarity: 0.85,
    matchMethod: 'fuzzy_name',
    resolution: 'pending',
    requiresHumanReview: true,
  };

  it('shows an empty state when there are no duplicates', () => {
    render(<EnterpriseMigrationDuplicatesTab duplicates={[]} onResolve={vi.fn()} />);
    expect(screen.getByText('No duplicates requiring review')).toBeInTheDocument();
  });

  it('renders the similarity and calls onResolve with the chosen resolution', () => {
    const onResolve = vi.fn();
    render(<EnterpriseMigrationDuplicatesTab duplicates={[dup]} onResolve={onResolve} />);

    expect(screen.getByText('85% Similar')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Keep A'));
    expect(onResolve).toHaveBeenCalledWith('cand-1', 'merge_a');

    fireEvent.click(screen.getByText('Keep B'));
    expect(onResolve).toHaveBeenCalledWith('cand-1', 'merge_b');

    fireEvent.click(screen.getByText('Keep Both'));
    expect(onResolve).toHaveBeenCalledWith('cand-1', 'keep_both');
  });
});

describe('EnterpriseMigrationRollbackTab', () => {
  const snapshot: MigrationSnapshot = {
    snapshotId: 'snap-1',
    snapshotName: 'Pre-migration Alpha',
    snapshotType: 'pre_migration',
    tablesIncluded: ['hc_staff'],
    snapshotData: {},
    totalRows: 100,
    sizeBytes: 2048,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('shows an empty state when there are no snapshots', () => {
    render(<EnterpriseMigrationRollbackTab snapshots={[]} onRollback={vi.fn()} />);
    expect(screen.getByText('No snapshots available')).toBeInTheDocument();
  });

  it('renders a snapshot and calls onRollback with its id', () => {
    const onRollback = vi.fn();
    render(<EnterpriseMigrationRollbackTab snapshots={[snapshot]} onRollback={onRollback} />);

    expect(screen.getByText('Pre-migration Alpha')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Rollback'));
    expect(onRollback).toHaveBeenCalledWith('snap-1');
  });
});

describe('EnterpriseMigrationRetriesTab', () => {
  const retry: RetryQueueItem = {
    retryId: 'retry-1',
    migrationBatchId: 'batch-1',
    failedOperation: 'INSERT hc_staff',
    sourceRowNumbers: [5],
    errorMessage: 'duplicate key value',
    attemptNumber: 2,
    maxAttempts: 3,
    nextRetryAt: new Date('2026-01-01T00:00:00Z'),
    status: 'retrying',
  };

  it('shows an empty state when the retry queue is empty', () => {
    render(<EnterpriseMigrationRetriesTab retryQueue={[]} />);
    expect(screen.getByText('No retries pending')).toBeInTheDocument();
  });

  it('renders the failed operation, attempt count, and error', () => {
    render(<EnterpriseMigrationRetriesTab retryQueue={[retry]} />);
    expect(screen.getByText('INSERT hc_staff')).toBeInTheDocument();
    expect(screen.getByText('Attempt 2/3')).toBeInTheDocument();
    expect(screen.getByText('duplicate key value')).toBeInTheDocument();
  });
});

describe('EnterpriseMigrationLineageTab', () => {
  const record: LineageRecord = {
    sourceFile: 'staff.csv',
    sourceRow: 5,
    sourceColumn: 'GIVEN_NAME',
    targetTable: 'hc_staff',
    targetColumn: 'first_name',
    transformations: ['TRIM', 'TITLE_CASE'],
    validationPassed: true,
  };

  it('prompts to select a batch when there is no lineage', () => {
    render(<EnterpriseMigrationLineageTab lineageRecords={[]} />);
    expect(screen.getByText(/Select a migration batch to view lineage/)).toBeInTheDocument();
  });

  it('renders a lineage row with source, target, transforms, and validity', () => {
    render(<EnterpriseMigrationLineageTab lineageRecords={[record]} />);
    expect(screen.getByText('GIVEN_NAME')).toBeInTheDocument();
    expect(screen.getByText('hc_staff.first_name')).toBeInTheDocument();
    expect(screen.getByText('TRIM, TITLE_CASE')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });
});
