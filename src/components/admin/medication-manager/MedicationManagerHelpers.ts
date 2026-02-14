/**
 * Helper functions and constants for MedicationManager
 */

export const HIGH_RISK_CATEGORIES = [
  'anticoagulants',
  'opioids',
  'insulin',
  'chemotherapy',
  'immunosuppressants',
  'digoxin',
  'lithium',
  'methotrexate',
  'neuromuscular_blocking_agents'
];

export const getRiskBadgeColor = (level: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (level) {
    case 'CRITICAL': return 'destructive';
    case 'HIGH': return 'destructive';
    case 'MODERATE': return 'secondary';
    default: return 'default';
  }
};

export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'CONTRAINDICATED': return 'bg-red-100 text-red-800 border-red-300';
    case 'MAJOR': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'MODERATE': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    default: return 'bg-blue-100 text-blue-800 border-blue-300';
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'URGENT': return 'bg-red-100 text-red-800';
    case 'HIGH': return 'bg-orange-100 text-orange-800';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-green-100 text-green-800';
  }
};
