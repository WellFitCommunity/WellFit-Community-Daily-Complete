/**
 * Marker3D - 3D clinical markers that attach to the anatomy model
 *
 * Renders PICC lines, wounds, devices, and other clinical markers as
 * 3D objects inside the Three.js scene so they rotate with the body.
 *
 * Each marker category uses a distinctive shape:
 * - critical: Diamond (central lines, chest tubes)
 * - moderate: Cylinder (PICC lines, IVs, catheters)
 * - informational: Cube (surgical sites, healed wounds)
 * - monitoring: Ring/torus (CGMs, cardiac monitors)
 * - chronic: Octahedron (CHF, COPD markers)
 * - neurological: Cone (neuro markers)
 */

import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { AnatomyMarkerOverlay } from './types';

/** Category color mapping (hex values) */
const MARKER_HEX: Record<string, string> = {
  critical: '#ef4444',
  moderate: '#f59e0b',
  informational: '#3b82f6',
  monitoring: '#a855f7',
  chronic: '#22c55e',
  neurological: '#f97316',
  obstetric: '#ec4899',
};

const DEFAULT_HEX = '#64748b';

/**
 * Convert 2D percentage coordinates (0-100) to 3D world position.
 *
 * The anatomy model is roughly centered at origin with:
 * - X: left (-0.3) to right (0.3)
 * - Y: feet (0) to head (~1.7)
 * - Z: front (0.15) — markers float slightly in front of the body
 */
function positionToWorld(posX: number, posY: number): [number, number, number] {
  const x = ((posX - 50) / 100) * 0.6;
  const y = 1.7 - (posY / 100) * 1.7;
  const z = 0.15;
  return [x, y, z];
}

/** Geometry for each marker category */
function MarkerGeometry({ category }: { category: string }) {
  switch (category) {
    case 'critical':
      // Diamond shape — urgent/critical devices
      return <octahedronGeometry args={[0.025, 0]} />;
    case 'moderate':
      // Cylinder — tubes and lines
      return <cylinderGeometry args={[0.008, 0.008, 0.05, 8]} />;
    case 'informational':
      // Cube — surgical sites
      return <boxGeometry args={[0.03, 0.03, 0.03]} />;
    case 'monitoring':
      // Torus (ring) — monitoring devices
      return <torusGeometry args={[0.02, 0.006, 8, 16]} />;
    case 'chronic':
      // Sphere with spikes look — chronic conditions
      return <dodecahedronGeometry args={[0.02, 0]} />;
    case 'neurological':
      // Cone — neurological markers
      return <coneGeometry args={[0.02, 0.04, 6]} />;
    default:
      return <sphereGeometry args={[0.02, 12, 12]} />;
  }
}

interface SingleMarker3DProps {
  marker: AnatomyMarkerOverlay;
  onClick?: () => void;
  isSelected?: boolean;
}

/** A single 3D marker with hover tooltip */
const SingleMarker3D: React.FC<SingleMarker3DProps> = ({ marker, onClick, isSelected }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = MARKER_HEX[marker.category] ?? DEFAULT_HEX;
  const position = useMemo(
    () => positionToWorld(marker.position_x, marker.position_y),
    [marker.position_x, marker.position_y]
  );

  // Gentle float animation for attention markers
  useFrame((state) => {
    if (!meshRef.current) return;
    if (marker.requires_attention) {
      meshRef.current.position.z = position[2] + Math.sin(state.clock.elapsedTime * 2) * 0.01;
    }
    // Slow rotation for all markers
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <group position={position}>
      {/* Glow ring for selected or attention markers */}
      {(isSelected || marker.requires_attention) && (
        <mesh>
          <ringGeometry args={[0.03, 0.04, 24]} />
          <meshBasicMaterial
            color={isSelected ? '#ffffff' : color}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Main marker shape */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <MarkerGeometry category={marker.category} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* Pending confirmation pulse ring */}
      {marker.status === 'pending_confirmation' && (
        <PulseRing color={color} />
      )}

      {/* Hover tooltip via HTML overlay (drei) */}
      {hovered && (
        <Html
          position={[0.05, 0.03, 0]}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 shadow-xl min-w-[140px] whitespace-nowrap">
            <p className="text-xs font-medium text-white">{marker.display_name}</p>
            <p className="text-[10px] text-slate-400 capitalize">
              {marker.category} — {marker.body_region.replace(/_/g, ' ')}
            </p>
            {marker.status === 'pending_confirmation' && (
              <p className="text-[10px] text-amber-400 mt-0.5">Pending confirmation</p>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

/** Animated pulse ring for pending markers */
const PulseRing: React.FC<{ color: string }> = ({ color }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
    ringRef.current.scale.set(scale, scale, 1);
    const mat = ringRef.current.material;
    if (mat instanceof THREE.MeshBasicMaterial) {
      mat.opacity = 0.4 - Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
  });

  return (
    <mesh ref={ringRef}>
      <ringGeometry args={[0.03, 0.045, 24]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

interface Marker3DGroupProps {
  markers: AnatomyMarkerOverlay[];
  onMarkerClick?: (markerId: string) => void;
  selectedMarkerId?: string | null;
}

/**
 * Marker3DGroup - Renders all clinical markers as 3D objects in the scene.
 *
 * Must be used inside a <Canvas> / R3F scene context.
 * Markers rotate with the anatomy model since they share the same 3D space.
 */
export const Marker3DGroup: React.FC<Marker3DGroupProps> = ({
  markers,
  onMarkerClick,
  selectedMarkerId,
}) => {
  const visibleMarkers = useMemo(
    () => markers.filter((m) => m.is_active && m.status !== 'rejected'),
    [markers]
  );

  if (visibleMarkers.length === 0) return null;

  return (
    <group>
      {visibleMarkers.map((marker) => (
        <SingleMarker3D
          key={marker.id}
          marker={marker}
          onClick={() => onMarkerClick?.(marker.id)}
          isSelected={selectedMarkerId === marker.id}
        />
      ))}
    </group>
  );
};

export default Marker3DGroup;
