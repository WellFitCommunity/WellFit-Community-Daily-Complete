/**
 * Voice Action Context — Type Definitions & Route Map
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

// ============================================================================
// TYPES
// ============================================================================

export type EntityType =
  | 'patient'
  | 'bed'
  | 'room'
  | 'provider'
  | 'caregiver'
  | 'referral'
  | 'alert'
  | 'task'
  | 'shift'
  | 'handoff'
  | 'medication'
  | 'diagnosis'
  | 'admission'
  | 'discharge'
  | 'medical_code'
  | 'clinical_note';

export interface ParsedEntity {
  type: EntityType;
  query: string;           // The search query (e.g., "Maria LeBlanc")
  filters: {
    // Identity filters
    name?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;  // ISO format
    mrn?: string;

    // Location filters
    roomNumber?: string;
    bedId?: string;
    unit?: string;
    unitType?: string;     // ICU, ER, med-surg, etc.

    // Clinical filters
    riskLevel?: 'critical' | 'high' | 'medium' | 'low';
    diagnosis?: string;    // CHF, diabetes, stroke, etc.
    medication?: string;   // metformin, insulin, etc.
    acuity?: 'critical' | 'high' | 'medium' | 'low';

    // Status filters
    status?: string;       // pending, active, completed, etc.
    priority?: string;     // urgent, routine, stat

    // Time filters
    timeframe?: 'today' | 'this_shift' | 'yesterday' | 'this_week' | 'this_month';
    shiftType?: 'day' | 'night' | 'current';

    // Source filters
    source?: string;       // For referrals - hospital name
    assignedTo?: string;   // For tasks - nurse/provider name
  };
  rawTranscript: string;   // Original voice input
  confidence: number;
}

export interface VoiceAction {
  id: string;
  entity: ParsedEntity;
  targetRoute: string;
  status: 'pending' | 'navigating' | 'searching' | 'completed' | 'failed';
  results?: SearchResult[];
  error?: string;
  timestamp: Date;
}

export interface SearchResult {
  id: string;
  type: EntityType;
  primaryText: string;     // e.g., "Maria LeBlanc"
  secondaryText?: string;  // e.g., "DOB: 06/10/1976 | MRN: 12345"
  matchScore: number;      // 0-100, how well it matches the query
  metadata: Record<string, unknown>;
}

export interface VoiceActionContextType {
  // Current action state
  currentAction: VoiceAction | null;
  searchResults: SearchResult[];
  isSearching: boolean;

  // Actions
  processVoiceInput: (transcript: string, confidence: number) => Promise<void>;
  selectResult: (result: SearchResult) => void;
  clearAction: () => void;

  // For dashboards to register their search handlers
  registerSearchHandler: (entityType: EntityType, handler: SearchHandler) => void;
  unregisterSearchHandler: (entityType: EntityType) => void;
}

export type SearchHandler = (entity: ParsedEntity) => Promise<SearchResult[]>;

// ============================================================================
// ROUTE MAPPING - Entity type to dashboard route
// ============================================================================

export const ENTITY_ROUTES: Record<EntityType, string> = {
  patient: '/admin',
  bed: '/bed-management',
  room: '/bed-management',
  provider: '/admin',
  caregiver: '/admin',
  referral: '/referrals',
  alert: '/clinical-alerts',
  task: '/admin',
  shift: '/shift-handoff',
  handoff: '/shift-handoff',
  medication: '/admin',
  diagnosis: '/admin',
  admission: '/admin',
  discharge: '/admin',
  medical_code: '/billing',
  clinical_note: '/admin',
};
