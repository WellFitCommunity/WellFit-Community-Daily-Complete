/**
 * Wounds & Surgical Sites Marker Types
 *
 * Includes: Incisions, pressure injuries, lacerations, ostomies
 */

import { MarkerTypeDefinition } from '../../../../types/patientAvatar';

export const WOUND_SURGICAL_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'surgical_incision',
    display_name: 'Surgical Incision',
    category: 'informational',
    default_body_region: 'abdomen_upper',
    default_body_view: 'front',
    default_position: { x: 50, y: 42 },
    keywords: ['incision', 'surgical site', 'surgical incision', 'operative site'],
  },
  {
    type: 'pressure_injury_1',
    display_name: 'Pressure Injury (Stage 1)',
    category: 'moderate',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['stage 1 pressure', 'stage i pressure', 'pressure injury', 'pressure ulcer', 'bedsore'],
  },
  {
    type: 'pressure_injury_2',
    display_name: 'Pressure Injury (Stage 2)',
    category: 'moderate',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['stage 2 pressure', 'stage ii pressure'],
  },
  {
    type: 'pressure_injury_3',
    display_name: 'Pressure Injury (Stage 3)',
    category: 'critical',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['stage 3 pressure', 'stage iii pressure'],
  },
  {
    type: 'pressure_injury_4',
    display_name: 'Pressure Injury (Stage 4)',
    category: 'critical',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['stage 4 pressure', 'stage iv pressure'],
  },
  {
    type: 'pressure_injury_unstageable',
    display_name: 'Pressure Injury (Unstageable)',
    category: 'critical',
    default_body_region: 'sacrum',
    default_body_view: 'back',
    default_position: { x: 50, y: 60 },
    keywords: ['unstageable pressure', 'unstaged pressure'],
  },
  {
    type: 'laceration',
    display_name: 'Laceration',
    category: 'moderate',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['laceration', 'cut', 'wound'],
  },
  {
    type: 'skin_tear',
    display_name: 'Skin Tear',
    category: 'moderate',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['skin tear', 'skin flap'],
  },
  {
    type: 'ostomy_colostomy',
    display_name: 'Colostomy',
    category: 'moderate',
    default_body_region: 'abdomen_left',
    default_body_view: 'front',
    default_position: { x: 62, y: 48 },
    keywords: ['colostomy', 'stoma', 'ostomy'],
  },
  {
    type: 'ostomy_ileostomy',
    display_name: 'Ileostomy',
    category: 'moderate',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 38, y: 48 },
    keywords: ['ileostomy'],
  },
  {
    type: 'ostomy_urostomy',
    display_name: 'Urostomy',
    category: 'moderate',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 38, y: 50 },
    keywords: ['urostomy', 'ileal conduit'],
  },
];
