/**
 * Vascular Access & Vein Access Marker Types
 *
 * Includes: PICC lines, central lines, dialysis access, peripheral IVs,
 * and vein quality/phlebotomy markers
 */

import { MarkerTypeDefinition } from '../../../../types/patientAvatar';

/**
 * Vascular access devices (PICC, central lines, ports, etc.)
 */
export const VASCULAR_ACCESS_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'picc_line',
    display_name: 'PICC Line',
    category: 'moderate',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 22, y: 35 },
    keywords: ['picc', 'picc line', 'peripherally inserted', 'peripherally-inserted'],
    laterality_adjustments: {
      left: { x: 78, y: 35 },
      right: { x: 22, y: 35 },
    },
  },
  {
    type: 'picc_line_double',
    display_name: 'PICC Line (Double Lumen)',
    category: 'moderate',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 22, y: 35 },
    keywords: ['double lumen picc', 'dual lumen picc', '2 lumen picc'],
    laterality_adjustments: {
      left: { x: 78, y: 35 },
      right: { x: 22, y: 35 },
    },
  },
  {
    type: 'picc_line_triple',
    display_name: 'PICC Line (Triple Lumen)',
    category: 'moderate',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 22, y: 35 },
    keywords: ['triple lumen picc', '3 lumen picc'],
    laterality_adjustments: {
      left: { x: 78, y: 35 },
      right: { x: 22, y: 35 },
    },
  },
  {
    type: 'central_line_subclavian',
    display_name: 'Central Line (Subclavian)',
    category: 'critical',
    default_body_region: 'chest_right',
    default_body_view: 'front',
    default_position: { x: 38, y: 26 },
    keywords: ['subclavian line', 'subclavian cvc', 'subclavian central'],
    laterality_adjustments: {
      left: { x: 62, y: 26 },
      right: { x: 38, y: 26 },
    },
  },
  {
    type: 'central_line_jugular',
    display_name: 'Central Line (Jugular)',
    category: 'critical',
    default_body_region: 'neck',
    default_body_view: 'front',
    default_position: { x: 45, y: 20 },
    keywords: ['jugular line', 'ij line', 'internal jugular', 'jugular cvc'],
    laterality_adjustments: {
      left: { x: 55, y: 20 },
      right: { x: 45, y: 20 },
    },
  },
  {
    type: 'central_line_femoral',
    display_name: 'Central Line (Femoral)',
    category: 'critical',
    default_body_region: 'groin_right',
    default_body_view: 'front',
    default_position: { x: 42, y: 60 },
    keywords: ['femoral line', 'femoral cvc', 'groin line'],
    laterality_adjustments: {
      left: { x: 58, y: 60 },
      right: { x: 42, y: 60 },
    },
  },
  {
    type: 'peripheral_iv',
    display_name: 'Peripheral IV',
    category: 'informational',
    default_body_region: 'hand_right',
    default_body_view: 'front',
    default_position: { x: 10, y: 66 },
    keywords: ['peripheral iv', 'piv', 'iv access', 'iv site'],
    laterality_adjustments: {
      left: { x: 90, y: 66 },
      right: { x: 10, y: 66 },
    },
  },
  {
    type: 'midline_catheter',
    display_name: 'Midline Catheter',
    category: 'moderate',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 22, y: 38 },
    keywords: ['midline', 'midline catheter'],
    laterality_adjustments: {
      left: { x: 78, y: 38 },
      right: { x: 22, y: 38 },
    },
  },
  {
    type: 'port_a_cath',
    display_name: 'Port-a-Cath',
    category: 'informational',
    default_body_region: 'chest_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 28 },
    keywords: ['port', 'port-a-cath', 'portacath', 'implanted port', 'chemo port'],
    laterality_adjustments: {
      left: { x: 60, y: 28 },
      right: { x: 40, y: 28 },
    },
  },
  {
    type: 'dialysis_catheter',
    display_name: 'Dialysis Catheter',
    category: 'critical',
    default_body_region: 'neck',
    default_body_view: 'front',
    default_position: { x: 45, y: 20 },
    keywords: ['dialysis catheter', 'hemodialysis catheter', 'hd catheter', 'permacath', 'tunneled dialysis'],
  },
  {
    type: 'arterial_line',
    display_name: 'Arterial Line',
    category: 'critical',
    default_body_region: 'wrist_right',
    default_body_view: 'front',
    default_position: { x: 12, y: 60 },
    keywords: ['arterial line', 'a-line', 'art line', 'radial artery'],
    laterality_adjustments: {
      left: { x: 88, y: 60 },
      right: { x: 12, y: 60 },
    },
  },
  {
    type: 'av_fistula',
    display_name: 'AV Fistula',
    category: 'moderate',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['av fistula', 'arteriovenous fistula', 'dialysis fistula', 'avf'],
    laterality_adjustments: {
      left: { x: 85, y: 52 },
      right: { x: 15, y: 52 },
    },
  },
];

/**
 * Vein quality and phlebotomy markers
 * Body region arm_lower_left: bounds { minX: 80, maxX: 92, minY: 46, maxY: 58 }
 * Body region arm_lower_right: bounds { minX: 8, maxX: 20, minY: 46, maxY: 58 }
 */
export const VEIN_ACCESS_TYPES: MarkerTypeDefinition[] = [
  // Vein quality markers (anatomical - placed on forearm/AC area)
  {
    type: 'blown_vein',
    display_name: 'Blown Vein',
    category: 'moderate',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 84, y: 50 },
    keywords: ['blown vein', 'infiltrated', 'extravasation', 'failed iv'],
    laterality_adjustments: {
      left: { x: 84, y: 50 },
      right: { x: 16, y: 50 },
    },
  },
  {
    type: 'scarred_vein',
    display_name: 'Scarred Vein',
    category: 'moderate',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 86, y: 52 },
    keywords: ['scarred vein', 'sclerosed', 'fibrotic vein', 'chemo vein', 'iv drug use'],
    laterality_adjustments: {
      left: { x: 86, y: 52 },
      right: { x: 14, y: 52 },
    },
  },
  {
    type: 'preferred_vein',
    display_name: 'Preferred Access Site',
    category: 'informational',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 82, y: 48 },
    keywords: ['preferred vein', 'good vein', 'best access', 'use this vein', 'preferred site'],
    laterality_adjustments: {
      left: { x: 82, y: 48 },
      right: { x: 18, y: 48 },
    },
  },
  {
    type: 'avoid_access',
    display_name: 'Avoid This Arm',
    category: 'critical',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 80, y: 46 },
    keywords: ['avoid arm', 'no access', 'mastectomy side', 'lymph node dissection', 'lymphedema arm', 'fistula arm', 'shunt arm'],
    laterality_adjustments: {
      left: { x: 80, y: 46 },
      right: { x: 20, y: 46 },
    },
  },
  {
    type: 'rolling_veins',
    display_name: 'Rolling Veins',
    category: 'moderate',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 85, y: 51 },
    keywords: ['rolling veins', 'mobile veins', 'veins roll', 'slippery veins'],
    laterality_adjustments: {
      left: { x: 85, y: 51 },
      right: { x: 15, y: 51 },
    },
  },
  {
    type: 'fragile_veins',
    display_name: 'Fragile Veins',
    category: 'moderate',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 83, y: 49 },
    keywords: ['fragile veins', 'elderly veins', 'thin veins', 'bruise easily', 'steroid skin'],
    laterality_adjustments: {
      left: { x: 83, y: 49 },
      right: { x: 17, y: 49 },
    },
  },
  // Access equipment requirements
  {
    type: 'ultrasound_guided',
    display_name: 'Ultrasound Guided Access Required',
    category: 'critical',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 81, y: 47 },
    keywords: ['ultrasound guided', 'us guided', 'ultrasound iv', 'blind stick failed', 'deep veins'],
    laterality_adjustments: {
      left: { x: 81, y: 47 },
      right: { x: 19, y: 47 },
    },
  },
  {
    type: 'vein_finder',
    display_name: 'Vein Finder Recommended',
    category: 'moderate',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 84, y: 53 },
    keywords: ['vein finder', 'accuvein', 'vein light', 'nir', 'near infrared'],
    laterality_adjustments: {
      left: { x: 84, y: 53 },
      right: { x: 16, y: 53 },
    },
  },
  {
    type: 'small_gauge_needle',
    display_name: 'Small Gauge Needle Required',
    category: 'moderate',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 86, y: 55 },
    keywords: ['small gauge', 'butterfly', 'pediatric needle', '23 gauge', '25 gauge', 'small veins'],
    laterality_adjustments: {
      left: { x: 86, y: 55 },
      right: { x: 14, y: 55 },
    },
  },
  {
    type: 'warm_compress_first',
    display_name: 'Warm Compress First',
    category: 'informational',
    default_body_region: 'arm_lower_left',
    default_body_view: 'front',
    default_position: { x: 88, y: 57 },
    keywords: ['warm compress', 'heat pack', 'warm arm first', 'vasodilate'],
    laterality_adjustments: {
      left: { x: 88, y: 57 },
      right: { x: 12, y: 57 },
    },
  },
  // Special access notes
  // Body region hand_left: bounds { minX: 85, maxX: 96, minY: 62, maxY: 72 }
  {
    type: 'hand_veins_only',
    display_name: 'Hand Veins Only',
    category: 'moderate',
    default_body_region: 'hand_left',
    default_body_view: 'front',
    default_position: { x: 90, y: 66 },
    keywords: ['hand veins', 'dorsal hand', 'hand only', 'no ac veins'],
    laterality_adjustments: {
      left: { x: 90, y: 66 },
      right: { x: 10, y: 66 },
    },
  },
  // Body region foot_left: bounds { minX: 48, maxX: 62, minY: 96, maxY: 100 }
  {
    type: 'foot_veins_backup',
    display_name: 'Foot Veins (Backup)',
    category: 'moderate',
    default_body_region: 'foot_left',
    default_body_view: 'front',
    default_position: { x: 55, y: 98 },
    keywords: ['foot veins', 'pedal veins', 'saphenous', 'foot access'],
    laterality_adjustments: {
      left: { x: 55, y: 98 },
      right: { x: 45, y: 98 },
    },
  },
  // Body region neck: bounds { minX: 45, maxX: 55, minY: 17, maxY: 23 }
  {
    type: 'external_jugular_backup',
    display_name: 'External Jugular (Last Resort)',
    category: 'critical',
    default_body_region: 'neck',
    default_body_view: 'front',
    default_position: { x: 43, y: 19 },
    keywords: ['ej', 'external jugular', 'neck access', 'ej access'],
    laterality_adjustments: {
      left: { x: 43, y: 19 },
      right: { x: 57, y: 19 },
    },
  },
];
