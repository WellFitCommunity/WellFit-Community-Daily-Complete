/**
 * React Query hooks for Billing Service
 *
 * Provides cached, optimized data fetching for all billing operations.
 * Follows the HIPAA-compliant caching strategy defined in queryClient.ts.
 *
 * @see src/lib/queryClient.ts for cache configuration
 * @see src/services/billingService.ts for underlying data operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BillingService } from '../services/billingService';
import { queryKeys, cacheTime } from '../lib/queryClient';
import type {
  ClaimLine,
  ClaimStatus,
  CodingSuggestion,
  CreateBillingProvider,
  UpdateBillingProvider,
  CreateClaim,
} from '../types/billing';

// ============================================================================
// QUERY HOOKS (Read Operations)
// ============================================================================

/**
 * Get all billing providers
 * Cache: 10 minutes (stable data)
 */
export function useBillingProviders() {
  return useQuery({
    queryKey: queryKeys.billing.all,
    queryFn: () => BillingService.getProviders(),
    ...cacheTime.stable,
  });
}

/**
 * Get a single billing provider by ID
 * Cache: 10 minutes (stable data)
 */
export function useBillingProvider(id: string) {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'provider', id],
    queryFn: () => BillingService.getProvider(id),
    ...cacheTime.stable,
    enabled: !!id, // Only fetch if ID is provided
  });
}

/**
 * Get all billing payers (insurance companies)
 * Cache: 10 minutes (stable data)
 */
export function useBillingPayers() {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'payers'],
    queryFn: () => BillingService.getPayers(),
    ...cacheTime.stable,
  });
}

/**
 * Get a single payer by ID
 * Cache: 10 minutes (stable data)
 */
export function useBillingPayer(id: string) {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'payer', id],
    queryFn: () => BillingService.getPayer(id),
    ...cacheTime.stable,
    enabled: !!id,
  });
}

/**
 * Get a single claim by ID
 * Cache: 5 minutes (frequent updates)
 */
export function useClaim(id: string) {
  return useQuery({
    queryKey: queryKeys.billing.claim(id),
    queryFn: () => BillingService.getClaim(id),
    ...cacheTime.frequent,
    enabled: !!id,
  });
}

/**
 * Get all claims for a specific encounter
 * Cache: 5 minutes (frequent updates)
 */
export function useClaimsByEncounter(encounterId: string) {
  return useQuery({
    queryKey: [...queryKeys.billing.claims(), 'encounter', encounterId],
    queryFn: () => BillingService.getClaimsByEncounter(encounterId),
    ...cacheTime.frequent,
    enabled: !!encounterId,
  });
}

/**
 * Search claims with filters
 * Cache: 5 minutes (frequent updates)
 */
export function useSearchClaims(filters: {
  status?: ClaimStatus;
  providerId?: string;
  payerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...queryKeys.billing.claims(), 'search', filters],
    queryFn: () => BillingService.searchClaims(filters),
    ...cacheTime.frequent,
    enabled: Object.keys(filters).length > 0,
  });
}

/**
 * Get claim lines for a specific claim
 * Cache: 5 minutes (frequent updates)
 */
export function useClaimLines(claimId: string) {
  return useQuery({
    queryKey: [...queryKeys.billing.claim(claimId), 'lines'],
    queryFn: () => BillingService.getClaimLines(claimId),
    ...cacheTime.frequent,
    enabled: !!claimId,
  });
}

/**
 * Get billing metrics (dashboard summary)
 * Cache: 5 minutes (frequent updates)
 *
 * NOTE: This is a heavy operation. Consider using a database view for better performance.
 */
export function useClaimMetrics(providerId?: string) {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'metrics', providerId || 'all'],
    queryFn: () => BillingService.getClaimMetrics(providerId),
    ...cacheTime.frequent,
  });
}

/**
 * Get all fee schedules
 * Cache: 1 hour (static data)
 */
export function useFeeSchedules() {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'feeSchedules'],
    queryFn: () => BillingService.getFeeSchedules(),
    ...cacheTime.static,
  });
}

/**
 * Get fee schedule items for a specific schedule
 * Cache: 1 hour (static data)
 *
 * NOTE: Fee schedules can contain 10,000+ items. Pagination is enforced.
 */
export function useFeeScheduleItems(scheduleId: string) {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'feeSchedule', scheduleId, 'items'],
    queryFn: () => BillingService.getFeeScheduleItems(scheduleId),
    ...cacheTime.static,
    enabled: !!scheduleId,
  });
}

/**
 * Lookup a specific fee from a schedule
 * Cache: 1 hour (static data)
 */
export function useFeeScheduleLookup(
  scheduleId: string,
  codeSystem: 'CPT' | 'HCPCS',
  code: string,
  modifiers?: string[]
) {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'feeLookup', scheduleId, codeSystem, code, modifiers],
    queryFn: () => BillingService.lookupFee(scheduleId, codeSystem, code, modifiers),
    ...cacheTime.static,
    enabled: !!scheduleId && !!code,
  });
}

/**
 * Get coding recommendations for an encounter
 * Cache: 5 minutes (frequent updates)
 */
export function useCodingRecommendations(encounterId: string) {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'codingRecs', encounterId],
    queryFn: () => BillingService.getCodingRecommendations(encounterId),
    ...cacheTime.frequent,
    enabled: !!encounterId,
  });
}

/**
 * Get AI-powered coding suggestions for an encounter
 * Cache: 5 minutes (Edge Function call - cache to reduce costs)
 */
export function useCodingSuggestions(encounterId: string) {
  return useQuery({
    queryKey: [...queryKeys.billing.all, 'codingSuggestions', encounterId],
    queryFn: () => BillingService.getCodingSuggestions(encounterId),
    ...cacheTime.frequent,
    enabled: !!encounterId,
  });
}

// ============================================================================
// MUTATION HOOKS (Write Operations)
// ============================================================================

/**
 * Create a new billing provider
 * Invalidates: billing providers list
 */
export function useCreateBillingProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: CreateBillingProvider) => BillingService.createProvider(provider),
    onSuccess: () => {
      // Invalidate and refetch provider list
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

/**
 * Update an existing billing provider
 * Invalidates: specific provider + providers list
 */
export function useUpdateBillingProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateBillingProvider }) =>
      BillingService.updateProvider(id, updates),
    onSuccess: (data) => {
      // Invalidate specific provider
      queryClient.invalidateQueries({ queryKey: [...queryKeys.billing.all, 'provider', data.id] });
      // Invalidate providers list
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

/**
 * Delete a billing provider
 * Invalidates: providers list
 */
export function useDeleteBillingProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => BillingService.deleteProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
    },
  });
}

/**
 * Create a new claim
 * Invalidates: claims list + metrics
 */
export function useCreateClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (claim: CreateClaim) => BillingService.createClaim(claim),
    onSuccess: (data) => {
      // Invalidate claims queries
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.claims() });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: [...queryKeys.billing.all, 'metrics'] });
      // Invalidate encounter-specific claims if encounter_id present
      if (data.encounter_id) {
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.billing.claims(), 'encounter', data.encounter_id],
        });
      }
    },
  });
}

/**
 * Update claim status
 * Invalidates: specific claim + claims list + metrics
 */
export function useUpdateClaimStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ claimId, status, note }: { claimId: string; status: ClaimStatus; note?: string }) =>
      BillingService.updateClaimStatus(claimId, status, note),
    onSuccess: (data) => {
      // Invalidate specific claim
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.claim(data.id) });
      // Invalidate claims list
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.claims() });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: [...queryKeys.billing.all, 'metrics'] });
    },
  });
}

/**
 * Add a claim line item
 * Invalidates: claim lines + specific claim
 */
export function useAddClaimLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (claimLine: Omit<ClaimLine, 'id' | 'created_at' | 'updated_at'>) =>
      BillingService.addClaimLine(claimLine),
    onSuccess: (data) => {
      // Invalidate claim lines for this claim
      queryClient.invalidateQueries({ queryKey: [...queryKeys.billing.claim(data.claim_id), 'lines'] });
      // Invalidate the claim itself (totals may have changed)
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.claim(data.claim_id) });
    },
  });
}

/**
 * Generate X12 claim file
 * No invalidation needed (read-only operation)
 */
export function useGenerateX12Claim() {
  return useMutation({
    mutationFn: ({ encounterId, billingProviderId }: { encounterId: string; billingProviderId: string }) =>
      BillingService.generateX12Claim(encounterId, billingProviderId),
  });
}

/**
 * Save a coding recommendation
 * Invalidates: coding recommendations for encounter
 */
export function useSaveCodingRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      encounterId,
      patientId,
      suggestion,
      confidence,
    }: {
      encounterId: string;
      patientId: string | null;
      suggestion: CodingSuggestion;
      confidence?: number;
    }) => BillingService.saveCodingRecommendation(encounterId, patientId, suggestion, confidence),
    onSuccess: (data) => {
      // Invalidate coding recommendations for this encounter
      queryClient.invalidateQueries({ queryKey: [...queryKeys.billing.all, 'codingRecs', data.encounter_id] });
    },
  });
}

/**
 * Create a clearinghouse batch
 * Invalidates: batches list (if we add batch queries later)
 */
export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchRef: string) => BillingService.createBatch(batchRef),
    onSuccess: () => {
      // Future: invalidate batches list when we add batch queries
      queryClient.invalidateQueries({ queryKey: [...queryKeys.billing.all, 'batches'] });
    },
  });
}

/**
 * Add claim to a batch
 * Invalidates: specific batch + claim
 */
export function useAddClaimToBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, claimId, stControlNumber }: { batchId: string; claimId: string; stControlNumber?: string }) =>
      BillingService.addClaimToBatch(batchId, claimId, stControlNumber),
    onSuccess: (_, variables) => {
      // Invalidate batch
      queryClient.invalidateQueries({ queryKey: [...queryKeys.billing.all, 'batch', variables.batchId] });
      // Invalidate claim (status may have changed)
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.claim(variables.claimId) });
    },
  });
}

/**
 * Update batch status
 * Invalidates: specific batch
 */
export function useUpdateBatchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, status }: { batchId: string; status: string }) =>
      BillingService.updateBatchStatus(batchId, status as any),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.billing.all, 'batch', variables.batchId] });
    },
  });
}
