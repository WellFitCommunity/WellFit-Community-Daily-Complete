/**
 * Shared types for Admin Panel sections
 */

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
}

export type CategoryId = 'revenue' | 'patient-care' | 'clinical' | 'security' | 'admin';
