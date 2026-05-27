// ============================================================================
// Team Huddle Page
// ============================================================================
// Purpose: Help a manager see, at the start of shift, who on the team needs
// attention RIGHT NOW based on wellness signals. Replaces the broken
// "Schedule Team Huddle" navigation target on AdminBurnoutRadar.
//
// Privacy posture:
//   - Individualized data BY DESIGN — managers must be able to act on wellness
//     signals. RLS at the database level enforces tenant isolation; no
//     tenant_id filter is added in client code.
//   - Free-text notes from check-ins are never displayed; only signal-level
//     chips (stress/energy/mood/flags).
//   - Manager actions (nudge, 1:1, mark-discussed) are audit-logged for HR/
//     legal/SOC2 traceability.
//
// Decomposed pieces live in ./team-huddle/* — this orchestrator owns the page
// shell, the toast, and the schedule-1:1 dialog only.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditLogger } from '../../services/auditLogger';
import { HuddleSection } from './team-huddle/HuddleSection';
import { useHuddleData } from './team-huddle/useHuddleData';
import type { HuddleProvider, ToastState, ToastTone } from './team-huddle/types';

export const TeamHuddlePage: React.FC = () => {
  const {
    providers,
    discussedIds,
    loading,
    errorMessage,
    markDiscussedLocal,
  } = useHuddleData();

  const [toast, setToast] = useState<ToastState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTarget, setDialogTarget] = useState<HuddleProvider | null>(null);
  const [dialogDate, setDialogDate] = useState('');
  const [dialogNote, setDialogNote] = useState('');

  const { urgent, watch, good, discussed } = useMemo(() => {
    const u: HuddleProvider[] = [];
    const w: HuddleProvider[] = [];
    const g: HuddleProvider[] = [];
    const d: HuddleProvider[] = [];
    for (const p of providers) {
      if (discussedIds.has(p.userId)) {
        d.push(p);
        continue;
      }
      if (p.bucket === 'urgent') u.push(p);
      else if (p.bucket === 'watch') w.push(p);
      else g.push(p);
    }
    return { urgent: u, watch: w, good: g, discussed: d };
  }, [providers, discussedIds]);

  const showToast = (message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3500);
  };

  const handleSendNudge = async (provider: HuddleProvider) => {
    await auditLogger.info('HUDDLE_NUDGE_SENT', {
      nurse_id: provider.userId,
      bucket: provider.bucket,
    });
    showToast(
      `Nudge logged for ${provider.fullName}. Notification wiring pending.`
    );
  };

  const openSchedule1on1 = (provider: HuddleProvider) => {
    setDialogTarget(provider);
    setDialogDate('');
    setDialogNote('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogTarget(null);
  };

  const submit1on1 = async () => {
    if (!dialogTarget) return;
    if (!dialogDate) {
      showToast('Please pick a date for the 1:1.', 'error');
      return;
    }
    // care_team_alerts.alert_type CHECK constraint does not allow
    // 'manager_1on1', so we log to auditLogger.info per implementation spec.
    await auditLogger.info('HUDDLE_1ON1_SCHEDULED', {
      nurse_id: dialogTarget.userId,
      scheduled_for: dialogDate,
      note: dialogNote || null,
    });
    showToast(`1:1 logged with ${dialogTarget.fullName}.`);
    closeDialog();
  };

  const markDiscussed = async (provider: HuddleProvider) => {
    await auditLogger.info('HUDDLE_DISCUSSED', {
      nurse_id: provider.userId,
      signals_at_time: provider.signals,
      bucket: provider.bucket,
    });
    markDiscussedLocal(provider.userId);
    showToast(`Marked ${provider.fullName} as discussed.`);
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-gray-50 flex items-center justify-center p-6"
      >
        <div className="text-center">
          <div
            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"
            aria-hidden="true"
          />
          <p className="mt-4 text-lg text-gray-700">Loading team huddle…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            to="/staff-wellness"
            className="inline-flex items-center gap-2 text-base text-indigo-700 hover:underline focus:outline-hidden focus:ring-2 focus:ring-indigo-500 rounded-sm px-1 py-1 min-h-[44px]"
          >
            <span aria-hidden="true">←</span>
            <span>Back to wellness radar</span>
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            Start-of-Shift Team Huddle
          </h1>
          <p className="mt-2 text-lg text-gray-700">
            Quick read of who needs attention right now. Data is signal-level
            only — no free-text from check-ins is shown here.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-lg bg-red-50 border-2 border-red-300 text-red-800 text-base"
          >
            {errorMessage}
          </div>
        )}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-base font-medium ${
              toast.tone === 'error'
                ? 'bg-red-100 text-red-800 border-2 border-red-300'
                : 'bg-indigo-100 text-indigo-800 border-2 border-indigo-300'
            }`}
          >
            {toast.message}
          </div>
        )}

        <HuddleSection
          title="Needs attention"
          tone="urgent"
          items={urgent}
          emptyMessage="No urgent signals. Everyone in the green so far."
          onNudge={handleSendNudge}
          onSchedule={openSchedule1on1}
          onDiscuss={markDiscussed}
        />
        <HuddleSection
          title="Watch list"
          tone="watch"
          items={watch}
          emptyMessage="No one on the watch list."
          onNudge={handleSendNudge}
          onSchedule={openSchedule1on1}
          onDiscuss={markDiscussed}
        />
        <HuddleSection
          title="Good"
          tone="good"
          items={good}
          emptyMessage="No recent check-ins in the green."
          onNudge={handleSendNudge}
          onSchedule={openSchedule1on1}
          onDiscuss={markDiscussed}
        />
        {discussed.length > 0 && (
          <HuddleSection
            title="Discussed today"
            tone="muted"
            items={discussed}
            emptyMessage=""
            onNudge={handleSendNudge}
            onSchedule={openSchedule1on1}
            onDiscuss={markDiscussed}
            hideDiscussButton
          />
        )}

        {dialogOpen && dialogTarget && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="huddle-1on1-title"
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h2
                id="huddle-1on1-title"
                className="text-2xl font-bold text-gray-900 mb-2"
              >
                Schedule 1:1 with {dialogTarget.fullName}
              </h2>
              <p className="text-gray-700 mb-4">
                Pick a date and add an optional note. The 1:1 is logged for
                accountability — the note is not shared with the team member.
              </p>
              <label
                className="block text-base font-medium text-gray-800 mb-1"
                htmlFor="huddle-1on1-date"
              >
                Date
              </label>
              <input
                id="huddle-1on1-date"
                type="date"
                value={dialogDate}
                onChange={(e) => setDialogDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border-2 border-gray-300 rounded-lg text-base mb-4 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <label
                className="block text-base font-medium text-gray-800 mb-1"
                htmlFor="huddle-1on1-note"
              >
                Note (optional)
              </label>
              <textarea
                id="huddle-1on1-note"
                value={dialogNote}
                onChange={(e) => setDialogNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-base mb-6 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-medium text-base hover:bg-gray-300 focus:outline-hidden focus:ring-2 focus:ring-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit1on1}
                  className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamHuddlePage;

// Re-export categorization for tests that need to verify bucket logic
export { categorizeProvider } from './team-huddle/types';
