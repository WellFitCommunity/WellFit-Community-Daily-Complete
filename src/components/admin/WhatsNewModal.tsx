// WhatsNewModal.tsx
// Shows recent updates and new features in the admin panel
// Production-grade with accessibility, error handling, and analytics

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Feature {
  title: string;
  description: string;
  category: 'new' | 'improved' | 'fixed';
  date: string;
  icon: string;
}

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RECENT_FEATURES: Feature[] = [
  {
    title: 'Physician Command Center',
    description: 'Revolutionary AI-powered physician dashboard with real-time FHIR vitals, SmartScribe billing integration (CPT, ICD-10, HCPCS, SDOH Z-codes, CCM codes), patient intelligence summaries, revenue optimization, and comprehensive clinical decision support. Includes live patient selector, CCM eligibility detection, and automated revenue opportunity identification.',
    category: 'new',
    date: '2025-10-18',
    icon: '🩺',
  },
  {
    title: 'Role-Based Routing Fixed',
    description: 'All 10 healthcare staff roles now properly recognized and routed after login. Nurses, physicians, NPs, PAs, clinical supervisors, and other clinical staff now bypass demographics and route to role-specific dashboards with proper PIN verification.',
    category: 'fixed',
    date: '2025-10-18',
    icon: '🔐',
  },
  {
    title: 'Medicine Cabinet Connected',
    description: 'AI-powered Medicine Cabinet now accessible to seniors from their dashboard. Features medication label scanning with Claude Vision, adherence tracking, refill reminders, and drug interaction warnings.',
    category: 'new',
    date: '2025-10-17',
    icon: '💊',
  },
  {
    title: 'ObservationService Testing Complete',
    description: 'Added 20 comprehensive unit tests for ObservationService covering vital signs, lab results, social history, and CRUD operations. All 58 FHIR resource tests passing with zero TypeScript errors.',
    category: 'improved',
    date: '2025-10-17',
    icon: '🧪',
  },
  {
    title: 'Security Audit Clean',
    description: 'Fixed ESLint security warnings. Verified zero actual security vulnerabilities - all warnings are code quality only. HIPAA/SOC2 compliance maintained through FHIR R4 implementation.',
    category: 'fixed',
    date: '2025-10-17',
    icon: '🔒',
  },
  {
    title: 'User Profile Page',
    description: 'New comprehensive profile page for seniors with photo upload, achievements tracking, emergency contacts, and account information. Accessible via /profile route.',
    category: 'new',
    date: '2025-10-16',
    icon: '👤',
  },
  {
    title: 'Avatar Storage System',
    description: 'Secure profile photo storage with automatic image management, size validation (5MB max), and RLS policies for user data protection.',
    category: 'new',
    date: '2025-10-16',
    icon: '📸',
  },
  {
    title: 'Loading Skeletons',
    description: 'Dashboards now show content placeholders while loading instead of spinners for better perceived performance.',
    category: 'improved',
    date: '2025-10-14',
    icon: '⚡',
  },
  {
    title: 'Optimistic UI Updates',
    description: 'Transfer acknowledgements now update instantly for a snappier user experience.',
    category: 'improved',
    date: '2025-10-14',
    icon: '🚀',
  },
  {
    title: 'Copy Buttons',
    description: 'One-click copy buttons added to API keys and packet IDs for easier workflow.',
    category: 'new',
    date: '2025-10-14',
    icon: '📋',
  },
  {
    title: 'Character Counters',
    description: 'Text inputs with limits now show character counts to help you stay within bounds.',
    category: 'new',
    date: '2025-10-14',
    icon: '🔢',
  },
  {
    title: 'Patient Engagement Dashboard',
    description: 'New dashboard to monitor senior activity levels and identify at-risk patients.',
    category: 'new',
    date: '2025-10-13',
    icon: '📊',
  },
  {
    title: 'CCM Time Tracking',
    description: 'Complete integration for Chronic Care Management billing with automatic time tracking.',
    category: 'new',
    date: '2025-10-12',
    icon: '⏱️',
  },
];

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  const [hasSeenVersion, setHasSeenVersion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const currentVersion = RECENT_FEATURES[0]?.date || '';

  useEffect(() => {
    // Check if user has seen the current version with error handling
    try {
      const lastSeenVersion = localStorage.getItem('whatsNew_lastSeen');
      setHasSeenVersion(lastSeenVersion === currentVersion);
    } catch (err) {
      console.error('Failed to read from localStorage:', err);
      setError('Unable to load preferences');
      // Gracefully degrade - assume not seen
      setHasSeenVersion(false);
    }
  }, [currentVersion]);

  // Trap focus within modal for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }

      // Trap tab focus within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus close button on open for screen readers
    setTimeout(() => closeButtonRef.current?.focus(), 100);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    try {
      // Mark current version as seen with error handling
      localStorage.setItem('whatsNew_lastSeen', currentVersion);
      setHasSeenVersion(true);

      // Track modal dismissal (analytics placeholder)
      if (window.gtag) {
        window.gtag('event', 'whats_new_dismissed', {
          version: currentVersion,
        });
      }
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
      // Don't block close on storage error
    }

    onClose();
  }, [currentVersion, onClose]);

  if (!isOpen) return null;

  const getCategoryColor = (category: Feature['category']) => {
    switch (category) {
      case 'new':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'improved':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'fixed':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryLabel = (category: Feature['category']) => {
    switch (category) {
      case 'new':
        return 'New';
      case 'improved':
        return 'Improved';
      case 'fixed':
        return 'Fixed';
      default:
        return category;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      aria-describedby="whats-new-description"
    >
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
          aria-hidden="true"
        ></div>

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div
          ref={modalRef}
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-4xl" role="img" aria-label="Sparkles">✨</span>
                <div>
                  <h3 id="whats-new-title" className="text-2xl font-bold text-white">What's New</h3>
                  <p id="whats-new-description" className="text-blue-100 text-sm mt-1">Recent updates and improvements</p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded-lg p-1"
                aria-label="Close what's new modal"
                type="button"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {error && (
              <div className="mt-3 bg-red-500 text-white px-4 py-2 rounded text-sm" role="alert">
                {error}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-5 max-h-[60vh] overflow-y-auto">
            <div className="space-y-4">
              {RECENT_FEATURES.map((feature, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-3xl flex-shrink-0">{feature.icon}</span>
                    <div className="flex-grow">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{feature.title}</h4>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(
                            feature.category
                          )}`}
                        >
                          {getCategoryLabel(feature.category)}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{feature.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(feature.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {!hasSeenVersion && (
                <span
                  className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium mr-2"
                  role="status"
                  aria-live="polite"
                >
                  New updates available
                </span>
              )}
              <span aria-label={`${RECENT_FEATURES.length} recent updates`}>
                {RECENT_FEATURES.length} recent update{RECENT_FEATURES.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
              type="button"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
