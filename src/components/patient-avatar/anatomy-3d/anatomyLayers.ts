/**
 * Anatomy Layer Definitions
 *
 * Defines the body system layers, their display properties,
 * and the mapping from GLTF mesh name patterns to systems.
 *
 * These definitions drive the layer toggle panel and the
 * mesh-to-system indexing when a GLTF model is loaded.
 */

import type { AnatomyLayerConfig, AnatomySystem } from './types';

/** Layer configuration for the 6 body systems */
export const ANATOMY_LAYERS: readonly AnatomyLayerConfig[] = [
  {
    system: 'skin',
    label: 'Skin & Surface',
    color: '#D4A574',    // Visible warm skin tone
    defaultVisible: false, // Hidden by default — skeleton is the primary clinical visual.
                           // Skin loads fastest (126KB) and briefly shows as a ghostly
                           // silhouette before skeleton (1.3MB) loads. Toggle on via panel.
    defaultOpacity: 0.25,
    order: 1,
  },
  {
    system: 'muscular',
    label: 'Muscular System',
    color: '#E74C3C',    // Red
    defaultVisible: false,
    defaultOpacity: 1.0,
    order: 2,
  },
  {
    system: 'vascular',
    label: 'Vascular System',
    color: '#3498DB',    // Blue
    defaultVisible: false,
    defaultOpacity: 1.0,
    order: 3,
  },
  {
    system: 'organs',
    label: 'Internal Organs',
    color: '#E67E22',    // Orange
    defaultVisible: false,
    defaultOpacity: 1.0,
    order: 4,
  },
  {
    system: 'nervous',
    label: 'Nervous System',
    color: '#F1C40F',    // Yellow
    defaultVisible: false,
    defaultOpacity: 1.0,
    order: 5,
  },
  {
    system: 'skeletal',
    label: 'Skeletal System',
    color: '#ECF0F1',    // Off-white/bone
    defaultVisible: true,
    defaultOpacity: 1.0,
    order: 6,
  },
] as const;

/**
 * Mesh name patterns used to classify GLTF mesh nodes into body systems.
 *
 * Z-Anatomy uses descriptive mesh names (e.g., "Femur", "Biceps brachii",
 * "Heart", "Aorta"). These patterns match against mesh names to assign
 * each mesh to the correct body system layer.
 *
 * Pattern matching is case-insensitive and checks for substring matches.
 */
export const SYSTEM_PATTERNS: Record<AnatomySystem, readonly string[]> = {
  skeletal: [
    'bone', 'vertebr', 'rib', 'sternum', 'clavicle', 'scapula',
    'humerus', 'radius', 'ulna', 'carpal', 'metacarpal', 'phalanx',
    'femur', 'tibia', 'fibula', 'tarsal', 'metatarsal', 'patella',
    'pelvis', 'ilium', 'ischium', 'pubis', 'sacrum', 'coccyx',
    'skull', 'mandible', 'maxilla', 'cranium', 'frontal', 'parietal',
    'temporal', 'occipital', 'sphenoid', 'ethmoid', 'zygomatic',
    'nasal', 'lacrimal', 'palatine', 'vomer', 'hyoid',
    'cartilage', 'disc', 'meniscus', 'ligament', 'tendon',
    'skeleton', 'osseous',
  ],
  muscular: [
    'muscle', 'muscul', 'deltoid', 'bicep', 'tricep', 'pectoral',
    'trapezius', 'latissimus', 'rectus', 'oblique', 'transvers',
    'gluteus', 'quadricep', 'hamstring', 'gastrocnemius', 'soleus',
    'diaphragm', 'intercostal', 'serratus', 'rhomboid',
    'supraspinat', 'infraspinat', 'subscapular', 'teres',
    'brachialis', 'brachiradialis', 'flexor', 'extensor',
    'adductor', 'abductor', 'sartorius', 'gracilis',
    'fascia', 'aponeurosis',
  ],
  organs: [
    'heart', 'lung', 'liver', 'kidney', 'stomach', 'intestin',
    'colon', 'pancreas', 'spleen', 'gallbladder', 'bladder',
    'esophag', 'oesophag', 'trachea', 'bronch', 'thyroid',
    'adrenal', 'pituitary', 'thymus', 'prostate', 'uterus',
    'ovary', 'testis', 'epididymis', 'appendix', 'cecum',
    'duodenum', 'jejunum', 'ileum', 'rectum', 'anus',
    'larynx', 'pharynx', 'tongue', 'eye', 'ear', 'nose',
    'organ', 'viscera', 'pleura', 'peritoneum', 'mesentery',
  ],
  vascular: [
    'artery', 'arter', 'vein', 'venous', 'aorta', 'vena cava',
    'carotid', 'jugular', 'subclavian', 'axillary', 'brachial',
    'radial', 'ulnar', 'iliac', 'femoral', 'popliteal', 'tibial',
    'pulmonary', 'coronary', 'hepatic', 'renal', 'splenic',
    'mesenteric', 'portal', 'saphenous', 'cephalic', 'basilic',
    'capillary', 'lymph', 'node', 'duct', 'vessel', 'vascular',
    'blood', 'circulat',
  ],
  nervous: [
    'nerve', 'neural', 'brain', 'cerebr', 'cerebell', 'cortex',
    'spinal cord', 'medulla', 'pons', 'midbrain', 'thalamus',
    'hypothalamus', 'hippocampus', 'amygdala', 'ganglion',
    'plexus', 'sciatic', 'femoral nerve', 'tibial nerve',
    'median', 'ulnar nerve', 'radial nerve', 'vagus',
    'trigeminal', 'facial nerve', 'optic', 'auditory',
    'sympathetic', 'parasympathetic', 'neuron', 'axon',
  ],
  skin: [
    'skin', 'integument', 'dermis', 'epidermis', 'subcutaneous',
    'surface', 'body surface', 'exterior', 'outer',
    'nipple', 'navel', 'umbilicus',
  ],
};

/**
 * Classify a GLTF mesh name into a body system.
 * Returns 'skin' as fallback if no pattern matches (unclassified
 * meshes are treated as surface/skin layer).
 */
export function classifyMesh(meshName: string): AnatomySystem {
  const lower = meshName.toLowerCase();

  for (const [system, patterns] of Object.entries(SYSTEM_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return system as AnatomySystem;
      }
    }
  }

  // Default: unclassified meshes go to skin layer
  return 'skin';
}

/** Get layer config by system name */
export function getLayerConfig(system: AnatomySystem): AnatomyLayerConfig {
  const config = ANATOMY_LAYERS.find(l => l.system === system);
  if (!config) {
    throw new Error(`Unknown anatomy system: ${system}`);
  }
  return config;
}

/** Get all layer configs sorted by display order */
export function getSortedLayers(): readonly AnatomyLayerConfig[] {
  return [...ANATOMY_LAYERS].sort((a, b) => a.order - b.order);
}
