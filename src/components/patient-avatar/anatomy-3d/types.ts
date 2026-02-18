/**
 * Types for the 3D Clinical Anatomy Viewer
 *
 * Defines the layer system, anatomy index, and viewer state
 * for the Three.js-based patient avatar.
 *
 * Model source: Z-Anatomy (CC BY-SA 4.0)
 * Renderer: @react-three/fiber (Three.js)
 */

/** Body systems that can be toggled as layers */
export type AnatomySystem =
  | 'skin'
  | 'muscular'
  | 'organs'
  | 'vascular'
  | 'nervous'
  | 'skeletal';

/** Display label and color for each anatomy system */
export interface AnatomyLayerConfig {
  system: AnatomySystem;
  label: string;
  /** Hex color used for the layer toggle button and highlighting */
  color: string;
  /** Default visibility when viewer loads */
  defaultVisible: boolean;
  /** Default opacity (0.0 to 1.0) */
  defaultOpacity: number;
  /** Sort order in the layer panel (lower = higher in list) */
  order: number;
}

/** State of a single layer in the viewer */
export interface LayerState {
  system: AnatomySystem;
  visible: boolean;
  opacity: number;
}

/** Index entry for a single mesh in the anatomy model */
export interface AnatomyMeshEntry {
  /** Unique mesh name from the GLTF model */
  name: string;
  /** Which body system this mesh belongs to */
  system: AnatomySystem;
  /** Human-readable label (e.g., "Left Femur") */
  label: string;
  /** Body region for marker placement (e.g., "left_leg", "thorax") */
  region: string;
  /** Reference to the Three.js Object3D (set at runtime after model loads) */
  objectRef?: unknown;
}

/** The complete anatomy index built from a loaded GLTF model */
export interface AnatomyIndex {
  /** All mesh entries by name */
  byName: Map<string, AnatomyMeshEntry>;
  /** Mesh names grouped by body system */
  bySystem: Map<AnatomySystem, Set<string>>;
  /** Mesh names grouped by body region */
  byRegion: Map<string, Set<string>>;
  /** Total mesh count */
  meshCount: number;
}

/** Viewer interaction mode */
export type ViewerMode =
  | 'view'       // Default — rotate, zoom, pan
  | 'select'     // Click to select/highlight a structure
  | 'marker'     // Click to place a clinical marker
  | 'clip';      // Clipping plane mode for cutaway views

/** Minimal marker shape for overlay display (avoids importing full PatientMarker type) */
export interface AnatomyMarkerOverlay {
  id: string;
  display_name: string;
  category: string;
  body_region: string;
  position_x: number;
  position_y: number;
  body_view: string;
  is_active: boolean;
  status: string;
  requires_attention: boolean;
}

/** Props for the main AnatomyViewer component */
export interface AnatomyViewerProps {
  /** Patient ID for loading markers and preferences */
  patientId: string;
  /** Patient display name */
  patientName?: string;
  /** Skin tone for the skin layer color (from avatar settings) */
  skinTone?: string;
  /** Anatomical gender for model variant selection */
  gender?: AnatomyGender;
  /** Initial viewer mode */
  initialMode?: ViewerMode;
  /** Whether the viewer is editable (place markers, toggle layers) */
  editable?: boolean;
  /** Compact mode for embedding in dashboards */
  compact?: boolean;
  /** Clinical markers to overlay on the body (PICC lines, wounds, etc.) */
  markers?: AnatomyMarkerOverlay[];
  /** Callback when a structure is selected */
  onStructureSelect?: (meshName: string, system: AnatomySystem) => void;
  /** Callback when a marker is placed */
  onMarkerPlace?: (position: MarkerPosition) => void;
  /** Callback when a marker overlay is clicked */
  onMarkerClick?: (markerId: string) => void;
  /** Additional CSS class names */
  className?: string;
}

/** 3D position for a marker on the anatomy model */
export interface MarkerPosition {
  /** World-space X coordinate */
  x: number;
  /** World-space Y coordinate */
  y: number;
  /** World-space Z coordinate */
  z: number;
  /** Name of the mesh the marker was placed on */
  meshName: string;
  /** Body system of the target mesh */
  system: AnatomySystem;
  /** Normal vector at the placement point (for marker orientation) */
  normal: { x: number; y: number; z: number };
}

/** Clipping plane configuration for surgical cutaway views */
export interface ClipPlaneConfig {
  /** Plane normal direction */
  normal: { x: number; y: number; z: number };
  /** Distance from origin along the normal */
  constant: number;
  /** Whether this clipping plane is active */
  enabled: boolean;
  /** Human-readable label (e.g., "Horizontal cut", "Sagittal plane") */
  label: string;
}

/** Gender presentation for model variant selection */
export type AnatomyGender = 'male' | 'female' | 'neutral';

/** Model variant configuration */
export interface AnatomyModelConfig {
  /** Gender variant to load */
  gender: AnatomyGender;
  /** Whether to show pregnancy variant (female only) */
  pregnancy?: {
    trimester: 1 | 2 | 3;
  };
  /** Path to the GLB model file */
  modelPath: string;
}
