/**
 * IdleTimeoutWarning Component
 *
 * Modal that appears when user is about to be logged out due to inactivity.
 * Gives user option to stay logged in or logout immediately.
 */

import React from 'react';

interface IdleTimeoutWarningProps {
  /** Whether to show the warning modal */
  show: boolean;
  /** Seconds remaining before auto-logout */
  secondsRemaining: number;
  /** Called when user wants to stay logged in */
  onStayLoggedIn: () => void;
  /** Called when user wants to logout now */
  onLogout: () => void;
}

export const IdleTimeoutWarning: React.FC<IdleTimeoutWarningProps> = ({
  show,
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}) => {
  if (!show) return null;

  // Format time remaining
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds} seconds`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      aria-describedby="idle-timeout-description"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2
          id="idle-timeout-title"
          className="text-xl font-bold text-center text-gray-900 mb-2"
        >
          Session Timeout Warning
        </h2>

        {/* Description */}
        <p
          id="idle-timeout-description"
          className="text-center text-gray-600 mb-4"
        >
          You will be logged out due to inactivity in:
        </p>

        {/* Countdown */}
        <div className="text-center mb-6">
          <span className="text-4xl font-bold text-amber-600 font-mono">
            {timeDisplay}
          </span>
        </div>

        {/* Security note */}
        <p className="text-xs text-center text-gray-500 mb-6">
          For your security, we automatically log you out after 15 minutes of inactivity.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onStayLoggedIn}
            className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogout}
            className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdleTimeoutWarning;
