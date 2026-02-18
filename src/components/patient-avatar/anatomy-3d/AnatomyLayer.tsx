/**
 * AnatomyLayer - Renders a single body system from a GLB file
 *
 * Loads a GLB model file and renders all meshes with the specified
 * opacity and visibility. Each body system is a separate layer.
 *
 * Model source: Z-Anatomy (CC BY-SA 4.0)
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { AnatomySystem } from './types';
import { getLayerConfig } from './anatomyLayers';

interface AnatomyLayerProps {
  /** Which body system this layer represents */
  system: AnatomySystem;
  /** Path to the GLB model file */
  modelPath: string;
  /** Whether this layer is visible */
  visible: boolean;
  /** Opacity (0.0 - 1.0) */
  opacity: number;
  /** Whether the mesh is highlighted (e.g., hovered or selected) */
  highlighted?: boolean;
  /** Override the system color (e.g., for skin tone selection) */
  colorOverride?: string;
  /** Callback when a mesh in this layer is clicked */
  onMeshClick?: (meshName: string, system: AnatomySystem) => void;
}

/** Model base path */
const MODEL_BASE = '/models/anatomy';

/**
 * Mesh name patterns to exclude from rendering.
 * Hair is excluded because clinical anatomy models are standardly
 * shown hairless — avoids cultural bias and matches medical convention.
 */
const EXCLUDED_MESH_PATTERNS = [
  'hair', 'scalp_hair', 'eyebrow', 'eyelash', 'beard', 'mustache',
  'body_hair', 'pubic', 'axillary_hair', 'chest_hair',
];

/** Check if a mesh should be excluded from rendering */
function isMeshExcluded(meshName: string): boolean {
  const lower = meshName.toLowerCase();
  return EXCLUDED_MESH_PATTERNS.some((pattern) => lower.includes(pattern));
}

export const AnatomyLayer: React.FC<AnatomyLayerProps> = ({
  system,
  modelPath,
  visible,
  opacity,
  highlighted = false,
  colorOverride,
  onMeshClick,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(`${MODEL_BASE}/${modelPath}`, true);
  const layerConfig = getLayerConfig(system);

  // Clone the scene so each layer instance is independent
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Apply material properties (opacity, color) to all meshes
  useEffect(() => {
    if (!clonedScene) return;

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Hide excluded meshes (hair, eyebrows, etc.) for clinical presentation
        if (isMeshExcluded(child.name)) {
          child.visible = false;
          return;
        }

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        for (const mat of materials) {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
            mat.transparent = opacity < 1.0;
            mat.opacity = opacity;
            // Depth write: fully opaque layers always write. Skin only writes
            // to depth when opacity is high enough to be the primary visual;
            // at low opacity it should NOT block inner layers (skeleton, organs).
            mat.depthWrite = opacity >= 0.5;
            mat.side = THREE.DoubleSide;

            // Apply color: use colorOverride if provided (e.g., skin tone),
            // otherwise use system color for skin, skeletal, or default white/grey meshes.
            // Skeletal meshes need the color forced because GLB models often ship
            // with dark/neutral colors that vanish against the dark scene background.
            const effectiveColor = colorOverride ?? layerConfig.color;
            const hex = mat.color.getHexString();
            if (system === 'skin' || system === 'skeletal' || hex === 'ffffff' || hex === 'cccccc') {
              mat.color.set(effectiveColor);
            }

            if (highlighted) {
              mat.emissive.set(layerConfig.color);
              mat.emissiveIntensity = 0.3;
            } else {
              mat.emissiveIntensity = 0;
            }

            mat.needsUpdate = true;
          }
        }
      }
    });
  }, [clonedScene, opacity, highlighted, layerConfig.color, system, colorOverride]);

  if (!visible) return null;

  // Skin renders last (renderOrder 10) so it appears on top of inner layers
  const renderOrder = system === 'skin' ? 10 : 0;

  return (
    <group ref={groupRef} renderOrder={renderOrder}>
      <primitive
        object={clonedScene}
        onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
          if (onMeshClick) {
            e.stopPropagation();
            onMeshClick(e.object.name || 'unknown', system);
          }
        }}
      />
    </group>
  );
};

/** Preload all anatomy models */
export function preloadAnatomyModels(): void {
  const models = [
    'anatomy_skeletal.glb',
    'anatomy_muscular.glb',
    'anatomy_organs.glb',
    'anatomy_vascular.glb',
    'anatomy_nervous.glb',
    'anatomy_skin.glb',
  ];
  for (const model of models) {
    useGLTF.preload(`${MODEL_BASE}/${model}`, true);
  }
}
