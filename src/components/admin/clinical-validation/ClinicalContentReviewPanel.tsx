/**
 * ClinicalContentReviewPanel — Admin panel for clinical content needing periodic review
 *
 * Lists clinical content with PDF export links, last review status, and next review dates.
 * Akima uses this to see what needs her review and download the relevant PDFs.
 *
 * Visual acceptance required: Maria must see this rendered before "done."
 */

import React, { useCallback, useState } from 'react';
import { EACard, EACardContent } from '../../envision-atlus/EACard';
import { EABadge } from '../../envision-atlus/EABadge';
import { useSupabaseClient } from '../../../contexts/AuthContext';
import { exportCulturalCompetencyPDF } from './culturalProfilePdfExport';
import { exportDRGReferencePDF } from './pdfExportService';
import type { CulturalProfileRow } from './culturalProfilePdfExport';
import type { DRGReferenceEntry } from './pdfExportService';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  category: 'clinical-reference' | 'ai-validation' | 'compliance';
  lastReviewed: string | null;
  reviewStatus: 'reviewed' | 'pending' | 'overdue';
  reviewCycle: string;
  exportAction: () => Promise<void>;
  exportLabel: string;
  exporting: boolean;
}

export const ClinicalContentReviewPanel: React.FC = () => {
  const supabase = useSupabaseClient();
  const [exportingProfiles, setExportingProfiles] = useState(false);
  const [exportingDRG, setExportingDRG] = useState(false);

  const handleExportProfiles = useCallback(async () => {
    setExportingProfiles(true);
    try {
      const { data, error } = await supabase
        .from('cultural_profiles')
        .select('id, population_key, display_name, description, caveat, profile_data, is_active')
        .eq('is_active', true)
        .order('display_name');

      if (error) {
        window.alert(`Failed to export cultural profiles: ${error.message}`);
        return;
      }

      const profiles = (data ?? []) as CulturalProfileRow[];
      if (profiles.length === 0) {
        window.alert('No cultural profiles found in database.');
        return;
      }

      exportCulturalCompetencyPDF(profiles);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Export failed: ${msg}`);
    } finally {
      setExportingProfiles(false);
    }
  }, [supabase]);

  const handleExportDRG = useCallback(async () => {
    setExportingDRG(true);
    try {
      const { data, error } = await supabase
        .from('ms_drg_reference')
        .select('drg_code, description, relative_weight, mdc, type')
        .order('drg_code');

      if (error) {
        window.alert(`Failed to export DRG table: ${error.message}`);
        return;
      }

      const entries = (data ?? []) as DRGReferenceEntry[];
      if (entries.length === 0) {
        window.alert('No DRG reference data found.');
        return;
      }

      exportDRGReferencePDF(entries);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Export failed: ${msg}`);
    } finally {
      setExportingDRG(false);
    }
  }, [supabase]);

  const contentItems: ContentItem[] = [
    {
      id: 'cultural-profiles',
      title: 'Cultural Competency Profiles',
      description: '8 population profiles with clinical considerations, drug interactions, communication guidance, and SDOH codes.',
      category: 'clinical-reference',
      lastReviewed: null,
      reviewStatus: 'pending',
      reviewCycle: 'Annual',
      exportAction: handleExportProfiles,
      exportLabel: exportingProfiles ? 'Exporting...' : 'Export PDF',
      exporting: exportingProfiles,
    },
    {
      id: 'drg-reference',
      title: 'MS-DRG Reference Table',
      description: 'All MS-DRG codes with descriptions, relative weights, MDC assignments. Source: CMS FY2026.',
      category: 'clinical-reference',
      lastReviewed: null,
      reviewStatus: 'pending',
      reviewCycle: 'Annual (each CMS fiscal year)',
      exportAction: handleExportDRG,
      exportLabel: exportingDRG ? 'Exporting...' : 'Export PDF',
      exporting: exportingDRG,
    },
    {
      id: 'validation-hooks',
      title: 'AI Code Validation Report',
      description: 'Rejection rates, top hallucinated codes, reference data health. Use the Export Report PDF button in the validation dashboard above.',
      category: 'ai-validation',
      lastReviewed: null,
      reviewStatus: 'pending',
      reviewCycle: 'Monthly',
      exportAction: async () => { /* handled by main dashboard */ },
      exportLabel: 'See Dashboard Above',
      exporting: false,
    },
  ];

  const statusVariant = (status: string): 'normal' | 'elevated' | 'high' => {
    if (status === 'reviewed') return 'normal';
    if (status === 'pending') return 'elevated';
    return 'high';
  };

  return (
    <EACard>
      <EACardContent>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Clinical Content Review</h3>
          <p className="text-sm text-slate-400 mt-1">
            Content requiring periodic clinical review. Download PDFs for offline review.
          </p>
        </div>

        <div className="space-y-3">
          {contentItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white text-sm">{item.title}</span>
                  <EABadge variant={statusVariant(item.reviewStatus)}>
                    {item.reviewStatus}
                  </EABadge>
                </div>
                <p className="text-xs text-slate-400 truncate">{item.description}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Review cycle: {item.reviewCycle}
                  {item.lastReviewed && ` • Last reviewed: ${new Date(item.lastReviewed).toLocaleDateString()}`}
                </p>
              </div>

              <button
                onClick={item.exportAction}
                disabled={item.exporting || item.id === 'validation-hooks'}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium min-h-[44px] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {item.exportLabel}
              </button>
            </div>
          ))}
        </div>
      </EACardContent>
    </EACard>
  );
};

export default ClinicalContentReviewPanel;
