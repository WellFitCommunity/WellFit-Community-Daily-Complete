import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Configuration for WellFit
 *
 * Provides centralized caching and data fetching for Supabase queries.
 * Configured for HIPAA compliance - no sensitive PHI should be cached client-side.
 *
 * Cache Strategy:
 * - Patient metadata (IDs, non-PHI): 10 minutes
 * - User profiles (non-PHI): 10 minutes
 * - Billing summaries: 5 minutes
 * - Real-time vitals: 30 seconds (stale quickly)
 * - Static data (medications list, care plans): 1 hour
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default cache time: 5 minutes (300,000 ms)
      staleTime: 5 * 60 * 1000,

      // Keep unused data in cache for 10 minutes before garbage collection
      gcTime: 10 * 60 * 1000,

      // Retry failed queries 2 times with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,

      // Don't refetch on mount if data is still fresh
      refetchOnMount: false,

      // Don't refetch on reconnect unless stale
      refetchOnReconnect: 'always',

      // Network mode - online by default
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,

      // Network mode for mutations
      networkMode: 'online',
    },
  },
});

/**
 * Query Keys Factory
 *
 * Centralized query key management for consistency and type safety.
 * Following React Query best practices for key structure.
 */
export const queryKeys = {
  // Patient queries
  patient: {
    all: ['patients'] as const,
    lists: () => [...queryKeys.patient.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.patient.lists(), { filters }] as const,
    details: () => [...queryKeys.patient.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.patient.details(), id] as const,
    vitals: (id: string) => [...queryKeys.patient.detail(id), 'vitals'] as const,
    medications: (id: string) => [...queryKeys.patient.detail(id), 'medications'] as const,
    conditions: (id: string) => [...queryKeys.patient.detail(id), 'conditions'] as const,
  },

  // User queries
  user: {
    all: ['users'] as const,
    profile: (id: string) => [...queryKeys.user.all, 'profile', id] as const,
    current: () => [...queryKeys.user.all, 'current'] as const,
  },

  // Billing queries
  billing: {
    all: ['billing'] as const,
    claims: () => [...queryKeys.billing.all, 'claims'] as const,
    claim: (id: string) => [...queryKeys.billing.claims(), id] as const,
    summary: (filters: Record<string, unknown>) => [...queryKeys.billing.all, 'summary', filters] as const,
    revenue: (period: string) => [...queryKeys.billing.all, 'revenue', period] as const,
  },

  // FHIR queries
  fhir: {
    all: ['fhir'] as const,

    // Generic resource queries
    resources: (type: string) => [...queryKeys.fhir.all, type] as const,
    resource: (type: string, id: string) => [...queryKeys.fhir.resources(type), id] as const,

    // MedicationRequest queries
    medicationRequests: () => [...queryKeys.fhir.all, 'medicationRequests'] as const,

    // Condition queries (diagnoses)
    conditions: () => [...queryKeys.fhir.all, 'conditions'] as const,

    // Observation queries (vitals, labs)
    observations: () => [...queryKeys.fhir.all, 'observations'] as const,

    // AllergyIntolerance queries
    allergies: () => [...queryKeys.fhir.all, 'allergies'] as const,

    // Procedure queries
    procedures: () => [...queryKeys.fhir.all, 'procedures'] as const,

    // DiagnosticReport queries
    diagnosticReports: () => [...queryKeys.fhir.all, 'diagnosticReports'] as const,

    // Encounter queries
    encounters: () => [...queryKeys.fhir.all, 'encounters'] as const,

    // Immunization queries
    immunizations: () => [...queryKeys.fhir.all, 'immunizations'] as const,

    // CarePlan queries
    carePlans: () => [...queryKeys.fhir.all, 'carePlans'] as const,

    // Goal queries
    goals: () => [...queryKeys.fhir.all, 'goals'] as const,
  },

  // Wearable queries
  wearable: {
    all: ['wearables'] as const,

    // Device connections
    connections: () => [...queryKeys.wearable.all, 'connections'] as const,

    // Vital signs
    vitals: () => [...queryKeys.wearable.all, 'vitals'] as const,

    // Activity data
    activity: () => [...queryKeys.wearable.all, 'activity'] as const,

    // Fall detection
    falls: () => [...queryKeys.wearable.all, 'falls'] as const,
  },

  // Community queries
  community: {
    all: ['community'] as const,
    moments: () => [...queryKeys.community.all, 'moments'] as const,
    moment: (id: string) => [...queryKeys.community.moments(), id] as const,
    imageUrl: (path: string) => [...queryKeys.community.all, 'imageUrl', path] as const,
  },

  // Admin queries
  admin: {
    all: ['admin'] as const,
    metrics: () => [...queryKeys.admin.all, 'metrics'] as const,
    users: (page: number) => [...queryKeys.admin.all, 'users', page] as const,
    auditLogs: (filters: Record<string, unknown>) => [...queryKeys.admin.all, 'auditLogs', filters] as const,
  },
} as const;

/**
 * Cache Time Presets
 *
 * Use these constants for different data types to ensure consistent caching strategy.
 */
export const cacheTime = {
  // Real-time data - stale quickly, short cache
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  },

  // Frequently updated data - moderate cache
  frequent: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },

  // Stable data - longer cache
  stable: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },

  // Static data - very long cache
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Never cache (use sparingly - for PHI or highly sensitive data)
  never: {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  },
} as const;

/**
 * Utility function to invalidate all queries for a specific patient
 * Useful after patient data mutations (e.g., new vitals, medication changes)
 */
export const invalidatePatientQueries = (patientId: string) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.patient.detail(patientId) });
};

/**
 * Utility function to prefetch patient data
 * Call this when navigating to a patient detail page
 */
export const prefetchPatientData = async (patientId: string) => {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.patient.detail(patientId),
      staleTime: cacheTime.stable.staleTime,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.patient.vitals(patientId),
      staleTime: cacheTime.frequent.staleTime,
    }),
  ]);
};
