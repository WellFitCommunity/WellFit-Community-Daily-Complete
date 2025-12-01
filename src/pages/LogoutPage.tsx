// src/pages/LogoutPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../contexts/AuthContext';
import { useTimeClockOptional } from '../contexts/TimeClockContext';
import { ClockOutConfirmDialog } from '../components/time-clock/ClockOutConfirmDialog';
import { TimeClockService } from '../services/timeClockService';
import { featureFlags } from '../config/featureFlags';

const LogoutPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const timeClock = useTimeClockOptional();

  const [sec, setSec] = useState(5);
  const [showDialog, setShowDialog] = useState(false);
  const [hasDecided, setHasDecided] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState("You've been logged out");

  // Check if user is clocked in and show dialog
  useEffect(() => {
    if (featureFlags.timeClock && timeClock?.isClockedIn && !hasDecided) {
      setShowDialog(true);
    } else if (!featureFlags.timeClock || !timeClock?.isClockedIn) {
      setHasDecided(true);
    }
  }, [timeClock?.isClockedIn, hasDecided]);

  // Calculate current work time for display
  const currentWorkTime = timeClock?.todayEntry?.clock_in_time
    ? TimeClockService.calculateCurrentWorkTime(timeClock.todayEntry.clock_in_time).formatted
    : undefined;

  // Handle clock out and logout
  const handleClockOutAndLogout = useCallback(async () => {
    if (timeClock?.todayEntry?.id) {
      await timeClock.clockOut('Shift completed');
      setLogoutMessage("Shift complete! You've been clocked out and logged out.");
    }
    setShowDialog(false);
    setHasDecided(true);
  }, [timeClock]);

  // Handle just logout (stay clocked in)
  const handleJustLogout = useCallback(() => {
    setLogoutMessage("You've been logged out. Remember to clock out when your shift ends!");
    setShowDialog(false);
    setHasDecided(true);
  }, []);

  // Handle cancel - go back
  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Sign out and clear app-local caches (only after decision made)
  useEffect(() => {
    if (!hasDecided) return;

    (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore signout errors
      } finally {
        try {
          localStorage.removeItem('wellfitPhone');
          localStorage.removeItem('wellfitPin');
        } catch {
          /* ignore storage errors */
        }
      }
    })();
  }, [supabase, hasDecided]);

  // Countdown then redirect (only after decision made)
  useEffect(() => {
    if (!hasDecided) return;

    if (sec <= 0) {
      navigate('/', { replace: true });
      return;
    }
    const t = setTimeout(() => setSec(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [sec, navigate, hasDecided]);

  // Show dialog if needed
  if (showDialog) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <ClockOutConfirmDialog
          isOpen={showDialog}
          onClockOutAndLogout={handleClockOutAndLogout}
          onJustLogout={handleJustLogout}
          onCancel={handleCancel}
          currentWorkTime={currentWorkTime}
        />
      </div>
    );
  }

  // Show logout message after decision
  if (!hasDecided) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="p-8 text-center max-w-md">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-teal-500/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-4">{logoutMessage}</h2>
        <p className="text-slate-400" role="status" aria-live="polite">
          Returning to the Welcome screen in {sec} second{sec !== 1 && 's'}…
        </p>
      </div>
    </div>
  );
};

export default LogoutPage;
