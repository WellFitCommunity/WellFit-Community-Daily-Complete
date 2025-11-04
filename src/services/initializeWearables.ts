// src/services/initializeWearables.ts
// Initialize and register all wearable adapters during app startup

import { registerAllWearableAdapters } from '../adapters/wearables';

/**
 * Initialize wearable integration system
 * Call this once during app initialization
 */
export function initializeWearables(): void {
  try {
    

    // Register all adapters
    registerAllWearableAdapters();

    
  } catch (error) {
    
    // Don't throw - wearables are optional feature, app should continue
  }
}
