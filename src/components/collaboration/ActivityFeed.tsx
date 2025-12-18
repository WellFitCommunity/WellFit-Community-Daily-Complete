/**
 * Activity Feed Component
 *
 * Real-time feed showing team activity on shared resources.
 * Keeps everyone informed of changes as they happen.
 *
 * ATLUS: Leading - Stay informed in real-time
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  User,
  BedDouble,
  AlertTriangle,
  CheckCircle,
  Edit2,
  Eye,
  LogIn,
  LogOut,
  Bell,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { auditLogger } from '../../services/auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export interface ActivityEvent {
  id: string;
  type: 'view' | 'edit' | 'create' | 'update' | 'delete' | 'join' | 'leave' | 'alert';
  entityType: 'patient' | 'bed' | 'alert' | 'task' | 'handoff' | 'user';
  entityId?: string;
  entityName?: string;
  userId: string;
  userName: string;
  userRole?: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  /** Room/context to show activity for */
  roomId: string;
  /** Maximum events to show */
  maxEvents?: number;
  /** Show as floating panel */
  floating?: boolean;
  /** Additional className */
  className?: string;
  /** Callback when new activity arrives */
  onNewActivity?: (event: ActivityEvent) => void;
}

// ============================================================================
// ICONS & COLORS
// ============================================================================

const eventIcons: Record<ActivityEvent['type'], React.ReactNode> = {
  view: <Eye className="w-4 h-4" />,
  edit: <Edit2 className="w-4 h-4" />,
  create: <CheckCircle className="w-4 h-4" />,
  update: <Edit2 className="w-4 h-4" />,
  delete: <X className="w-4 h-4" />,
  join: <LogIn className="w-4 h-4" />,
  leave: <LogOut className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
};

const eventColors: Record<ActivityEvent['type'], string> = {
  view: 'text-blue-400 bg-blue-400/10',
  edit: 'text-amber-400 bg-amber-400/10',
  create: 'text-green-400 bg-green-400/10',
  update: 'text-teal-400 bg-teal-400/10',
  delete: 'text-red-400 bg-red-400/10',
  join: 'text-emerald-400 bg-emerald-400/10',
  leave: 'text-slate-400 bg-slate-400/10',
  alert: 'text-red-400 bg-red-400/10',
};

const entityIcons: Record<ActivityEvent['entityType'], React.ReactNode> = {
  patient: <User className="w-3 h-3" />,
  bed: <BedDouble className="w-3 h-3" />,
  alert: <Bell className="w-3 h-3" />,
  task: <CheckCircle className="w-3 h-3" />,
  handoff: <Activity className="w-3 h-3" />,
  user: <User className="w-3 h-3" />,
};

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return then.toLocaleDateString();
}

// ============================================================================
// ACTIVITY ITEM
// ============================================================================

const ActivityItem: React.FC<{ event: ActivityEvent }> = React.memo(({ event }) => {
  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-slate-800/50 rounded-lg transition-colors">
      {/* Icon */}
      <div className={`p-1.5 rounded-lg ${eventColors[event.type]}`}>
        {eventIcons[event.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-white truncate">{event.userName}</span>
          {event.userRole && (
            <span className="text-xs text-slate-500 capitalize">
              {event.userRole.replace('_', ' ')}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 truncate">{event.description}</p>
        {event.entityName && (
          <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
            {entityIcons[event.entityType]}
            <span>{event.entityName}</span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-slate-500 whitespace-nowrap">
        {formatTimeAgo(event.timestamp)}
      </span>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  roomId,
  maxEvents = 20,
  floating = false,
  className = '',
  onNewActivity,
}) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(!floating);

  // Broadcast activity event
  const broadcastActivity = useCallback(
    async (event: Omit<ActivityEvent, 'id' | 'timestamp' | 'userId' | 'userName' | 'userRole'>) => {
      if (!user) return;

      const metadata = user.user_metadata || {};
      const fullEvent: ActivityEvent = {
        ...event,
        id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName:
          `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() ||
          user.email?.split('@')[0] ||
          'Unknown',
        userRole: metadata.role,
      };

      // Broadcast via Supabase channel
      const channel = supabase.channel(`activity:${roomId}`);
      await channel.send({
        type: 'broadcast',
        event: 'activity',
        payload: fullEvent,
      });

      // Add to local state
      setEvents((prev) => [fullEvent, ...prev].slice(0, maxEvents));

      // Notify parent
      onNewActivity?.(fullEvent);
    },
    [user, roomId, maxEvents, onNewActivity]
  );

  // Subscribe to activity broadcasts and announce join/leave
  useEffect(() => {
    const channel = supabase.channel(`activity:${roomId}`);

    channel
      .on('broadcast', { event: 'activity' }, ({ payload }) => {
        const activityEvent = payload as ActivityEvent;

        // Don't duplicate own events
        if (activityEvent.userId === user?.id) return;

        setEvents((prev) => [activityEvent, ...prev].slice(0, maxEvents));
        onNewActivity?.(activityEvent);

        auditLogger.debug('ACTIVITY_RECEIVED', {
          roomId,
          type: activityEvent.type,
          entityType: activityEvent.entityType,
        });
      })
      .subscribe();

    // Announce user joined the room
    broadcastActivity({
      type: 'join',
      entityType: 'user',
      description: 'joined the room',
    });

    return () => {
      // Announce user leaving the room
      broadcastActivity({
        type: 'leave',
        entityType: 'user',
        description: 'left the room',
      });
      channel.unsubscribe();
    };
  }, [roomId, user?.id, maxEvents, onNewActivity, broadcastActivity]);

  // Floating variant
  if (floating) {
    return (
      <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
        {/* Toggle button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow-lg border border-slate-600 transition-colors"
        >
          <Activity className="w-4 h-4 text-teal-400" />
          <span className="text-sm">Activity</span>
          {events.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-teal-500 text-white rounded-full">
              {events.length}
            </span>
          )}
        </button>

        {/* Expanded panel */}
        {isExpanded && (
          <div className="absolute bottom-full right-0 mb-2 w-80 max-h-96 bg-slate-800 rounded-lg shadow-2xl border border-slate-600 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <span className="font-medium text-white">Team Activity</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {events.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No activity yet
                </div>
              ) : (
                <div className="py-1">
                  {events.map((event) => (
                    <ActivityItem key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Inline variant
  return (
    <div className={`bg-slate-800/50 rounded-lg border border-slate-700 ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-400" />
          <span className="font-medium text-white">Team Activity</span>
        </div>
        {events.length > 0 && (
          <span className="text-xs text-slate-400">{events.length} events</span>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {events.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No activity yet
          </div>
        ) : (
          <div className="py-1">
            {events.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// HOOK FOR BROADCASTING
// ============================================================================

export function useActivityBroadcast(roomId: string) {
  const { user } = useAuth();

  const broadcast = useCallback(
    async (
      type: ActivityEvent['type'],
      entityType: ActivityEvent['entityType'],
      description: string,
      entityId?: string,
      entityName?: string
    ) => {
      if (!user) return;

      const metadata = user.user_metadata || {};
      const event: ActivityEvent = {
        id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        entityType,
        entityId,
        entityName,
        userId: user.id,
        userName:
          `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() ||
          user.email?.split('@')[0] ||
          'Unknown',
        userRole: metadata.role,
        description,
        timestamp: new Date().toISOString(),
      };

      try {
        const channel = supabase.channel(`activity:${roomId}`);
        await channel.send({
          type: 'broadcast',
          event: 'activity',
          payload: event,
        });
      } catch (err) {
        auditLogger.warn('ACTIVITY_BROADCAST_FAILED', { error: String(err), roomId });
      }
    },
    [user, roomId]
  );

  return { broadcast };
}

export default ActivityFeed;
