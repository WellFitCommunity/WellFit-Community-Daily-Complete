/**
 * ClinicalPatientBanner.tsx
 *
 * Wrapper for EAPatientBanner that only shows for clinical users on clinical routes.
 * Non-clinical users (seniors, patients, caregivers) do not see the patient banner.
 * Clinical users on community routes (e.g. admins browsing WellFit pages) also do not see it.
 *
 * ATLUS: Unity - Patient context persists across all clinical dashboards
 * Boundary: Route-based gate ensures avatar never leaks into WellFit community UI
 */

import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

// Patient Banner Component
import { EAPatientBanner } from '../envision-atlus/EAPatientBanner';

// Clinical Mode Hook
import { useClinicalMode } from '../../hooks/useClinicalMode';

// Route configuration for category lookup
import { allRoutes } from '../../routes/routeConfig';
import type { RouteCategory } from '../../routes/routeConfig';

/** Route categories where the clinical patient banner should be visible */
const CLINICAL_CATEGORIES: ReadonlySet<RouteCategory> = new Set([
  'admin',
  'superAdmin',
  'clinical',
  'workflow',
]);

/**
 * Build a lookup of route paths → categories from routeConfig.
 * Handles parameterized routes by stripping :param segments for prefix matching.
 */
function buildRouteCategoryMap(): Map<string, RouteCategory> {
  const map = new Map<string, RouteCategory>();
  for (const route of allRoutes) {
    // Store exact path for static routes
    map.set(route.path, route.category);
    // Also store the prefix for parameterized routes (e.g. /patient-avatar/:patientId → /patient-avatar)
    const paramIndex = route.path.indexOf('/:');
    if (paramIndex > 0) {
      map.set(route.path.substring(0, paramIndex), route.category);
    }
  }
  return map;
}

const ROUTE_CATEGORY_MAP = buildRouteCategoryMap();

/**
 * Determine if the current pathname is a clinical route.
 * Checks exact match first, then tries prefix matching for parameterized routes.
 */
function isClinicalRoute(pathname: string): boolean {
  // Exact match
  const exactCategory = ROUTE_CATEGORY_MAP.get(pathname);
  if (exactCategory) {
    return CLINICAL_CATEGORIES.has(exactCategory);
  }

  // Prefix match for parameterized routes (e.g. /patient-avatar/abc-123)
  for (const [routePath, category] of ROUTE_CATEGORY_MAP) {
    if (pathname.startsWith(routePath + '/') && CLINICAL_CATEGORIES.has(category)) {
      return true;
    }
  }

  return false;
}

interface ClinicalPatientBannerProps {
  className?: string;
}

/**
 * Clinical Patient Banner Wrapper
 * Only shows patient banner for clinical users on clinical/admin routes.
 * Enforces the WellFit ↔ Envision Atlus product boundary.
 */
export function ClinicalPatientBanner({ className }: ClinicalPatientBannerProps): React.ReactElement | null {
  const { isClinical, loading } = useClinicalMode();
  const { pathname } = useLocation();

  const onClinicalRoute = useMemo(() => isClinicalRoute(pathname), [pathname]);

  // Both conditions must be true: user has clinical role AND is on a clinical route
  if (loading || !isClinical || !onClinicalRoute) {
    return null;
  }

  return <EAPatientBanner className={className} />;
}

export default ClinicalPatientBanner;
