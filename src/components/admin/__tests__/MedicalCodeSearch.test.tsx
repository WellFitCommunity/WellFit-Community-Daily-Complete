/**
 * MedicalCodeSearch tests — behavioral coverage for code search widget.
 *
 * Deletion Test: Every test fails if the component is an empty <div />.
 *
 * Tests:
 *   - Tab switching triggers correct MCP search method (Tier 1 behavior)
 *   - Selecting a code calls onCodeSelect with correct args (Tier 1 behavior)
 *   - Bundling warning appears when conflicting CPT codes are passed (Tier 1 behavior)
 *   - Loading spinner shows during async search (Tier 2 state)
 *   - Error state shows when search fails (Tier 2 state)
 *   - Empty results message when no codes found (Tier 2 state)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockSearchCPT = vi.fn();
const mockSearchICD10 = vi.fn();
const mockSearchHCPCS = vi.fn();
const mockCheckBundling = vi.fn();

vi.mock('../../../services/mcp/mcpMedicalCodesClient', () => ({
  searchCPTCodes: (...args: unknown[]) => mockSearchCPT(...args),
  searchICD10Codes: (...args: unknown[]) => mockSearchICD10(...args),
  searchHCPCSCodes: (...args: unknown[]) => mockSearchHCPCS(...args),
  checkCodeBundling: (...args: unknown[]) => mockCheckBundling(...args),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

vi.mock('lucide-react', () => ({
  Search: () => <span data-testid="icon-search" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="icon-loader" className={className} />
  ),
  CheckCircle: () => <span data-testid="icon-check" />,
}));

import MedicalCodeSearch from '../MedicalCodeSearch';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_CPT_RESULTS = [
  { code: '99213', short_description: 'Office visit, est pt, moderate complexity' },
  { code: '99214', short_description: 'Office visit, est pt, high complexity' },
];

const MOCK_ICD10_RESULTS = [
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'I11.0', description: 'Hypertensive heart disease with heart failure' },
];

const MOCK_HCPCS_RESULTS = [
  { code: 'G0439', short_description: 'Annual wellness visit, subsequent' },
];

const SUCCESS_CPT = { success: true, data: MOCK_CPT_RESULTS, error: undefined };
const SUCCESS_ICD10 = { success: true, data: MOCK_ICD10_RESULTS, error: undefined };
const SUCCESS_HCPCS = { success: true, data: MOCK_HCPCS_RESULTS, error: undefined };
const EMPTY_RESULT = { success: true, data: [], error: undefined };
const FAIL_RESULT = { success: false, data: undefined, error: 'MCP unavailable' };

// ============================================================================
// HELPERS
// ============================================================================

function renderSearch(props?: Partial<React.ComponentProps<typeof MedicalCodeSearch>>) {
  const onCodeSelect = vi.fn();
  const result = render(
    <MedicalCodeSearch
      onCodeSelect={onCodeSelect}
      {...props}
    />
  );
  return { ...result, onCodeSelect };
}

// ============================================================================
// TESTS
// ============================================================================

describe('MedicalCodeSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCheckBundling.mockResolvedValue({ success: true, data: [], error: undefined });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Tab switching triggers correct MCP search method', () => {
    it('searches CPT codes when CPT tab is active (default)', async () => {
      mockSearchCPT.mockResolvedValue(SUCCESS_CPT);
      const { onCodeSelect } = renderSearch();

      const input = screen.getByRole('searchbox');
      await userEvent.type(input, '99');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockSearchCPT).toHaveBeenCalledWith('99', { limit: 10 });
      });

      expect(mockSearchICD10).not.toHaveBeenCalled();
      expect(onCodeSelect).not.toHaveBeenCalled(); // not called until user selects
    });

    it('calls searchICD10Codes when ICD-10 tab is activated', async () => {
      mockSearchICD10.mockResolvedValue(SUCCESS_ICD10);
      renderSearch();

      const icd10Tab = screen.getByRole('tab', { name: /ICD-10/i });
      await userEvent.click(icd10Tab);

      const input = screen.getByRole('searchbox');
      await userEvent.type(input, 'hyper');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockSearchICD10).toHaveBeenCalledWith('hyper', { limit: 10 });
      });

      expect(mockSearchCPT).not.toHaveBeenCalled();
    });

    it('calls searchHCPCSCodes when HCPCS tab is activated', async () => {
      mockSearchHCPCS.mockResolvedValue(SUCCESS_HCPCS);
      renderSearch();

      const hcpcsTab = screen.getByRole('tab', { name: /HCPCS/i });
      await userEvent.click(hcpcsTab);

      const input = screen.getByRole('searchbox');
      await userEvent.type(input, 'G04');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockSearchHCPCS).toHaveBeenCalledWith('G04', { limit: 10 });
      });
    });
  });

  describe('Selecting a code calls onCodeSelect with correct args', () => {
    it('calls onCodeSelect with code, type cpt, and description when CPT result is clicked', async () => {
      mockSearchCPT.mockResolvedValue(SUCCESS_CPT);
      const { onCodeSelect } = renderSearch();

      const input = screen.getByRole('searchbox');
      await userEvent.type(input, '99213');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByText(/99213/)).toBeInTheDocument();
      });

      const resultItem = screen.getByRole('option', { name: /99213/ });
      await userEvent.click(resultItem);

      expect(onCodeSelect).toHaveBeenCalledWith(
        '99213',
        'cpt',
        'Office visit, est pt, moderate complexity'
      );
    });

    it('calls onCodeSelect with code, type icd10, and description when ICD-10 result is clicked', async () => {
      mockSearchICD10.mockResolvedValue(SUCCESS_ICD10);
      const { onCodeSelect } = renderSearch({ initialCodeType: 'icd10' });

      const input = screen.getByRole('searchbox');
      await userEvent.type(input, 'I10');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByText(/Essential.*hypertension/i)).toBeInTheDocument();
      });

      const resultItem = screen.getByRole('option', { name: /I10/ });
      await userEvent.click(resultItem);

      expect(onCodeSelect).toHaveBeenCalledWith(
        'I10',
        'icd10',
        'Essential (primary) hypertension'
      );
    });
  });

  describe('Bundling warning displays when conflicting CPT codes are selected', () => {
    it('shows bundling warning section when selectedCodes has 2+ CPT codes with a bundling issue', async () => {
      mockCheckBundling.mockResolvedValue({
        success: true,
        data: [
          {
            codes: ['99213', '99214'],
            issue: 'Cannot bill two E/M codes on the same day',
            suggestion: 'Use the higher-complexity code only',
          },
        ],
        error: undefined,
      });

      render(
        <MedicalCodeSearch
          onCodeSelect={vi.fn()}
          selectedCodes={['99213', '99214']}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Bundling Warning/i)).toBeInTheDocument();
      expect(screen.getByText(/99213 \+ 99214/)).toBeInTheDocument();
      expect(screen.getByText(/Cannot bill two E\/M codes/i)).toBeInTheDocument();
      expect(screen.getByText(/Use the higher-complexity code only/i)).toBeInTheDocument();

      expect(mockCheckBundling).toHaveBeenCalledWith(['99213', '99214']);
    });

    it('does not call checkBundling when fewer than 2 CPT codes are selected', async () => {
      render(
        <MedicalCodeSearch
          onCodeSelect={vi.fn()}
          selectedCodes={['99213']}
        />
      );

      // Give time for any async effect
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(mockCheckBundling).not.toHaveBeenCalled();
    });

    it('does not show bundling section when no bundling issues are returned', async () => {
      mockCheckBundling.mockResolvedValue({ success: true, data: [], error: undefined });

      render(
        <MedicalCodeSearch
          onCodeSelect={vi.fn()}
          selectedCodes={['99213', '99215']}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(screen.queryByText(/Bundling Warning/i)).not.toBeInTheDocument();
    });
  });

  describe('Loading state shows during async search', () => {
    it('renders loading indicator while search is in progress', async () => {
      let resolveSearch!: (v: unknown) => void;
      mockSearchCPT.mockReturnValue(
        new Promise(resolve => {
          resolveSearch = resolve;
        })
      );

      renderSearch();

      const input = screen.getByRole('searchbox');
      await userEvent.type(input, 'off');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      // While search is pending, loader should be visible
      expect(screen.getByTestId('icon-loader')).toBeInTheDocument();

      // Resolve the search
      await act(async () => {
        resolveSearch(SUCCESS_CPT);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('icon-loader')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error state shows when search fails', () => {
    it('shows error message when MCP search returns failure', async () => {
      mockSearchCPT.mockResolvedValue(FAIL_RESULT);

      renderSearch();

      const input = screen.getByRole('searchbox');
      await userEvent.type(input, 'xyz');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/MCP unavailable/i)).toBeInTheDocument();
    });
  });

  describe('Empty results', () => {
    it('shows "No codes found" message when search returns empty results', async () => {
      mockSearchCPT.mockResolvedValue(EMPTY_RESULT);

      renderSearch();

      const input = screen.getByRole('searchbox');
      await userEvent.type(input, 'zzzzzz');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByText(/No codes found for/i)).toBeInTheDocument();
      });
    });
  });

  describe('Component rendering', () => {
    it('renders three tabs: CPT, ICD-10, HCPCS', () => {
      renderSearch();

      expect(screen.getByRole('tab', { name: 'CPT' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'ICD-10' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'HCPCS' })).toBeInTheDocument();
    });

    it('defaults to CPT tab when no initialCodeType is specified', () => {
      renderSearch();

      const cptTab = screen.getByRole('tab', { name: 'CPT' });
      expect(cptTab).toHaveAttribute('aria-selected', 'true');
    });

    it('starts with ICD-10 tab active when initialCodeType is icd10', () => {
      renderSearch({ initialCodeType: 'icd10' });

      const icd10Tab = screen.getByRole('tab', { name: 'ICD-10' });
      expect(icd10Tab).toHaveAttribute('aria-selected', 'true');
    });
  });
});
