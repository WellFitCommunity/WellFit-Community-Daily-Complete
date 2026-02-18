/**
 * AnatomyViewer - 3D Clinical Anatomy Visualization
 *
 * Main component for the layered 3D anatomy viewer. Renders a Three.js
 * canvas with orbit controls and loads body system layers from GLB files.
 *
 * Used by physicians to:
 * - View layered anatomy (skin, muscles, organs, vascular, nervous, skeletal)
 * - Toggle individual layers on/off with opacity control
 * - Rotate, zoom, and pan the model
 * - Select structures for clinical annotation
 *
 * Model source: Z-Anatomy (CC BY-SA 4.0)
 * Renderer: @react-three/fiber (Three.js WebGL)
 */

import React, { Suspense, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import * as THREE from 'three';
import type { AnatomySystem, AnatomyGender, AnatomyViewerProps } from './types';
import { AnatomyLayer } from './AnatomyLayer';
import { LayerPanel } from './LayerPanel';
import { Marker3DGroup } from './Marker3D';
import { useAnatomyLayers } from './useAnatomyLayers';
import { SKIN_TONE_COLORS } from '../constants/skinTones';
import type { SkinTone } from '../../../types/patientAvatar';

/** Dark background color for the 3D scene */
const SCENE_BG = new THREE.Color('#0f172a'); // slate-900

/**
 * GLB file paths per gender variant.
 * When gender-specific models are available, add entries for 'male' and 'female'.
 * All variants fall back to the neutral models until gendered assets exist.
 */
const GENDER_MODELS: Record<AnatomyGender, Record<AnatomySystem, string>> = {
  neutral: {
    skeletal: 'anatomy_skeletal.glb',
    muscular: 'anatomy_muscular.glb',
    organs: 'anatomy_organs.glb',
    vascular: 'anatomy_vascular.glb',
    nervous: 'anatomy_nervous.glb',
    skin: 'anatomy_skin.glb',
  },
  male: {
    skeletal: 'anatomy_skeletal.glb',
    muscular: 'anatomy_muscular.glb',
    organs: 'anatomy_organs.glb',
    vascular: 'anatomy_vascular.glb',
    nervous: 'anatomy_nervous.glb',
    skin: 'anatomy_skin.glb',
  },
  female: {
    skeletal: 'anatomy_skeletal.glb',
    muscular: 'anatomy_muscular.glb',
    organs: 'anatomy_organs.glb',
    vascular: 'anatomy_vascular.glb',
    nervous: 'anatomy_nervous.glb',
    skin: 'anatomy_skin.glb',
  },
};

/** Resolve model set for the given gender, falling back to neutral */
function getSystemModels(gender: AnatomyGender = 'neutral'): Record<AnatomySystem, string> {
  return GENDER_MODELS[gender] ?? GENDER_MODELS.neutral;
}

/** Loading fallback shown while GLB files download */
function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#3b82f6" wireframe />
    </mesh>
  );
}

/** Three.js scene contents (lights, layers, controls) */
function AnatomyScene({
  layers,
  selectedSystem,
  skinToneColor,
  systemModels,
  markers = [],
  selectedMarkerId,
  onMeshClick,
  onMarkerClick,
}: {
  layers: ReturnType<typeof useAnatomyLayers>;
  selectedSystem: AnatomySystem | null;
  skinToneColor?: string;
  systemModels: Record<AnatomySystem, string>;
  markers?: AnatomyViewerProps['markers'];
  selectedMarkerId?: string | null;
  onMeshClick: (meshName: string, system: AnatomySystem) => void;
  onMarkerClick?: (markerId: string) => void;
}) {
  return (
    <>
      {/* Dark background */}
      <color attach="background" args={[SCENE_BG.r, SCENE_BG.g, SCENE_BG.b]} />

      {/* Lighting — clinical white from multiple angles */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.0} />
      <directionalLight position={[-5, 5, -5]} intensity={0.6} />
      <directionalLight position={[0, -5, 5]} intensity={0.3} />
      <hemisphereLight args={['#b0d4f1', '#1e293b', 0.5]} />

      {/* Camera controls — target chest height for anatomical centering */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={0.3}
        maxDistance={20}
        target={[0, 0.8, 0]}
      />

      {/* Body system layers — gender-aware model selection */}
      <Center disableY>
          {(Object.entries(systemModels) as [AnatomySystem, string][]).map(
            ([system, modelPath]) => (
              <Suspense key={system} fallback={null}>
                <AnatomyLayer
                  system={system}
                  modelPath={modelPath}
                  visible={layers.isVisible(system)}
                  opacity={layers.getOpacity(system)}
                  highlighted={selectedSystem === system}
                  colorOverride={system === 'skin' ? skinToneColor : undefined}
                  onMeshClick={onMeshClick}
                />
              </Suspense>
            )
          )}

          {/* 3D clinical markers — rotate with the body */}
          {markers && markers.length > 0 && (
            <Marker3DGroup
              markers={markers}
              onMarkerClick={onMarkerClick}
              selectedMarkerId={selectedMarkerId}
            />
          )}
      </Center>
    </>
  );
}

/**
 * AnatomyViewer Component
 *
 * Renders a full 3D anatomy viewer with layer controls.
 * Requires a WebGL-capable browser.
 */
export const AnatomyViewer: React.FC<AnatomyViewerProps> = ({
  patientId: _patientId,
  patientName,
  skinTone,
  gender = 'neutral',
  editable = true,
  compact = false,
  markers = [],
  onStructureSelect,
  onMarkerClick,
  className,
}) => {
  const layers = useAnatomyLayers();
  const [selectedSystem, setSelectedSystem] = useState<AnatomySystem | null>(null);
  const [selectedMesh, setSelectedMesh] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  // Resolve gender-specific model file set
  const systemModels = getSystemModels(gender);

  // Resolve skin tone name to hex color for the 3D skin layer
  const skinToneColor = skinTone && skinTone in SKIN_TONE_COLORS
    ? SKIN_TONE_COLORS[skinTone as SkinTone]
    : undefined;

  const handleMeshClick = useCallback(
    (meshName: string, system: AnatomySystem) => {
      setSelectedSystem(system);
      setSelectedMesh(meshName);
      onStructureSelect?.(meshName, system);
    },
    [onStructureSelect]
  );

  const handleMarkerClick = useCallback(
    (markerId: string) => {
      setSelectedMarkerId(markerId);
      onMarkerClick?.(markerId);
    },
    [onMarkerClick]
  );

  return (
    <div
      className={`relative flex ${compact ? 'h-64' : 'h-[calc(100vh-10rem)] min-h-[500px]'} bg-slate-950 rounded-lg overflow-hidden ${className ?? ''}`}
    >
      {/* 3D Canvas — camera closer (fov 35, distance 3.5) for larger body */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [0, 0.85, 3.5], fov: 35 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
          scene={{ background: SCENE_BG }}
        >
          <Suspense fallback={<LoadingFallback />}>
            <AnatomyScene
              layers={layers}
              selectedSystem={selectedSystem}
              skinToneColor={skinToneColor}
              systemModels={systemModels}
              markers={markers}
              selectedMarkerId={selectedMarkerId}
              onMeshClick={handleMeshClick}
              onMarkerClick={handleMarkerClick}
            />
          </Suspense>
        </Canvas>

        {/* Patient info overlay */}
        {patientName && (
          <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-sm px-3 py-1 rounded backdrop-blur-sm flex items-center gap-2">
            <span>{patientName}</span>
            {gender !== 'neutral' && (
              <span className="text-[10px] uppercase tracking-wider text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded">
                {gender}
              </span>
            )}
          </div>
        )}

        {/* Selected structure info */}
        {selectedMesh && (
          <div className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-xs px-3 py-2 rounded backdrop-blur-sm max-w-xs">
            <p className="font-medium">{selectedMesh}</p>
            <p className="text-slate-400">{selectedSystem}</p>
          </div>
        )}
      </div>

      {/* Layer controls panel */}
      {editable && (
        <div className="w-52 flex-shrink-0 p-2 overflow-y-auto">
          <LayerPanel
            layers={layers.layers}
            onToggle={layers.toggleLayer}
            onOpacityChange={layers.setOpacity}
            onSolo={layers.soloLayer}
            onReset={layers.resetLayers}
            compact={compact}
            selectedSystem={selectedSystem}
          />
        </div>
      )}
    </div>
  );
};

export default AnatomyViewer;
