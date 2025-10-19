// WhatsNewSeniorModal.tsx
// Senior-friendly What's New modal with large text and simple language
// Shows new features and improvements relevant to seniors

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface SeniorFeature {
  title: string;
  description: string;
  icon: string;
  date: string;
  link?: string; // Optional navigation link
}

interface WhatsNewSeniorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SENIOR_FEATURES: SeniorFeature[] = [
  {
    title: 'Medicine Cabinet Now Available!',
    description: 'Track all your medications in one place! Just take a photo of your pill bottle label and our AI will read it for you. Get reminders when to take your medicine and when you need refills.',
    icon: '💊',
    date: '2025-10-17',
    link: '/medicine-cabinet',
  },
  {
    title: 'New Profile Page',
    description: 'Visit your profile to upload a photo, view your achievements, and update your emergency contact information.',
    icon: '👤',
    date: '2025-10-16',
    link: '/profile',
  },
  {
    title: 'Profile Photos',
    description: 'You can now add your photo to your profile! Click the camera button on your profile page to upload a picture.',
    icon: '📸',
    date: '2025-10-16',
    link: '/profile',
  },
  {
    title: 'Settings Made Easy',
    description: 'Updated settings page with clearer options and easier navigation to manage your account.',
    icon: '⚙️',
    date: '2025-10-16',
    link: '/settings',
  },
];

const WhatsNewSeniorModal: React.FC<WhatsNewSeniorModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const currentVersion = SENIOR_FEATURES[0]?.date || '';

  const handleClose = useCallback((permanentDismiss = false) => {
    try {
      if (permanentDismiss || dontShowAgain) {
        // Permanently dismiss - set a far future version
        localStorage.setItem('seniorWhatsNew_lastSeen', '9999-12-31');
        localStorage.setItem('seniorWhatsNew_permanentlyDismissed', 'true');
      } else {
        // Mark current version as seen
        localStorage.setItem('seniorWhatsNew_lastSeen', currentVersion);
      }
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
    onClose();
  }, [currentVersion, dontShowAgain, onClose]);

  const handleFeatureClick = useCallback((feature: SeniorFeature) => {
    if (feature.link) {
      navigate(feature.link);
      handleClose(false);
    }
  }, [navigate, handleClose]);

  // Keyboard handling for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    setTimeout(() => closeButtonRef.current?.focus(), 100);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div className="flex items-center justify-center min-h-screen px-4 py-6">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity"
          style={{ backgroundColor: 'rgba(0, 56, 101, 0.75)' }}
          onClick={() => handleClose(false)}
          aria-hidden="true"
        ></div>

        {/* Modal */}
        <div
          ref={modalRef}
          className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full transform transition-all"
          style={{ border: '4px solid #8cc63f' }}
        >
          {/* Header */}
          <div
            className="px-8 py-8 rounded-t-3xl"
            style={{
              background: 'linear-gradient(135deg, #003865 0%, #8cc63f 100%)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-6xl" role="img" aria-label="Sparkles">✨</span>
                <div>
                  <h2 id="whats-new-title" className="text-4xl font-bold text-white mb-2">
                    What's New!
                  </h2>
                  <p className="text-white text-xl opacity-90">
                    Check out these exciting updates
                  </p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                onClick={() => handleClose(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 transition-colors rounded-full p-3 focus:outline-none focus:ring-4 focus:ring-white"
                aria-label="Close what's new"
                type="button"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8 max-h-[50vh] overflow-y-auto">
            <div className="space-y-6">
              {SENIOR_FEATURES.map((feature, index) => (
                <div
                  key={index}
                  onClick={() => handleFeatureClick(feature)}
                  className={`rounded-2xl p-6 border-4 transition-all ${
                    feature.link
                      ? 'cursor-pointer hover:shadow-xl hover:scale-105'
                      : 'hover:shadow-lg'
                  }`}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#f0f8e8' : '#e8f4f8',
                    borderColor: index % 2 === 0 ? '#8cc63f' : '#003865',
                  }}
                  role={feature.link ? 'button' : undefined}
                  tabIndex={feature.link ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (feature.link && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleFeatureClick(feature);
                    }
                  }}
                  aria-label={feature.link ? `${feature.title} - Tap to try it` : feature.title}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-5xl flex-shrink-0">{feature.icon}</span>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-2xl font-bold" style={{ color: '#003865' }}>
                          {feature.title}
                        </h3>
                        {feature.link && (
                          <span className="text-3xl" style={{ color: '#8cc63f' }} aria-hidden="true">
                            →
                          </span>
                        )}
                      </div>
                      <p className="text-xl text-gray-800 leading-relaxed mb-2">
                        {feature.description}
                      </p>
                      {feature.link && (
                        <p className="text-lg font-bold mt-3" style={{ color: '#8cc63f' }}>
                          ✨ Tap here to try it! ✨
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 rounded-b-3xl" style={{ backgroundColor: '#f0f8e8' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold" style={{ color: '#003865' }}>
                {SENIOR_FEATURES.length} new update{SENIOR_FEATURES.length !== 1 ? 's' : ''}
              </div>
              <button
                onClick={() => handleClose(false)}
                className="px-8 py-4 text-white rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform focus:outline-none focus:ring-4"
                style={{ backgroundColor: '#8cc63f', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                type="button"
              >
                Got it, thanks!
              </button>
            </div>

            {/* Don't show again option - Senior friendly with larger text */}
            <div className="border-t-4 pt-4" style={{ borderColor: '#8cc63f' }}>
              <label className="flex items-center cursor-pointer group mb-3">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-6 h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-4 cursor-pointer"
                  aria-label="Don't show What's New automatically anymore"
                />
                <span className="ml-3 text-lg font-semibold group-hover:underline" style={{ color: '#003865' }}>
                  Don't show this automatically anymore
                </span>
              </label>
              {dontShowAgain && (
                <button
                  onClick={() => handleClose(true)}
                  className="w-full px-6 py-3 text-white rounded-xl font-bold text-lg shadow-md hover:scale-105 transition-transform focus:outline-none focus:ring-4"
                  style={{ backgroundColor: '#003865' }}
                  type="button"
                  aria-label="Confirm don't show again and close"
                >
                  ✓ Confirm & Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewSeniorModal;
