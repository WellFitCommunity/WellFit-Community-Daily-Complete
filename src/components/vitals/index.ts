/**
 * Vitals Component Module
 * Multi-modal vital sign capture for web
 */

// Main component
export { VitalCapture, default as VitalCaptureComponent } from './VitalCapture';

// Hooks
export { useCapabilities, getCapabilityMessage } from './useCapabilities';
export { useBluetooth } from './useBluetooth';
export { useCameraScan } from './useCameraScan';

// Types
export * from './types';
