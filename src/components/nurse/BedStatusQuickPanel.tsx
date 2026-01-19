/**
 * Bed Status Quick Panel
 *
 * Nurse-focused component for rapid bed status updates at the bedside.
 * Designed for tablet/mobile use with large touch targets (44px+).
 *
 * Features:
 *   - One-tap status changes (Available, Dirty, Blocked, Cleaning)
 *   - Swipe gestures for quick actions
 *   - Voice commands ("Mark bed 205 ready")
 *   - Keyboard shortcuts (Shift+R, Shift+D, Shift+B)
 *   - WCAG AA compliant (seniors/motor impairments)
 *
 * ATLUS Principles:
 *   - Intuitive Technology: Voice + touch + keyboard
 *   - Service: Affirmation toasts for completed actions
 *   - Leading: Team presence awareness
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Bed,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  Hand,
  Trash2,
} from 'lucide-react';
import { EAButton, EACard, EACardContent, EACardHeader } from '../envision-atlus';
import { EAAffirmationToast } from '../envision-atlus/EAAffirmationToast';
import { BedManagementService } from '../../services/bedManagementService';
import { getProviderAffirmation } from '../../services/providerAffirmations';
import { auditLogger } from '../../services/auditLogger';
import type { BedBoardEntry, BedStatus } from '../../types/bed';
import { getBedStatusLabel, getBedStatusColor } from '../../types/bed';

// ============================================================================
// TYPES
// ============================================================================

interface BedStatusQuickPanelProps {
  /** Unit ID to filter beds (optional) */
  unitId?: string;
  /** Callback when bed status changes */
  onStatusChange?: (bedId: string, newStatus: BedStatus) => void;
  /** Enable voice commands */
  enableVoice?: boolean;
  /** Enable swipe gestures */
  enableSwipe?: boolean;
  /** Compact mode for smaller screens */
  compact?: boolean;
}

interface SwipeState {
  startX: number;
  startY: number;
  bedId: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_ACTIONS: { status: BedStatus; label: string; icon: React.ReactNode; color: string; shortcut: string }[] = [
  { status: 'available', label: 'Ready', icon: <CheckCircle className="w-6 h-6" />, color: 'bg-green-500 hover:bg-green-600', shortcut: 'R' },
  { status: 'dirty', label: 'Dirty', icon: <Trash2 className="w-6 h-6" />, color: 'bg-amber-500 hover:bg-amber-600', shortcut: 'D' },
  { status: 'cleaning', label: 'Cleaning', icon: <Sparkle className="w-6 h-6" />, color: 'bg-blue-500 hover:bg-blue-600', shortcut: 'C' },
  { status: 'blocked', label: 'Blocked', icon: <Hand className="w-6 h-6" />, color: 'bg-red-500 hover:bg-red-600', shortcut: 'B' },
  { status: 'maintenance', label: 'Repair', icon: <AlertTriangle className="w-6 h-6" />, color: 'bg-gray-500 hover:bg-gray-600', shortcut: 'M' },
];

const SWIPE_THRESHOLD = 50; // Minimum pixels for swipe

// ============================================================================
// COMPONENT
// ============================================================================

export const BedStatusQuickPanel: React.FC<BedStatusQuickPanelProps> = ({
  unitId,
  onStatusChange,
  enableVoice = true,
  enableSwipe = true,
  compact = false,
}) => {
  // ========================================================================
  // STATE
  // ========================================================================
  const [beds, setBeds] = useState<BedBoardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBed, setSelectedBed] = useState<BedBoardEntry | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [affirmation, setAffirmation] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Voice state
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Swipe state
  const swipeRef = useRef<SwipeState>({ startX: 0, startY: 0, bedId: null });

  // Pagination for bed cards
  const [currentPage, setCurrentPage] = useState(0);
  const bedsPerPage = compact ? 6 : 12;

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  const loadBeds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await BedManagementService.getBedBoard(unitId ? { unitId } : undefined);

      if (result.success && result.data) {
        setBeds(result.data);
      } else {
        setError(result.error?.message || 'Failed to load beds');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error loading beds';
      setError(errorMessage);
      await auditLogger.error('BED_QUICK_PANEL_LOAD_ERROR', new Error(errorMessage), { unitId });
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    loadBeds();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadBeds, 30000);
    return () => clearInterval(interval);
  }, [loadBeds]);

  // ========================================================================
  // STATUS UPDATE
  // ========================================================================

  const updateBedStatus = useCallback(async (bedId: string, newStatus: BedStatus) => {
    const bed = beds.find((b) => b.bed_id === bedId);
    if (!bed) return;

    try {
      setUpdating(bedId);

      const result = await BedManagementService.updateBedStatus(bedId, newStatus);

      if (result.success) {
        // Update local state
        setBeds((prev) =>
          prev.map((b) => (b.bed_id === bedId ? { ...b, status: newStatus } : b))
        );

        // Show affirmation
        const affirmationMessage = getProviderAffirmation('task_completed');
        setAffirmation({ message: affirmationMessage, type: 'success' });

        // Callback
        onStatusChange?.(bedId, newStatus);

        // Log success
        await auditLogger.clinical('BED_STATUS_QUICK_UPDATE', true, {
          bedId,
          bedLabel: bed.bed_label,
          previousStatus: bed.status,
          newStatus,
        });
      } else {
        setError(result.error?.message || 'Failed to update status');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      await auditLogger.error('BED_STATUS_QUICK_UPDATE_ERROR', new Error(errorMessage), { bedId, newStatus });
    } finally {
      setUpdating(null);
    }
  }, [beds, onStatusChange]);

  // ========================================================================
  // KEYBOARD SHORTCUTS
  // ========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Shift+Key when a bed is selected
      if (!selectedBed || !e.shiftKey) return;

      const key = e.key.toUpperCase();
      const action = STATUS_ACTIONS.find((a) => a.shortcut === key);

      if (action) {
        e.preventDefault();
        updateBedStatus(selectedBed.bed_id, action.status);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBed, updateBedStatus]);

  // ========================================================================
  // SWIPE GESTURES
  // ========================================================================

  const handleTouchStart = useCallback((e: React.TouchEvent, bedId: string) => {
    if (!enableSwipe) return;
    const touch = e.touches[0];
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, bedId };
  }, [enableSwipe]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enableSwipe || !swipeRef.current.bedId) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - swipeRef.current.startX;
    const deltaY = touch.clientY - swipeRef.current.startY;

    // Check if horizontal swipe
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      const bedId = swipeRef.current.bedId;

      if (deltaX > 0) {
        // Swipe right = Mark as Available
        updateBedStatus(bedId, 'available');
      } else {
        // Swipe left = Mark as Dirty
        updateBedStatus(bedId, 'dirty');
      }
    } else if (Math.abs(deltaY) > SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
      const bedId = swipeRef.current.bedId;

      if (deltaY < 0) {
        // Swipe up = Blocked
        updateBedStatus(bedId, 'blocked');
      } else {
        // Swipe down = Cleaning
        updateBedStatus(bedId, 'cleaning');
      }
    }

    swipeRef.current = { startX: 0, startY: 0, bedId: null };
  }, [enableSwipe, updateBedStatus]);

  // ========================================================================
  // VOICE COMMANDS
  // ========================================================================

  useEffect(() => {
    if (!enableVoice) return;

    // Check for browser support
    type SpeechRecognitionType = typeof window.SpeechRecognition;
    const SpeechRecognitionClass = (window as Window & { webkitSpeechRecognition?: SpeechRecognitionType; SpeechRecognition?: SpeechRecognitionType }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionType }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setVoiceTranscript(transcript);
      processVoiceCommand(transcript);
    };

    recognition.onerror = () => {
      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableVoice]);

  const processVoiceCommand = useCallback((transcript: string) => {
    // Pattern: "mark [bed] 205 ready" or "bed 101 dirty"
    const patterns = [
      { regex: /mark\s+(?:bed\s+)?(\d+[a-z]?)\s+(?:as\s+)?(ready|available)/i, status: 'available' as BedStatus },
      { regex: /mark\s+(?:bed\s+)?(\d+[a-z]?)\s+(?:as\s+)?dirty/i, status: 'dirty' as BedStatus },
      { regex: /mark\s+(?:bed\s+)?(\d+[a-z]?)\s+(?:as\s+)?blocked/i, status: 'blocked' as BedStatus },
      { regex: /start\s+cleaning\s+(?:bed\s+)?(\d+[a-z]?)/i, status: 'cleaning' as BedStatus },
      { regex: /(?:bed\s+)?(\d+[a-z]?)\s+(?:is\s+)?ready/i, status: 'available' as BedStatus },
      { regex: /(?:bed\s+)?(\d+[a-z]?)\s+(?:is\s+)?dirty/i, status: 'dirty' as BedStatus },
    ];

    for (const { regex, status } of patterns) {
      const match = transcript.match(regex);
      if (match) {
        const bedLabelSearch = match[1].toUpperCase();
        const bed = beds.find((b) =>
          b.bed_label?.toUpperCase().includes(bedLabelSearch) ||
          b.room_number?.toUpperCase() === bedLabelSearch
        );

        if (bed) {
          updateBedStatus(bed.bed_id, status);
          return;
        }
      }
    }

    // Refresh command
    if (/refresh|update|reload/i.test(transcript)) {
      loadBeds();
    }
  }, [beds, updateBedStatus, loadBeds]);

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;

    if (voiceListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setVoiceListening(true);
    }
  }, [voiceListening]);

  // ========================================================================
  // PAGINATION
  // ========================================================================

  const paginatedBeds = useMemo(() => {
    const start = currentPage * bedsPerPage;
    return beds.slice(start, start + bedsPerPage);
  }, [beds, currentPage, bedsPerPage]);

  const totalPages = Math.ceil(beds.length / bedsPerPage);

  // ========================================================================
  // RENDER
  // ========================================================================

  if (loading && beds.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <span className="ml-2 text-gray-600">Loading beds...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Affirmation Toast */}
      {affirmation && (
        <EAAffirmationToast
          message={affirmation.message}
          type={affirmation.type}
          onDismiss={() => setAffirmation(null)}
        />
      )}

      {/* Header with Voice & Refresh */}
      <EACard>
        <EACardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Bed className="w-6 h-6 text-teal-600" />
            <span className="text-lg font-semibold">Quick Bed Status</span>
          </div>
          <div className="flex items-center gap-2">
            {enableVoice && (
              <EAButton
                variant={voiceListening ? 'primary' : 'secondary'}
                size="md"
                onClick={toggleVoice}
                className="min-w-[44px] min-h-[44px]"
                aria-label={voiceListening ? 'Stop voice' : 'Start voice'}
              >
                {voiceListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </EAButton>
            )}
            <EAButton
              variant="secondary"
              size="md"
              onClick={() => loadBeds()}
              disabled={loading}
              className="min-w-[44px] min-h-[44px]"
              aria-label="Refresh beds"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </EAButton>
          </div>
        </EACardHeader>

        {voiceTranscript && (
          <div className="px-4 py-2 bg-blue-50 text-blue-700 text-sm">
            Voice: "{voiceTranscript}"
          </div>
        )}
      </EACard>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="text-sm text-gray-500 flex flex-wrap gap-4">
        <span>Shortcuts (select bed first):</span>
        {STATUS_ACTIONS.slice(0, 4).map((action) => (
          <span key={action.status} className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 bg-gray-100 border rounded text-xs">Shift+{action.shortcut}</kbd>
            <span>{action.label}</span>
          </span>
        ))}
      </div>

      {/* Swipe Gestures Help */}
      {enableSwipe && (
        <div className="text-sm text-gray-500">
          Swipe: →Ready | ←Dirty | ↑Blocked | ↓Cleaning
        </div>
      )}

      {/* Bed Cards Grid */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'}`}>
        {paginatedBeds.map((bed) => {
          const statusColor = getBedStatusColor(bed.status);
          const isUpdating = updating === bed.bed_id;
          const isSelected = selectedBed?.bed_id === bed.bed_id;

          return (
            <div
              key={bed.bed_id}
              onClick={() => setSelectedBed(isSelected ? null : bed)}
              onTouchStart={(e) => handleTouchStart(e, bed.bed_id)}
              onTouchEnd={handleTouchEnd}
              className={`
                relative rounded-lg border-2 p-4 cursor-pointer transition-all
                min-h-[100px] flex flex-col items-center justify-center
                ${isSelected ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-200'}
                ${isUpdating ? 'opacity-50' : ''}
                hover:shadow-md
              `}
              role="button"
              tabIndex={0}
              aria-label={`Bed ${bed.bed_label}, status: ${getBedStatusLabel(bed.status)}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedBed(isSelected ? null : bed);
                }
              }}
            >
              {/* Status Indicator */}
              <div
                className={`absolute top-2 right-2 w-4 h-4 rounded-full ${statusColor}`}
                title={getBedStatusLabel(bed.status)}
              />

              {/* Bed Icon */}
              <Bed className={`w-8 h-8 mb-2 ${bed.status === 'occupied' ? 'text-gray-400' : 'text-gray-600'}`} />

              {/* Bed Label */}
              <span className="font-bold text-lg">{bed.bed_label || bed.room_number}</span>

              {/* Status */}
              <span className="text-xs text-gray-500 uppercase mt-1">
                {getBedStatusLabel(bed.status)}
              </span>

              {/* Patient indicator */}
              {bed.patient_name && (
                <span className="text-xs text-gray-400 truncate max-w-full mt-1">
                  {bed.patient_name}
                </span>
              )}

              {/* Loading overlay */}
              {isUpdating && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <EAButton
            variant="secondary"
            size="md"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="min-w-[44px] min-h-[44px]"
          >
            <ChevronLeft className="w-5 h-5" />
          </EAButton>
          <span className="text-gray-600">
            Page {currentPage + 1} of {totalPages}
          </span>
          <EAButton
            variant="secondary"
            size="md"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="min-w-[44px] min-h-[44px]"
          >
            <ChevronRight className="w-5 h-5" />
          </EAButton>
        </div>
      )}

      {/* Quick Action Buttons (when bed selected) */}
      {selectedBed && (
        <EACard className="sticky bottom-0 border-t-2 border-teal-500">
          <EACardContent>
            <div className="text-center mb-3">
              <span className="font-semibold text-lg">Bed {selectedBed.bed_label}</span>
              <span className="text-gray-500 ml-2">
                Current: {getBedStatusLabel(selectedBed.status)}
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {STATUS_ACTIONS.map((action) => (
                <EAButton
                  key={action.status}
                  variant={selectedBed.status === action.status ? 'secondary' : 'primary'}
                  size="lg"
                  onClick={() => updateBedStatus(selectedBed.bed_id, action.status)}
                  disabled={updating === selectedBed.bed_id || selectedBed.status === action.status}
                  className={`min-w-[80px] min-h-[44px] ${action.color} text-white`}
                >
                  <span className="flex items-center gap-2">
                    {action.icon}
                    <span>{action.label}</span>
                  </span>
                </EAButton>
              ))}
            </div>
          </EACardContent>
        </EACard>
      )}
    </div>
  );
};

export default BedStatusQuickPanel;
