/**
 * PubMedEvidencePanel — Behavioral tests
 *
 * Tests: collapsed/expanded state, search trigger, article display,
 * abstract viewing, error handling, empty state.
 *
 * Uses synthetic test data only (no real PMIDs or patient data).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PubMedEvidencePanel } from '../PubMedEvidencePanel';

// =====================================================
// Mock usePubMedEvidence hook
// =====================================================

const mockSearchGuidelineEvidence = vi.fn();
const mockFetchAbstract = vi.fn();
const mockReset = vi.fn();

vi.mock('../../../hooks/usePubMedEvidence', () => ({
  usePubMedEvidence: () => mockHookReturn,
}));

let mockHookReturn = {
  status: 'idle' as 'idle' | 'searching' | 'loaded' | 'error',
  result: null as ReturnType<typeof createMockResult> | null,
  error: null as string | null,
  selectedAbstract: null as { title: string; abstract_text: string; mesh_terms: string[] } | null,
  loadingAbstract: false,
  searchGuidelineEvidence: mockSearchGuidelineEvidence,
  searchDrugInteractionEvidence: vi.fn(),
  searchEvidence: vi.fn(),
  fetchAbstract: mockFetchAbstract,
  reset: mockReset,
};

function createMockResult() {
  return {
    articles: [
      {
        pmid: 'PMID-TEST-001',
        title: 'Test Article About Heart Failure Management',
        authors: ['Author Alpha', 'Author Beta', 'Author Gamma', 'Author Delta'],
        journal: 'Test Journal of Medicine',
        publication_date: '2025-01',
        doi: '10.1234/test.2025.001',
      },
      {
        pmid: 'PMID-TEST-002',
        title: 'Secondary Article on Cardiac Care',
        authors: ['Author Epsilon'],
        journal: 'Test Cardiology Review',
        publication_date: '2024-06',
        doi: null,
      },
    ],
    totalResults: 42,
    query: 'heart failure clinical guideline',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchGuidelineEvidence.mockResolvedValue(null);
  mockFetchAbstract.mockResolvedValue(null);
  mockHookReturn = {
    status: 'idle',
    result: null,
    error: null,
    selectedAbstract: null,
    loadingAbstract: false,
    searchGuidelineEvidence: mockSearchGuidelineEvidence,
    searchDrugInteractionEvidence: vi.fn(),
    searchEvidence: vi.fn(),
    fetchAbstract: mockFetchAbstract,
    reset: mockReset,
  };
});

// =====================================================
// Tests
// =====================================================

describe('PubMedEvidencePanel', () => {
  describe('Collapsed/Expanded behavior', () => {
    it('starts collapsed by default and shows header', () => {
      render(<PubMedEvidencePanel condition="heart failure" />);
      expect(screen.getByText('Supporting Literature')).toBeInTheDocument();
      // Search button should not be visible when collapsed
      expect(screen.queryByRole('button', { name: /find literature/i })).not.toBeInTheDocument();
    });

    it('starts expanded when collapsed=false', () => {
      render(<PubMedEvidencePanel condition="heart failure" collapsed={false} />);
      expect(screen.getByRole('button', { name: /find literature/i })).toBeInTheDocument();
    });

    it('toggles open/closed on header click', () => {
      render(<PubMedEvidencePanel condition="heart failure" />);
      const header = screen.getByText('Supporting Literature');
      fireEvent.click(header);
      expect(screen.getByRole('button', { name: /find literature/i })).toBeInTheDocument();
      fireEvent.click(header);
      expect(screen.queryByRole('button', { name: /find literature/i })).not.toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('displays the search condition', () => {
      render(<PubMedEvidencePanel condition="diabetes mellitus" collapsed={false} />);
      expect(screen.getByText('diabetes mellitus')).toBeInTheDocument();
    });

    it('displays guideline org when provided', () => {
      render(
        <PubMedEvidencePanel condition="hypertension" guidelineOrg="AHA" collapsed={false} />
      );
      expect(screen.getByText('(AHA)')).toBeInTheDocument();
    });

    it('calls searchGuidelineEvidence on button click', async () => {
      render(<PubMedEvidencePanel condition="heart failure" guidelineOrg="ACC" collapsed={false} />);
      const searchBtn = screen.getByRole('button', { name: /find literature/i });
      fireEvent.click(searchBtn);
      await waitFor(() => {
        expect(mockSearchGuidelineEvidence).toHaveBeenCalledWith('heart failure', 'ACC', 5);
      });
    });

    it('passes custom maxResults to search', async () => {
      render(
        <PubMedEvidencePanel condition="COPD" collapsed={false} maxResults={10} />
      );
      fireEvent.click(screen.getByRole('button', { name: /find literature/i }));
      await waitFor(() => {
        expect(mockSearchGuidelineEvidence).toHaveBeenCalledWith('COPD', undefined, 10);
      });
    });
  });

  describe('Results display', () => {
    it('shows article cards with title, journal, date, and PMID', () => {
      mockHookReturn.status = 'loaded';
      mockHookReturn.result = createMockResult();

      render(<PubMedEvidencePanel condition="heart failure" collapsed={false} />);
      expect(screen.getByText('Test Article About Heart Failure Management')).toBeInTheDocument();
      expect(screen.getByText('Test Journal of Medicine')).toBeInTheDocument();
      expect(screen.getByText('PMID: PMID-TEST-001')).toBeInTheDocument();
    });

    it('shows truncated author list with "et al." for 4+ authors', () => {
      mockHookReturn.status = 'loaded';
      mockHookReturn.result = createMockResult();

      render(<PubMedEvidencePanel condition="heart failure" collapsed={false} />);
      expect(screen.getByText(/Author Alpha, Author Beta, Author Gamma/)).toBeInTheDocument();
      expect(screen.getByText(/et al\./)).toBeInTheDocument();
    });

    it('shows DOI link only when DOI exists', () => {
      mockHookReturn.status = 'loaded';
      mockHookReturn.result = createMockResult();

      render(<PubMedEvidencePanel condition="heart failure" collapsed={false} />);
      const doiLinks = screen.getAllByText('DOI');
      // First article has DOI, second does not
      expect(doiLinks).toHaveLength(1);
    });

    it('shows result count in header', () => {
      mockHookReturn.status = 'loaded';
      mockHookReturn.result = createMockResult();

      render(<PubMedEvidencePanel condition="heart failure" collapsed={false} />);
      expect(screen.getByText('2 of 42 results')).toBeInTheDocument();
    });
  });

  describe('Abstract viewing', () => {
    it('calls fetchAbstract when View Abstract button is clicked', async () => {
      mockHookReturn.status = 'loaded';
      mockHookReturn.result = createMockResult();

      render(<PubMedEvidencePanel condition="heart failure" collapsed={false} />);
      const abstractBtns = screen.getAllByRole('button', { name: /view abstract/i });
      fireEvent.click(abstractBtns[0]);
      await waitFor(() => {
        expect(mockFetchAbstract).toHaveBeenCalledWith('PMID-TEST-001');
      });
    });

    it('displays abstract text when selectedAbstract is set', () => {
      mockHookReturn.status = 'loaded';
      mockHookReturn.result = createMockResult();
      mockHookReturn.selectedAbstract = {
        title: 'Test Article About Heart Failure Management',
        abstract_text: 'This is the abstract text for the test article about heart failure.',
        mesh_terms: ['Heart Failure', 'Guideline', 'Treatment'],
      };

      render(<PubMedEvidencePanel condition="heart failure" collapsed={false} />);
      expect(screen.getByText(/This is the abstract text/)).toBeInTheDocument();
      expect(screen.getByText('Heart Failure')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('displays error message when search fails', () => {
      mockHookReturn.status = 'error';
      mockHookReturn.error = 'PubMed service unavailable';

      render(<PubMedEvidencePanel condition="heart failure" collapsed={false} />);
      expect(screen.getByText('PubMed service unavailable')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty message when search returns no results', () => {
      mockHookReturn.status = 'loaded';
      mockHookReturn.result = {
        articles: [],
        totalResults: 0,
        query: 'nonexistent condition xyz',
      };

      render(<PubMedEvidencePanel condition="nonexistent" collapsed={false} />);
      expect(screen.getByText('No articles found for this search.')).toBeInTheDocument();
    });
  });
});
