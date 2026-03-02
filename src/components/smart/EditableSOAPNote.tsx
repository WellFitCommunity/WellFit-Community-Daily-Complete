/**
 * EditableSOAPNote — SOAP note display with per-section inline editing
 *
 * Replaces the read-only SOAPNote component when used in the scribe workflow.
 * Physicians can click Edit on individual sections to modify AI-generated content.
 * On save, computes diffs for the style profiler.
 *
 * Part of Compass Riley Ambient Learning Session 2.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import type { SOAPNote } from './hooks/useSmartScribe.types';

// ============================================================================
// Types
// ============================================================================

type SOAPSectionKey = 'subjective' | 'objective' | 'assessment' | 'plan' | 'hpi' | 'ros';

interface EditableSOAPNoteProps {
  soapNote: SOAPNote;
  sessionId: string | null;
  providerId: string;
  readOnly?: boolean;
  onSaveEdits: (original: SOAPNote, edited: SOAPNote) => Promise<void>;
}

interface SectionConfig {
  key: SOAPSectionKey;
  label: string;
  shortLabel: string;
  colorClass: string;
  borderColor: string;
}

// ============================================================================
// Section Configuration
// ============================================================================

const CORE_SECTIONS: SectionConfig[] = [
  { key: 'subjective', label: 'S - Subjective', shortLabel: 'S', colorClass: 'bg-blue-900/20', borderColor: 'border-blue-500' },
  { key: 'objective', label: 'O - Objective', shortLabel: 'O', colorClass: 'bg-green-900/20', borderColor: 'border-green-500' },
  { key: 'assessment', label: 'A - Assessment', shortLabel: 'A', colorClass: 'bg-amber-900/20', borderColor: 'border-amber-500' },
  { key: 'plan', label: 'P - Plan', shortLabel: 'P', colorClass: 'bg-purple-900/20', borderColor: 'border-purple-500' },
];

const LABEL_COLORS: Record<string, string> = {
  subjective: 'text-blue-400',
  objective: 'text-green-400',
  assessment: 'text-amber-400',
  plan: 'text-purple-400',
};

// ============================================================================
// Component
// ============================================================================

export const EditableSOAPNote: React.FC<EditableSOAPNoteProps> = React.memo(({
  soapNote,
  readOnly = false,
  onSaveEdits,
}) => {
  const [editingSections, setEditingSections] = useState<Set<SOAPSectionKey>>(new Set());
  const [editedContent, setEditedContent] = useState<Partial<SOAPNote>>({});
  const [saving, setSaving] = useState(false);

  const hasEdits = useMemo(() => {
    return Object.entries(editedContent).some(([key, value]) => {
      const original = soapNote[key as SOAPSectionKey] ?? '';
      return value !== undefined && value.trim() !== original.trim();
    });
  }, [editedContent, soapNote]);

  const handleToggleEdit = useCallback((section: SOAPSectionKey) => {
    setEditingSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
        // Discard edit if reverting
        setEditedContent(prev => {
          const updated = { ...prev };
          delete updated[section];
          return updated;
        });
      } else {
        next.add(section);
        // Initialize with current content
        setEditedContent(prev => ({
          ...prev,
          [section]: soapNote[section] || '',
        }));
      }
      return next;
    });
  }, [soapNote]);

  const handleContentChange = useCallback((section: SOAPSectionKey, value: string) => {
    setEditedContent(prev => ({ ...prev, [section]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasEdits) return;
    setSaving(true);

    const edited: SOAPNote = {
      subjective: editedContent.subjective ?? soapNote.subjective,
      objective: editedContent.objective ?? soapNote.objective,
      assessment: editedContent.assessment ?? soapNote.assessment,
      plan: editedContent.plan ?? soapNote.plan,
      hpi: editedContent.hpi ?? soapNote.hpi,
      ros: editedContent.ros ?? soapNote.ros,
    };

    await onSaveEdits(soapNote, edited);

    // Clear editing state after successful save
    setEditingSections(new Set());
    setEditedContent({});
    setSaving(false);
  }, [hasEdits, editedContent, soapNote, onSaveEdits]);

  const handleCopyToClipboard = useCallback(async () => {
    const note = hasEdits ? { ...soapNote, ...editedContent } : soapNote;
    const soapText = `SUBJECTIVE:\n${note.subjective}\n\nOBJECTIVE:\n${note.objective}\n\nASSESSMENT:\n${note.assessment}\n\nPLAN:\n${note.plan}`;
    await navigator.clipboard.writeText(soapText);
  }, [soapNote, editedContent, hasEdits]);

  return (
    <EACard>
      <EACardHeader
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        action={
          <div className="flex items-center gap-2">
            {hasEdits && (
              <EAButton variant="primary" size="sm" onClick={handleSave} loading={saving}>
                Save Changes
              </EAButton>
            )}
            <EAButton variant="ghost" size="sm" onClick={handleCopyToClipboard}>
              Copy
            </EAButton>
          </div>
        }
      >
        <h3 className="text-sm font-medium text-white">SOAP Note</h3>
        <p className="text-xs text-slate-400">
          {readOnly ? 'AI-generated clinical documentation' : 'Click edit to refine — Riley learns your style'}
        </p>
      </EACardHeader>
      <EACardContent className="p-0">
        {CORE_SECTIONS.map((config, idx) => (
          <SOAPSection
            key={config.key}
            config={config}
            content={editedContent[config.key] ?? soapNote[config.key] ?? ''}
            isEditing={editingSections.has(config.key)}
            isModified={editedContent[config.key] !== undefined && editedContent[config.key]?.trim() !== (soapNote[config.key] ?? '').trim()}
            readOnly={readOnly}
            isLast={idx === CORE_SECTIONS.length - 1 && !soapNote.hpi && !soapNote.ros}
            onToggleEdit={() => handleToggleEdit(config.key)}
            onChange={(v) => handleContentChange(config.key, v)}
          />
        ))}

        {/* Expandable HPI & ROS */}
        {(soapNote.hpi || soapNote.ros) && (
          <div className="border-t border-slate-700 grid grid-cols-2 divide-x divide-slate-700">
            {soapNote.hpi && (
              <ExpandableSection
                label="Detailed HPI"
                content={editedContent.hpi ?? soapNote.hpi}
                isEditing={editingSections.has('hpi')}
                readOnly={readOnly}
                onToggleEdit={() => handleToggleEdit('hpi')}
                onChange={(v) => handleContentChange('hpi', v)}
              />
            )}
            {soapNote.ros && (
              <ExpandableSection
                label="Review of Systems"
                content={editedContent.ros ?? soapNote.ros}
                isEditing={editingSections.has('ros')}
                readOnly={readOnly}
                onToggleEdit={() => handleToggleEdit('ros')}
                onChange={(v) => handleContentChange('ros', v)}
              />
            )}
          </div>
        )}
      </EACardContent>
    </EACard>
  );
});

EditableSOAPNote.displayName = 'EditableSOAPNote';

// ============================================================================
// Sub-components
// ============================================================================

interface SOAPSectionProps {
  config: SectionConfig;
  content: string;
  isEditing: boolean;
  isModified: boolean;
  readOnly: boolean;
  isLast: boolean;
  onToggleEdit: () => void;
  onChange: (value: string) => void;
}

const SOAPSection: React.FC<SOAPSectionProps> = React.memo(({
  config, content, isEditing, isModified, readOnly, isLast, onToggleEdit, onChange,
}) => (
  <div className={`${isLast ? '' : 'border-b border-slate-700'} ${isModified ? 'ring-1 ring-blue-500/30' : ''}`}>
    <div className={`px-4 py-2 ${config.colorClass} border-l-4 ${config.borderColor} flex items-center justify-between`}>
      <h4 className={`text-xs font-semibold ${LABEL_COLORS[config.key] || 'text-slate-400'} uppercase tracking-wide`}>
        {config.label}
        {isModified && <span className="ml-2 text-blue-400 text-[10px] normal-case">(edited)</span>}
      </h4>
      {!readOnly && (
        <button
          onClick={onToggleEdit}
          className="text-slate-500 hover:text-white transition-colors p-1"
          title={isEditing ? 'Cancel edit' : 'Edit section'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isEditing ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            )}
          </svg>
        </button>
      )}
    </div>
    <div className="px-4 py-3">
      {isEditing ? (
        <textarea
          className="w-full bg-slate-800 text-sm text-slate-200 leading-relaxed p-2 rounded border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y min-h-[60px]"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.max(3, (content || '').split('\n').length)}
        />
      ) : (
        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{content}</p>
      )}
    </div>
  </div>
));

SOAPSection.displayName = 'SOAPSection';

interface ExpandableSectionProps {
  label: string;
  content: string;
  isEditing: boolean;
  readOnly: boolean;
  onToggleEdit: () => void;
  onChange: (value: string) => void;
}

const ExpandableSection: React.FC<ExpandableSectionProps> = React.memo(({
  label, content, isEditing, readOnly, onToggleEdit, onChange,
}) => (
  <details className="group">
    <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center justify-between">
      <span>
        {label}
        <span className="ml-2 text-slate-500 group-open:rotate-180 inline-block transition-transform">&#x25BC;</span>
      </span>
      {!readOnly && (
        <button
          onClick={(e) => { e.preventDefault(); onToggleEdit(); }}
          className="text-slate-500 hover:text-white transition-colors p-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
    </summary>
    <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/30">
      {isEditing ? (
        <textarea
          className="w-full bg-slate-800 text-sm text-slate-300 leading-relaxed p-2 rounded border border-slate-600 focus:border-blue-500 outline-none resize-y min-h-[60px]"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.max(3, (content || '').split('\n').length)}
        />
      ) : (
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
      )}
    </div>
  </details>
));

ExpandableSection.displayName = 'ExpandableSection';

export default EditableSOAPNote;
