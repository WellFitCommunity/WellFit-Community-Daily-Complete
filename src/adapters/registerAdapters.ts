/**
 * Adapter Registration
 *
 * Central registration of all EHR/EMR adapters
 * Auto-loads all adapters on application startup
 */

import { adapterRegistry } from './UniversalAdapterRegistry';
import { GenericFHIRAdapter } from './implementations/GenericFHIRAdapter';
import { EpicFHIRAdapter } from './implementations/EpicFHIRAdapter';
import { CernerFHIRAdapter } from './implementations/CernerFHIRAdapter';
import { MeditechFHIRAdapter } from './implementations/MeditechFHIRAdapter';

/**
 * Register all available adapters
 * Call this on application initialization
 */
export function registerAllAdapters(): void {


  // Generic FHIR R4 (works with any FHIR server)
  const genericAdapter = new GenericFHIRAdapter();
  adapterRegistry.registerAdapter(genericAdapter.metadata, GenericFHIRAdapter);

  // Epic Systems
  const epicAdapter = new EpicFHIRAdapter();
  adapterRegistry.registerAdapter(epicAdapter.metadata, EpicFHIRAdapter);

  // Cerner (Oracle Health)
  const cernerAdapter = new CernerFHIRAdapter();
  adapterRegistry.registerAdapter(cernerAdapter.metadata, CernerFHIRAdapter);

  // Meditech
  const meditechAdapter = new MeditechFHIRAdapter();
  adapterRegistry.registerAdapter(meditechAdapter.metadata, MeditechFHIRAdapter);


  adapterRegistry.listAdapters().forEach(adapter => {
    console.log(`  - ${adapter.name} (${adapter.id}) by ${adapter.vendor}`);
  });
}

/**
 * Get adapter by vendor name (convenience function)
 */
export function getAdapterByVendor(vendor: string): string | null {
  const vendorMap: Record<string, string> = {
    'epic': 'epic-fhir',
    'cerner': 'cerner-fhir',
    'oracle': 'cerner-fhir',
    'oracle health': 'cerner-fhir',
    'meditech': 'meditech-fhir',
    'generic': 'generic-fhir',
    'fhir': 'generic-fhir',
  };

  return vendorMap[vendor.toLowerCase()] || null;
}

/**
 * Auto-detect EHR vendor from endpoint URL
 */
export function detectVendorFromUrl(url: string): string | null {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('epic')) return 'epic-fhir';
  if (lowerUrl.includes('cerner')) return 'cerner-fhir';
  if (lowerUrl.includes('meditech')) return 'meditech-fhir';

  return 'generic-fhir'; // Default to generic
}

// Auto-register on import
registerAllAdapters();
