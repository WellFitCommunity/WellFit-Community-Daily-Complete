/**
 * usePregnancyAvatar - Hook for pregnancy-specific avatar data
 *
 * Fetches active pregnancy from LaborDeliveryService, computes trimester
 * from EDD, and auto-generates OB status markers from pregnancy data.
 */

import { useState, useEffect, useCallback } from 'react';
import { LaborDeliveryService } from '../../../services/laborDelivery';
import { calculateGestationalAge } from '../../../types/laborDelivery';
import type { LDPregnancy } from '../../../types/laborDelivery';
import type { PregnancyAvatarContext, PatientMarker } from '../../../types/patientAvatar';
import { auditLogger } from '../../../services/auditLogger';

interface UsePregnancyAvatarResult {
  pregnancyContext: PregnancyAvatarContext | null;
  trimester: 1 | 2 | 3 | null;
  obStatusMarkers: Partial<PatientMarker>[];
  loading: boolean;
  error: string | null;
}

function deriveTrimester(weeks: number): 1 | 2 | 3 {
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

function buildObStatusMarkers(pregnancy: LDPregnancy): Partial<PatientMarker>[] {
  const markers: Partial<PatientMarker>[] = [];

  // OB Risk Level badge
  if (pregnancy.risk_level !== 'low') {
    markers.push({
      marker_type: 'ob_risk_level',
      display_name: `OB Risk: ${pregnancy.risk_level.toUpperCase()}`,
      category: 'obstetric',
      body_region: 'badge_area',
      body_view: 'front',
      is_active: true,
      status: 'confirmed',
      source: 'import',
      details: {
        notes: `Risk factors: ${pregnancy.risk_factors.join(', ') || 'None documented'}`,
      },
    });
  }

  // GBS Positive badge
  if (pregnancy.gbs_status === 'positive') {
    markers.push({
      marker_type: 'gbs_positive',
      display_name: 'GBS Positive',
      category: 'obstetric',
      body_region: 'badge_area',
      body_view: 'front',
      is_active: true,
      status: 'confirmed',
      source: 'import',
      details: {
        notes: 'IV antibiotics required during labor (penicillin G preferred)',
      },
    });
  }

  return markers;
}

export function usePregnancyAvatar(
  patientId: string,
  tenantId: string
): UsePregnancyAvatarResult {
  const [pregnancyContext, setPregnancyContext] = useState<PregnancyAvatarContext | null>(null);
  const [trimester, setTrimester] = useState<1 | 2 | 3 | null>(null);
  const [obStatusMarkers, setObStatusMarkers] = useState<Partial<PatientMarker>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPregnancy = useCallback(async () => {
    if (!patientId || !tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await LaborDeliveryService.getActivePregnancy(patientId, tenantId);

      if (!result.success || !result.data) {
        setPregnancyContext(null);
        setTrimester(null);
        setObStatusMarkers([]);
        setLoading(false);
        return;
      }

      const pregnancy = result.data;
      const ga = calculateGestationalAge(pregnancy.edd);
      const derivedTrimester = deriveTrimester(ga.weeks);

      const context: PregnancyAvatarContext = {
        pregnancyId: pregnancy.id,
        trimester: derivedTrimester,
        gestationalAgeWeeks: ga.weeks,
        gestationalAgeDays: ga.days,
        edd: pregnancy.edd,
        riskLevel: pregnancy.risk_level,
        gbsStatus: pregnancy.gbs_status,
        gravida: pregnancy.gravida,
        para: pregnancy.para,
        bloodType: pregnancy.blood_type,
        rhFactor: pregnancy.rh_factor,
      };

      setPregnancyContext(context);
      setTrimester(derivedTrimester);
      setObStatusMarkers(buildObStatusMarkers(pregnancy));
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('PREGNANCY_AVATAR_FETCH_ERROR', errorObj, { patientId });
      setError(errorObj.message);
    } finally {
      setLoading(false);
    }
  }, [patientId, tenantId]);

  useEffect(() => {
    fetchPregnancy();
  }, [fetchPregnancy]);

  return { pregnancyContext, trimester, obStatusMarkers, loading, error };
}

export default usePregnancyAvatar;
