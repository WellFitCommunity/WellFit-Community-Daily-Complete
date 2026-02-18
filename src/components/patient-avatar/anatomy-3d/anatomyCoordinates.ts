/**
 * Anatomical 3D Coordinate Map
 *
 * Maps body_region strings to accurate 3D world positions on the
 * anatomy model. Based on standard human proportional anatomy
 * (8-head system) scaled to a ~1.7 unit tall model.
 *
 * Coordinate system (model facing viewer):
 * - X: patient's left (+) to patient's right (-)
 *       (viewer's right = patient's left)
 * - Y: feet (0) to head (~1.7)
 * - Z: back (-0.12) to front (+0.15)
 *
 * Patient's right = viewer's left = negative X
 * Patient's left  = viewer's right = positive X
 */

type Vec3 = [x: number, y: number, z: number];

/**
 * Body region to 3D coordinate lookup.
 *
 * Positions are calibrated to a Z-Anatomy GLB model centered at
 * origin with Y-up, standing ~1.7 units tall. Markers float
 * slightly in front (Z=0.15) or behind (Z=-0.12) the body surface.
 */
export const BODY_REGION_COORDINATES: Record<string, Vec3> = {
  // ── HEAD & NECK ──────────────────────────────────────────────
  head_top:      [0,     1.72,  0.05],
  brain:         [0,     1.62,  0.0],
  face:          [0,     1.55,  0.12],
  head_back:     [0,     1.60, -0.12],
  neck:          [0,     1.42,  0.08],

  // ── CHEST / THORAX ──────────────────────────────────────────
  chest_left:    [0.10,  1.22,  0.14],
  chest_right:   [-0.10, 1.22,  0.14],
  heart:         [0.06,  1.22,  0.08],

  // ── UPPER ABDOMEN ───────────────────────────────────────────
  abdomen_upper: [0,     1.02,  0.14],
  abdomen_right: [-0.12, 0.97,  0.12],
  abdomen_left:  [0.12,  0.97,  0.12],

  // ── LOWER ABDOMEN / PELVIS ──────────────────────────────────
  abdomen:       [0,     0.95,  0.14],
  abdomen_lower: [0,     0.85,  0.14],
  groin_right:   [-0.08, 0.75,  0.10],
  groin_left:    [0.08,  0.75,  0.10],
  suprapubic:    [0,     0.80,  0.14],

  // ── BACK ────────────────────────────────────────────────────
  back:          [0,     1.15, -0.12],
  upper_back:    [0,     1.25, -0.12],
  lower_back_right: [-0.08, 0.95, -0.12],
  lower_back_left:  [0.08,  0.95, -0.12],
  spine_lower:   [0,     0.92, -0.12],
  lumbar_spine:  [0,     0.95, -0.12],
  sacrum:        [0,     0.75, -0.12],

  // ── SHOULDER ────────────────────────────────────────────────
  shoulder_right: [-0.22, 1.35,  0.06],
  shoulder_left:  [0.22,  1.35,  0.06],

  // ── RIGHT ARM (patient's right = viewer's left) ─────────────
  arm_upper_right: [-0.28, 1.15,  0.05],
  arm_lower_right: [-0.30, 0.92,  0.05],
  wrist_right:     [-0.28, 0.75,  0.05],
  hand_right:      [-0.27, 0.65,  0.06],

  // ── LEFT ARM (patient's left = viewer's right) ──────────────
  arm_upper_left:  [0.28,  1.15,  0.05],
  arm_lower_left:  [0.30,  0.92,  0.05],
  left_arm:        [0.28,  1.05,  0.05],
  wrist_left:      [0.28,  0.75,  0.05],
  hand_left:       [0.27,  0.65,  0.06],
  left_hand:       [0.27,  0.65,  0.06],

  // ── RIGHT LEG ──────────────────────────────────────────────
  thigh_right:   [-0.10, 0.60,  0.08],
  knee_right:    [-0.10, 0.46,  0.10],
  shin_right:    [-0.09, 0.30,  0.08],
  ankle_right:   [-0.08, 0.10,  0.08],
  foot_right:    [-0.08, 0.04,  0.10],

  // ── LEFT LEG ───────────────────────────────────────────────
  thigh_left:    [0.10,  0.60,  0.08],
  knee_left:     [0.10,  0.46,  0.10],
  shin_left:     [0.09,  0.30,  0.08],
  ankle_left:    [0.08,  0.10,  0.08],
  foot_left:     [0.08,  0.04,  0.10],
  left_foot:     [0.08,  0.04,  0.10],

  // ── OBSTETRIC / UTERINE ────────────────────────────────────
  uterus_fundus: [0,     0.90,  0.10],
  uterus_body:   [0,     0.85,  0.10],
  uterus_lower:  [0,     0.80,  0.10],

  // ── SPECIAL ────────────────────────────────────────────────
  // Badge area: upper-left shoulder area (for safety badges, ID bands)
  badge_area:    [0.18,  1.38,  0.14],
};

/**
 * Resolve a body_region to a 3D world position.
 *
 * If the body_region exists in the coordinate map, returns that position.
 * Otherwise falls back to the legacy percentage-based conversion.
 *
 * @param bodyRegion - Body region identifier (e.g., 'heart', 'neck')
 * @param fallbackX - Fallback X percentage (0-100) if region not mapped
 * @param fallbackY - Fallback Y percentage (0-100) if region not mapped
 */
export function resolveMarkerPosition(
  bodyRegion: string,
  fallbackX: number,
  fallbackY: number,
): Vec3 {
  const mapped = BODY_REGION_COORDINATES[bodyRegion];
  if (mapped) {
    return mapped;
  }

  // Legacy fallback: convert 2D percentage to 3D space
  const x = ((fallbackX - 50) / 100) * 0.6;
  const y = 1.7 - (fallbackY / 100) * 1.7;
  const z = 0.15;
  return [x, y, z];
}
