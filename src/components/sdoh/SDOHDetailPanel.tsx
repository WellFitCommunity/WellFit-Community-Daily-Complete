import React from 'react';
import {
  SDOHFactor,
  SDOH_INDICATOR_CONFIGS,
  getSDOHRiskColor
} from '../../types/sdohIndicators';

interface SDOHDetailPanelProps {
  factor: SDOHFactor;
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  className?: string;
}

/**
 * SDOH Detail Panel Component
 *
 * A modal/side panel that shows detailed information about a specific SDOH factor
 * when a badge is clicked. Displays risk level, interventions, referrals, and history.
 */
export const SDOHDetailPanel: React.FC<SDOHDetailPanelProps> = ({
  factor,
  isOpen,
  onClose,
  patientId,
  className = ''
}) => {
  if (!isOpen) return null;

  const config = SDOH_INDICATOR_CONFIGS[factor.category];
  const backgroundColor = getSDOHRiskColor(factor.category, factor.riskLevel);

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get risk level text color
  const getRiskLevelColor = () => {
    switch (factor.riskLevel) {
      case 'critical': return 'text-red-700';
      case 'high': return 'text-orange-600';
      case 'moderate': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      case 'none': return 'text-green-700';
      default: return 'text-gray-600';
    }
  };

  // Get intervention status badge
  const getInterventionStatusBadge = () => {
    const statusConfig = {
      'not-assessed': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Not Assessed' },
      'identified': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Identified' },
      'referral-made': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Referral Made' },
      'in-progress': { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'In Progress' },
      'resolved': { bg: 'bg-green-100', text: 'text-green-700', label: 'Resolved' },
      'declined': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Declined' }
    };

    const status = statusConfig[factor.interventionStatus];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
        {status.label}
      </span>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          overflow-y-auto ${className}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sdoh-detail-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between p-6" style={{ backgroundColor }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl" role="img" aria-hidden="true">
                {config.icon}
              </span>
              <div>
                <h2 id="sdoh-detail-title" className="text-xl font-bold text-gray-800">
                  {config.label}
                </h2>
                <p className="text-sm text-gray-600">{config.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close detail panel"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-gray-500">Risk Level</span>
                <p className={`text-lg font-bold capitalize ${getRiskLevelColor()}`}>
                  {factor.riskLevel}
                </p>
              </div>
              {factor.priorityLevel && (
                <div>
                  <span className="text-xs text-gray-500">Priority</span>
                  <p className="text-lg font-bold text-gray-700">
                    {factor.priorityLevel}/5
                  </p>
                </div>
              )}
            </div>
            {getInterventionStatusBadge()}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Assessment Information */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Assessment Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Last Assessed:</span>
                <span className="text-sm font-medium text-gray-800">{formatDate(factor.lastAssessed)}</span>
              </div>
              {factor.assessedBy && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Assessed By:</span>
                  <span className="text-sm font-medium text-gray-800">{factor.assessedBy}</span>
                </div>
              )}
              {factor.nextAssessmentDue && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Next Assessment Due:</span>
                  <span className="text-sm font-medium text-gray-800">{formatDate(factor.nextAssessmentDue)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Description & Notes */}
          {(factor.description || factor.notes) && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                {factor.description && (
                  <div>
                    <span className="text-xs font-medium text-blue-700 uppercase">Description</span>
                    <p className="text-sm text-gray-700 mt-1">{factor.description}</p>
                  </div>
                )}
                {factor.notes && (
                  <div>
                    <span className="text-xs font-medium text-blue-700 uppercase">Clinical Notes</span>
                    <p className="text-sm text-gray-700 mt-1">{factor.notes}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Clinical Codes */}
          {(factor.zCodes || factor.loincCode || factor.snomedCode) && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Clinical Codes</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {factor.zCodes && factor.zCodes.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500">ICD-10 Z-Codes:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {factor.zCodes.map(code => (
                        <span key={code} className="px-2 py-1 bg-white border border-gray-200 rounded-sm text-xs font-mono">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {factor.loincCode && (
                  <div>
                    <span className="text-xs text-gray-500">LOINC Code:</span>
                    <span className="ml-2 text-sm font-mono text-gray-700">{factor.loincCode}</span>
                  </div>
                )}
                {factor.snomedCode && (
                  <div>
                    <span className="text-xs text-gray-500">SNOMED CT:</span>
                    <span className="ml-2 text-sm font-mono text-gray-700">{factor.snomedCode}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Referrals */}
          {factor.referrals && factor.referrals.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Referrals & Services</h3>
              <div className="space-y-3">
                {factor.referrals.map(referral => (
                  <div key={referral.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-800">{referral.service}</h4>
                        {referral.organization && (
                          <p className="text-sm text-gray-600">{referral.organization}</p>
                        )}
                      </div>
                      <span className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${referral.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                        ${referral.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                        ${referral.status === 'declined' ? 'bg-gray-100 text-gray-700' : ''}
                        ${referral.status === 'no-show' ? 'bg-red-100 text-red-700' : ''}
                      `}>
                        {referral.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Referred: {formatDate(referral.dateReferred)}</p>
                      {referral.followUpDate && <p>Follow-up: {formatDate(referral.followUpDate)}</p>}
                      {referral.contactInfo && <p>Contact: {referral.contactInfo}</p>}
                      {referral.notes && <p className="italic mt-2">{referral.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Resources Provided */}
          {factor.resources && factor.resources.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Resources Provided</h3>
              <div className="space-y-2">
                {factor.resources.map(resource => (
                  <div key={resource.id} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-sm text-gray-800">{resource.name}</h4>
                        {resource.description && (
                          <p className="text-xs text-gray-600 mt-1">{resource.description}</p>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-sm text-xs">
                        {resource.type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Provided: {formatDate(resource.dateProvided)}
                      {resource.providedBy && ` by ${resource.providedBy}`}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Impact Assessment */}
          {factor.impactOnHealth && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Health Impact</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Impact on Health:</span>
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium capitalize
                    ${factor.impactOnHealth === 'severe' ? 'bg-red-100 text-red-700' : ''}
                    ${factor.impactOnHealth === 'significant' ? 'bg-orange-100 text-orange-700' : ''}
                    ${factor.impactOnHealth === 'moderate' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${factor.impactOnHealth === 'minimal' ? 'bg-green-100 text-green-700' : ''}
                    ${factor.impactOnHealth === 'none' ? 'bg-gray-100 text-gray-700' : ''}
                  `}>
                    {factor.impactOnHealth}
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <button
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => {
                // TODO: Open update form
                // Update factor handler
              }}
            >
              Update Assessment
            </button>
            <button
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              onClick={() => {
                // TODO: Open referral form
                // Add referral handler
              }}
            >
              Add Referral
            </button>
            <button
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SDOHDetailPanel;
