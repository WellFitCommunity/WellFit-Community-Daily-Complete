/**
 * useAnatomyLayers - State management for anatomy layer visibility
 *
 * Manages the visible/opacity state for each body system layer.
 * Initialized from ANATOMY_LAYERS defaults.
 */

import { useState, useCallback, useMemo } from 'react';
import type { AnatomySystem, LayerState } from './types';
import { ANATOMY_LAYERS } from './anatomyLayers';

interface UseAnatomyLayersReturn {
  /** Current state of all layers */
  layers: readonly LayerState[];
  /** Toggle a layer's visibility */
  toggleLayer: (system: AnatomySystem) => void;
  /** Set a layer's opacity (0.0 - 1.0) */
  setOpacity: (system: AnatomySystem, opacity: number) => void;
  /** Show only one system (solo mode) */
  soloLayer: (system: AnatomySystem) => void;
  /** Reset all layers to defaults */
  resetLayers: () => void;
  /** Check if a system is currently visible */
  isVisible: (system: AnatomySystem) => boolean;
  /** Get opacity for a system */
  getOpacity: (system: AnatomySystem) => number;
}

function createDefaultState(): LayerState[] {
  return ANATOMY_LAYERS.map(config => ({
    system: config.system,
    visible: config.defaultVisible,
    opacity: config.defaultOpacity,
  }));
}

export function useAnatomyLayers(): UseAnatomyLayersReturn {
  const [layers, setLayers] = useState<LayerState[]>(createDefaultState);

  const toggleLayer = useCallback((system: AnatomySystem) => {
    setLayers(prev =>
      prev.map(layer =>
        layer.system === system
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    );
  }, []);

  const setOpacity = useCallback((system: AnatomySystem, opacity: number) => {
    const clamped = Math.max(0, Math.min(1, opacity));
    setLayers(prev =>
      prev.map(layer =>
        layer.system === system
          ? { ...layer, opacity: clamped }
          : layer
      )
    );
  }, []);

  const soloLayer = useCallback((system: AnatomySystem) => {
    setLayers(prev =>
      prev.map(layer => ({
        ...layer,
        visible: layer.system === system,
        opacity: layer.system === system ? 1.0 : layer.opacity,
      }))
    );
  }, []);

  const resetLayers = useCallback(() => {
    setLayers(createDefaultState());
  }, []);

  const isVisible = useCallback(
    (system: AnatomySystem) =>
      layers.find(l => l.system === system)?.visible ?? false,
    [layers]
  );

  const getOpacity = useCallback(
    (system: AnatomySystem) =>
      layers.find(l => l.system === system)?.opacity ?? 1.0,
    [layers]
  );

  return useMemo(
    () => ({
      layers,
      toggleLayer,
      setOpacity,
      soloLayer,
      resetLayers,
      isVisible,
      getOpacity,
    }),
    [layers, toggleLayer, setOpacity, soloLayer, resetLayers, isVisible, getOpacity]
  );
}
