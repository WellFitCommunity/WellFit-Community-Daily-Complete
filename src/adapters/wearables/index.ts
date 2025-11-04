// src/adapters/wearables/index.ts
// Central export file for wearable adapters

import { wearableRegistry } from './UniversalWearableRegistry';
import { AppleHealthKitAdapter } from './implementations/AppleHealthKitAdapter';
import { FitbitAdapter } from './implementations/FitbitAdapter';
import { GarminAdapter } from './implementations/GarminAdapter';
import { WithingsAdapter } from './implementations/WithingsAdapter';
import { SamsungHealthAdapter } from './implementations/SamsungHealthAdapter';
import { AmazfitAdapter } from './implementations/AmazfitAdapter';

export * from './UniversalWearableRegistry';
export { AppleHealthKitAdapter } from './implementations/AppleHealthKitAdapter';
export { FitbitAdapter } from './implementations/FitbitAdapter';
export { GarminAdapter } from './implementations/GarminAdapter';
export { WithingsAdapter } from './implementations/WithingsAdapter';
export { SamsungHealthAdapter } from './implementations/SamsungHealthAdapter';
export { AmazfitAdapter } from './implementations/AmazfitAdapter';

/**
 * Register all available wearable adapters
 * Call this once during app initialization
 */
export function registerAllWearableAdapters(): void {
  console.log('📱 Registering all wearable adapters...');

  const appleAdapter = new AppleHealthKitAdapter();
  wearableRegistry.registerAdapter(appleAdapter.metadata, AppleHealthKitAdapter);
  console.log('✅ Apple HealthKit adapter registered');

  const fitbitAdapter = new FitbitAdapter();
  wearableRegistry.registerAdapter(fitbitAdapter.metadata, FitbitAdapter);
  console.log('✅ Fitbit adapter registered');

  const garminAdapter = new GarminAdapter();
  wearableRegistry.registerAdapter(garminAdapter.metadata, GarminAdapter);
  console.log('✅ Garmin adapter registered');

  const withingsAdapter = new WithingsAdapter();
  wearableRegistry.registerAdapter(withingsAdapter.metadata, WithingsAdapter);
  console.log('✅ Withings adapter registered');

  const samsungAdapter = new SamsungHealthAdapter();
  wearableRegistry.registerAdapter(samsungAdapter.metadata, SamsungHealthAdapter);
  console.log('✅ Samsung Health adapter registered');

  const amazfitAdapter = new AmazfitAdapter();
  wearableRegistry.registerAdapter(amazfitAdapter.metadata, AmazfitAdapter);
  console.log('✅ Amazfit adapter registered');

  console.log('🎉 All 6 wearable adapters registered successfully');
}

// Export singleton registry
export { wearableRegistry };
