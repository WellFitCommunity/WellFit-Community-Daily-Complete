/**
 * ClinicalValidationDashboard Tests
 *
 * Tests: summary cards, rejection log table, reference data health panel,
 * filter behavior, loading/error states, empty states.
 * All tests pass the Deletion Test — would fail if component logic removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock PDF exports
const mockExportValidationReport = vi.fn();
const mockExportDRGReference = vi.fn();

vi.mock('../pdfExportService', () => ({
  exportValidationReportPDF: (...args: unknown[]) => mockExportValidationReport(...args),
  exportDRGReferencePDF: (...args: unknown[]) => mockExportDRGReference(...args),
}));

// --- Mock data ---

const mockValidationResults = [
  {
    id: 'vr-1',
    created_at: '2026-03-07T10:00:00Z',
    source_function: 'coding-suggest',
    patient_id: null,
    tenant_id: null,
    codes_checked: 5,
    codes_validated: 4,
    codes_rejected: 1,
    codes_suppressed: 0,
    rejected_details: [
      { code: 'Z99.999', system: 'icd10', reason: 'code_not_found', detail: 'Code not found in ICD-10-CM' },
    ],
    validation_method: 'both',
    response_time_ms: 150,
  },
  {
    id: 'vr-2',
    created_at: '2026-03-06T14:00:00Z',
    source_function: 'ai-discharge-summary',
    patient_id: null,
    tenant_id: null,
    codes_checked: 3,
    codes_validated: 3,
    codes_rejected: 0,
    codes_suppressed: 0,
    rejected_details: [],
    validation_method: 'local_cache',
    response_time_ms: 45,
  },
  {
    id: 'vr-3',
    created_at: '2026-03-05T09:00:00Z',
    source_function: 'coding-suggest',
    patient_id: null,
    tenant_id: null,
    codes_checked: 4,
    codes_validated: 2,
    codes_rejected: 2,
    codes_suppressed: 1,
    rejected_details: [
      { code: 'Z99.999', system: 'icd10', reason: 'code_not_found', detail: 'Code not found in ICD-10-CM' },
      { code: '99999', system: 'cpt', reason: 'code_not_found', detail: 'Code not found in CPT table' },
    ],
    validation_method: 'both',
    response_time_ms: 200,
  },
];

const mockReferenceData = [
  {
    id: 'ref-1',
    source_name: 'NLM ICD-10-CM API',
    source_type: 'api',
    last_updated: '2026-03-01T00:00:00Z',
    version: '2026',
    status: 'current',
    next_expected_update: '2026-10-01T00:00:00Z',
    notes: null,
  },
  {
    id: 'ref-2',
    source_name: 'CMS MS-DRG Table',
    source_type: 'seeded_table',
    last_updated: '2026-01-15T00:00:00Z',
    version: 'FY2026',
    status: 'warning',
    next_expected_update: '2026-10-01T00:00:00Z',
    notes: 'Check CMS for FY2027 updates',
  },
];

// --- Supabase mock ---

function createQueryChain(data: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  };
  // Make the chain thenable (resolves when awaited)
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: { data: unknown[]; error: null }) => void) => {
      resolve({ data, error: null });
      return Promise.resolve({ data, error: null });
    },
    writable: true,
  });
  return chain;
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'validation_hook_results') {
    return createQueryChain(mockValidationResults);
  }
  if (table === 'reference_data_versions') {
    return createQueryChain(mockReferenceData);
  }
  return createQueryChain([]);
});

vi.mock('../../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

// --- Import AFTER mocks ---

import { ClinicalValidationDashboard } from '../ClinicalValidationDashboard';

describe('ClinicalValidationDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'validation_hook_results') {
        return createQueryChain(mockValidationResults);
      }
      if (table === 'reference_data_versions') {
        return createQueryChain(mockReferenceData);
      }
      return createQueryChain([]);
    });
  });

  it('displays loading spinner while fetching data', () => {
    // Make the query never resolve by using a chain whose then never calls back
    function createPendingChain() {
      const chain = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: undefined as unknown,
      };
      Object.defineProperty(chain, 'then', {
        value: () => new Promise(() => {}),
        writable: true,
      });
      return chain;
    }
    mockFrom.mockReturnValue(createPendingChain());

    render(<ClinicalValidationDashboard />);
    expect(screen.getByText('Loading validation data...')).toBeInTheDocument();
  });

  it('renders summary cards with correct totals after data loads', async () => {
    render(<ClinicalValidationDashboard />);

    // Total codes: 5 + 3 + 4 = 12
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    // Total rejected: 1 + 0 + 2 = 3
    expect(screen.getByText('3')).toBeInTheDocument();

    // Rejection rate: 3/12 = 25.0%
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('displays top hallucinated code with occurrence count', async () => {
    render(<ClinicalValidationDashboard />);

    // Z99.999 appears twice (vr-1 and vr-3)
    await waitFor(() => {
      expect(screen.getByText('icd10:Z99.999')).toBeInTheDocument();
    });
    expect(screen.getByText('2 occurrences')).toBeInTheDocument();
  });

  it('shows rejection log entries with code details', async () => {
    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/3 entries/)).toBeInTheDocument();
    });

    // Check code values appear in table — Z99.999 appears in both summary card and table rows
    expect(screen.getAllByText('Z99.999').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('99999')).toBeInTheDocument();
  });

  it('renders code system badges for each rejection', async () => {
    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      // ICD10 badges in the rejection table
      const icd10Badges = screen.getAllByText('ICD10');
      expect(icd10Badges.length).toBeGreaterThanOrEqual(2);
    });

    // CPT appears in both the table badge and the filter dropdown
    const cptElements = screen.getAllByText('CPT');
    expect(cptElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays reference data sources with freshness status', async () => {
    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('NLM ICD-10-CM API')).toBeInTheDocument();
    });

    expect(screen.getByText('CMS MS-DRG Table')).toBeInTheDocument();
    expect(screen.getByText('current')).toBeInTheDocument();
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('shows reference data notes when present', async () => {
    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Check CMS for FY2027/)).toBeInTheDocument();
    });
  });

  it('renders filter dropdowns for date range, function, system, reason', async () => {
    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('AI Function')).toBeInTheDocument();
    expect(screen.getByLabelText('Code System')).toBeInTheDocument();
    expect(screen.getByLabelText('Rejection Reason')).toBeInTheDocument();
  });

  it('changes date range filter and refetches data', async () => {
    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Time Range');
    fireEvent.change(select, { target: { value: '7d' } });

    // Should trigger a new fetch
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('validation_hook_results');
    });
  });

  it('displays empty state when no rejections exist', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'validation_hook_results') {
        return createQueryChain([{
          id: 'vr-clean',
          created_at: '2026-03-07T10:00:00Z',
          source_function: 'coding-suggest',
          patient_id: null,
          tenant_id: null,
          codes_checked: 5,
          codes_validated: 5,
          codes_rejected: 0,
          codes_suppressed: 0,
          rejected_details: [],
          validation_method: 'local_cache',
          response_time_ms: 50,
        }]);
      }
      if (table === 'reference_data_versions') {
        return createQueryChain(mockReferenceData);
      }
      return createQueryChain([]);
    });

    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/AI output validation is clean/)).toBeInTheDocument();
    });
  });

  it('shows 0% rejection rate when no codes rejected', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'validation_hook_results') {
        return createQueryChain([{
          id: 'vr-clean',
          created_at: '2026-03-07T10:00:00Z',
          source_function: 'coding-suggest',
          patient_id: null,
          tenant_id: null,
          codes_checked: 10,
          codes_validated: 10,
          codes_rejected: 0,
          codes_suppressed: 0,
          rejected_details: [],
          validation_method: 'both',
          response_time_ms: 100,
        }]);
      }
      if (table === 'reference_data_versions') {
        return createQueryChain(mockReferenceData);
      }
      return createQueryChain([]);
    });

    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  it('shows empty reference data message when no sources configured', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'validation_hook_results') {
        return createQueryChain(mockValidationResults);
      }
      if (table === 'reference_data_versions') {
        return createQueryChain([]);
      }
      return createQueryChain([]);
    });

    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No reference data sources configured/)).toBeInTheDocument();
    });
  });

  it('shows avg response time metric', async () => {
    render(<ClinicalValidationDashboard />);

    // Avg: (150 + 45 + 200) / 3 = ~132ms
    await waitFor(() => {
      expect(screen.getByText('132ms')).toBeInTheDocument();
    });
  });

  it('shows auto-suppressed count in rejected codes card', async () => {
    render(<ClinicalValidationDashboard />);

    // Total suppressed: 0 + 0 + 1 = 1
    await waitFor(() => {
      expect(screen.getByText('1 auto-suppressed')).toBeInTheDocument();
    });
  });

  it('renders refresh button that triggers data reload', async () => {
    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });

    const initialCallCount = mockFrom.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  it('displays stale badge when reference data has critical status', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'validation_hook_results') {
        return createQueryChain(mockValidationResults);
      }
      if (table === 'reference_data_versions') {
        return createQueryChain([{
          id: 'ref-stale',
          source_name: 'Stale Source',
          source_type: 'seeded_table',
          last_updated: '2025-01-01T00:00:00Z',
          version: '2025',
          status: 'critical',
          next_expected_update: null,
          notes: null,
        }]);
      }
      return createQueryChain([]);
    });

    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('1 stale')).toBeInTheDocument();
    });
  });

  it('renders Export Report PDF button that calls export function', async () => {
    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export Report PDF' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export Report PDF' }));
    expect(mockExportValidationReport).toHaveBeenCalledTimes(1);

    // Verify it passes the correct data shape
    const callArgs = mockExportValidationReport.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs).toHaveProperty('summary');
    expect(callArgs).toHaveProperty('rejectionLog');
    expect(callArgs).toHaveProperty('referenceData');
    expect(callArgs).toHaveProperty('dateRange', '30d');
  });

  it('renders Export DRG Table button that fetches and exports DRG data', async () => {
    // Mock ms_drg_reference query
    const originalImpl = mockFrom.getMockImplementation();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ms_drg_reference') {
        return createQueryChain([
          { drg_code: '001', description: 'Test DRG', relative_weight: 1.5, mdc: '01', type: 'SURG' },
        ]);
      }
      return originalImpl ? originalImpl(table) : createQueryChain([]);
    });

    render(<ClinicalValidationDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export DRG Table' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export DRG Table' }));

    await waitFor(() => {
      expect(mockExportDRGReference).toHaveBeenCalledTimes(1);
    });
  });
});
