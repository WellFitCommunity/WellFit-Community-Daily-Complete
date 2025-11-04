// src/services/initializeWearables.ts
// Initialize and register all wearable adapters during app startup

import { registerAllWearableAdapters } from '../adapters/wearables';

/**
 * Initialize wearable integration system
 * Call this once during app initialization
 */
export function initializeWearables(): void {
  try {
    console.log('🔧 Initializing wearable integration system...');

    // Register all adapters
    registerAllWearableAdapters();

    console.log('✅ Wearable integration system initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize wearable system:', error);
    // Don't throw - wearables are optional feature, app should continue
  }
}
