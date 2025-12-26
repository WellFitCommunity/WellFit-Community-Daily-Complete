// src/adapters/wearables/index.ts
// Central export file for wearable adapters

import { wearableRegistry } from './UniversalWearableRegistry';
import { AppleHealthKitAdapter } from './implementations/AppleHealthKitAdapter';
import { FitbitAdapter } from './implementations/FitbitAdapter';
import { GarminAdapter } from './implementations/GarminAdapter';
import { WithingsAdapter } from './implementations/WithingsAdapter';
import { SamsungHealthAdapter } from './implementations/SamsungHealthAdapter';
import { AmazfitAdapter } from './implementations/AmazfitAdapter';
import { iHealthAdapter } from './implementations/iHealthAdapter';

export * from './UniversalWearableRegistry';
export { AppleHealthKitAdapter } from './implementations/AppleHealthKitAdapter';
export { FitbitAdapter } from './implementations/FitbitAdapter';
export { GarminAdapter } from './implementations/GarminAdapter';
export { WithingsAdapter } from './implementations/WithingsAdapter';
export { SamsungHealthAdapter } from './implementations/SamsungHealthAdapter';
export { AmazfitAdapter } from './implementations/AmazfitAdapter';
export { iHealthAdapter } from './implementations/iHealthAdapter';

/**
 * Register all available wearable adapters
 * Call this once during app initialization
 */
export function registerAllWearableAdapters(): void {
  // Registering all wearable adapters

  const appleAdapter = new AppleHealthKitAdapter();
  wearableRegistry.registerAdapter(appleAdapter.metadata, AppleHealthKitAdapter);

  const fitbitAdapter = new FitbitAdapter();
  wearableRegistry.registerAdapter(fitbitAdapter.metadata, FitbitAdapter);

  const garminAdapter = new GarminAdapter();
  wearableRegistry.registerAdapter(garminAdapter.metadata, GarminAdapter);

  const withingsAdapter = new WithingsAdapter();
  wearableRegistry.registerAdapter(withingsAdapter.metadata, WithingsAdapter);

  const samsungAdapter = new SamsungHealthAdapter();
  wearableRegistry.registerAdapter(samsungAdapter.metadata, SamsungHealthAdapter);

  const amazfitAdapter = new AmazfitAdapter();
  wearableRegistry.registerAdapter(amazfitAdapter.metadata, AmazfitAdapter);

  const ihealthAdapter = new iHealthAdapter();
  wearableRegistry.registerAdapter(ihealthAdapter.metadata, iHealthAdapter);

  // All 7 wearable adapters registered successfully
}

// Export singleton registry
export { wearableRegistry };
