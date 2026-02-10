/**
 * NoticeOfPrivacyPractices - Patient-Facing NPP Acknowledgment Page
 *
 * Purpose: Display HIPAA Notice of Privacy Practices and record patient acknowledgment
 * Route: /notice-of-privacy-practices
 * Regulation: 45 CFR 164.520
 *
 * Features:
 *  - Displays hardcoded HIPAA-compliant NPP content sections
 *  - "I Acknowledge" button that records via nppService
 *  - Shows acknowledgment status if already acknowledged
 *  - Loading/error/success states
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  nppService,
  type AcknowledgmentStatus,
} from '../services/nppService';
import { auditLogger } from '../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type PageState = 'loading' | 'ready' | 'submitting' | 'acknowledged' | 'error';

interface NppSection {
  title: string;
  content: string;
}

// =============================================================================
// NPP CONTENT SECTIONS (HIPAA-compliant)
// =============================================================================

const NPP_SECTIONS: NppSection[] = [
  {
    title: 'About This Notice',
    content:
      'This Notice of Privacy Practices describes how medical information about you may be used ' +
      'and disclosed and how you can get access to this information. Please review it carefully. ' +
      'Your health information is personal, and we are committed to protecting it.',
  },
  {
    title: 'Our Responsibilities',
    content:
      'We are required by law to maintain the privacy of your Protected Health Information (PHI), ' +
      'give you this notice describing our legal duties and privacy practices with respect to your ' +
      'PHI, and follow the terms of this notice currently in effect. We will let you know promptly ' +
      'if a breach occurs that may have compromised the privacy or security of your information.',
  },
  {
    title: 'How We May Use and Disclose Your Information',
    content:
      'We may use and disclose your PHI for the following purposes: Treatment (to provide, ' +
      'coordinate, or manage your healthcare), Payment (to bill and receive payment for healthcare ' +
      'services), and Healthcare Operations (to support business activities such as quality ' +
      'assessment, employee review, licensing, and accreditation). We may also contact you for ' +
      'appointment reminders, treatment alternatives, or health-related benefits and services.',
  },
  {
    title: 'Uses and Disclosures Requiring Your Authorization',
    content:
      'Most uses and disclosures of psychotherapy notes, uses and disclosures of PHI for marketing ' +
      'purposes, and disclosures that constitute a sale of PHI require your written authorization. ' +
      'Other uses and disclosures not described in this notice will be made only with your written ' +
      'authorization. You may revoke an authorization at any time, in writing.',
  },
  {
    title: 'Your Rights Regarding Your Health Information',
    content:
      'You have the right to: request restrictions on how your PHI is used or disclosed; receive ' +
      'confidential communications; inspect and obtain a copy of your PHI; request amendment of ' +
      'your PHI; receive an accounting of disclosures; obtain a paper copy of this notice upon ' +
      'request; and file a complaint if you believe your privacy rights have been violated. You ' +
      'will not be penalized for filing a complaint.',
  },
  {
    title: 'Right to Amend Your Records',
    content:
      'You have the right to request that we amend your health information if you believe it is ' +
      'incorrect or incomplete. We may deny your request in certain circumstances; if we do, ' +
      'you have the right to file a statement of disagreement that will be included with your ' +
      'records for future disclosures.',
  },
  {
    title: 'Changes to This Notice',
    content:
      'We reserve the right to change the terms of this notice and to make the new notice ' +
      'provisions effective for all PHI we maintain. We will make the revised notice available ' +
      'upon request and post it in our facility and on our website.',
  },
  {
    title: 'Filing a Complaint',
    content:
      'If you believe your privacy rights have been violated, you may file a complaint with us ' +
      'or with the Secretary of the U.S. Department of Health and Human Services. You will not be ' +
      'retaliated against for filing a complaint. To file a complaint with HHS, visit ' +
      'www.hhs.gov/ocr/privacy/hipaa/complaints.',
  },
];

// =============================================================================
// HELPERS
// =============================================================================

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

const NoticeOfPrivacyPractices: React.FC = () => {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [ackStatus, setAckStatus] = useState<AcknowledgmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadAcknowledgmentStatus = useCallback(async () => {
    try {
      setPageState('loading');
      setError(null);

      const result = await nppService.checkAcknowledgmentStatus();
      if (!result.success) {
        setError(result.error.message);
        setPageState('error');
        return;
      }

      setAckStatus(result.data);
      setPageState(result.data.has_acknowledged_current ? 'acknowledged' : 'ready');
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('NPP_PAGE_LOAD_FAILED', e);
      setError('Unable to load your privacy practices acknowledgment status.');
      setPageState('error');
    }
  }, []);

  useEffect(() => {
    loadAcknowledgmentStatus();
  }, [loadAcknowledgmentStatus]);

  const handleAcknowledge = useCallback(async () => {
    if (!ackStatus?.current_version) {
      setError('No current NPP version available to acknowledge.');
      return;
    }

    try {
      setPageState('submitting');
      setError(null);

      const result = await nppService.recordAcknowledgment(
        ackStatus.current_version.id,
        'electronic'
      );

      if (!result.success) {
        setError(result.error.message);
        setPageState('ready');
        return;
      }

      setSuccessMessage('Your acknowledgment has been recorded successfully. Thank you.');
      setPageState('acknowledged');
      setAckStatus(prev =>
        prev
          ? {
              ...prev,
              has_acknowledged_current: true,
              last_acknowledgment: result.data,
            }
          : prev
      );
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('NPP_ACKNOWLEDGMENT_UI_FAILED', e);
      setError('We could not record your acknowledgment. Please try again.');
      setPageState('ready');
    }
  }, [ackStatus]);

  // -- Loading State --
  if (pageState === 'loading') {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div
          className="flex items-center justify-center p-12"
          role="status"
          aria-label="Loading privacy practices"
        >
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600 text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  // -- Error State (no content loaded) --
  if (pageState === 'error' && !ackStatus) {
    return (
      <div className="max-w-3xl mx-auto p-6" role="alert">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Unable to load Notice of Privacy Practices</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadAcknowledgmentStatus}
            className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-base font-medium"
            aria-label="Retry loading privacy practices"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="text-center border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">Notice of Privacy Practices</h1>
        <p className="text-gray-500 mt-2">HIPAA Privacy Rule - 45 CFR 164.520</p>
        {ackStatus?.current_version && (
          <p className="text-sm text-gray-400 mt-1">
            Version {ackStatus.current_version.version_number} &mdash; Effective{' '}
            {formatDate(ackStatus.current_version.effective_date)}
          </p>
        )}
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4" role="status">
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Inline Error Banner */}
      {error && pageState !== 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Already Acknowledged Banner */}
      {pageState === 'acknowledged' && ackStatus?.last_acknowledgment && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 font-medium">
            You have acknowledged this Notice of Privacy Practices.
          </p>
          <p className="text-blue-600 text-sm mt-1">
            Acknowledged on: {formatDateTime(ackStatus.last_acknowledgment.acknowledged_at)}
          </p>
          <p className="text-blue-600 text-sm">
            Method:{' '}
            {ackStatus.last_acknowledgment.acknowledgment_type === 'electronic'
              ? 'Electronic signature'
              : ackStatus.last_acknowledgment.acknowledgment_type}
          </p>
        </div>
      )}

      {/* NPP Content Sections */}
      <div className="space-y-5">
        {NPP_SECTIONS.map((section, index) => (
          <section
            key={section.title}
            className="bg-white border border-gray-200 rounded-lg p-5"
            aria-labelledby={`npp-section-${index}`}
          >
            <h2
              id={`npp-section-${index}`}
              className="text-lg font-semibold text-gray-900 mb-2"
            >
              {section.title}
            </h2>
            <p className="text-gray-700 text-base leading-relaxed">{section.content}</p>
          </section>
        ))}
      </div>

      {/* Contact Information */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact Information</h2>
        <p className="text-gray-700 text-base">
          If you have questions about this notice or wish to exercise your rights, please contact
          your healthcare organization&apos;s Privacy Officer through the administration office.
        </p>
      </div>

      {/* Acknowledgment Section */}
      {pageState === 'ready' && (
        <div className="border-t border-gray-200 pt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <p className="text-gray-800 text-base mb-4">
              By clicking the button below, you acknowledge that you have received and reviewed
              this Notice of Privacy Practices. This serves as your electronic acknowledgment
              per 45 CFR 164.520(c)(2).
            </p>
            <button
              onClick={handleAcknowledge}
              className="min-h-[44px] min-w-[44px] px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
              aria-label="Acknowledge Notice of Privacy Practices"
            >
              I Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Submitting Indicator */}
      {pageState === 'submitting' && (
        <div className="border-t border-gray-200 pt-6">
          <div
            className="flex items-center justify-center p-4"
            role="status"
            aria-label="Recording acknowledgment"
          >
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <span className="ml-2 text-gray-600">Recording your acknowledgment...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeOfPrivacyPractices;
