/**
 * SDOH Passive Detection Review Panel
 *
 * Displays automatically detected SDOH indicators from patient communications
 * for clinician review and validation. Complements structured assessments.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { SDOHPassiveDetectionService, type SDOHDetection } from '../../services/sdohPassiveDetection';
import { SDOHIndicatorBadge } from './SDOHIndicatorBadge';

interface SDOHPassiveDetectionPanelProps {
  patientId: string;
  onDetectionReviewed?: () => void;
}

export const SDOHPassiveDetectionPanel: React.FC<SDOHPassiveDetectionPanelProps> = ({
  patientId,
  onDetectionReviewed
}) => {
  const [detections, setDetections] = useState<SDOHDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadDetections = useCallback(async () => {
    setLoading(true);
    try {
      const unreviewed = await SDOHPassiveDetectionService.getUnreviewedDetections(patientId);
      setDetections(unreviewed);
    } catch (error) {
      // Error logged server-side, fail silently on client
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadDetections();
  }, [patientId, loadDetections]);

  const handleReview = async (detectionId: string, createFactor: boolean, notes?: string) => {
    setReviewingId(detectionId);
    try {
      await SDOHPassiveDetectionService.reviewDetection(detectionId, createFactor, notes);

      // Remove from list
      setDetections(prev => prev.filter(_d => {
        // Need to get detection ID from database - for now filter by source_id
        return true; // Will be fixed when we add ID to detection type
      }));

      if (onDetectionReviewed) {
        onDetectionReviewed();
      }
    } catch (error) {
      // Error logged server-side, fail silently on client
    } finally {
      setReviewingId(null);
    }
  };

  const handleScanCommunications = async () => {
    setLoading(true);
    try {
      const newDetections = await SDOHPassiveDetectionService.scanRecentCommunications(patientId);
      if (newDetections.length > 0) {
        await loadDetections(); // Reload to get all unreviewed
      }
    } catch (error) {
      // Error logged server-side, fail silently on client
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeColor = (risk: string): string => {
    switch (risk) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getSourceLabel = (source: string): string => {
    const labels: Record<string, string> = {
      'clinical_note': 'Clinical Note',
      'community_post': 'Community Post',
      'patient_message': 'Patient Message',
      'check_in_comment': 'Check-in Comment',
      'telehealth_transcript': 'Telehealth',
      'scribe_note': 'Scribe Note'
    };
    return labels[source] || source;
  };

  if (loading && detections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading passive detections...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Passive SDOH Detection
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Automatically identified from patient communications
            </p>
          </div>
          <button
            onClick={handleScanCommunications}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {loading ? 'Scanning...' : 'Scan Recent Communications'}
          </button>
        </div>
      </div>

      {/* Detections List */}
      <div className="divide-y divide-gray-200">
        {detections.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-sm">No unreviewed detections</p>
            <p className="mt-1 text-xs">Click "Scan Recent Communications" to analyze patient text</p>
          </div>
        ) : (
          detections.map((detection, index) => (
            <div key={`${detection.sourceId}-${index}`} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              {/* Detection Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <SDOHIndicatorBadge
                      category={detection.category}
                      riskLevel={detection.riskLevel}
                    />
                    <span className={`px-2 py-1 text-xs font-medium rounded-sm ${getRiskBadgeColor(detection.riskLevel)}`}>
                      {detection.riskLevel.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-sm">
                      {detection.confidence}% confidence
                    </span>
                    <span className="text-xs text-gray-500">
                      {getSourceLabel(detection.source)}
                    </span>
                  </div>

                  {/* Matched Keywords */}
                  <div className="mb-2">
                    <span className="text-xs text-gray-600">Detected keywords: </span>
                    <span className="text-xs font-medium text-gray-900">
                      {detection.matchedKeywords.join(', ')}
                    </span>
                  </div>

                  {/* Context Snippet */}
                  <div className="mb-3">
                    <button
                      onClick={() => setExpandedId(expandedId === `${detection.sourceId}-${index}` ? null : `${detection.sourceId}-${index}`)}
                      className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-sm border border-gray-200 hover:bg-gray-100 transition-colors w-full text-left"
                    >
                      <span className="font-medium">Context: </span>
                      {expandedId === `${detection.sourceId}-${index}` ? (
                        <span className="block mt-1">{detection.contextSnippet}</span>
                      ) : (
                        <span className="line-clamp-1">{detection.contextSnippet}</span>
                      )}
                    </button>
                  </div>

                  {/* Suggested Z-Code */}
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Suggested billing code:</span> {detection.suggestedZCode}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="ml-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleReview(`${detection.sourceId}-${index}`, true, 'Confirmed via passive detection')}
                    disabled={reviewingId !== null}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    Confirm & Add to Chart
                  </button>
                  <button
                    onClick={() => handleReview(`${detection.sourceId}-${index}`, false, 'Dismissed - not clinically relevant')}
                    disabled={reviewingId !== null}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-sm hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Timestamp */}
              <div className="mt-2 text-xs text-gray-500">
                Detected: {new Date(detection.detectedAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Summary */}
      {detections.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{detections.length}</span> unreviewed detection{detections.length !== 1 ? 's' : ''}
            {detections.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').length > 0 && (
              <span className="ml-2 text-orange-600 font-medium">
                ({detections.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').length} high priority)
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default SDOHPassiveDetectionPanel;
