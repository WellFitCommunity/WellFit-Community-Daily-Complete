/**
 * Real-Time Presence Hook
 *
 * Track who is viewing the same dashboard/patient/entity in real-time.
 * Enables team awareness and prevents duplicate work.
 *
 * ATLUS: Leading - Real-time collaboration for healthcare teams
 *
 * Features:
 * - Track user presence on any room (dashboard, patient, bed)
 * - See who else is viewing the same content
 * - Automatic cleanup on disconnect
 * - User metadata (name, role, avatar)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export interface PresenceUser {
  /** User ID */
  userId: string;
  /** Display name */
  displayName: string;
  /** User role */
  role?: string;
  /** Avatar URL or initials */
  avatar?: string;
  /** What they're viewing (e.g., "patient:123", "bed:205A") */
  viewing?: string;
  /** When they joined */
  joinedAt: string;
  /** Current cursor/focus position (optional) */
  cursor?: { x: number; y: number };
  /** Is currently typing/editing */
  isEditing?: boolean;
  /** What section/field they're editing */
  editingField?: string;
}

export interface PresenceState {
  /** Current users in the room */
  users: PresenceUser[];
  /** Is connected to presence channel */
  isConnected: boolean;
  /** Current user's presence key */
  presenceKey: string | null;
  /** Error state */
  error: Error | null;
}

export interface UsePresenceOptions {
  /** Room identifier (e.g., "dashboard:bed-management", "patient:abc123") */
  roomId: string;
  /** Optional: specific entity being viewed */
  viewing?: string;
  /** Component name for debugging */
  componentName?: string;
}

export interface UsePresenceReturn extends PresenceState {
  /** Update current user's presence state */
  updatePresence: (updates: Partial<PresenceUser>) => void;
  /** Set editing state */
  setEditing: (isEditing: boolean, field?: string) => void;
  /** Get other users (excluding self) */
  otherUsers: PresenceUser[];
  /** Check if someone else is editing a field */
  isFieldBeingEdited: (field: string) => PresenceUser | null;
  /** Leave the room manually */
  leave: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function generatePresenceKey(): string {
  return `presence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePresence(options: UsePresenceOptions): UsePresenceReturn {
  const { roomId, viewing, componentName = 'UnknownComponent' } = options;
  const { user } = useAuth();

  // State
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceKey, setPresenceKey] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);
  const currentPresenceRef = useRef<PresenceUser | null>(null);

  // Build current user's presence data
  const buildPresenceData = useCallback(
    (overrides?: Partial<PresenceUser>): PresenceUser => {
      const metadata = user?.user_metadata || {};
      const displayName =
        `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() ||
        user?.email?.split('@')[0] ||
        'Anonymous';

      return {
        userId: user?.id || 'anonymous',
        displayName,
        role: metadata.role || 'user',
        avatar: metadata.avatar_url || getInitials(displayName),
        viewing,
        joinedAt: new Date().toISOString(),
        isEditing: false,
        ...overrides,
      };
    },
    [user, viewing]
  );

  // Update presence
  const updatePresence = useCallback(
    (updates: Partial<PresenceUser>) => {
      if (!channelRef.current || !presenceKey) return;

      const newPresence = {
        ...currentPresenceRef.current,
        ...updates,
      };
      currentPresenceRef.current = newPresence as PresenceUser;

      channelRef.current.track(newPresence);
    },
    [presenceKey]
  );

  // Set editing state
  const setEditing = useCallback(
    (isEditing: boolean, field?: string) => {
      updatePresence({ isEditing, editingField: field });
    },
    [updatePresence]
  );

  // Leave room
  const leave = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.untrack();
      channelRef.current.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
      setUsers([]);
    }
  }, []);

  // Setup presence channel
  useEffect(() => {
    if (!user?.id) return;

    mountedRef.current = true;
    const key = generatePresenceKey();
    setPresenceKey(key);

    const channelName = `presence:${roomId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key,
        },
      },
    });

    // Handle presence sync (initial state + updates)
    channel.on('presence', { event: 'sync' }, () => {
      if (!mountedRef.current) return;

      const state = channel.presenceState();
      const presenceUsers: PresenceUser[] = [];

      Object.entries(state).forEach(([_key, presences]) => {
        // Each key can have multiple presence entries
        // Supabase adds presence_ref to each entry, we extract PresenceUser fields
        (presences as Array<PresenceUser & { presence_ref?: string }>).forEach((presence) => {
          // Extract only PresenceUser fields, ignoring presence_ref
          const { presence_ref: _ref, ...userData } = presence as PresenceUser & { presence_ref?: string };
          if (userData.userId) {
            presenceUsers.push(userData as PresenceUser);
          }
        });
      });

      setUsers(presenceUsers);
    });

    // Handle user join
    channel.on('presence', { event: 'join' }, ({ key: _joinKey, newPresences }) => {
      if (!mountedRef.current) return;

      auditLogger.debug('PRESENCE_USER_JOINED', {
        roomId,
        component: componentName,
        users: newPresences.length,
      });
    });

    // Handle user leave
    channel.on('presence', { event: 'leave' }, ({ key: _leaveKey, leftPresences }) => {
      if (!mountedRef.current) return;

      auditLogger.debug('PRESENCE_USER_LEFT', {
        roomId,
        component: componentName,
        users: leftPresences.length,
      });
    });

    // Subscribe and track presence
    channel
      .subscribe(async (status) => {
        if (!mountedRef.current) return;

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);

          // Track our presence
          const presenceData = buildPresenceData();
          currentPresenceRef.current = presenceData;
          await channel.track(presenceData);

          auditLogger.info('PRESENCE_CONNECTED', {
            roomId,
            component: componentName,
            presenceKey: key,
          });
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setError(new Error('Presence channel error'));
          auditLogger.error('PRESENCE_CHANNEL_ERROR', 'Failed to connect to presence channel', {
            roomId,
            component: componentName,
          });
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;

      if (channelRef.current) {
        channelRef.current.untrack();
        channelRef.current.unsubscribe();
        channelRef.current = null;

        auditLogger.info('PRESENCE_DISCONNECTED', {
          roomId,
          component: componentName,
        });
      }
    };
  }, [user?.id, roomId, componentName, buildPresenceData]);

  // Update viewing when it changes
  useEffect(() => {
    if (viewing && isConnected) {
      updatePresence({ viewing });
    }
  }, [viewing, isConnected, updatePresence]);

  // Computed: other users (excluding self)
  const otherUsers = users.filter((u) => u.userId !== user?.id);

  // Check if someone else is editing a field
  const isFieldBeingEdited = useCallback(
    (field: string): PresenceUser | null => {
      return otherUsers.find((u) => u.isEditing && u.editingField === field) || null;
    },
    [otherUsers]
  );

  return {
    users,
    isConnected,
    presenceKey,
    error,
    updatePresence,
    setEditing,
    otherUsers,
    isFieldBeingEdited,
    leave,
  };
}

export default usePresence;
