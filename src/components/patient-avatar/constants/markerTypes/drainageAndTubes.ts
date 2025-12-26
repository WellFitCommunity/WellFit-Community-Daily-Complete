/**
 * Drainage & Tubes Marker Types
 *
 * Includes: Catheters, chest tubes, drains, NG/G-tubes, tracheostomy
 */

import { MarkerTypeDefinition } from '../../../../types/patientAvatar';

export const DRAINAGE_TUBE_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'foley_catheter',
    display_name: 'Foley Catheter',
    category: 'moderate',
    default_body_region: 'abdomen_lower',
    default_body_view: 'front',
    default_position: { x: 50, y: 58 },
    keywords: ['foley', 'foley catheter', 'urinary catheter', 'indwelling catheter'],
  },
  {
    type: 'suprapubic_catheter',
    display_name: 'Suprapubic Catheter',
    category: 'moderate',
    default_body_region: 'abdomen_lower',
    default_body_view: 'front',
    default_position: { x: 50, y: 55 },
    keywords: ['suprapubic', 'sp catheter', 'suprapubic tube'],
  },
  {
    type: 'chest_tube',
    display_name: 'Chest Tube',
    category: 'critical',
    default_body_region: 'chest_right',
    default_body_view: 'front',
    default_position: { x: 38, y: 35 },
    keywords: ['chest tube', 'thoracostomy', 'pleural drain', 'thoracic drain'],
    laterality_adjustments: {
      left: { x: 62, y: 35 },
      right: { x: 38, y: 35 },
    },
  },
  {
    type: 'jp_drain',
    display_name: 'JP Drain',
    category: 'moderate',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 47 },
    keywords: ['jp drain', 'jackson-pratt', 'jackson pratt', 'bulb drain'],
  },
  {
    type: 'hemovac',
    display_name: 'Hemovac',
    category: 'moderate',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 50 },
    keywords: ['hemovac', 'hemovac drain'],
  },
  {
    type: 'penrose_drain',
    display_name: 'Penrose Drain',
    category: 'informational',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 48 },
    keywords: ['penrose', 'penrose drain', 'passive drain'],
  },
  {
    type: 'ng_tube',
    display_name: 'NG Tube',
    category: 'moderate',
    default_body_region: 'face',
    default_body_view: 'front',
    default_position: { x: 52, y: 14 },
    keywords: ['ng tube', 'nasogastric', 'nasogastric tube', 'ngt'],
  },
  {
    type: 'g_tube',
    display_name: 'G-Tube/PEG',
    category: 'moderate',
    default_body_region: 'abdomen_left',
    default_body_view: 'front',
    default_position: { x: 60, y: 45 },
    keywords: ['g-tube', 'gtube', 'peg', 'peg tube', 'gastrostomy', 'feeding tube'],
  },
  {
    type: 'j_tube',
    display_name: 'J-Tube',
    category: 'moderate',
    default_body_region: 'abdomen_left',
    default_body_view: 'front',
    default_position: { x: 60, y: 48 },
    keywords: ['j-tube', 'jtube', 'jej tube', 'jejunostomy'],
  },
  {
    type: 'tracheostomy',
    display_name: 'Tracheostomy',
    category: 'critical',
    default_body_region: 'neck',
    default_body_view: 'front',
    default_position: { x: 50, y: 21 },
    keywords: ['trach', 'tracheostomy', 'tracheotomy', 'trach tube'],
  },
  {
    type: 'nephrostomy',
    display_name: 'Nephrostomy Tube',
    category: 'moderate',
    default_body_region: 'lower_back_right',
    default_body_view: 'back',
    default_position: { x: 40, y: 50 },
    keywords: ['nephrostomy', 'nephrostomy tube', 'percutaneous nephrostomy'],
    laterality_adjustments: {
      left: { x: 60, y: 50 },
      right: { x: 40, y: 50 },
    },
  },
];
