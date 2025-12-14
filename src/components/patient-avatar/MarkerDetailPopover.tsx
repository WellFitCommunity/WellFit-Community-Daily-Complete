/**
 * MarkerDetailPopover - Detail panel for a selected marker
 *
 * Displays comprehensive marker information including:
 * - Device/condition name and type
 * - Location, dates, care instructions
 * - SmartScribe source and confidence
 * - Confirm/Edit/Reject actions for pending markers
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { EACard, EACardHeader, EACardContent, EACardFooter } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';
import {
  MarkerDetailPopoverProps,
  PatientMarker,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '../../types/patientAvatar';

/**
 * Format a date string for display
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Not specified';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Detail row component
 */
const DetailRow: React.FC<{
  label: string;
  value?: string | null;
  className?: string;
}> = ({ label, value, className }) => {
  if (!value) return null;

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm text-slate-200">{value}</span>
    </div>
  );
};

/**
 * List detail row for arrays
 */
const ListDetailRow: React.FC<{
  label: string;
  items?: string[];
}> = ({ label, items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <ul className="list-disc list-inside text-sm text-slate-200 space-y-0.5">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Category badge with color
 */
const CategoryIndicator: React.FC<{ category: PatientMarker['category'] }> = ({
  category,
}) => {
  const colors = CATEGORY_COLORS[category];
  const label = CATEGORY_LABELS[category];

  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-3 h-3 rounded-full', colors.bg)} />
      <span className={cn('text-sm font-medium', colors.text)}>{label}</span>
    </div>
  );
};

/**
 * MarkerDetailPopover Component
 */
export const MarkerDetailPopover: React.FC<MarkerDetailPopoverProps> = ({
  marker,
  isOpen,
  onClose,
  onConfirm,
  onReject,
  onEdit,
  onDeactivate,
}) => {
  if (!isOpen) return null;

  const isPending = marker.status === 'pending_confirmation';
  const isSmartScribe = marker.source === 'smartscribe';
  const details = marker.details || {};

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <EACard
        className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <EACardHeader
          icon={
            <span className={cn('w-4 h-4 rounded-full', CATEGORY_COLORS[marker.category].bg)} />
          }
          action={
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          }
        >
          <h3 className="text-lg font-semibold text-white">{marker.display_name}</h3>
          <p className="text-sm text-slate-400">{marker.marker_type.replace(/_/g, ' ')}</p>
        </EACardHeader>

        {/* Content - Scrollable */}
        <EACardContent className="overflow-y-auto flex-1 space-y-4">
          {/* Source Badge */}
          {isSmartScribe && (
            <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
              <EABadge variant={isPending ? 'high' : 'info'}>
                SmartScribe {isPending ? 'Detected' : 'Confirmed'}
              </EABadge>
              {marker.confidence_score && (
                <span className="text-xs text-slate-400">
                  {Math.round(marker.confidence_score * 100)}% confidence
                </span>
              )}
            </div>
          )}

          {/* Category & Status */}
          <div className="flex items-center justify-between">
            <CategoryIndicator category={marker.category} />
            {isPending && (
              <EABadge variant="high">Pending Confirmation</EABadge>
            )}
            {marker.requires_attention && !isPending && (
              <EABadge variant="critical">Needs Attention</EABadge>
            )}
          </div>

          {/* Location */}
          <DetailRow
            label="Body Location"
            value={marker.body_region.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          />

          {/* Dates Section */}
          <div className="grid grid-cols-2 gap-4">
            <DetailRow
              label={details.onset_date ? 'Onset Date' : 'Insertion Date'}
              value={formatDate(details.onset_date || details.insertion_date)}
            />
            <DetailRow
              label="Last Assessed"
              value={formatDate(details.last_assessed)}
            />
            {details.expected_removal && (
              <DetailRow
                label="Expected Removal"
                value={formatDate(details.expected_removal)}
              />
            )}
          </div>

          {/* Provider Info */}
          {(details.assessed_by || details.diagnosing_provider) && (
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Assessed By" value={details.assessed_by} />
              <DetailRow label="Diagnosing Provider" value={details.diagnosing_provider} />
            </div>
          )}

          {/* Clinical Info */}
          {details.severity_stage && (
            <DetailRow label="Severity / Stage" value={details.severity_stage} />
          )}

          {details.icd10_code && (
            <DetailRow label="ICD-10 Code" value={details.icd10_code} />
          )}

          {details.specifications && (
            <DetailRow label="Specifications" value={details.specifications} />
          )}

          {/* Care Instructions */}
          {details.care_instructions && (
            <div className="p-3 bg-[#00857a]/10 border border-[#00857a]/30 rounded-lg">
              <span className="text-xs text-[#00857a] font-medium block mb-1">
                Care Instructions
              </span>
              <p className="text-sm text-slate-200">{details.care_instructions}</p>
            </div>
          )}

          {/* Complications to Watch */}
          <ListDetailRow
            label="Complications to Watch For"
            items={details.complications_watch}
          />

          {/* Symptoms to Monitor */}
          <ListDetailRow
            label="Symptoms to Monitor"
            items={details.symptoms_monitor}
          />

          {/* Related Medications */}
          <ListDetailRow
            label="Related Medications"
            items={details.related_medications}
          />

          {/* Notes */}
          {details.notes && (
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <span className="text-xs text-slate-400 block mb-1">Notes</span>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{details.notes}</p>
            </div>
          )}

          {/* SmartScribe Raw Text */}
          {isSmartScribe && details.raw_smartscribe_text && (
            <div className="p-3 bg-slate-900/50 rounded-lg border border-dashed border-slate-600">
              <span className="text-xs text-slate-400 block mb-1">
                Original SmartScribe Text
              </span>
              <p className="text-sm text-slate-300 italic">
                &quot;{details.raw_smartscribe_text}&quot;
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-2 border-t border-slate-700 text-xs text-slate-500">
            <p>Created: {new Date(marker.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(marker.updated_at).toLocaleString()}</p>
          </div>
        </EACardContent>

        {/* Footer Actions */}
        <EACardFooter className="justify-between">
          {/* Left side - Source */}
          <div className="text-xs text-slate-500">
            Source: {marker.source === 'smartscribe' ? 'SmartScribe AI' : 'Manual Entry'}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {isPending ? (
              // Pending marker actions
              <>
                <EAButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onReject?.()}
                >
                  Reject
                </EAButton>
                <EAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit?.()}
                >
                  Edit
                </EAButton>
                <EAButton
                  variant="primary"
                  size="sm"
                  onClick={() => onConfirm?.()}
                >
                  Confirm
                </EAButton>
              </>
            ) : (
              // Confirmed marker actions
              <>
                <EAButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeactivate?.()}
                >
                  Deactivate
                </EAButton>
                <EAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit?.()}
                >
                  Edit
                </EAButton>
                <EAButton
                  variant="primary"
                  size="sm"
                  onClick={onClose}
                >
                  Close
                </EAButton>
              </>
            )}
          </div>
        </EACardFooter>
      </EACard>
    </div>
  );
};

MarkerDetailPopover.displayName = 'MarkerDetailPopover';

export default MarkerDetailPopover;
