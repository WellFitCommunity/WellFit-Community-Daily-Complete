/**
 * Collaboration Components
 *
 * Real-time collaboration features for healthcare teams.
 * ATLUS: Leading - Work together, stay informed
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

export { PresenceAvatars, PresenceAvatarsCompact } from './PresenceAvatars';
export { ActivityFeed, useActivityBroadcast } from './ActivityFeed';
export {
  CollaborativeIndicator,
  CollaborativeField,
  EditingBanner,
  EditingInline,
  EditingBadge,
} from './CollaborativeIndicator';

// Re-export hook for convenience
export { usePresence } from '../../hooks/usePresence';
export type { PresenceUser, UsePresenceOptions, UsePresenceReturn } from '../../hooks/usePresence';
