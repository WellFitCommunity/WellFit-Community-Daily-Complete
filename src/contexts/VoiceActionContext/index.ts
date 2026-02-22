/**
 * Voice Action Context — Barrel Re-export
 *
 * All imports from 'contexts/VoiceActionContext' resolve here.
 */

// Types
export type {
  EntityType,
  ParsedEntity,
  VoiceAction,
  SearchResult,
  VoiceActionContextType,
  SearchHandler,
} from './types';

// Constants
export { ENTITY_ROUTES } from './types';

// Parser
export { parseVoiceEntity } from './parsers';

// Medical aliases (for direct access if needed)
export { DIAGNOSIS_ALIASES, MEDICATION_ALIASES, UNIT_ALIASES } from './medicalAliases';

// Provider & Hooks
export {
  VoiceActionProvider,
  useVoiceAction,
  useVoiceActionSafe,
  useVoiceSearchHandler,
} from './VoiceActionProvider';

// Default export (the context itself)
export { default } from './VoiceActionProvider';
