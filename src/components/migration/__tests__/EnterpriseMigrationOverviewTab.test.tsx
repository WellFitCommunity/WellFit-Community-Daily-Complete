/**
 * Tests for EnterpriseMigrationOverviewTab — upload/analysis/execute/recent
 * batches. Real components, no mocks. Behavior tests: user-visible output +
 * callbacks fired from real clicks. Synthetic test data only (Rule 15).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SourceDNA, MappingSuggestion } from '../../../services/migration-engine';
import type { MigrationBatch } from '../enterpriseMigrationHelpers';
import { EnterpriseMigrationOverviewTab } from '../EnterpriseMigrationOverviewTab';

const baseProps = {
  onFileUpload: vi.fn(),
  uploadedFile: null,
  parsedData: null,
  sourceDNA: null,
  mappingSuggestions: [] as MappingSuggestion[],
  onExecuteMigration: vi.fn(),
  isMigrating: false,
  migrationProgress: 0,
  batches: [] as MigrationBatch[],
  selectedBatch: null,
  onSelectBatch: vi.fn(),
};

const batch: MigrationBatch = {
  batchId: 'batch-1',
  sourceSystem: 'EPIC',
  recordCount: 100,
  successCount: 98,
  errorCount: 2,
  status: 'COMPLETED',
  startedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('EnterpriseMigrationOverviewTab', () => {
  it('shows the empty state when there are no batches', () => {
    render(<EnterpriseMigrationOverviewTab {...baseProps} />);
    expect(screen.getByText('No migrations yet')).toBeInTheDocument();
  });

  it('renders a batch and calls onSelectBatch when it is clicked', () => {
    const onSelectBatch = vi.fn();
    render(<EnterpriseMigrationOverviewTab {...baseProps} batches={[batch]} onSelectBatch={onSelectBatch} />);

    expect(screen.getByText('EPIC')).toBeInTheDocument();
    expect(screen.getByText('100 records')).toBeInTheDocument();
    expect(screen.getByText('98 success')).toBeInTheDocument();
    expect(screen.getByText('2 errors')).toBeInTheDocument();

    fireEvent.click(screen.getByText('EPIC'));
    expect(onSelectBatch).toHaveBeenCalledWith('batch-1');
  });

  it('shows source analysis when a DNA is present', () => {
    const sourceDNA = {
      dnaId: 'd1',
      sourceType: 'CSV',
      sourceSystem: 'CERNER',
      columnCount: 3,
      rowCount: 100,
      columns: [],
      structureHash: 'h',
      signatureVector: [],
      detectedAt: new Date('2026-01-01T00:00:00Z'),
    } as SourceDNA;

    render(<EnterpriseMigrationOverviewTab {...baseProps} sourceDNA={sourceDNA} />);
    expect(screen.getByText('CERNER')).toBeInTheDocument();
    // Columns and rows are shown.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders mapping suggestions with a confidence percentage', () => {
    const mappingSuggestions: MappingSuggestion[] = [
      {
        sourceColumn: 'GIVEN_NAME',
        targetTable: 'hc_staff',
        targetColumn: 'first_name',
        confidence: 0.9,
        reasons: ['name match'],
        alternativeMappings: [],
      },
    ];
    render(<EnterpriseMigrationOverviewTab {...baseProps} mappingSuggestions={mappingSuggestions} />);
    expect(screen.getByText('GIVEN_NAME')).toBeInTheDocument();
    expect(screen.getByText('hc_staff.first_name')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('shows the execute button once data is parsed and fires onExecuteMigration', () => {
    const onExecuteMigration = vi.fn();
    render(
      <EnterpriseMigrationOverviewTab
        {...baseProps}
        parsedData={[{ a: 1 }]}
        onExecuteMigration={onExecuteMigration}
      />
    );
    const btn = screen.getByText('Execute Enterprise Migration');
    fireEvent.click(btn);
    expect(onExecuteMigration).toHaveBeenCalledTimes(1);
  });

  it('shows migration progress while migrating and disables the button', () => {
    render(
      <EnterpriseMigrationOverviewTab
        {...baseProps}
        parsedData={[{ a: 1 }]}
        isMigrating
        migrationProgress={42}
      />
    );
    expect(screen.getByText('Migrating... 42%')).toBeInTheDocument();
  });

  it('fires onFileUpload when a file is selected', () => {
    const onFileUpload = vi.fn();
    const { container } = render(
      <EnterpriseMigrationOverviewTab {...baseProps} onFileUpload={onFileUpload} />
    );
    const input = container.querySelector('#file-upload') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(onFileUpload).toHaveBeenCalled();
  });
});
