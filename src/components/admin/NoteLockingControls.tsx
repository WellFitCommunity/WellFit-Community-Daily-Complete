/**
 * Note Locking Controls - Clinical Note Locking UI
 *
 * Purpose: Provide UI controls for locking clinical notes and viewing lock status
 * Features: Lock button, lock status display, amendment history link
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  History,
  FileText,
  RefreshCw,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import { noteLockingService, type NoteType } from '../../services/noteLockingService';
import { noteAmendmentService } from '../../services/noteAmendmentService';
import { supabase } from '../../lib/supabaseClient';

// =============================================================================
// TYPES
// =============================================================================

interface NoteLockingControlsProps {
  noteId: string;
  noteType: NoteType;
  onLockChange?: (isLocked: boolean) => void;
  showAmendmentHistory?: boolean;
  compact?: boolean;
}

interface LockDetails {
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  locked_by_name?: string;
  signature_hash: string | null;
  version: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const NoteLockingControls: React.FC<NoteLockingControlsProps> = ({
  noteId,
  noteType,
  onLockChange,
  showAmendmentHistory = true,
  compact = false,
}) => {
  const [lockDetails, setLockDetails] = useState<LockDetails | null>(null);
  const [amendmentCount, setAmendmentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch lock details
  const fetchLockDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await noteLockingService.getLockDetails(noteId, noteType);
      if (result.success && result.data) {
        setLockDetails(result.data);
      }

      // Fetch amendment count if showing history
      if (showAmendmentHistory) {
        const amendmentsResult = await noteAmendmentService.getAmendmentsForNote(noteId, noteType);
        if (amendmentsResult.success) {
          setAmendmentCount(amendmentsResult.data.length);
        }
      }
    } catch (err) {
      setError('Failed to load lock status');
    } finally {
      setLoading(false);
    }
  }, [noteId, noteType, showAmendmentHistory]);

  useEffect(() => {
    fetchLockDetails();
  }, [fetchLockDetails]);

  // Handle lock action
  const handleLock = async () => {
    setLocking(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to lock notes');
        return;
      }

      const result = await noteLockingService.lockNote(noteId, noteType, user.id, {
        generateSignature: true,
      });

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      await fetchLockDetails();
      onLockChange?.(true);
      setShowConfirm(false);
    } catch (err) {
      setError('Failed to lock note');
    } finally {
      setLocking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {lockDetails?.is_locked ? (
          <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-medium">Locked</span>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          >
            <Unlock className="w-4 h-4" />
            <span className="text-xs">Lock</span>
          </button>
        )}
        {showAmendmentHistory && amendmentCount > 0 && (
          <span className="text-xs text-gray-500">{amendmentCount} amendment{amendmentCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    );
  }

  return (
    <EACard className="border-2 border-dashed">
      <EACardContent className="p-4">
        {/* Error Alert */}
        {error && (
          <EAAlert variant="critical" className="mb-4" onDismiss={() => setError(null)} dismissible>
            {error}
          </EAAlert>
        )}

        {/* Lock Status */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${lockDetails?.is_locked ? 'bg-green-100' : 'bg-gray-100'}`}>
              {lockDetails?.is_locked ? (
                <Lock className="w-6 h-6 text-green-600" />
              ) : (
                <Unlock className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                {lockDetails?.is_locked ? 'Note Locked' : 'Note Unlocked'}
              </h4>
              {lockDetails?.is_locked ? (
                <div className="text-sm text-gray-500 mt-1">
                  <p>Locked by {lockDetails.locked_by_name || 'Unknown'}</p>
                  <p>
                    {lockDetails.locked_at
                      ? new Date(lockDetails.locked_at).toLocaleString()
                      : 'Unknown time'}
                  </p>
                  {lockDetails.signature_hash && (
                    <p className="flex items-center gap-1 mt-1 text-green-600">
                      <Shield className="w-3 h-3" />
                      <span>Digitally signed</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-1">
                  This note can be edited. Lock it to prevent modifications.
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!lockDetails?.is_locked && !showConfirm && (
              <EAButton variant="primary" onClick={() => setShowConfirm(true)}>
                <Lock className="w-4 h-4 mr-2" />
                Lock Note
              </EAButton>
            )}
            {showAmendmentHistory && (
              <EAButton variant="secondary" onClick={() => window.open(`/admin/notes/${noteId}/amendments`, '_blank')}>
                <History className="w-4 h-4 mr-2" />
                Amendments ({amendmentCount})
              </EAButton>
            )}
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirm && !lockDetails?.is_locked && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h5 className="font-medium text-yellow-900">Confirm Lock</h5>
                <p className="text-sm text-yellow-800 mt-1">
                  Once locked, this note cannot be directly edited. Any changes must be made through
                  the amendment workflow. A digital signature will be generated for integrity
                  verification.
                </p>
                <div className="flex gap-2 mt-3">
                  <EAButton variant="secondary" onClick={() => setShowConfirm(false)}>
                    Cancel
                  </EAButton>
                  <EAButton variant="primary" onClick={handleLock} disabled={locking}>
                    {locking ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Locking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirm Lock
                      </>
                    )}
                  </EAButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Version Info */}
        {lockDetails && (
          <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>Version {lockDetails.version}</span>
            </div>
            {lockDetails.is_locked && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Amendments only</span>
              </div>
            )}
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};

export default NoteLockingControls;
