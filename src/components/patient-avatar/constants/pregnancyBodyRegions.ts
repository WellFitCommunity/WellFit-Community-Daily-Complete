/**
 * Pregnancy-Specific Body Regions for Patient Avatar
 *
 * Obstetric anatomical regions for marker placement on pregnant body.
 * Uses same BodyRegion interface and center/bounds pattern.
 */

import type { BodyRegion } from '../../../types/patientAvatar';

/**
 * Pregnancy-specific front body regions
 */
export const PREGNANCY_BODY_REGIONS_FRONT: BodyRegion[] = [
  {
    id: 'uterus_fundus',
    label: 'Uterine Fundus',
    view: 'front',
    center: { x: 50, y: 42 },
    bounds: { minX: 38, maxX: 62, minY: 38, maxY: 46 },
  },
  {
    id: 'uterus_body',
    label: 'Uterine Body',
    view: 'front',
    center: { x: 50, y: 50 },
    bounds: { minX: 36, maxX: 64, minY: 44, maxY: 56 },
  },
  {
    id: 'uterus_lower',
    label: 'Lower Uterine Segment',
    view: 'front',
    center: { x: 50, y: 58 },
    bounds: { minX: 40, maxX: 60, minY: 54, maxY: 62 },
  },
  {
    id: 'suprapubic',
    label: 'Suprapubic',
    view: 'front',
    center: { x: 50, y: 62 },
    bounds: { minX: 40, maxX: 60, minY: 59, maxY: 65 },
  },
  {
    id: 'perineum',
    label: 'Perineum',
    view: 'front',
    center: { x: 50, y: 66 },
    bounds: { minX: 44, maxX: 56, minY: 63, maxY: 69 },
  },
];

/**
 * Pregnancy-specific back body regions
 */
export const PREGNANCY_BODY_REGIONS_BACK: BodyRegion[] = [
  {
    id: 'lumbar_spine',
    label: 'Lumbar Spine (Epidural)',
    view: 'back',
    center: { x: 50, y: 52 },
    bounds: { minX: 45, maxX: 55, minY: 48, maxY: 56 },
  },
];

/**
 * All pregnancy-specific body regions
 */
export const ALL_PREGNANCY_BODY_REGIONS: BodyRegion[] = [
  ...PREGNANCY_BODY_REGIONS_FRONT,
  ...PREGNANCY_BODY_REGIONS_BACK,
];
