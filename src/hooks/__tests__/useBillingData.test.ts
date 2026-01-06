/**
 * useBillingData.test.ts - Tests for billing React Query hooks
 *
 * Purpose: Verify data fetching, caching, mutations, and cache invalidation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Use vi.hoisted to define mocks used inside vi.mock factories
const { mockBillingService } = vi.hoisted(() => ({
  mockBillingService: {
    getProviders: vi.fn(),
    getProvider: vi.fn(),
    getPayers: vi.fn(),
    getPayer: vi.fn(),
    getClaim: vi.fn(),
    getClaimsByEncounter: vi.fn(),
    searchClaims: vi.fn(),
    getClaimMetrics: vi.fn(),
    getCodingSuggestions: vi.fn(),
    createProvider: vi.fn(),
    updateClaimStatus: vi.fn(),
  },
}));

vi.mock('../../services/billingService', () => ({
  BillingService: mockBillingService,
}));

import {
  useBillingProviders,
  useBillingProvider,
  useBillingPayers,
  useClaim,
  useClaimsByEncounter,
  useSearchClaims,
  useClaimMetrics,
  useCodingSuggestions,
  useCreateBillingProvider,
  useUpdateClaimStatus,
} from '../useBillingData';

vi.mock('../../lib/queryClient', () => ({
  queryKeys: {
    billing: {
      all: ['billing'],
      claims: () => ['billing', 'claims'],
      claim: (id: string) => ['billing', 'claim', id],
    },
  },
  cacheTime: {
    stable: { staleTime: 10 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
    frequent: { staleTime: 5 * 60 * 1000, cacheTime: 15 * 60 * 1000 },
    static: { staleTime: 60 * 60 * 1000, cacheTime: 24 * 60 * 60 * 1000 },
  },
}));

// Create wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
};

describe('useBillingProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch billing providers', async () => {
    const mockProviders = [
      { id: 'p1', name: 'Provider 1', npi: '1234567890' },
      { id: 'p2', name: 'Provider 2', npi: '0987654321' },
    ];
    mockBillingService.getProviders.mockResolvedValue(mockProviders);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingProviders(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockProviders);
    expect(mockBillingService.getProviders).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch error', async () => {
    mockBillingService.getProviders.mockRejectedValue(new Error('Network error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingProviders(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useBillingProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single provider by ID', async () => {
    const mockProvider = { id: 'p1', name: 'Provider 1', npi: '1234567890' };
    mockBillingService.getProvider.mockResolvedValue(mockProvider);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingProvider('p1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockProvider);
    expect(mockBillingService.getProvider).toHaveBeenCalledWith('p1');
  });

  it('should not fetch when ID is empty', () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useBillingProvider(''), { wrapper: Wrapper });

    expect(mockBillingService.getProvider).not.toHaveBeenCalled();
  });
});

describe('useBillingPayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch billing payers', async () => {
    const mockPayers = [
      { id: 'pay1', name: 'Blue Cross', payer_id: 'BC001' },
      { id: 'pay2', name: 'Aetna', payer_id: 'AET001' },
    ];
    mockBillingService.getPayers.mockResolvedValue(mockPayers);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingPayers(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockPayers);
  });
});

describe('useClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single claim', async () => {
    const mockClaim = {
      id: 'claim1',
      status: 'pending',
      total_amount: 150.0,
    };
    mockBillingService.getClaim.mockResolvedValue(mockClaim);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClaim('claim1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockClaim);
  });

  it('should not fetch when ID is empty', () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useClaim(''), { wrapper: Wrapper });

    expect(mockBillingService.getClaim).not.toHaveBeenCalled();
  });
});

describe('useClaimsByEncounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch claims for an encounter', async () => {
    const mockClaims = [
      { id: 'claim1', encounter_id: 'enc1', status: 'pending' },
      { id: 'claim2', encounter_id: 'enc1', status: 'submitted' },
    ];
    mockBillingService.getClaimsByEncounter.mockResolvedValue(mockClaims);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimsByEncounter('enc1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockClaims);
    expect(mockBillingService.getClaimsByEncounter).toHaveBeenCalledWith('enc1');
  });
});

describe('useSearchClaims', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search claims with filters', async () => {
    const mockResults = [
      { id: 'claim1', status: 'pending' },
    ];
    mockBillingService.searchClaims.mockResolvedValue(mockResults);

    const filters = { status: 'generated' as const, limit: 10 };
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearchClaims(filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockResults);
    expect(mockBillingService.searchClaims).toHaveBeenCalledWith(filters);
  });

  it('should not search when filters are empty', () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useSearchClaims({}), { wrapper: Wrapper });

    expect(mockBillingService.searchClaims).not.toHaveBeenCalled();
  });
});

describe('useClaimMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch claim metrics', async () => {
    const mockMetrics = {
      totalClaims: 100,
      pendingClaims: 25,
      totalBilled: 50000,
      totalPaid: 40000,
    };
    mockBillingService.getClaimMetrics.mockResolvedValue(mockMetrics);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimMetrics(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockMetrics);
  });

  it('should fetch metrics filtered by provider', async () => {
    const mockMetrics = { totalClaims: 50 };
    mockBillingService.getClaimMetrics.mockResolvedValue(mockMetrics);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimMetrics('provider-123'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockBillingService.getClaimMetrics).toHaveBeenCalledWith('provider-123');
  });
});

describe('useCodingSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch AI coding suggestions', async () => {
    const mockSuggestions = {
      icd10: [{ code: 'J06.9', description: 'Acute upper respiratory infection' }],
      cpt: [{ code: '99213', description: 'Office visit' }],
      confidence: 0.85,
    };
    mockBillingService.getCodingSuggestions.mockResolvedValue(mockSuggestions);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCodingSuggestions('enc1'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockSuggestions);
    expect(mockBillingService.getCodingSuggestions).toHaveBeenCalledWith('enc1');
  });
});

describe('useCreateBillingProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new provider', async () => {
    const newProvider = { organization_name: 'New Provider', npi: '1111111111' };
    const createdProvider = { id: 'p-new', ...newProvider };
    mockBillingService.createProvider.mockResolvedValue(createdProvider);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateBillingProvider(), { wrapper: Wrapper });

    let mutationResult;
    await act(async () => {
      mutationResult = await result.current.mutateAsync(newProvider);
    });

    expect(mockBillingService.createProvider).toHaveBeenCalledWith(newProvider);
    expect(mutationResult).toEqual(createdProvider);
  });

  it('should invalidate queries on success', async () => {
    const createdProvider = { id: 'p-new', organization_name: 'New Provider', npi: '1111111111' };
    mockBillingService.createProvider.mockResolvedValue(createdProvider);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateBillingProvider(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ organization_name: 'New Provider', npi: '1111111111' });
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useUpdateClaimStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update claim status', async () => {
    const updatedClaim = { id: 'claim1', status: 'submitted' };
    mockBillingService.updateClaimStatus.mockResolvedValue(updatedClaim);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClaimStatus(), { wrapper: Wrapper });

    let mutationResult;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        claimId: 'claim1',
        status: 'submitted' as const,
        note: 'Submitted to payer',
      });
    });

    expect(mockBillingService.updateClaimStatus).toHaveBeenCalledWith(
      'claim1',
      'submitted',
      'Submitted to payer'
    );
    expect(mutationResult).toEqual(updatedClaim);
  });

  it('should handle mutation error', async () => {
    mockBillingService.updateClaimStatus.mockRejectedValue(new Error('Update failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClaimStatus(), { wrapper: Wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          claimId: 'claim1',
          status: 'submitted' as const,
        });
      })
    ).rejects.toThrow('Update failed');
  });
});
