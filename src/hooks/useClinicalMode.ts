/**
 * useClinicalMode Hook
 *
 * Determines if the current user should see clinical (Envision Atlus) features
 * vs community (WellFit) features.
 *
 * Clinical users: Physicians, nurses, NPs, PAs, admin, staff, care coordinators
 * Community users: Seniors, patients, caregivers
 *
 * This separation ensures:
 * - Seniors don't see clinical search bars, voice commands, patient banners
 * - Clinical staff get full Envision Atlus experience
 * - Caregivers get a middle-ground (can view but not clinical features)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useMemo, useState, useEffect } from 'react';
import { useAuth, useSupabaseClient, useUser } from '../contexts/AuthContext';

// Role codes that indicate clinical access
const CLINICAL_ROLE_CODES = new Set([
  1,  // admin
  2,  // super_admin
  3,  // staff
  8,  // physician
  9,  // nurse
  10, // nurse_practitioner
  11, // physician_assistant
  12, // contractor_nurse
  13, // care_coordinator
  14, // clinical_staff
  15, // social_worker
  16, // case_manager
  17, // physical_therapist
  18, // occupational_therapist
  19, // speech_therapist
  20, // pharmacist
  21, // dietitian
  22, // respiratory_therapist
  23, // lab_tech
  24, // radiology_tech
  25, // medical_assistant
]);

// Role names that indicate clinical access
const CLINICAL_ROLE_NAMES = new Set([
  'admin',
  'super_admin',
  'staff',
  'physician',
  'nurse',
  'nurse_practitioner',
  'physician_assistant',
  'care_coordinator',
  'clinical_staff',
  'social_worker',
  'case_manager',
  'physical_therapist',
  'occupational_therapist',
  'speech_therapist',
  'pharmacist',
  'dietitian',
  'respiratory_therapist',
  'lab_tech',
  'radiology_tech',
  'medical_assistant',
  'it_admin',
  'billing_admin',
]);

// Community roles (seniors, patients, caregivers)
const COMMUNITY_ROLE_CODES = new Set([
  4,  // senior
  5,  // patient
  6,  // caregiver
  7,  // family_member
]);

export interface ClinicalModeInfo {
  /** True if user should see Envision Atlus clinical features */
  isClinical: boolean;
  /** True if user is a community member (senior, patient, caregiver) */
  isCommunity: boolean;
  /** True if user is a caregiver (special middle-ground access) */
  isCaregiver: boolean;
  /** True if user is admin or super_admin */
  isAdmin: boolean;
  /** User's role name */
  role: string | null;
  /** User's role code */
  roleCode: number | null;
  /** Loading state while fetching profile */
  loading: boolean;
}

interface ProfileData {
  role?: string | null;
  role_code?: number | null;
  is_admin?: boolean | null;
}

export function useClinicalMode(): ClinicalModeInfo {
  const { isAdmin: authIsAdmin } = useAuth();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile on mount/user change
  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, role_code, is_admin')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setProfile(null);
        } else {
          setProfile(data);
        }
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, supabase]);

  return useMemo(() => {
    // Default to NOT showing clinical features until we know
    if (loading || !profile) {
      return {
        isClinical: authIsAdmin, // Use auth context admin as fallback
        isCommunity: false,
        isCaregiver: false,
        isAdmin: authIsAdmin,
        role: null,
        roleCode: null,
        loading,
      };
    }

    const roleCode = profile.role_code ?? null;
    const roleName = (profile.role ?? '').toLowerCase().trim();
    const isAdmin = profile.is_admin === true || authIsAdmin || roleName === 'admin' || roleName === 'super_admin';

    // Check if clinical by role code or role name
    const isClinicalByCode = roleCode !== null && CLINICAL_ROLE_CODES.has(roleCode);
    const isClinicalByName = CLINICAL_ROLE_NAMES.has(roleName);
    const isClinical = isClinicalByCode || isClinicalByName || isAdmin;

    // Check if community user
    const isCommunityByCode = roleCode !== null && COMMUNITY_ROLE_CODES.has(roleCode);
    const isCommunityByName = ['senior', 'patient', 'caregiver', 'family_member'].includes(roleName);
    const isCommunity = isCommunityByCode || isCommunityByName;

    // Check if caregiver specifically
    const isCaregiver = roleName === 'caregiver' || roleCode === 6;

    return {
      isClinical,
      isCommunity,
      isCaregiver,
      isAdmin,
      role: profile.role ?? null,
      roleCode,
      loading: false,
    };
  }, [profile, authIsAdmin, loading]);
}

export default useClinicalMode;
