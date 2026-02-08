/**
 * MfaGracePeriodBanner
 *
 * Shows a dismissible warning banner for admin/clinical users
 * who are in their MFA grace period but haven't set up TOTP yet.
 *
 * Color coding:
 * - Yellow: >3 days remaining
 * - Orange: 1-3 days remaining
 * - Red: <1 day remaining
 *
 * Senior-friendly: 18px+ text, 44px+ touch targets.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, X, ArrowRight } from 'lucide-react';
import { useMfaEnrollment } from '../../hooks/useMfaEnrollment';
import { useUser } from '../../contexts/AuthContext';

const SESSION_DISMISS_KEY = 'mfa_banner_dismissed';

export const MfaGracePeriodBanner: React.FC = () => {
  const user = useUser();
  const { isInGracePeriod, daysRemaining, isLoading } = useMfaEnrollment(
    user?.id
  );
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  if (isLoading || !isInGracePeriod || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    } catch {
      // sessionStorage unavailable
    }
  };

  // Color coding by urgency
  let bgColor = 'bg-yellow-50 border-yellow-300';
  let textColor = 'text-yellow-800';
  let iconColor = 'text-yellow-600';
  let btnColor = 'bg-yellow-600 hover:bg-yellow-700';

  if (daysRemaining <= 1) {
    bgColor = 'bg-red-50 border-red-300';
    textColor = 'text-red-800';
    iconColor = 'text-red-600';
    btnColor = 'bg-red-600 hover:bg-red-700';
  } else if (daysRemaining <= 3) {
    bgColor = 'bg-orange-50 border-orange-300';
    textColor = 'text-orange-800';
    iconColor = 'text-orange-600';
    btnColor = 'bg-orange-600 hover:bg-orange-700';
  }

  const daysText =
    daysRemaining <= 0
      ? 'today'
      : daysRemaining === 1
        ? 'in 1 day'
        : `in ${daysRemaining} days`;

  return (
    <div
      className={`${bgColor} border rounded-lg p-4 mb-4 flex items-center justify-between gap-4`}
      role="alert"
    >
      <div className="flex items-center gap-3 flex-1">
        <Shield className={`w-6 h-6 ${iconColor} shrink-0`} />
        <div>
          <p className={`${textColor} font-medium text-lg`}>
            Multi-factor authentication required {daysText}
          </p>
          <p className={`${textColor} text-base opacity-80`}>
            Set up your authenticator app to maintain access to the admin panel.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/admin-mfa-setup')}
          className={`${btnColor} text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 min-h-[44px] min-w-[44px] text-base`}
        >
          Set Up Now
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className={`${textColor} opacity-60 hover:opacity-100 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center`}
          title="Dismiss for this session"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default MfaGracePeriodBanner;
