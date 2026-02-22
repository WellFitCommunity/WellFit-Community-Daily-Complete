/**
 * Fetch patient contact graph (caregivers, emergency contacts, providers, care team)
 *
 * Integrates with:
 * - caregiver_access table (community caregivers)
 * - emergency_contacts table
 * - CareTeamService (FHIR care teams → providers + care coordinators)
 *
 * @module patient-context/fetchContacts
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { CareTeamService } from '../fhir/CareTeamService';
import type {
  PatientId,
  PatientContactGraph,
  PatientContact,
  ContactRelationType,
} from '../../types/patientContext';
import type { FHIRCareTeamMember } from '../../types/fhir';
import type { FetchResult } from './types';

// Provider role codes that map to 'providers' array
const PROVIDER_ROLE_CODES = new Set([
  'primary-care-physician',
  'attending-physician',
  'specialist',
  'physician',
  'surgeon',
  'consultant',
  'referring',
  'provider',
]);

// Role codes that map to 'care_team' array
const CARE_TEAM_ROLE_CODES = new Set([
  'care-coordinator',
  'social-worker',
  'nurse',
  'case-manager',
  'pharmacist',
  'therapist',
  'dietitian',
  'chaplain',
]);

/**
 * Map FHIR care team role_code to ContactRelationType
 */
function mapRoleToRelationType(roleCode: string | undefined): ContactRelationType {
  if (!roleCode) return 'other';

  if (roleCode === 'primary-care-physician') return 'primary_care';
  if (roleCode === 'attending-physician') return 'attending_physician';
  if (roleCode === 'specialist' || roleCode === 'consultant') return 'specialist';
  if (roleCode === 'care-coordinator' || roleCode === 'case-manager') return 'care_coordinator';
  if (roleCode === 'social-worker') return 'social_worker';

  if (PROVIDER_ROLE_CODES.has(roleCode)) return 'provider';
  if (CARE_TEAM_ROLE_CODES.has(roleCode)) return 'care_coordinator';

  return 'other';
}

/**
 * Extract phone/email from FHIR telecom array
 */
function extractTelecom(telecom: FHIRCareTeamMember['telecom']): {
  phone: string | null;
  email: string | null;
} {
  let phone: string | null = null;
  let email: string | null = null;

  if (!telecom || !Array.isArray(telecom)) return { phone, email };

  for (const entry of telecom) {
    if (entry.system === 'phone' && entry.value && !phone) {
      phone = entry.value;
    }
    if (entry.system === 'email' && entry.value && !email) {
      email = entry.value;
    }
  }

  return { phone, email };
}

/**
 * Convert a FHIRCareTeamMember to a PatientContact
 */
function memberToContact(member: FHIRCareTeamMember, fetchedAt: string): PatientContact {
  const { phone, email } = extractTelecom(member.telecom);
  const relationship = mapRoleToRelationType(member.role_code);

  return {
    contact_id: member.id ?? '',
    user_id: member.member_user_id ?? null,
    relationship,
    name: member.member_display || 'Unknown Provider',
    phone,
    email,
    permission_level: 'limited_access',
    is_primary: member.is_primary_contact ?? false,
    notifications_enabled: false,
    preferred_contact_method: null,
    notes: member.role_display ?? null,
    created_at: member.created_at ?? fetchedAt,
    updated_at: member.updated_at ?? null,
  };
}

/**
 * Determine if a member is a provider (vs care team support staff)
 */
function isProviderRole(roleCode: string | undefined): boolean {
  return PROVIDER_ROLE_CODES.has(roleCode ?? '');
}

/**
 * Fetch patient contacts including FHIR care team integration
 */
export async function fetchContacts(
  patientId: PatientId
): Promise<FetchResult<PatientContactGraph>> {
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];

  try {
    // Query caregiver_access table for registered caregivers
    const { data: caregiverData, error: caregiverError } = await supabase
      .from('caregiver_access')
      .select('id, caregiver_id, caregiver_name, name, phone, email, is_primary, created_at, updated_at')
      .eq('senior_id', patientId)
      .eq('is_active', true);

    // Query emergency_contacts table if it exists
    const { data: emergencyData } = await supabase
      .from('emergency_contacts')
      .select('id, name, phone, email, is_primary, relationship_to_patient, created_at, updated_at')
      .eq('patient_id', patientId);

    // Transform caregivers
    const caregivers: PatientContact[] = (caregiverData || []).map((row: Record<string, unknown>) => ({
      contact_id: String(row.id ?? ''),
      user_id: String(row.caregiver_id ?? ''),
      relationship: 'caregiver' as ContactRelationType,
      name: String(row.caregiver_name ?? row.name ?? 'Caregiver'),
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      permission_level: 'full_access' as const,
      is_primary: Boolean(row.is_primary ?? false),
      notifications_enabled: true,
      preferred_contact_method: null,
      notes: null,
      created_at: String(row.created_at ?? fetchedAt),
      updated_at: row.updated_at ? String(row.updated_at) : null,
    }));

    // Transform emergency contacts
    const emergencyContacts: PatientContact[] = (emergencyData || []).map((row: Record<string, unknown>) => ({
      contact_id: String(row.id ?? ''),
      user_id: null,
      relationship: 'emergency_contact' as ContactRelationType,
      name: String(row.name ?? 'Emergency Contact'),
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      permission_level: 'emergency_only' as const,
      is_primary: Boolean(row.is_primary ?? false),
      notifications_enabled: true,
      preferred_contact_method: 'phone',
      notes: row.relationship_to_patient ? String(row.relationship_to_patient) : null,
      created_at: String(row.created_at ?? fetchedAt),
      updated_at: row.updated_at ? String(row.updated_at) : null,
    }));

    // Fetch providers + care team from FHIR CareTeamService
    const providers: PatientContact[] = [];
    const careTeamMembers: PatientContact[] = [];

    try {
      const careTeamsResult = await CareTeamService.getActive(patientId);

      if (careTeamsResult.success && careTeamsResult.data) {
        // For each active care team with an ID, get its members
        const teamsWithIds = careTeamsResult.data.filter(
          (team): team is typeof team & { id: string } => typeof team.id === 'string'
        );
        const memberPromises = teamsWithIds.map((team) =>
          CareTeamService.getActiveMembers(team.id)
        );
        const memberResults = await Promise.all(memberPromises);

        for (const memberResult of memberResults) {
          if (!memberResult.success || !memberResult.data) continue;

          for (const member of memberResult.data) {
            const contact = memberToContact(member, fetchedAt);
            if (isProviderRole(member.role_code)) {
              providers.push(contact);
            } else {
              careTeamMembers.push(contact);
            }
          }
        }
      } else if (careTeamsResult.error) {
        warnings.push(`CareTeamService: ${careTeamsResult.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      warnings.push(`CareTeam fetch failed: ${msg}`);
      await auditLogger.warn('PATIENT_CONTEXT_CARE_TEAM_FETCH_FAILED', {
        patientId,
        error: msg,
      });
    }

    const contactGraph: PatientContactGraph = {
      emergency_contacts: emergencyContacts,
      caregivers,
      providers,
      care_team: careTeamMembers,
      summary: {
        total_contacts:
          caregivers.length + emergencyContacts.length + providers.length + careTeamMembers.length,
        active_caregivers: caregivers.length,
        active_providers: providers.length,
      },
    };

    return {
      success: true,
      data: contactGraph,
      source: {
        source: 'caregiver_access + emergency_contacts + fhir_care_teams',
        fetched_at: fetchedAt,
        success: !caregiverError,
        record_count: contactGraph.summary.total_contacts,
        note: warnings.length > 0 ? warnings.join('; ') : (caregiverError ? caregiverError.message : null),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      data: null,
      source: {
        source: 'caregiver_access',
        fetched_at: fetchedAt,
        success: false,
        record_count: 0,
        note: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}
