/**
 * Presence Avatars Component
 *
 * Displays avatars of users currently viewing the same dashboard/patient.
 * Provides real-time team awareness.
 *
 * ATLUS: Leading - See your team in real-time
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { Users, Eye, Edit2 } from 'lucide-react';
import { PresenceUser } from '../../hooks/usePresence';

// ============================================================================
// TYPES
// ============================================================================

interface PresenceAvatarsProps {
  /** Users currently in the room */
  users: PresenceUser[];
  /** Maximum avatars to show before "+N" */
  maxDisplay?: number;
  /** Show "viewing" indicator */
  showViewing?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

const roleColors: Record<string, string> = {
  physician: 'ring-purple-500 bg-purple-600',
  doctor: 'ring-purple-500 bg-purple-600',
  nurse: 'ring-blue-500 bg-blue-600',
  admin: 'ring-amber-500 bg-amber-600',
  super_admin: 'ring-red-500 bg-red-600',
  case_manager: 'ring-green-500 bg-green-600',
  social_worker: 'ring-teal-500 bg-teal-600',
  pt: 'ring-orange-500 bg-orange-600',
  physical_therapist: 'ring-orange-500 bg-orange-600',
  default: 'ring-slate-500 bg-slate-600',
};

function getRoleColor(role?: string): string {
  if (!role) return roleColors.default;
  return roleColors[role.toLowerCase()] || roleColors.default;
}

// ============================================================================
// AVATAR COMPONENT
// ============================================================================

const Avatar: React.FC<{
  user: PresenceUser;
  size: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  showViewing?: boolean;
}> = React.memo(({ user, size, showTooltip = true, showViewing = false }) => {
  const isInitials = !user.avatar?.startsWith('http');
  const roleColor = getRoleColor(user.role);

  return (
    <div className="relative group">
      <div
        className={`
          ${sizeClasses[size]}
          ${roleColor}
          rounded-full flex items-center justify-center
          text-white font-medium ring-2 ring-offset-1 ring-offset-slate-900
          transition-transform hover:scale-110 hover:z-10
          ${user.isEditing ? 'animate-pulse' : ''}
        `}
      >
        {isInitials ? (
          <span>{user.avatar}</span>
        ) : (
          <img
            src={user.avatar}
            alt={user.displayName}
            className="w-full h-full rounded-full object-cover"
          />
        )}

        {/* Editing indicator */}
        {user.isEditing && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center ring-2 ring-slate-900">
            <Edit2 className="w-2.5 h-2.5 text-white" />
          </div>
        )}

        {/* Viewing indicator (shows when showViewing is true and user has viewing data) */}
        {showViewing && user.viewing && !user.isEditing && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-slate-900">
            <Eye className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          <div className="font-medium">{user.displayName}</div>
          {user.role && (
            <div className="text-slate-400 capitalize">{user.role.replace('_', ' ')}</div>
          )}
          {user.isEditing && user.editingField && (
            <div className="text-amber-400 flex items-center gap-1 mt-1">
              <Edit2 className="w-3 h-3" />
              Editing: {user.editingField}
            </div>
          )}
          {showViewing && user.viewing && (
            <div className="text-slate-400 flex items-center gap-1 mt-1">
              <Eye className="w-3 h-3" />
              {user.viewing}
            </div>
          )}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = React.memo(
  ({ users, maxDisplay = 4, showViewing = false, size = 'md', className = '' }) => {
    if (users.length === 0) return null;

    const displayUsers = users.slice(0, maxDisplay);
    const remainingCount = users.length - maxDisplay;
    const editingUsers = users.filter((u) => u.isEditing);
    const viewingUsers = users.filter((u) => u.viewing && !u.isEditing);

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Label */}
        <div className="flex items-center gap-1 text-slate-400 text-sm">
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">
            {users.length} {users.length === 1 ? 'viewer' : 'viewers'}
          </span>
        </div>

        {/* Avatar Stack */}
        <div className="flex -space-x-2">
          {displayUsers.map((user) => (
            <Avatar key={user.userId} user={user} size={size} showViewing={showViewing} />
          ))}

          {/* Overflow indicator */}
          {remainingCount > 0 && (
            <div
              className={`
                ${sizeClasses[size]}
                rounded-full flex items-center justify-center
                bg-slate-700 text-white font-medium
                ring-2 ring-offset-1 ring-offset-slate-900 ring-slate-600
              `}
            >
              +{remainingCount}
            </div>
          )}
        </div>

        {/* Editing indicator */}
        {editingUsers.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
            <Edit2 className="w-3 h-3" />
            <span>
              {editingUsers.length} editing
            </span>
          </div>
        )}

        {/* Viewing indicator (shows what resources users are viewing) */}
        {showViewing && viewingUsers.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            <Eye className="w-3 h-3" />
            <span>
              {viewingUsers.length} viewing
            </span>
          </div>
        )}
      </div>
    );
  }
);

// ============================================================================
// COMPACT VARIANT
// ============================================================================

export const PresenceAvatarsCompact: React.FC<{
  users: PresenceUser[];
  className?: string;
}> = React.memo(({ users, className = '' }) => {
  if (users.length === 0) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex -space-x-1.5">
        {users.slice(0, 3).map((user) => (
          <Avatar key={user.userId} user={user} size="sm" />
        ))}
      </div>
      {users.length > 3 && (
        <span className="text-xs text-slate-400">+{users.length - 3}</span>
      )}
    </div>
  );
});

export default PresenceAvatars;
