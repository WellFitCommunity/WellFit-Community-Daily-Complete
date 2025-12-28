/**
 * ClockOutConfirmDialog
 *
 * Dialog shown when user tries to logout while clocked in.
 * Asks if they want to clock out (end shift) or just log out (stay clocked in).
 */

import React from 'react';
import { Clock, LogOut, X } from 'lucide-react';
import { EACard, EACardContent } from '../envision-atlus';

interface ClockOutConfirmDialogProps {
  isOpen: boolean;
  onClockOutAndLogout: () => void;
  onJustLogout: () => void;
  onCancel: () => void;
  currentWorkTime?: string;
}

export const ClockOutConfirmDialog: React.FC<ClockOutConfirmDialogProps> = ({
  isOpen,
  onClockOutAndLogout,
  onJustLogout,
  onCancel,
  currentWorkTime,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <EACard className="max-w-md w-full animate-in fade-in zoom-in duration-200">
        <EACardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/20 rounded-lg">
                <Clock className="h-6 w-6 text-teal-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">You're Still Clocked In</h2>
            </div>
            <button
              onClick={onCancel}
              className="p-1 text-slate-400 hover:text-white transition-colors rounded-sm"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Current work time */}
          {currentWorkTime && (
            <div className="bg-slate-800 rounded-lg p-4 mb-6 text-center">
              <p className="text-slate-400 text-sm mb-1">Time worked today</p>
              <p className="text-2xl font-bold text-teal-400">{currentWorkTime}</p>
            </div>
          )}

          {/* Question */}
          <p className="text-slate-300 mb-6 text-center">
            Is your shift complete, or are you just stepping away?
          </p>

          {/* Options */}
          <div className="space-y-3">
            {/* Clock out and logout */}
            <button
              onClick={onClockOutAndLogout}
              className="w-full flex items-center justify-between p-4 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/20 rounded-lg group-hover:bg-teal-500/30 transition-colors">
                  <Clock className="h-5 w-5 text-teal-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">Yes, end my shift</p>
                  <p className="text-sm text-slate-400">Clock out & log out</p>
                </div>
              </div>
              <span className="text-teal-400 text-sm font-medium">Recommended</span>
            </button>

            {/* Just logout, stay clocked in */}
            <button
              onClick={onJustLogout}
              className="w-full flex items-center p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700 rounded-lg group-hover:bg-slate-600 transition-colors">
                  <LogOut className="h-5 w-5 text-slate-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">No, just log out</p>
                  <p className="text-sm text-slate-400">Stay clocked in, I'll clock out later</p>
                </div>
              </div>
            </button>
          </div>

          {/* Cancel link */}
          <div className="mt-4 text-center">
            <button
              onClick={onCancel}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel, go back
            </button>
          </div>
        </EACardContent>
      </EACard>
    </div>
  );
};

export default ClockOutConfirmDialog;
