// =====================================================
// MCP Prior Auth Server — Type Definitions
// =====================================================

export type PriorAuthStatus =
  | 'draft'
  | 'pending_submission'
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'denied'
  | 'partial_approval'
  | 'pending_additional_info'
  | 'cancelled'
  | 'expired'
  | 'appealed';

export type PriorAuthUrgency = 'stat' | 'urgent' | 'routine';
