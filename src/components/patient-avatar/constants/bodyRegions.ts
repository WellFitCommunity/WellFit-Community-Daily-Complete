/**
 * Body Region Constants for Patient Avatar
 *
 * Anatomical regions with default marker positions.
 * Positions are percentages (0-100) from top-left.
 */

import { BodyRegion, BodyView } from '../../../types/patientAvatar';

/**
 * Body regions for front view
 */
export const BODY_REGIONS_FRONT: BodyRegion[] = [
  // Head & Neck
  {
    id: 'head_top',
    label: 'Top of Head',
    view: 'front',
    center: { x: 50, y: 5 },
    bounds: { minX: 40, maxX: 60, minY: 0, maxY: 10 },
  },
  {
    id: 'brain',
    label: 'Brain',
    view: 'front',
    center: { x: 50, y: 8 },
    bounds: { minX: 42, maxX: 58, minY: 3, maxY: 13 },
  },
  {
    id: 'forehead',
    label: 'Forehead',
    view: 'front',
    center: { x: 50, y: 10 },
    bounds: { minX: 43, maxX: 57, minY: 8, maxY: 13 },
  },
  {
    id: 'face',
    label: 'Face',
    view: 'front',
    center: { x: 50, y: 14 },
    bounds: { minX: 43, maxX: 57, minY: 10, maxY: 18 },
  },
  {
    id: 'neck',
    label: 'Neck',
    view: 'front',
    center: { x: 50, y: 20 },
    bounds: { minX: 45, maxX: 55, minY: 17, maxY: 23 },
  },

  // Upper Torso
  {
    id: 'chest_left',
    label: 'Left Chest',
    view: 'front',
    center: { x: 58, y: 30 },
    bounds: { minX: 52, maxX: 65, minY: 24, maxY: 38 },
  },
  {
    id: 'chest_right',
    label: 'Right Chest',
    view: 'front',
    center: { x: 42, y: 30 },
    bounds: { minX: 35, maxX: 48, minY: 24, maxY: 38 },
  },
  {
    id: 'heart',
    label: 'Heart',
    view: 'front',
    center: { x: 55, y: 32 },
    bounds: { minX: 50, maxX: 60, minY: 28, maxY: 38 },
  },
  {
    id: 'sternum',
    label: 'Sternum',
    view: 'front',
    center: { x: 50, y: 32 },
    bounds: { minX: 47, maxX: 53, minY: 25, maxY: 40 },
  },

  // Shoulders & Arms
  {
    id: 'shoulder_left',
    label: 'Left Shoulder',
    view: 'front',
    center: { x: 70, y: 25 },
    bounds: { minX: 65, maxX: 78, minY: 22, maxY: 30 },
  },
  {
    id: 'shoulder_right',
    label: 'Right Shoulder',
    view: 'front',
    center: { x: 30, y: 25 },
    bounds: { minX: 22, maxX: 35, minY: 22, maxY: 30 },
  },
  {
    id: 'arm_upper_left',
    label: 'Left Upper Arm',
    view: 'front',
    center: { x: 78, y: 35 },
    bounds: { minX: 72, maxX: 85, minY: 28, maxY: 42 },
  },
  {
    id: 'arm_upper_right',
    label: 'Right Upper Arm',
    view: 'front',
    center: { x: 22, y: 35 },
    bounds: { minX: 15, maxX: 28, minY: 28, maxY: 42 },
  },
  {
    id: 'elbow_left',
    label: 'Left Elbow',
    view: 'front',
    center: { x: 82, y: 44 },
    bounds: { minX: 78, maxX: 88, minY: 41, maxY: 47 },
  },
  {
    id: 'elbow_right',
    label: 'Right Elbow',
    view: 'front',
    center: { x: 18, y: 44 },
    bounds: { minX: 12, maxX: 22, minY: 41, maxY: 47 },
  },
  {
    id: 'arm_lower_left',
    label: 'Left Forearm',
    view: 'front',
    center: { x: 85, y: 52 },
    bounds: { minX: 80, maxX: 92, minY: 46, maxY: 58 },
  },
  {
    id: 'arm_lower_right',
    label: 'Right Forearm',
    view: 'front',
    center: { x: 15, y: 52 },
    bounds: { minX: 8, maxX: 20, minY: 46, maxY: 58 },
  },
  {
    id: 'wrist_left',
    label: 'Left Wrist',
    view: 'front',
    center: { x: 88, y: 60 },
    bounds: { minX: 84, maxX: 94, minY: 57, maxY: 63 },
  },
  {
    id: 'wrist_right',
    label: 'Right Wrist',
    view: 'front',
    center: { x: 12, y: 60 },
    bounds: { minX: 6, maxX: 16, minY: 57, maxY: 63 },
  },
  {
    id: 'hand_left',
    label: 'Left Hand',
    view: 'front',
    center: { x: 90, y: 66 },
    bounds: { minX: 85, maxX: 96, minY: 62, maxY: 72 },
  },
  {
    id: 'hand_right',
    label: 'Right Hand',
    view: 'front',
    center: { x: 10, y: 66 },
    bounds: { minX: 4, maxX: 15, minY: 62, maxY: 72 },
  },

  // Abdomen
  {
    id: 'abdomen_upper',
    label: 'Upper Abdomen',
    view: 'front',
    center: { x: 50, y: 42 },
    bounds: { minX: 38, maxX: 62, minY: 38, maxY: 48 },
  },
  {
    id: 'abdomen_lower',
    label: 'Lower Abdomen',
    view: 'front',
    center: { x: 50, y: 52 },
    bounds: { minX: 38, maxX: 62, minY: 48, maxY: 58 },
  },
  {
    id: 'abdomen_left',
    label: 'Left Abdomen',
    view: 'front',
    center: { x: 60, y: 47 },
    bounds: { minX: 55, maxX: 68, minY: 40, maxY: 55 },
  },
  {
    id: 'abdomen_right',
    label: 'Right Abdomen',
    view: 'front',
    center: { x: 40, y: 47 },
    bounds: { minX: 32, maxX: 45, minY: 40, maxY: 55 },
  },

  // Pelvis & Groin
  {
    id: 'groin_left',
    label: 'Left Groin',
    view: 'front',
    center: { x: 58, y: 60 },
    bounds: { minX: 52, maxX: 64, minY: 56, maxY: 65 },
  },
  {
    id: 'groin_right',
    label: 'Right Groin',
    view: 'front',
    center: { x: 42, y: 60 },
    bounds: { minX: 36, maxX: 48, minY: 56, maxY: 65 },
  },

  // Legs
  {
    id: 'thigh_left',
    label: 'Left Thigh',
    view: 'front',
    center: { x: 58, y: 70 },
    bounds: { minX: 52, maxX: 68, minY: 63, maxY: 78 },
  },
  {
    id: 'thigh_right',
    label: 'Right Thigh',
    view: 'front',
    center: { x: 42, y: 70 },
    bounds: { minX: 32, maxX: 48, minY: 63, maxY: 78 },
  },
  {
    id: 'knee_left',
    label: 'Left Knee',
    view: 'front',
    center: { x: 56, y: 80 },
    bounds: { minX: 52, maxX: 62, minY: 77, maxY: 83 },
  },
  {
    id: 'knee_right',
    label: 'Right Knee',
    view: 'front',
    center: { x: 44, y: 80 },
    bounds: { minX: 38, maxX: 48, minY: 77, maxY: 83 },
  },
  {
    id: 'shin_left',
    label: 'Left Shin',
    view: 'front',
    center: { x: 55, y: 88 },
    bounds: { minX: 50, maxX: 62, minY: 82, maxY: 94 },
  },
  {
    id: 'shin_right',
    label: 'Right Shin',
    view: 'front',
    center: { x: 45, y: 88 },
    bounds: { minX: 38, maxX: 50, minY: 82, maxY: 94 },
  },
  {
    id: 'ankle_left',
    label: 'Left Ankle',
    view: 'front',
    center: { x: 55, y: 95 },
    bounds: { minX: 50, maxX: 60, minY: 93, maxY: 97 },
  },
  {
    id: 'ankle_right',
    label: 'Right Ankle',
    view: 'front',
    center: { x: 45, y: 95 },
    bounds: { minX: 40, maxX: 50, minY: 93, maxY: 97 },
  },
  {
    id: 'foot_left',
    label: 'Left Foot',
    view: 'front',
    center: { x: 55, y: 98 },
    bounds: { minX: 48, maxX: 62, minY: 96, maxY: 100 },
  },
  {
    id: 'foot_right',
    label: 'Right Foot',
    view: 'front',
    center: { x: 45, y: 98 },
    bounds: { minX: 38, maxX: 52, minY: 96, maxY: 100 },
  },
];

/**
 * Body regions for back view
 */
export const BODY_REGIONS_BACK: BodyRegion[] = [
  // Head & Neck (back)
  {
    id: 'head_back',
    label: 'Back of Head',
    view: 'back',
    center: { x: 50, y: 8 },
    bounds: { minX: 42, maxX: 58, minY: 3, maxY: 15 },
  },
  {
    id: 'neck_back',
    label: 'Back of Neck',
    view: 'back',
    center: { x: 50, y: 19 },
    bounds: { minX: 45, maxX: 55, minY: 15, maxY: 23 },
  },

  // Upper Back
  {
    id: 'upper_back_left',
    label: 'Left Upper Back',
    view: 'back',
    center: { x: 60, y: 30 },
    bounds: { minX: 52, maxX: 70, minY: 23, maxY: 40 },
  },
  {
    id: 'upper_back_right',
    label: 'Right Upper Back',
    view: 'back',
    center: { x: 40, y: 30 },
    bounds: { minX: 30, maxX: 48, minY: 23, maxY: 40 },
  },
  {
    id: 'spine_upper',
    label: 'Upper Spine',
    view: 'back',
    center: { x: 50, y: 30 },
    bounds: { minX: 47, maxX: 53, minY: 22, maxY: 40 },
  },

  // Mid Back
  {
    id: 'mid_back_left',
    label: 'Left Mid Back',
    view: 'back',
    center: { x: 58, y: 45 },
    bounds: { minX: 52, maxX: 68, minY: 38, maxY: 52 },
  },
  {
    id: 'mid_back_right',
    label: 'Right Mid Back',
    view: 'back',
    center: { x: 42, y: 45 },
    bounds: { minX: 32, maxX: 48, minY: 38, maxY: 52 },
  },
  {
    id: 'spine_mid',
    label: 'Mid Spine',
    view: 'back',
    center: { x: 50, y: 45 },
    bounds: { minX: 47, maxX: 53, minY: 38, maxY: 52 },
  },

  // Lower Back
  {
    id: 'lower_back_left',
    label: 'Left Lower Back',
    view: 'back',
    center: { x: 58, y: 55 },
    bounds: { minX: 52, maxX: 65, minY: 50, maxY: 62 },
  },
  {
    id: 'lower_back_right',
    label: 'Right Lower Back',
    view: 'back',
    center: { x: 42, y: 55 },
    bounds: { minX: 35, maxX: 48, minY: 50, maxY: 62 },
  },
  {
    id: 'spine_lower',
    label: 'Lower Spine',
    view: 'back',
    center: { x: 50, y: 55 },
    bounds: { minX: 47, maxX: 53, minY: 50, maxY: 62 },
  },
  {
    id: 'sacrum',
    label: 'Sacrum',
    view: 'back',
    center: { x: 50, y: 60 },
    bounds: { minX: 45, maxX: 55, minY: 58, maxY: 65 },
  },

  // Buttocks
  {
    id: 'buttock_left',
    label: 'Left Buttock',
    view: 'back',
    center: { x: 58, y: 65 },
    bounds: { minX: 52, maxX: 68, minY: 60, maxY: 72 },
  },
  {
    id: 'buttock_right',
    label: 'Right Buttock',
    view: 'back',
    center: { x: 42, y: 65 },
    bounds: { minX: 32, maxX: 48, minY: 60, maxY: 72 },
  },

  // Back of Legs
  {
    id: 'hamstring_left',
    label: 'Left Hamstring',
    view: 'back',
    center: { x: 58, y: 75 },
    bounds: { minX: 52, maxX: 68, minY: 70, maxY: 82 },
  },
  {
    id: 'hamstring_right',
    label: 'Right Hamstring',
    view: 'back',
    center: { x: 42, y: 75 },
    bounds: { minX: 32, maxX: 48, minY: 70, maxY: 82 },
  },
  {
    id: 'calf_left',
    label: 'Left Calf',
    view: 'back',
    center: { x: 56, y: 88 },
    bounds: { minX: 50, maxX: 64, minY: 82, maxY: 94 },
  },
  {
    id: 'calf_right',
    label: 'Right Calf',
    view: 'back',
    center: { x: 44, y: 88 },
    bounds: { minX: 36, maxX: 50, minY: 82, maxY: 94 },
  },
  {
    id: 'heel_left',
    label: 'Left Heel',
    view: 'back',
    center: { x: 55, y: 97 },
    bounds: { minX: 50, maxX: 60, minY: 95, maxY: 100 },
  },
  {
    id: 'heel_right',
    label: 'Right Heel',
    view: 'back',
    center: { x: 45, y: 97 },
    bounds: { minX: 40, maxX: 50, minY: 95, maxY: 100 },
  },
];

/**
 * All body regions combined
 */
export const ALL_BODY_REGIONS: BodyRegion[] = [
  ...BODY_REGIONS_FRONT,
  ...BODY_REGIONS_BACK,
];

/**
 * Get body region by ID
 */
export function getBodyRegion(id: string): BodyRegion | undefined {
  return ALL_BODY_REGIONS.find((r) => r.id === id);
}

/**
 * Get body regions for a specific view
 */
export function getBodyRegionsForView(view: BodyView): BodyRegion[] {
  return view === 'front' ? BODY_REGIONS_FRONT : BODY_REGIONS_BACK;
}

/**
 * Find the closest body region to a position
 */
export function findClosestBodyRegion(
  x: number,
  y: number,
  view: BodyView
): BodyRegion | undefined {
  const regions = getBodyRegionsForView(view);
  let closest: BodyRegion | undefined;
  let minDistance = Infinity;

  for (const region of regions) {
    const dx = x - region.center.x;
    const dy = y - region.center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      closest = region;
    }
  }

  return closest;
}
