/**
 * Anatomy 3D - Layer System and Utility Tests
 *
 * Tests for the layer management hook, mesh classification,
 * and layer configuration utilities. Three.js rendering
 * components are NOT tested here (require WebGL context).
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnatomyLayers } from '../anatomy-3d/useAnatomyLayers';
import {
  classifyMesh,
  getLayerConfig,
  getSortedLayers,
  ANATOMY_LAYERS,
  SYSTEM_PATTERNS,
} from '../anatomy-3d/anatomyLayers';
import type { AnatomySystem } from '../anatomy-3d/types';

// ============================================
// classifyMesh - Mesh name → body system
// ============================================

describe('classifyMesh', () => {
  it('classifies skeletal structures by name', () => {
    expect(classifyMesh('Femur')).toBe('skeletal');
    expect(classifyMesh('Left Scapula')).toBe('skeletal');
    expect(classifyMesh('Cervical Vertebra C3')).toBe('skeletal');
    expect(classifyMesh('Sternum body')).toBe('skeletal');
    expect(classifyMesh('Rib cage')).toBe('skeletal');
    expect(classifyMesh('Patella.r')).toBe('skeletal');
    expect(classifyMesh('Mandible')).toBe('skeletal');
    expect(classifyMesh('Frontal bone')).toBe('skeletal');
  });

  it('classifies muscular structures by name', () => {
    expect(classifyMesh('Biceps brachii')).toBe('muscular');
    expect(classifyMesh('Right Deltoid')).toBe('muscular');
    expect(classifyMesh('Rectus abdominis')).toBe('muscular');
    expect(classifyMesh('External oblique')).toBe('muscular');
    expect(classifyMesh('Diaphragm')).toBe('muscular');
    expect(classifyMesh('Quadriceps femoris')).toBe('muscular');
    expect(classifyMesh('Pectoralis major')).toBe('muscular');
    expect(classifyMesh('Muscle of upper limb')).toBe('muscular');
  });

  it('classifies organ structures by name', () => {
    expect(classifyMesh('Heart')).toBe('organs');
    expect(classifyMesh('Right Lung')).toBe('organs');
    expect(classifyMesh('Liver')).toBe('organs');
    expect(classifyMesh('Left Kidney')).toBe('organs');
    expect(classifyMesh('Stomach')).toBe('organs');
    expect(classifyMesh('Small intestine')).toBe('organs');
    expect(classifyMesh('Gallbladder')).toBe('organs');
    expect(classifyMesh('Urinary bladder')).toBe('organs');
    expect(classifyMesh('Oesophagus')).toBe('organs');
    expect(classifyMesh('Trachea')).toBe('organs');
  });

  it('classifies vascular structures by name', () => {
    expect(classifyMesh('Aorta')).toBe('vascular');
    expect(classifyMesh('Carotid artery')).toBe('vascular');
    expect(classifyMesh('Jugular vein')).toBe('vascular');
    expect(classifyMesh('Pulmonary artery')).toBe('vascular');
    expect(classifyMesh('Femoral artery')).toBe('vascular');
    expect(classifyMesh('Vena cava')).toBe('vascular');
  });

  it('classifies nervous structures by name', () => {
    expect(classifyMesh('Brain')).toBe('nervous');
    expect(classifyMesh('Cerebellum')).toBe('nervous');
    expect(classifyMesh('Spinal cord')).toBe('nervous');
    expect(classifyMesh('Sciatic nerve')).toBe('nervous');
    expect(classifyMesh('Vagus nerve')).toBe('nervous');
    expect(classifyMesh('Thalamus')).toBe('nervous');
  });

  it('classifies skin structures by name', () => {
    expect(classifyMesh('Skin')).toBe('skin');
    expect(classifyMesh('Integument')).toBe('skin');
    expect(classifyMesh('Dermis layer')).toBe('skin');
  });

  it('defaults unrecognized meshes to skin layer', () => {
    expect(classifyMesh('Unknown structure xyz')).toBe('skin');
    expect(classifyMesh('Random mesh 001')).toBe('skin');
  });

  it('is case-insensitive', () => {
    expect(classifyMesh('FEMUR')).toBe('skeletal');
    expect(classifyMesh('heart')).toBe('organs');
    expect(classifyMesh('BRAIN')).toBe('nervous');
    expect(classifyMesh('AoRtA')).toBe('vascular');
  });
});

// ============================================
// Layer Configuration
// ============================================

describe('ANATOMY_LAYERS', () => {
  it('defines all 6 body systems', () => {
    const systems = ANATOMY_LAYERS.map(l => l.system);
    expect(systems).toContain('skin');
    expect(systems).toContain('muscular');
    expect(systems).toContain('organs');
    expect(systems).toContain('vascular');
    expect(systems).toContain('nervous');
    expect(systems).toContain('skeletal');
    expect(ANATOMY_LAYERS).toHaveLength(6);
  });

  it('has unique system names', () => {
    const systems = ANATOMY_LAYERS.map(l => l.system);
    expect(new Set(systems).size).toBe(systems.length);
  });

  it('has unique sort orders', () => {
    const orders = ANATOMY_LAYERS.map(l => l.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('has valid opacity values between 0 and 1', () => {
    for (const layer of ANATOMY_LAYERS) {
      expect(layer.defaultOpacity).toBeGreaterThanOrEqual(0);
      expect(layer.defaultOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('defaults skin and skeletal as visible', () => {
    const skin = ANATOMY_LAYERS.find(l => l.system === 'skin');
    const skeletal = ANATOMY_LAYERS.find(l => l.system === 'skeletal');
    expect(skin?.defaultVisible).toBe(true);
    expect(skeletal?.defaultVisible).toBe(true);
  });

  it('defaults muscular, organs, vascular, nervous as hidden', () => {
    const hidden = ['muscular', 'organs', 'vascular', 'nervous'] as AnatomySystem[];
    for (const sys of hidden) {
      const layer = ANATOMY_LAYERS.find(l => l.system === sys);
      expect(layer?.defaultVisible).toBe(false);
    }
  });
});

describe('getLayerConfig', () => {
  it('returns config for valid system names', () => {
    const skeletal = getLayerConfig('skeletal');
    expect(skeletal.system).toBe('skeletal');
    expect(skeletal.label).toBe('Skeletal System');
    expect(skeletal.color).toBeDefined();
  });

  it('throws for unknown system names', () => {
    expect(() => getLayerConfig('invalid' as AnatomySystem)).toThrow();
  });
});

describe('getSortedLayers', () => {
  it('returns layers sorted by order ascending', () => {
    const sorted = getSortedLayers();
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].order).toBeGreaterThan(sorted[i - 1].order);
    }
  });

  it('returns all 6 layers', () => {
    expect(getSortedLayers()).toHaveLength(6);
  });
});

describe('SYSTEM_PATTERNS', () => {
  it('defines patterns for all 6 systems', () => {
    const systems: AnatomySystem[] = ['skin', 'muscular', 'organs', 'vascular', 'nervous', 'skeletal'];
    for (const sys of systems) {
      expect(SYSTEM_PATTERNS[sys]).toBeDefined();
      expect(SYSTEM_PATTERNS[sys].length).toBeGreaterThan(0);
    }
  });
});

// ============================================
// useAnatomyLayers hook
// ============================================

describe('useAnatomyLayers', () => {
  it('initializes with default layer states', () => {
    const { result } = renderHook(() => useAnatomyLayers());

    expect(result.current.layers).toHaveLength(6);
    expect(result.current.isVisible('skin')).toBe(true);
    expect(result.current.isVisible('skeletal')).toBe(true);
    expect(result.current.isVisible('muscular')).toBe(false);
  });

  it('toggles layer visibility', () => {
    const { result } = renderHook(() => useAnatomyLayers());

    expect(result.current.isVisible('muscular')).toBe(false);

    act(() => {
      result.current.toggleLayer('muscular');
    });

    expect(result.current.isVisible('muscular')).toBe(true);

    act(() => {
      result.current.toggleLayer('muscular');
    });

    expect(result.current.isVisible('muscular')).toBe(false);
  });

  it('sets layer opacity', () => {
    const { result } = renderHook(() => useAnatomyLayers());

    act(() => {
      result.current.setOpacity('skin', 0.5);
    });

    expect(result.current.getOpacity('skin')).toBe(0.5);
  });

  it('clamps opacity to 0-1 range', () => {
    const { result } = renderHook(() => useAnatomyLayers());

    act(() => {
      result.current.setOpacity('skin', -0.5);
    });
    expect(result.current.getOpacity('skin')).toBe(0);

    act(() => {
      result.current.setOpacity('skin', 2.0);
    });
    expect(result.current.getOpacity('skin')).toBe(1);
  });

  it('solos a layer (shows only that one)', () => {
    const { result } = renderHook(() => useAnatomyLayers());

    act(() => {
      result.current.soloLayer('organs');
    });

    expect(result.current.isVisible('organs')).toBe(true);
    expect(result.current.isVisible('skin')).toBe(false);
    expect(result.current.isVisible('skeletal')).toBe(false);
    expect(result.current.isVisible('muscular')).toBe(false);
    expect(result.current.isVisible('vascular')).toBe(false);
    expect(result.current.isVisible('nervous')).toBe(false);
  });

  it('resets layers to defaults', () => {
    const { result } = renderHook(() => useAnatomyLayers());

    // Modify state
    act(() => {
      result.current.toggleLayer('skin');
      result.current.toggleLayer('muscular');
      result.current.setOpacity('skeletal', 0.3);
    });

    expect(result.current.isVisible('skin')).toBe(false);
    expect(result.current.isVisible('muscular')).toBe(true);

    // Reset
    act(() => {
      result.current.resetLayers();
    });

    expect(result.current.isVisible('skin')).toBe(true);
    expect(result.current.isVisible('muscular')).toBe(false);
    expect(result.current.getOpacity('skeletal')).toBe(1.0);
  });

  it('does not affect other layers when toggling one', () => {
    const { result } = renderHook(() => useAnatomyLayers());

    const initialSkin = result.current.isVisible('skin');
    const initialSkeletal = result.current.isVisible('skeletal');

    act(() => {
      result.current.toggleLayer('muscular');
    });

    expect(result.current.isVisible('skin')).toBe(initialSkin);
    expect(result.current.isVisible('skeletal')).toBe(initialSkeletal);
  });

  it('getOpacity returns default for unmodified layers', () => {
    const { result } = renderHook(() => useAnatomyLayers());

    // Skin default is 0.85 (clearly visible; user can lower via slider)
    expect(result.current.getOpacity('skin')).toBe(0.85);
    // Skeletal default is 1.0
    expect(result.current.getOpacity('skeletal')).toBe(1.0);
  });
});
