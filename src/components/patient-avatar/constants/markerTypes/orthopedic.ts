/**
 * Orthopedic Marker Types
 *
 * Includes: Fractures, joint replacements, casts, external fixators
 */

import { MarkerTypeDefinition } from '../../../../types/patientAvatar';

export const ORTHOPEDIC_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'fracture',
    display_name: 'Fracture Site',
    category: 'moderate',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['fracture', 'broken', 'fx'],
  },
  {
    type: 'external_fixator',
    display_name: 'External Fixator',
    category: 'critical',
    default_body_region: 'shin_right',
    default_body_view: 'front',
    default_position: { x: 45, y: 88 },
    keywords: ['external fixator', 'ex fix', 'ilizarov'],
  },
  {
    type: 'cast',
    display_name: 'Cast/Splint',
    category: 'informational',
    default_body_region: 'arm_lower_right',
    default_body_view: 'front',
    default_position: { x: 15, y: 52 },
    keywords: ['cast', 'splint', 'immobilizer'],
  },
  {
    type: 'joint_replacement_hip',
    display_name: 'Hip Replacement',
    category: 'informational',
    default_body_region: 'groin_right',
    default_body_view: 'front',
    default_position: { x: 42, y: 62 },
    keywords: ['hip replacement', 'total hip', 'hip arthroplasty', 'tha'],
    laterality_adjustments: {
      left: { x: 58, y: 62 },
      right: { x: 42, y: 62 },
    },
  },
  {
    type: 'joint_replacement_knee',
    display_name: 'Knee Replacement',
    category: 'informational',
    default_body_region: 'knee_right',
    default_body_view: 'front',
    default_position: { x: 44, y: 80 },
    keywords: ['knee replacement', 'total knee', 'knee arthroplasty', 'tka'],
    laterality_adjustments: {
      left: { x: 56, y: 80 },
      right: { x: 44, y: 80 },
    },
  },
  {
    type: 'joint_replacement_shoulder',
    display_name: 'Shoulder Replacement',
    category: 'informational',
    default_body_region: 'shoulder_right',
    default_body_view: 'front',
    default_position: { x: 30, y: 25 },
    keywords: ['shoulder replacement', 'total shoulder', 'shoulder arthroplasty', 'tsa'],
    laterality_adjustments: {
      left: { x: 70, y: 25 },
      right: { x: 30, y: 25 },
    },
  },
];
