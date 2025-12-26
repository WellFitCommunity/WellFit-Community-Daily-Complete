/**
 * Monitoring Devices & Implants Marker Types
 *
 * Includes: CGM, cardiac monitors, pacemakers, pumps, shunts, stimulators
 */

import { MarkerTypeDefinition } from '../../../../types/patientAvatar';

/**
 * Monitoring devices (external, wearable)
 */
export const MONITORING_DEVICE_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'cgm',
    display_name: 'Continuous Glucose Monitor',
    category: 'monitoring',
    default_body_region: 'arm_upper_right',
    default_body_view: 'front',
    default_position: { x: 20, y: 33 },
    keywords: ['cgm', 'continuous glucose', 'dexcom', 'libre', 'glucose monitor'],
    laterality_adjustments: {
      left: { x: 80, y: 33 },
      right: { x: 20, y: 33 },
    },
  },
  {
    type: 'cardiac_monitor',
    display_name: 'Cardiac Monitor Leads',
    category: 'monitoring',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 55, y: 30 },
    keywords: ['cardiac monitor', 'ecg leads', 'ekg leads', 'telemetry'],
  },
  {
    type: 'pulse_ox_continuous',
    display_name: 'Continuous Pulse Oximeter',
    category: 'monitoring',
    default_body_region: 'hand_right',
    default_body_view: 'front',
    default_position: { x: 8, y: 66 },
    keywords: ['pulse ox', 'pulse oximeter', 'spo2 monitor'],
  },
  {
    type: 'holter_monitor',
    display_name: 'Holter Monitor',
    category: 'monitoring',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 58, y: 32 },
    keywords: ['holter', 'holter monitor', '24 hour monitor'],
  },
];

/**
 * Implanted devices
 */
export const IMPLANT_TYPES: MarkerTypeDefinition[] = [
  {
    type: 'pacemaker',
    display_name: 'Pacemaker',
    category: 'informational',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 62, y: 28 },
    keywords: ['pacemaker', 'pacer', 'cardiac pacemaker'],
  },
  {
    type: 'icd',
    display_name: 'ICD (Defibrillator)',
    category: 'informational',
    default_body_region: 'chest_left',
    default_body_view: 'front',
    default_position: { x: 62, y: 28 },
    keywords: ['icd', 'implantable defibrillator', 'aicd', 'implantable cardioverter'],
  },
  {
    type: 'insulin_pump',
    display_name: 'Insulin Pump',
    category: 'monitoring',
    default_body_region: 'abdomen_right',
    default_body_view: 'front',
    default_position: { x: 40, y: 48 },
    keywords: ['insulin pump', 'omnipod', 'tandem', 'medtronic pump'],
  },
  {
    type: 'pain_pump',
    display_name: 'Pain Pump',
    category: 'informational',
    default_body_region: 'abdomen_left',
    default_body_view: 'front',
    default_position: { x: 60, y: 50 },
    keywords: ['pain pump', 'intrathecal pump', 'baclofen pump'],
  },
  {
    type: 'vp_shunt',
    display_name: 'VP Shunt',
    category: 'informational',
    default_body_region: 'head_top',
    default_body_view: 'front',
    default_position: { x: 48, y: 8 },
    keywords: ['vp shunt', 'ventriculoperitoneal', 'brain shunt', 'csf shunt'],
  },
  {
    type: 'dbs',
    display_name: 'Deep Brain Stimulator',
    category: 'informational',
    default_body_region: 'brain',
    default_body_view: 'front',
    default_position: { x: 50, y: 8 },
    keywords: ['dbs', 'deep brain stimulator', 'brain stimulator'],
  },
  {
    type: 'cochlear_implant',
    display_name: 'Cochlear Implant',
    category: 'informational',
    default_body_region: 'head_back',
    default_body_view: 'back',
    default_position: { x: 45, y: 10 },
    keywords: ['cochlear implant', 'cochlear'],
    laterality_adjustments: {
      left: { x: 55, y: 10 },
      right: { x: 45, y: 10 },
    },
  },
  {
    type: 'spinal_cord_stimulator',
    display_name: 'Spinal Cord Stimulator',
    category: 'informational',
    default_body_region: 'spine_lower',
    default_body_view: 'back',
    default_position: { x: 50, y: 52 },
    keywords: ['spinal cord stimulator', 'scs', 'dorsal column stimulator'],
  },
];
