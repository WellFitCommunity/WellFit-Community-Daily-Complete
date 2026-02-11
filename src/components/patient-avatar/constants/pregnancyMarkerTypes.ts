/**
 * Pregnancy-Specific Marker Types for Patient Avatar
 *
 * Obstetric anatomical markers and status badges for L&D visualization.
 * All markers use category: 'obstetric' (pink #ec4899).
 */

import type { MarkerTypeDefinition } from '../../../types/patientAvatar';

// ============================================================================
// OBSTETRIC ANATOMICAL MARKERS (placed on body)
// ============================================================================

export const OBSTETRIC_ANATOMICAL_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'efm_external',
    display_name: 'External Fetal Monitor',
    category: 'obstetric',
    default_body_region: 'uterus_body',
    default_body_view: 'front',
    default_position: { x: 50, y: 52 },
    keywords: ['efm', 'external fetal monitor', 'toco', 'tocodynamometer', 'nst', 'non stress test'],
    icd10: 'Z36.89',
  },
  {
    type: 'ifm_internal',
    display_name: 'Internal Fetal Monitor (FSE)',
    category: 'obstetric',
    default_body_region: 'uterus_lower',
    default_body_view: 'front',
    default_position: { x: 50, y: 58 },
    keywords: ['ifm', 'internal fetal monitor', 'fse', 'fetal scalp electrode', 'iupc'],
  },
  {
    type: 'epidural_catheter',
    display_name: 'Epidural Catheter',
    category: 'obstetric',
    default_body_region: 'lumbar_spine',
    default_body_view: 'back',
    default_position: { x: 50, y: 52 },
    keywords: ['epidural', 'epidural catheter', 'lumbar epidural', 'labor epidural'],
  },
  {
    type: 'spinal_block',
    display_name: 'Spinal Block',
    category: 'obstetric',
    default_body_region: 'lumbar_spine',
    default_body_view: 'back',
    default_position: { x: 50, y: 54 },
    keywords: ['spinal block', 'spinal anesthesia', 'intrathecal', 'cse', 'combined spinal epidural'],
  },
  {
    type: 'cesarean_incision',
    display_name: 'Cesarean Incision',
    category: 'obstetric',
    default_body_region: 'suprapubic',
    default_body_view: 'front',
    default_position: { x: 50, y: 62 },
    keywords: ['cesarean incision', 'c-section incision', 'pfannenstiel', 'low transverse incision'],
    icd10: 'O82',
  },
  {
    type: 'ob_iv_access',
    display_name: 'IV Access (L&D)',
    category: 'obstetric',
    default_body_region: 'hand_left',
    default_body_view: 'front',
    default_position: { x: 90, y: 66 },
    keywords: ['labor iv', 'ob iv', 'delivery iv', 'pitocin iv', 'oxytocin iv'],
    laterality_adjustments: {
      left: { x: 90, y: 66 },
      right: { x: 10, y: 66 },
    },
  },
  {
    type: 'ob_foley_catheter',
    display_name: 'Foley Catheter (L&D)',
    category: 'obstetric',
    default_body_region: 'suprapubic',
    default_body_view: 'front',
    default_position: { x: 50, y: 60 },
    keywords: ['foley labor', 'ob foley', 'urinary catheter delivery', 'foley bulb', 'cervical ripening foley'],
  },
  {
    type: 'cervical_ripening',
    display_name: 'Cervical Ripening Agent',
    category: 'obstetric',
    default_body_region: 'uterus_lower',
    default_body_view: 'front',
    default_position: { x: 50, y: 60 },
    keywords: ['cervical ripening', 'cervidil', 'cytotec', 'misoprostol', 'dinoprostone', 'cook balloon'],
  },
  {
    type: 'amniotomy_site',
    display_name: 'Amniotomy Site',
    category: 'obstetric',
    default_body_region: 'uterus_lower',
    default_body_view: 'front',
    default_position: { x: 50, y: 58 },
    keywords: ['amniotomy', 'arom', 'artificial rupture', 'amnihook'],
  },
  {
    type: 'fundal_height_marker',
    display_name: 'Fundal Height',
    category: 'obstetric',
    default_body_region: 'uterus_fundus',
    default_body_view: 'front',
    default_position: { x: 50, y: 42 },
    keywords: ['fundal height', 'fundus', 'uterine fundus'],
  },
  {
    type: 'fetal_presentation',
    display_name: 'Fetal Presentation',
    category: 'obstetric',
    default_body_region: 'uterus_body',
    default_body_view: 'front',
    default_position: { x: 50, y: 50 },
    keywords: ['fetal presentation', 'vertex', 'breech', 'transverse lie', 'cephalic'],
  },
];

// ============================================================================
// OBSTETRIC STATUS BADGES (displayed around avatar ring)
// ============================================================================

export const OBSTETRIC_BADGE_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'ob_risk_level',
    display_name: 'OB Risk Level',
    category: 'obstetric',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 65 },
    keywords: ['ob risk', 'pregnancy risk', 'maternal risk', 'obstetric risk level'],
    is_status_badge: true,
    badge_color: '#ec4899', // pink
    badge_icon: 'ob_risk',
  },
  {
    type: 'gbs_positive',
    display_name: 'GBS Positive',
    category: 'obstetric',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 75 },
    keywords: ['gbs positive', 'group b strep', 'gbs+', 'group b streptococcus'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'gbs_positive',
  },
  {
    type: 'membranes_ruptured',
    display_name: 'Membranes Ruptured',
    category: 'obstetric',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 85 },
    keywords: ['ruptured membranes', 'rom', 'srom', 'arom', 'water broke', 'pprom'],
    is_status_badge: true,
    badge_color: '#3b82f6', // blue
    badge_icon: 'membranes_ruptured',
  },
  {
    type: 'fhr_category_badge',
    display_name: 'FHR Category',
    category: 'obstetric',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 95 },
    keywords: ['fhr category', 'fetal heart rate category', 'category i', 'category ii', 'category iii'],
    is_status_badge: true,
    badge_color: '#22c55e', // green (default for Cat I, overridden in rendering)
    badge_icon: 'fhr_category',
  },
];

/**
 * All pregnancy marker types combined
 */
export const ALL_PREGNANCY_MARKER_TYPES: MarkerTypeDefinition[] = [
  ...OBSTETRIC_ANATOMICAL_TYPES,
  ...OBSTETRIC_BADGE_TYPES,
];
