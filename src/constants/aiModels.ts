/**
 * Canonical AI Model Version Constants
 *
 * Single source of truth for model IDs used across the service layer.
 * These MUST match the versions pinned in the `ai_skills` database table.
 *
 * When Anthropic releases new model versions:
 * 1. Update the constants here
 * 2. Update ai_skills.model in a migration
 * 3. Update supabase/functions/_shared/models.ts (edge function mirror)
 * 4. Run full test suite to verify
 *
 * Copyright © 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

/** Fast tier — UI personalization, quick responses, low-cost operations */
export const HAIKU_MODEL = 'claude-haiku-4-5-20250929';

/** Accurate tier — clinical analysis, billing, medical coding, risk assessment */
export const SONNET_MODEL = 'claude-sonnet-4-5-20250929';

/** Complex tier — reserved for multi-step reasoning, research, complex clinical decisions */
export const OPUS_MODEL = 'claude-opus-4-5-20251101';
