/**
 * MarkerForm - Add/Edit Marker Form
 *
 * Form for creating new markers or editing existing ones.
 * Includes body region picker and marker type selector.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { EACard, EACardHeader, EACardContent, EACardFooter } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import {
  PatientMarker,
  MarkerCategory,
  MarkerDetails,
  BodyView,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from '../../types/patientAvatar';
import { MARKER_TYPE_GROUPS, getMarkerTypeDefinition } from './constants/markerTypeLibrary';
import { BODY_REGION_COORDINATES } from './anatomy-3d/anatomyCoordinates';

interface MarkerFormProps {
  patientId: string;
  existingMarker?: PatientMarker;
  /** @deprecated No longer used — body region dropdown replaced the 2D avatar position picker */
  skinTone?: string;
  /** @deprecated No longer used — body region dropdown replaced the 2D avatar position picker */
  genderPresentation?: string;
  onSave: (marker: Omit<PatientMarker, 'id' | 'patient_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onClose: () => void;
}

/**
 * Form section component
 */
const FormSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="space-y-2">
    <h4 className="text-sm font-medium text-slate-300">{title}</h4>
    {children}
  </div>
);

/**
 * MarkerForm Component
 */
/** Body region groups for the dropdown, derived from BODY_REGION_COORDINATES */
const BODY_REGION_GROUPS = [
  { label: 'Head & Neck', regions: ['head_top', 'brain', 'face', 'head_back', 'neck'] },
  { label: 'Chest', regions: ['chest_left', 'chest_right', 'heart'] },
  { label: 'Abdomen', regions: ['abdomen_upper', 'abdomen', 'abdomen_lower', 'abdomen_right', 'abdomen_left', 'suprapubic'] },
  { label: 'Back', regions: ['upper_back', 'back', 'lower_back_right', 'lower_back_left', 'lumbar_spine', 'spine_lower', 'sacrum'] },
  { label: 'Shoulders', regions: ['shoulder_left', 'shoulder_right'] },
  { label: 'Right Arm', regions: ['arm_upper_right', 'arm_lower_right', 'wrist_right', 'hand_right'] },
  { label: 'Left Arm', regions: ['arm_upper_left', 'arm_lower_left', 'left_arm', 'wrist_left', 'hand_left', 'left_hand'] },
  { label: 'Right Leg', regions: ['thigh_right', 'knee_right', 'shin_right', 'ankle_right', 'foot_right'] },
  { label: 'Left Leg', regions: ['thigh_left', 'knee_left', 'shin_left', 'ankle_left', 'foot_left', 'left_foot'] },
  { label: 'Pelvis', regions: ['groin_right', 'groin_left'] },
  { label: 'Obstetric', regions: ['uterus_fundus', 'uterus_body', 'uterus_lower'] },
] as const;

/** Human-readable label from region key */
function regionLabel(region: string): string {
  return region.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const MarkerForm: React.FC<MarkerFormProps> = ({
  patientId: _patientId,
  existingMarker,
  onSave,
  onClose,
}) => {
  const isEditing = !!existingMarker;

  // Form state
  const [category, setCategory] = useState<MarkerCategory>(
    existingMarker?.category || 'informational'
  );
  const [markerType, setMarkerType] = useState(existingMarker?.marker_type || '');
  const [displayName, setDisplayName] = useState(existingMarker?.display_name || '');
  const [bodyRegion, setBodyRegion] = useState(existingMarker?.body_region || '');
  const [positionX, setPositionX] = useState(existingMarker?.position_x || 50);
  const [positionY, setPositionY] = useState(existingMarker?.position_y || 50);
  const [bodyView, setBodyView] = useState<BodyView>(existingMarker?.body_view || 'front');
  const [requiresAttention, setRequiresAttention] = useState(
    existingMarker?.requires_attention || false
  );

  // Details state
  const [insertionDate, setInsertionDate] = useState(
    existingMarker?.details?.insertion_date || existingMarker?.details?.onset_date || ''
  );
  const [careInstructions, setCareInstructions] = useState(
    existingMarker?.details?.care_instructions || ''
  );
  const [severityStage, setSeverityStage] = useState(
    existingMarker?.details?.severity_stage || ''
  );
  const [notes, setNotes] = useState(existingMarker?.details?.notes || '');

  const [saving, setSaving] = useState(false);

  // Get marker types for selected category (used in type selection dropdown)
  const _availableTypes = useMemo(() => {
    const group = MARKER_TYPE_GROUPS.find((g) =>
      g.types.some((t) => t.category === category)
    );
    return group?.types.filter((t) => t.category === category) || [];
  }, [category]);

  // Handle marker type selection
  const handleTypeSelect = useCallback((type: string) => {
    setMarkerType(type);
    const typeDef = getMarkerTypeDefinition(type);
    if (typeDef) {
      setDisplayName(typeDef.display_name);
      setBodyRegion(typeDef.default_body_region);
      setPositionX(typeDef.default_position.x);
      setPositionY(typeDef.default_position.y);
      setBodyView(typeDef.default_body_view);
    }
  }, []);

  // Handle body region selection — auto-set coordinates from the coordinate map
  const handleBodyRegionSelect = useCallback((region: string) => {
    setBodyRegion(region);
    const coords = BODY_REGION_COORDINATES[region];
    if (coords) {
      // Convert 3D coords back to percentage approximation for storage
      const x = Math.round((coords[0] / 0.6 * 100 + 50) * 10) / 10;
      const y = Math.round(((1.7 - coords[1]) / 1.7 * 100) * 10) / 10;
      setPositionX(x);
      setPositionY(y);
      // Determine front/back from Z coordinate
      setBodyView(coords[2] >= 0 ? 'front' : 'back');
    }
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!markerType || !displayName || !bodyRegion) {
      return; // Basic validation
    }

    setSaving(true);

    const details: MarkerDetails = {
      insertion_date: insertionDate || undefined,
      care_instructions: careInstructions || undefined,
      severity_stage: severityStage || undefined,
      notes: notes || undefined,
    };

    // Get ICD-10 from type definition if available
    const typeDef = getMarkerTypeDefinition(markerType);
    if (typeDef?.icd10) {
      details.icd10_code = typeDef.icd10;
    }

    await onSave({
      category,
      marker_type: markerType,
      display_name: displayName,
      body_region: bodyRegion,
      position_x: positionX,
      position_y: positionY,
      body_view: bodyView,
      source: existingMarker?.source || 'manual',
      status: existingMarker?.status || 'confirmed',
      confidence_score: existingMarker?.confidence_score,
      details,
      is_active: true,
      requires_attention: requiresAttention,
    });

    setSaving(false);
  }, [
    category,
    markerType,
    displayName,
    bodyRegion,
    positionX,
    positionY,
    bodyView,
    requiresAttention,
    insertionDate,
    careInstructions,
    severityStage,
    notes,
    existingMarker,
    onSave,
  ]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <EACard
        className="max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <EACardHeader
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          }
          action={
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          }
        >
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Marker' : 'Add New Marker'}
          </h3>
          <p className="text-sm text-slate-400">
            {isEditing ? 'Update marker details' : 'Select a body region and marker type'}
          </p>
        </EACardHeader>

        {/* Content */}
        <EACardContent className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {/* Body Region & Position */}
            <FormSection title="Body Region">
              <select
                value={bodyRegion}
                onChange={(e) => handleBodyRegionSelect(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg',
                  'bg-slate-800 border border-slate-700',
                  'text-white text-sm',
                  'focus:outline-hidden focus:ring-2 focus:ring-[#00857a]/50'
                )}
              >
                <option value="">Select body region...</option>
                {BODY_REGION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.regions
                      .filter((r) => r in BODY_REGION_COORDINATES)
                      .map((region) => (
                        <option key={region} value={region}>
                          {regionLabel(region)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {bodyRegion && (
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span>View: <span className="text-slate-300 capitalize">{bodyView}</span></span>
                  <span>X: {positionX.toFixed(1)}%</span>
                  <span>Y: {positionY.toFixed(1)}%</span>
                </div>
              )}
            </FormSection>

            {/* Form fields */}
            <div className="space-y-4">
              {/* Category */}
              <FormSection title="Category">
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CATEGORY_LABELS) as MarkerCategory[]).map((cat) => (
                    <button
                      key={cat}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-sm border text-left text-sm',
                        category === cat
                          ? 'bg-slate-700 border-[#00857a]'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      )}
                      onClick={() => {
                        setCategory(cat);
                        setMarkerType('');
                        setDisplayName('');
                      }}
                    >
                      <span
                        className={cn('w-3 h-3 rounded-full', CATEGORY_COLORS[cat].bg)}
                      />
                      <span className="text-slate-200">{CATEGORY_LABELS[cat]}</span>
                    </button>
                  ))}
                </div>
              </FormSection>

              {/* Marker Type */}
              <FormSection title="Type">
                <select
                  value={markerType}
                  onChange={(e) => handleTypeSelect(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg',
                    'bg-slate-800 border border-slate-700',
                    'text-white text-sm',
                    'focus:outline-hidden focus:ring-2 focus:ring-[#00857a]/50'
                  )}
                >
                  <option value="">Select a type...</option>
                  {MARKER_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types
                        .filter((t) => t.category === category)
                        .map((type) => (
                          <option key={type.type} value={type.type}>
                            {type.display_name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </FormSection>

              {/* Display Name */}
              <FormSection title="Display Name">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="E.g., PICC Line - Right Arm"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg',
                    'bg-slate-800 border border-slate-700',
                    'text-white text-sm placeholder:text-slate-500',
                    'focus:outline-hidden focus:ring-2 focus:ring-[#00857a]/50'
                  )}
                />
              </FormSection>

              {/* Date */}
              <FormSection title="Insertion/Onset Date">
                <input
                  type="date"
                  value={insertionDate}
                  onChange={(e) => setInsertionDate(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg',
                    'bg-slate-800 border border-slate-700',
                    'text-white text-sm',
                    'focus:outline-hidden focus:ring-2 focus:ring-[#00857a]/50'
                  )}
                />
              </FormSection>

              {/* Severity/Stage (for conditions) */}
              {(category === 'chronic' || category === 'neurological') && (
                <FormSection title="Severity/Stage">
                  <input
                    type="text"
                    value={severityStage}
                    onChange={(e) => setSeverityStage(e.target.value)}
                    placeholder="E.g., Stage III, Mild, Hoehn-Yahr 2"
                    className={cn(
                      'w-full px-3 py-2 rounded-lg',
                      'bg-slate-800 border border-slate-700',
                      'text-white text-sm placeholder:text-slate-500',
                      'focus:outline-hidden focus:ring-2 focus:ring-[#00857a]/50'
                    )}
                  />
                </FormSection>
              )}

              {/* Care Instructions */}
              <FormSection title="Care Instructions">
                <textarea
                  value={careInstructions}
                  onChange={(e) => setCareInstructions(e.target.value)}
                  placeholder="Dressing change schedule, flush protocol, etc."
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg resize-none',
                    'bg-slate-800 border border-slate-700',
                    'text-white text-sm placeholder:text-slate-500',
                    'focus:outline-hidden focus:ring-2 focus:ring-[#00857a]/50'
                  )}
                />
              </FormSection>

              {/* Notes */}
              <FormSection title="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for shift handoff..."
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg resize-none',
                    'bg-slate-800 border border-slate-700',
                    'text-white text-sm placeholder:text-slate-500',
                    'focus:outline-hidden focus:ring-2 focus:ring-[#00857a]/50'
                  )}
                />
              </FormSection>

              {/* Requires Attention */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresAttention}
                  onChange={(e) => setRequiresAttention(e.target.checked)}
                  className="w-4 h-4 rounded-sm border-slate-600 bg-slate-800 text-[#00857a] focus:ring-[#00857a]/50"
                />
                <span className="text-sm text-slate-300">
                  Requires attention (will pulse on avatar)
                </span>
              </label>
            </div>
          </div>
        </EACardContent>

        {/* Footer */}
        <EACardFooter className="justify-end gap-2">
          <EAButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </EAButton>
          <EAButton
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!markerType || !displayName || saving}
          >
            {isEditing ? 'Update Marker' : 'Add Marker'}
          </EAButton>
        </EACardFooter>
      </EACard>
    </div>
  );
};

MarkerForm.displayName = 'MarkerForm';

export default MarkerForm;
