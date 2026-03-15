/**
 * ClinicalNoteSummaryDashboard - Browse and review AI-generated clinical notes
 *
 * Purpose: Admin dashboard for viewing, reviewing, and approving AI-generated
 *          SOAP notes, progress notes, and discharge summaries
 * Used by: Admin Panel (sectionDefinitions), route /admin/clinical-notes
 *
 * Data sources:
 * - clinical_notes table (notes with ai_generated flag)
 * - ai_progress_notes table
 * - SOAPNoteAIService, ProgressNoteSynthesizerService
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EATabs,
  EATabsList,
  EATabsTrigger,
} from '../envision-atlus';
import { auditLogger } from '../../services/auditLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClinicalNote {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  note_type: string;
  note_content: string;
  status: string;
  created_by: string | null;
  created_at: string;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  ai_generated: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface AIProgressNote {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  synthesis_type: string;
  content: string;
  confidence_score: number | null;
  model_used: string | null;
  created_at: string;
  reviewed: boolean;
  reviewer_id: string | null;
}

interface NoteMetrics {
  totalAINotes: number;
  pendingReview: number;
  approvedNotes: number;
  avgConfidence: number;
}

type TabId = 'clinical-notes' | 'progress-notes' | 'metrics';

// ─── Component ────────────────────────────────────────────────────────────────

const ClinicalNoteSummaryDashboard: React.FC = () => {
  useDashboardTheme();
  const supabase = useSupabaseClient();
  const [activeTab, setActiveTab] = useState<TabId>('clinical-notes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);
  const [progressNotes, setProgressNotes] = useState<AIProgressNote[]>([]);
  const [metrics, setMetrics] = useState<NoteMetrics>({
    totalAINotes: 0,
    pendingReview: 0,
    approvedNotes: 0,
    avgConfidence: 0,
  });
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);

  const loadNotes = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch AI-generated clinical notes
      const { data: notes, error: notesError } = await supabase
        .from('clinical_notes')
        .select('id, patient_id, encounter_id, note_type, note_content, status, created_by, created_at, is_locked, locked_at, locked_by, ai_generated, reviewed_by, reviewed_at')
        .eq('ai_generated', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (notesError) throw notesError;
      const allNotes = (notes || []) as ClinicalNote[];
      setClinicalNotes(allNotes);

      // Fetch AI progress notes
      const { data: aiNotes, error: aiError } = await supabase
        .from('ai_progress_notes')
        .select('id, patient_id, encounter_id, synthesis_type, content, confidence_score, model_used, created_at, reviewed, reviewer_id')
        .order('created_at', { ascending: false })
        .limit(100);

      if (aiError) throw aiError;
      const allProgress = (aiNotes || []) as AIProgressNote[];
      setProgressNotes(allProgress);

      // Compute metrics
      const pending = allNotes.filter(n => !n.reviewed_by && !n.is_locked);
      const approved = allNotes.filter(n => n.reviewed_by || n.is_locked);
      const confidences = allProgress
        .map(n => n.confidence_score)
        .filter((c): c is number => c !== null);
      const avgConf = confidences.length > 0
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
        : 0;

      setMetrics({
        totalAINotes: allNotes.length + allProgress.length,
        pendingReview: pending.length + allProgress.filter(n => !n.reviewed).length,
        approvedNotes: approved.length + allProgress.filter(n => n.reviewed).length,
        avgConfidence: Math.round(avgConf * 100),
      });

      await auditLogger.info('CLINICAL_NOTE_DASHBOARD_LOADED', {
        clinicalNoteCount: allNotes.length,
        progressNoteCount: allProgress.length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load notes';
      setError(message);
      await auditLogger.error(
        'CLINICAL_NOTE_DASHBOARD_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'loadNotes' }
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const getNoteTypeBadge = (noteType: string) => {
    switch (noteType.toLowerCase()) {
      case 'soap':
        return <EABadge variant="info">SOAP</EABadge>;
      case 'progress':
        return <EABadge variant="neutral">Progress</EABadge>;
      case 'discharge':
        return <EABadge variant="elevated">Discharge</EABadge>;
      case 'consultation':
        return <EABadge variant="neutral">Consult</EABadge>;
      default:
        return <EABadge variant="neutral">{noteType}</EABadge>;
    }
  };

  const getReviewStatusBadge = (note: ClinicalNote) => {
    if (note.is_locked) return <EABadge variant="normal">Signed</EABadge>;
    if (note.reviewed_by) return <EABadge variant="normal">Reviewed</EABadge>;
    return <EABadge variant="elevated">Pending Review</EABadge>;
  };

  const truncateContent = (content: string, maxLen: number = 120) => {
    if (content.length <= maxLen) return content;
    return content.slice(0, maxLen) + '...';
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ea-primary,#00857a)]" />
        <span className="ml-3 text-gray-600 text-lg">Loading clinical notes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clinical Note Summarization</h2>
          <p className="text-gray-600 mt-1">
            Review and approve AI-generated SOAP notes, progress notes, and discharge summaries
          </p>
        </div>
        <EAButton onClick={loadNotes} variant="secondary" size="sm">
          Refresh
        </EAButton>
      </div>

      {error && (
        <EAAlert variant="warning">
          <p>{error}</p>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EAMetricCard
          label="AI-Generated Notes"
          value={metrics.totalAINotes}
          sublabel="Total across all types"
        />
        <EAMetricCard
          label="Pending Review"
          value={metrics.pendingReview}
          sublabel="Awaiting clinician sign-off"
          riskLevel={metrics.pendingReview > 10 ? 'elevated' : 'normal'}
        />
        <EAMetricCard
          label="Approved"
          value={metrics.approvedNotes}
          sublabel="Reviewed and signed"
        />
        <EAMetricCard
          label="Avg Confidence"
          value={`${metrics.avgConfidence}%`}
          sublabel="AI model confidence"
        />
      </div>

      {/* Tabs */}
      <EATabs defaultValue="clinical-notes" value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <EATabsList>
          <EATabsTrigger value="clinical-notes">
            Clinical Notes ({clinicalNotes.length})
          </EATabsTrigger>
          <EATabsTrigger value="progress-notes">
            AI Progress Notes ({progressNotes.length})
          </EATabsTrigger>
        </EATabsList>
      </EATabs>

      {/* Clinical Notes Tab */}
      {activeTab === 'clinical-notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Note List */}
          <div className="lg:col-span-2">
            <EACard>
              <EACardHeader>
                <h3 className="text-lg font-semibold">AI-Generated Clinical Notes</h3>
              </EACardHeader>
              <EACardContent>
                {clinicalNotes.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No AI-generated clinical notes found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {clinicalNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => setSelectedNote(note)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          selectedNote?.id === note.id
                            ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/5'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getNoteTypeBadge(note.note_type)}
                            {getReviewStatusBadge(note)}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(note.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {truncateContent(note.note_content)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </EACardContent>
            </EACard>
          </div>

          {/* Note Detail */}
          <div>
            <EACard>
              <EACardHeader>
                <h3 className="text-lg font-semibold">Note Detail</h3>
              </EACardHeader>
              <EACardContent>
                {selectedNote ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getNoteTypeBadge(selectedNote.note_type)}
                      {getReviewStatusBadge(selectedNote)}
                      <EABadge variant="info">AI Generated</EABadge>
                    </div>

                    <div className="text-sm space-y-2">
                      <div>
                        <span className="font-medium text-gray-700">Created:</span>{' '}
                        <span className="text-gray-600">
                          {new Date(selectedNote.created_at).toLocaleString()}
                        </span>
                      </div>
                      {selectedNote.reviewed_by && (
                        <div>
                          <span className="font-medium text-gray-700">Reviewed:</span>{' '}
                          <span className="text-gray-600">
                            {selectedNote.reviewed_at
                              ? new Date(selectedNote.reviewed_at).toLocaleString()
                              : 'Yes'}
                          </span>
                        </div>
                      )}
                      {selectedNote.is_locked && (
                        <div>
                          <span className="font-medium text-gray-700">Signed:</span>{' '}
                          <span className="text-gray-600">
                            {selectedNote.locked_at
                              ? new Date(selectedNote.locked_at).toLocaleString()
                              : 'Yes'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-700 mb-2">Content</h4>
                      <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-96 overflow-y-auto bg-gray-50 p-3 rounded">
                        {selectedNote.note_content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Select a note to view details
                  </p>
                )}
              </EACardContent>
            </EACard>
          </div>
        </div>
      )}

      {/* Progress Notes Tab */}
      {activeTab === 'progress-notes' && (
        <EACard>
          <EACardHeader>
            <h3 className="text-lg font-semibold">AI Progress Note Syntheses</h3>
          </EACardHeader>
          <EACardContent>
            {progressNotes.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No AI progress notes found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {progressNotes.map((note) => (
                      <tr key={note.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(note.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <EABadge variant="neutral">{note.synthesis_type}</EABadge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {note.model_used || 'Claude'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {note.confidence_score !== null ? (
                            <span className={`font-medium ${
                              note.confidence_score >= 0.8 ? 'text-green-600' :
                              note.confidence_score >= 0.6 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {Math.round(note.confidence_score * 100)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {note.reviewed ? (
                            <EABadge variant="normal">Reviewed</EABadge>
                          ) : (
                            <EABadge variant="elevated">Pending</EABadge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {truncateContent(note.content, 80)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EACardContent>
        </EACard>
      )}
    </div>
  );
};

export default ClinicalNoteSummaryDashboard;
