/**
 * Guardian Eyes Player - Replay Viewer Component
 *
 * Displays recorded Guardian Eyes sessions using rrweb-player.
 * Features:
 * - Visual replay of what happened during fix execution
 * - Save Forever button for major issues
 * - Mark as Reviewed button
 * - Playback controls (play, pause, speed, seek)
 * - Duration and event count display
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { guardianEyesRecorder, RecordingMetadata } from '../../services/guardian-agent/GuardianEyesRecorder';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';

interface GuardianEyesPlayerProps {
  sessionId: string;
  onClose?: () => void;
  onSaveFor30Days?: (sessionId: string, reason: string) => void;
  onMarkReviewed?: (sessionId: string, notes: string) => void;
}

export const GuardianEyesPlayer: React.FC<GuardianEyesPlayerProps> = ({
  sessionId,
  onClose,
  onSaveFor30Days,
  onMarkReviewed,
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<rrwebPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<RecordingMetadata | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [saveReason, setSaveReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load and initialize player
  useEffect(() => {
    const loadRecording = async () => {
      try {
        setLoading(true);
        setError(null);

        const recording = await guardianEyesRecorder.loadRecording(sessionId);

        if (!recording) {
          setError('Recording not found or has expired');
          return;
        }

        setMetadata(recording.metadata);

        // Wait for container to be ready
        if (!playerContainerRef.current) {
          setError('Player container not ready');
          return;
        }

        // Clear any existing player
        if (playerRef.current) {
          playerRef.current.pause();
          playerRef.current = null;
        }
        playerContainerRef.current.innerHTML = '';

        // Initialize rrweb player
        playerRef.current = new rrwebPlayer({
          target: playerContainerRef.current,
          props: {
            events: recording.events,
            width: 800,
            height: 450,
            autoPlay: false,
            showController: true,
            speedOption: [0.5, 1, 2, 4],
            skipInactive: true,
            showDebug: false,
          },
        });

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recording');
        setLoading(false);
      }
    };

    loadRecording();

    // Cleanup on unmount
    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current = null;
      }
    };
  }, [sessionId]);

  // Handle Save for 30 Days
  const handleSaveFor30Days = useCallback(async () => {
    if (!saveReason.trim()) return;

    setSaving(true);
    try {
      const success = await guardianEyesRecorder.saveFor30Days(sessionId, saveReason);
      if (success) {
        setShowSaveDialog(false);
        setSaveReason('');
        onSaveFor30Days?.(sessionId, saveReason);
      } else {
        setError('Failed to extend recording retention');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend retention');
    } finally {
      setSaving(false);
    }
  }, [sessionId, saveReason, onSaveFor30Days]);

  // Handle Mark Reviewed
  const handleMarkReviewed = useCallback(async () => {
    setSaving(true);
    try {
      const success = await guardianEyesRecorder.markReviewed(sessionId, reviewNotes || undefined);
      if (success) {
        setShowReviewDialog(false);
        setReviewNotes('');
        onMarkReviewed?.(sessionId, reviewNotes);
      } else {
        setError('Failed to mark recording as reviewed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark reviewed');
    } finally {
      setSaving(false);
    }
  }, [sessionId, reviewNotes, onMarkReviewed]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get trigger type badge variant (matches EABadge variants)
  const getTriggerBadgeVariant = (triggerType: string): 'critical' | 'high' | 'elevated' | 'normal' | 'info' | 'neutral' => {
    switch (triggerType) {
      case 'phi_exposure':
        return 'critical';
      case 'security_vulnerability':
        return 'critical';
      case 'memory_leak':
        return 'high';
      case 'api_failure':
        return 'elevated';
      default:
        return 'info';
    }
  };

  return (
    <EACard className="guardian-eyes-player">
      <EACardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">Guardian Eyes Recording</span>
          {metadata && (
            <EABadge variant={getTriggerBadgeVariant(metadata.triggerType)}>
              {metadata.triggerType.replace(/_/g, ' ')}
            </EABadge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {metadata && (
            <>
              <span className="text-sm text-slate-400">
                Duration: {formatDuration(metadata.durationSeconds)}
              </span>
              <span className="text-sm text-slate-400">
                Events: {metadata.eventCount}
              </span>
            </>
          )}
          {onClose && (
            <EAButton variant="ghost" size="sm" onClick={onClose}>
              Close
            </EAButton>
          )}
        </div>
      </EACardHeader>

      <EACardContent>
        {/* Error display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
          </div>
        )}

        {/* Player container */}
        <div
          ref={playerContainerRef}
          className="bg-slate-900 rounded-lg overflow-hidden"
          style={{ minHeight: loading ? 0 : 450 }}
        />

        {/* Metadata info */}
        {metadata && !loading && (
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
            <p className="text-sm text-slate-300">
              <strong>Trigger:</strong> {metadata.triggerDescription}
            </p>
            {metadata.triggerAlertId && (
              <p className="text-sm text-slate-400 mt-1">
                <strong>Alert ID:</strong> {metadata.triggerAlertId}
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!loading && !error && (
          <div className="flex gap-3 mt-4">
            <EAButton
              variant="primary"
              onClick={() => setShowSaveDialog(true)}
            >
              Save for 30 Days
            </EAButton>
            <EAButton
              variant="secondary"
              onClick={() => setShowReviewDialog(true)}
            >
              Mark as Reviewed
            </EAButton>
          </div>
        )}

        {/* Save for 30 Days Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Extend Recording Retention</h3>
              <p className="text-sm text-slate-400 mb-4">
                This recording will be kept for 30 days instead of the standard 10 days.
              </p>
              <textarea
                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 resize-none"
                rows={3}
                placeholder="Reason for extending retention (e.g., Needs further review, Complex fix)"
                value={saveReason}
                onChange={(e) => setSaveReason(e.target.value)}
              />
              <div className="flex gap-3 mt-4">
                <EAButton
                  variant="primary"
                  onClick={handleSaveFor30Days}
                  disabled={!saveReason.trim() || saving}
                >
                  {saving ? 'Saving...' : 'Save for 30 Days'}
                </EAButton>
                <EAButton
                  variant="ghost"
                  onClick={() => setShowSaveDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </EAButton>
              </div>
            </div>
          </div>
        )}

        {/* Mark Reviewed Dialog */}
        {showReviewDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Mark Recording as Reviewed</h3>
              <p className="text-sm text-slate-400 mb-4">
                Confirm that you have reviewed this Guardian Eyes recording.
              </p>
              <textarea
                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 resize-none"
                rows={3}
                placeholder="Review notes (optional)"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
              <div className="flex gap-3 mt-4">
                <EAButton
                  variant="primary"
                  onClick={handleMarkReviewed}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Mark Reviewed'}
                </EAButton>
                <EAButton
                  variant="ghost"
                  onClick={() => setShowReviewDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </EAButton>
              </div>
            </div>
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};

export default GuardianEyesPlayer;
