/**
 * ClinicalPatientBanner.tsx
 *
 * Wrapper for EAPatientBanner that only shows for clinical users.
 * Non-clinical users (seniors, patients, caregivers) do not see the patient banner.
 *
 * ATLUS: Unity - Patient context persists across all clinical dashboards
 */

import React from 'react';

// Patient Banner Component
import { EAPatientBanner } from '../envision-atlus/EAPatientBanner';

// Clinical Mode Hook
import { useClinicalMode } from '../../hooks/useClinicalMode';

interface ClinicalPatientBannerProps {
  className?: string;
}

/**
 * Clinical Patient Banner Wrapper
 * Only shows patient banner for clinical users (outside AuthGate for layout purposes)
 */
export function ClinicalPatientBanner({ className }: ClinicalPatientBannerProps): React.ReactElement | null {
  const { isClinical, loading } = useClinicalMode();

  if (loading || !isClinical) {
    return null;
  }

  return <EAPatientBanner className={className} />;
}

export default ClinicalPatientBanner;
