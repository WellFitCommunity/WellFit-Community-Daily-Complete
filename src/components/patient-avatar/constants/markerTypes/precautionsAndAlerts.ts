/**
 * Precautions, Isolation, Code Status & Alerts Marker Types
 *
 * These are status badges displayed around the avatar (not on body)
 */

import { MarkerTypeDefinition } from '../../../../types/patientAvatar';

/**
 * Safety precautions (fall risk, aspiration, NPO, etc.)
 */
export const PRECAUTION_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'fall_risk',
    display_name: 'Fall Risk',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 5 },
    keywords: ['fall risk', 'falls', 'fall precautions', 'high fall risk'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'fall',
  },
  {
    type: 'aspiration_risk',
    display_name: 'Aspiration Risk',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 15 },
    keywords: ['aspiration risk', 'aspiration precautions', 'dysphagia', 'swallowing difficulty'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'aspiration',
  },
  {
    type: 'npo',
    display_name: 'NPO',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 25 },
    keywords: ['npo', 'nothing by mouth', 'nil per os', 'no food or drink'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'npo',
  },
  {
    type: 'seizure_precautions',
    display_name: 'Seizure Precautions',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 35 },
    keywords: ['seizure precautions', 'seizure risk', 'epilepsy precautions'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'seizure',
  },
  {
    type: 'bleeding_precautions',
    display_name: 'Bleeding Precautions',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 45 },
    keywords: ['bleeding precautions', 'anticoagulated', 'on blood thinners', 'coumadin', 'warfarin', 'eliquis', 'xarelto'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'bleeding',
  },
  {
    type: 'elopement_risk',
    display_name: 'Elopement Risk',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 5, y: 55 },
    keywords: ['elopement risk', 'wandering', 'flight risk', 'wander guard'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'elopement',
  },
];

/**
 * Isolation precautions (color-coded per standard)
 */
export const ISOLATION_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'isolation_contact',
    display_name: 'Contact Isolation',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 5 },
    keywords: ['contact isolation', 'contact precautions', 'mrsa', 'vre', 'c diff', 'cdiff', 'clostridium'],
    is_status_badge: true,
    badge_color: '#eab308', // yellow - standard for contact
    badge_icon: 'isolation_contact',
  },
  {
    type: 'isolation_droplet',
    display_name: 'Droplet Isolation',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 15 },
    keywords: ['droplet isolation', 'droplet precautions', 'flu', 'influenza', 'rsv', 'pertussis', 'meningitis'],
    is_status_badge: true,
    badge_color: '#22c55e', // green - standard for droplet
    badge_icon: 'isolation_droplet',
  },
  {
    type: 'isolation_airborne',
    display_name: 'Airborne Isolation',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 25 },
    keywords: ['airborne isolation', 'airborne precautions', 'tb', 'tuberculosis', 'measles', 'varicella', 'chickenpox', 'covid', 'n95'],
    is_status_badge: true,
    badge_color: '#3b82f6', // blue - standard for airborne
    badge_icon: 'isolation_airborne',
  },
  {
    type: 'isolation_protective',
    display_name: 'Protective Isolation',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 35 },
    keywords: ['protective isolation', 'reverse isolation', 'neutropenic', 'immunocompromised', 'bone marrow transplant'],
    is_status_badge: true,
    badge_color: '#a855f7', // purple - for protective
    badge_icon: 'isolation_protective',
  },
];

/**
 * Code status (resuscitation preferences)
 */
export const CODE_STATUS_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'code_full',
    display_name: 'Full Code',
    category: 'informational',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['full code', 'resuscitate', 'cpr'],
    is_status_badge: true,
    badge_color: '#22c55e', // green
    badge_icon: 'code_full',
  },
  {
    type: 'code_dnr',
    display_name: 'DNR',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['dnr', 'do not resuscitate', 'no cpr', 'no code'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'code_dnr',
  },
  {
    type: 'code_dni',
    display_name: 'DNI',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['dni', 'do not intubate', 'no intubation'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'code_dni',
  },
  {
    type: 'code_dnr_dni',
    display_name: 'DNR/DNI',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['dnr dni', 'dnr/dni', 'no code no intubation'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'code_dnr_dni',
  },
  {
    type: 'code_comfort',
    display_name: 'Comfort Care',
    category: 'informational',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 50, y: 0 },
    keywords: ['comfort care', 'comfort measures', 'cmo', 'hospice', 'palliative', 'end of life'],
    is_status_badge: true,
    badge_color: '#a855f7', // purple
    badge_icon: 'code_comfort',
  },
];

/**
 * Clinical alerts (allergies, difficult airway, etc.)
 */
export const ALERT_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'allergy_alert',
    display_name: 'Allergies',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 50 },
    keywords: ['allergy', 'allergies', 'allergic', 'drug allergy', 'food allergy', 'latex allergy'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'allergy',
  },
  {
    type: 'allergy_latex',
    display_name: 'Latex Allergy',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 60 },
    keywords: ['latex allergy', 'latex sensitive', 'no latex'],
    is_status_badge: true,
    badge_color: '#ef4444', // red
    badge_icon: 'allergy_latex',
  },
  {
    type: 'difficult_airway',
    display_name: 'Difficult Airway',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 70 },
    keywords: ['difficult airway', 'difficult intubation', 'mallampati iv', 'poor visualization'],
    is_status_badge: true,
    badge_color: '#f97316', // orange
    badge_icon: 'difficult_airway',
  },
  {
    type: 'limb_alert',
    display_name: 'Limb Alert',
    category: 'moderate',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 80 },
    keywords: ['limb alert', 'no bp', 'no blood draw', 'lymphedema', 'av fistula protect'],
    is_status_badge: true,
    badge_color: '#eab308', // yellow
    badge_icon: 'limb_alert',
  },
  {
    type: 'difficult_iv_access',
    display_name: 'Difficult IV Access',
    category: 'critical',
    default_body_region: 'badge_area',
    default_body_view: 'front',
    default_position: { x: 95, y: 90 },
    keywords: ['difficult iv', 'hard stick', 'difficult access', 'poor veins', 'dva', 'difficult vascular access'],
    is_status_badge: true,
    badge_color: '#f97316', // orange - matches difficult airway
    badge_icon: 'difficult_iv',
  },
];
