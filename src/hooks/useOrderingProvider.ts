/**
 * useOrderingProvider — resolves the authenticated user's tenant + identity
 * for CPOE order submission (ONC 170.315(a)(1)–(a)(3)).
 *
 * What it does, and why each piece exists:
 *   - tenant_id: RLS on fhir_medication_requests and fhir_service_requests
 *     enforces `tenant_id = get_current_tenant_id()` on INSERT. Without it
 *     every submit gets a 403. This hook fetches it from `profiles.user_id`.
 *   - user_id: ServiceRequest.requester_id (and the FHIR
 *     MedicationRequest.requester_id) point to the ordering provider's
 *     identity. Lost without this. Used directly from auth.uid().
 *   - display_name: human-readable requester name on the order record
 *     (FHIR requester_display). Built from profiles.first_name + last_name.
 *   - practitioner_id: optional. If the user has a fhir_practitioners row
 *     it points there; null for users who haven't been provisioned as
 *     practitioners. Maps to FHIR ServiceRequest.requester_practitioner_id.
 *
 * Loading + error states are returned so the caller can disable the submit
 * button while resolving and surface a useful message if the lookup fails.
 *
 * Usage:
 *   const provider = useOrderingProvider();
 *   if (provider.loading || !provider.tenant_id) {
 *     // disable submit
 *   }
 *   // on submit:
 *   await Service.create({
 *     ...formPayload,
 *     tenant_id: provider.tenant_id,
 *     requester_id: provider.user_id,
 *     requester_display: provider.display_name,
 *     requester_practitioner_id: provider.practitioner_id ?? undefined,
 *   });
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

export interface OrderingProvider {
  loading: boolean;
  error: string | null;
  tenant_id: string | null;
  user_id: string | null;
  display_name: string | null;
  practitioner_id: string | null;
}

const INITIAL: OrderingProvider = {
  loading: true,
  error: null,
  tenant_id: null,
  user_id: null,
  display_name: null,
  practitioner_id: null,
};

export function useOrderingProvider(): OrderingProvider {
  const { user, supabase } = useAuth();
  const [state, setState] = useState<OrderingProvider>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    async function resolve(): Promise<void> {
      if (!user?.id) {
        if (!cancelled) {
          setState({
            loading: false,
            error: 'Not signed in. Sign in as the ordering provider to place orders.',
            tenant_id: null,
            user_id: null,
            display_name: null,
            practitioner_id: null,
          });
        }
        return;
      }

      try {
        const [{ data: profile, error: profileError }, { data: practitioner }] = await Promise.all([
          supabase
            .from('profiles')
            .select('tenant_id, first_name, last_name')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('fhir_practitioners')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (profileError) {
          await auditLogger.error(
            'ORDERING_PROVIDER_LOOKUP_FAILED',
            new Error(profileError.message),
            { userId: user.id }
          );
          setState({
            loading: false,
            error: 'Could not load your profile. Sign out and back in.',
            tenant_id: null,
            user_id: user.id,
            display_name: null,
            practitioner_id: null,
          });
          return;
        }

        if (!profile?.tenant_id) {
          setState({
            loading: false,
            error: 'Your profile is not assigned to a tenant. Contact your administrator.',
            tenant_id: null,
            user_id: user.id,
            display_name: null,
            practitioner_id: null,
          });
          return;
        }

        const first = (profile.first_name ?? '').trim();
        const last = (profile.last_name ?? '').trim();
        const display = [first, last].filter(Boolean).join(' ') || user.email || 'Ordering provider';

        setState({
          loading: false,
          error: null,
          tenant_id: profile.tenant_id,
          user_id: user.id,
          display_name: display,
          practitioner_id: practitioner?.id ?? null,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        await auditLogger.error(
          'ORDERING_PROVIDER_LOOKUP_UNEXPECTED',
          err instanceof Error ? err : new Error(String(err)),
          { userId: user.id }
        );
        setState({
          loading: false,
          error: 'Unexpected error loading your profile. Please try again.',
          tenant_id: null,
          user_id: user.id,
          display_name: null,
          practitioner_id: null,
        });
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  return state;
}
