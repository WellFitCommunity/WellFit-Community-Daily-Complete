/**
 * 3D Clinical Anatomy Viewer
 *
 * Layered anatomical visualization using Three.js / React Three Fiber.
 * Model source: Z-Anatomy (CC BY-SA 4.0)
 *
 * Exports:
 * - AnatomyViewer: Main viewer component
 * - LayerPanel: Layer toggle UI (for custom layouts)
 * - useAnatomyLayers: Layer state hook (for external state management)
 * - Types and layer config utilities
 */

export { AnatomyViewer, default as AnatomyViewerDefault } from './AnatomyViewer';
export { AnatomyLayer, preloadAnatomyModels } from './AnatomyLayer';
export { LayerPanel } from './LayerPanel';
export { MarkerOverlay } from './MarkerOverlay';
export { Marker3DGroup } from './Marker3D';
export { useAnatomyLayers } from './useAnatomyLayers';
export { ANATOMY_LAYERS, SYSTEM_PATTERNS, classifyMesh, getLayerConfig, getSortedLayers } from './anatomyLayers';
export { BODY_REGION_COORDINATES, resolveMarkerPosition } from './anatomyCoordinates';
export type {
  AnatomySystem,
  AnatomyLayerConfig,
  LayerState,
  AnatomyMeshEntry,
  AnatomyIndex,
  ViewerMode,
  AnatomyMarkerOverlay,
  AnatomyViewerProps,
  MarkerPosition,
  ClipPlaneConfig,
  AnatomyGender,
  AnatomyModelConfig,
} from './types';
