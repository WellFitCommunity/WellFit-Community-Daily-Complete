/**
 * Collaborative Indicator Component
 *
 * Shows when another user is editing a field or section.
 * Prevents accidental overwrites and conflicts.
 *
 * ATLUS: Leading - Prevent conflicts, work together
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { Edit2, Lock, AlertTriangle } from 'lucide-react';
import { PresenceUser } from '../../hooks/usePresence';

// ============================================================================
// TYPES
// ============================================================================

interface CollaborativeIndicatorProps {
  /** User who is editing (null if no one) */
  editingUser: PresenceUser | null;
  /** Field/section being edited */
  fieldName?: string;
  /** Variant style */
  variant?: 'banner' | 'inline' | 'badge';
  /** Additional className */
  className?: string;
}

interface EditingBannerProps {
  /** User who is editing */
  user: PresenceUser;
  /** Field being edited */
  fieldName?: string;
  /** Close handler */
  onClose?: () => void;
  /** Additional className */
  className?: string;
}

// ============================================================================
// EDITING BANNER (Full-width warning)
// ============================================================================

export const EditingBanner: React.FC<EditingBannerProps> = React.memo(
  ({ user, fieldName, onClose: _onClose, className = '' }) => {
    return (
      <div
        className={`
          flex items-center justify-between gap-3 px-4 py-2
          bg-amber-500/20 border border-amber-500/30 rounded-lg
          ${className}
        `}
      >
        <div className="flex items-center gap-3">
          {/* Animated edit icon */}
          <div className="p-1.5 bg-amber-500/20 rounded-lg">
            <Edit2 className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>

          {/* Message */}
          <div className="text-sm">
            <span className="font-medium text-amber-300">{user.displayName}</span>
            <span className="text-amber-400/80">
              {' '}
              is currently editing{fieldName ? ` "${fieldName}"` : ' this section'}
            </span>
          </div>

          {/* User avatar */}
          <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center text-xs text-white font-medium">
            {user.avatar?.startsWith('http') ? (
              <img
                src={user.avatar}
                alt={user.displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.avatar
            )}
          </div>
        </div>

        {/* Warning icon */}
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Changes may be overwritten</span>
        </div>
      </div>
    );
  }
);

// ============================================================================
// INLINE INDICATOR (Small, next to field)
// ============================================================================

export const EditingInline: React.FC<{
  user: PresenceUser;
  className?: string;
}> = React.memo(({ user, className = '' }) => {
  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5
        text-xs text-amber-400 bg-amber-500/10 rounded-full
        ${className}
      `}
    >
      <Edit2 className="w-3 h-3 animate-pulse" />
      <span>{user.displayName} editing</span>
    </div>
  );
});

// ============================================================================
// LOCK BADGE (Shows field is locked)
// ============================================================================

export const EditingBadge: React.FC<{
  user: PresenceUser;
  className?: string;
}> = React.memo(({ user, className = '' }) => {
  return (
    <div className={`relative group ${className}`}>
      <div className="p-1 bg-amber-500/20 rounded-full">
        <Lock className="w-3 h-3 text-amber-400" />
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        <div className="flex items-center gap-1">
          <Edit2 className="w-3 h-3 text-amber-400" />
          <span>{user.displayName} is editing</span>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CollaborativeIndicator: React.FC<CollaborativeIndicatorProps> = React.memo(
  ({ editingUser, fieldName, variant = 'banner', className = '' }) => {
    if (!editingUser) return null;

    switch (variant) {
      case 'banner':
        return (
          <EditingBanner
            user={editingUser}
            fieldName={fieldName}
            className={className}
          />
        );
      case 'inline':
        return <EditingInline user={editingUser} className={className} />;
      case 'badge':
        return <EditingBadge user={editingUser} className={className} />;
      default:
        return null;
    }
  }
);

// ============================================================================
// WRAPPER FOR COLLABORATIVE FIELDS
// ============================================================================

interface CollaborativeFieldProps {
  /** Field identifier */
  fieldId: string;
  /** User editing this field (from usePresence.isFieldBeingEdited) */
  editingUser: PresenceUser | null;
  /** Whether current user is editing */
  isCurrentUserEditing?: boolean;
  /** Children to render */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

export const CollaborativeField: React.FC<CollaborativeFieldProps> = React.memo(
  ({ fieldId: _fieldId, editingUser, isCurrentUserEditing = false, children, className = '' }) => {
    const hasOtherEditor = editingUser && !isCurrentUserEditing;

    return (
      <div
        className={`
          relative
          ${hasOtherEditor ? 'opacity-75 pointer-events-none' : ''}
          ${className}
        `}
      >
        {children}

        {/* Overlay when someone else is editing */}
        {hasOtherEditor && (
          <>
            {/* Lock overlay */}
            <div className="absolute inset-0 bg-slate-900/20 rounded-lg" />

            {/* Badge in corner */}
            <div className="absolute -top-2 -right-2 z-10">
              <EditingBadge user={editingUser} />
            </div>
          </>
        )}
      </div>
    );
  }
);

export default CollaborativeIndicator;
