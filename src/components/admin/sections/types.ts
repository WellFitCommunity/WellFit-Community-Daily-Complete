/**
 * Shared types for Admin Panel sections
 */

import type { FeatureFlags } from '../../../config/featureFlags';

export interface DashboardSection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  headerColor: string;
  component: React.ReactNode;
  category: 'revenue' | 'patient-care' | 'clinical' | 'security' | 'admin';
  priority: 'high' | 'medium' | 'low';
  defaultOpen?: boolean;
  roles?: string[]; // Which roles can see this section
  /** Optional modular off-switch: section is hidden when this feature flag is false. */
  featureFlag?: keyof FeatureFlags;
}

export type CategoryId = 'revenue' | 'patient-care' | 'clinical' | 'security' | 'admin';
