// WhatsNewSeniorModal.tsx
// Senior-friendly What's New modal with large text and simple language
// Shows new features and improvements relevant to seniors

import React, { useEffect, useCallback, useRef } from 'react';

interface SeniorFeature {
  title: string;
  description: string;
  icon: string;
  date: string;
}

interface WhatsNewSeniorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SENIOR_FEATURES: SeniorFeature[] = [
  {
    title: 'New Profile Page',
    description: 'Visit your profile to upload a photo, view your achievements, and update your emergency contact information.',
    icon: '👤',
    date: '2025-10-16',
  },
  {
    title: 'Profile Photos',
    description: 'You can now add your photo to your profile! Click the camera button on your profile page to upload a picture.',
    icon: '📸',
    date: '2025-10-16',
  },
  {
    title: 'Settings Made Easy',
    description: 'Updated settings page with clearer options and easier navigation to manage your account.',
    icon: '⚙️',
    date: '2025-10-16',
  },
];

const WhatsNewSeniorModal: React.FC<WhatsNewSeniorModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const currentVersion = SENIOR_FEATURES[0]?.date || '';

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem('seniorWhatsNew_lastSeen', currentVersion);
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
    onClose();
  }, [currentVersion, onClose]);

  // Keyboard handling for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
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
          onClick={handleClose}
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
                onClick={handleClose}
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
                  className="rounded-2xl p-6 border-4 hover:shadow-lg transition-shadow"
                  style={{
                    backgroundColor: index % 2 === 0 ? '#f0f8e8' : '#e8f4f8',
                    borderColor: index % 2 === 0 ? '#8cc63f' : '#003865',
                  }}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-5xl flex-shrink-0">{feature.icon}</span>
                    <div className="flex-grow">
                      <h3 className="text-2xl font-bold mb-3" style={{ color: '#003865' }}>
                        {feature.title}
                      </h3>
                      <p className="text-xl text-gray-800 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 rounded-b-3xl" style={{ backgroundColor: '#f0f8e8' }}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold" style={{ color: '#003865' }}>
                {SENIOR_FEATURES.length} new update{SENIOR_FEATURES.length !== 1 ? 's' : ''}
              </div>
              <button
                onClick={handleClose}
                className="px-8 py-4 text-white rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform focus:outline-none focus:ring-4"
                style={{ backgroundColor: '#8cc63f', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                type="button"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewSeniorModal;
