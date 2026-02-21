/**
 * Tests for usePubMedEvidence hook
 *
 * Tests PubMed literature search for drug interactions,
 * clinical guidelines, abstract fetching, and state management.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePubMedEvidence } from '../usePubMedEvidence';

// Mock the PubMed MCP client
vi.mock('../../services/mcp/mcpPubMedClient', () => ({
  searchPubMed: vi.fn(),
  getArticleAbstract: vi.fn(),
}));

// Mock audit logger
vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  searchPubMed,
  getArticleAbstract,
} from '../../services/mcp/mcpPubMedClient';

const mockSearch = vi.mocked(searchPubMed);
const mockAbstract = vi.mocked(getArticleAbstract);

describe('usePubMedEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => usePubMedEvidence());

    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.selectedAbstract).toBeNull();
  });

  it('searches for drug interaction evidence and returns articles', async () => {
    mockSearch.mockResolvedValue({
      success: true,
      data: {
        articles: [
          {
            pmid: '12345678',
            title: 'Warfarin-Aspirin Interaction: A Meta-Analysis',
            authors: ['Smith J', 'Doe A', 'Lee B'],
            journal: 'J Clin Pharmacol',
            publication_date: '2024-01-15',
            doi: '10.1234/test',
          },
          {
            pmid: '87654321',
            title: 'Anticoagulant-NSAID Drug Interactions in Elderly',
            authors: ['Johnson K'],
            journal: 'Br J Clin Pharmacol',
            publication_date: '2023-08-20',
          },
        ],
        total_results: 42,
        query: '"warfarin" AND "aspirin" AND (drug interaction OR adverse effect)',
      },
    });

    const { result } = renderHook(() => usePubMedEvidence());

    let evidence: unknown;
    await act(async () => {
      evidence = await result.current.searchDrugInteractionEvidence('warfarin', 'aspirin');
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.result?.articles).toHaveLength(2);
    expect(result.current.result?.totalResults).toBe(42);
    expect(evidence).toBeTruthy();
    expect(mockSearch).toHaveBeenCalledWith(
      '"warfarin" AND "aspirin" AND (drug interaction OR adverse effect)',
      { maxResults: 5, sort: 'relevance' }
    );
  });

  it('searches for clinical guideline evidence', async () => {
    mockSearch.mockResolvedValue({
      success: true,
      data: {
        articles: [
          {
            pmid: '33333333',
            title: 'AHA/ACC Hypertension Guidelines 2017',
            authors: ['Whelton P'],
            journal: 'J Am Coll Cardiol',
            publication_date: '2017-11-13',
          },
        ],
        total_results: 15,
        query: 'Hypertension AND clinical guideline AND ACC',
      },
    });

    const { result } = renderHook(() => usePubMedEvidence());

    await act(async () => {
      await result.current.searchGuidelineEvidence('Hypertension', 'ACC');
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.result?.articles).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith(
      'Hypertension AND clinical guideline AND ACC',
      { maxResults: 5, sort: 'relevance' }
    );
  });

  it('fetches article abstract by PMID', async () => {
    mockAbstract.mockResolvedValue({
      success: true,
      data: {
        pmid: '12345678',
        title: 'Test Article',
        abstract_text: 'This study demonstrates that...',
        mesh_terms: ['Drug Interactions', 'Warfarin'],
      },
    });

    const { result } = renderHook(() => usePubMedEvidence());

    let abstractData: unknown;
    await act(async () => {
      abstractData = await result.current.fetchAbstract('12345678');
    });

    expect(abstractData).toBeTruthy();
    expect(result.current.selectedAbstract?.pmid).toBe('12345678');
    expect(result.current.selectedAbstract?.abstract_text).toContain('This study');
    expect(mockAbstract).toHaveBeenCalledWith('12345678');
  });

  it('handles search failure gracefully', async () => {
    mockSearch.mockResolvedValue({
      success: false,
      error: 'PubMed API unavailable',
    });

    const { result } = renderHook(() => usePubMedEvidence());

    await act(async () => {
      await result.current.searchEvidence('test query');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('PubMed API unavailable');
  });

  it('handles network exception gracefully', async () => {
    mockSearch.mockRejectedValue(new Error('Network timeout'));

    const { result } = renderHook(() => usePubMedEvidence());

    await act(async () => {
      await result.current.searchDrugInteractionEvidence('drug1', 'drug2');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('Network timeout');
  });

  it('returns null for empty query', async () => {
    const { result } = renderHook(() => usePubMedEvidence());

    let evidence: unknown;
    await act(async () => {
      evidence = await result.current.searchEvidence('');
    });

    expect(evidence).toBeNull();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('resets all state to idle', async () => {
    mockSearch.mockResolvedValue({
      success: true,
      data: { articles: [], total_results: 0, query: 'test' },
    });

    const { result } = renderHook(() => usePubMedEvidence());

    await act(async () => {
      await result.current.searchEvidence('test');
    });
    expect(result.current.status).not.toBe('idle');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.selectedAbstract).toBeNull();
  });
});
