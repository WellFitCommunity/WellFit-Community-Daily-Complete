/**
 * DrugInteractionsTab — Drug interaction alerts + override button
 * Extracted from MedicationManager for decomposition
 * Wires into MedicationAlertOverrideModal for structured override logging
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Zap, CheckCircle, BookOpen, Loader2, ExternalLink } from 'lucide-react';
import type { DrugInteraction } from './MedicationManager.types';
import { getSeverityColor } from './MedicationManagerHelpers';
import { MedicationAlertOverrideModal } from '../MedicationAlertOverrideModal';
import type { AlertSeverity } from '../../../services/medicationOverrideService';
import { usePubMedEvidence } from '../../../hooks/usePubMedEvidence';
import type { PubMedArticle } from '../../../services/mcp/mcpPubMedClient';

interface DrugInteractionsTabProps {
  interactions: DrugInteraction[];
  tenantId?: string;
}

/** Map DrugInteraction severity to override service AlertSeverity */
const mapSeverity = (severity: DrugInteraction['severity']): AlertSeverity => {
  switch (severity) {
    case 'CONTRAINDICATED': return 'contraindicated';
    case 'MAJOR': return 'high';
    case 'MODERATE': return 'moderate';
    default: return 'low';
  }
};

export const DrugInteractionsTab: React.FC<DrugInteractionsTabProps> = ({
  interactions,
  tenantId,
}) => {
  const [overrideTarget, setOverrideTarget] = useState<DrugInteraction | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<string | null>(null);
  const [evidenceArticles, setEvidenceArticles] = useState<Record<string, PubMedArticle[]>>({});
  const pubmed = usePubMedEvidence();

  const handleViewEvidence = async (interaction: DrugInteraction) => {
    const key = `${interaction.drug1}-${interaction.drug2}`;
    if (evidenceTarget === key) {
      setEvidenceTarget(null);
      return;
    }
    setEvidenceTarget(key);

    if (!evidenceArticles[key]) {
      const result = await pubmed.searchDrugInteractionEvidence(
        interaction.drug1,
        interaction.drug2,
        5
      );
      if (result) {
        setEvidenceArticles(prev => ({ ...prev, [key]: result.articles }));
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Drug Interaction Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {interactions.length > 0 ? (
            <div className="space-y-3">
              {interactions.map(interaction => (
                <div
                  key={interaction.id}
                  className={`p-4 border rounded-lg ${getSeverityColor(interaction.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {interaction.drug1} + {interaction.drug2}
                      </div>
                      <div className="text-sm mt-1">{interaction.description}</div>
                      <div className="text-sm mt-2 font-medium">
                        Recommendation: {interaction.recommendation}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="destructive">{interaction.severity}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOverrideTarget(interaction)}
                        className="text-xs"
                      >
                        Override Alert
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs">Patient: {interaction.patientName}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewEvidence(interaction)}
                      className="text-xs text-blue-600"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      {evidenceTarget === `${interaction.drug1}-${interaction.drug2}` ? 'Hide Evidence' : 'View Evidence'}
                    </Button>
                  </div>

                  {/* PubMed Evidence Panel */}
                  {evidenceTarget === `${interaction.drug1}-${interaction.drug2}` && (
                    <EvidenceCitationPanel
                      articles={evidenceArticles[`${interaction.drug1}-${interaction.drug2}`]}
                      loading={pubmed.status === 'searching'}
                      error={pubmed.error}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <div className="text-lg font-medium text-gray-900">No Drug Interactions Detected</div>
              <div className="text-gray-600">
                All patient medication profiles have been analyzed
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Modal */}
      {overrideTarget && (
        <MedicationAlertOverrideModal
          onClose={() => setOverrideTarget(null)}
          onOverrideComplete={() => setOverrideTarget(null)}
          alertType="drug_interaction"
          alertSeverity={mapSeverity(overrideTarget.severity)}
          alertDescription={overrideTarget.description}
          alertRecommendations={[overrideTarget.recommendation]}
          medicationName={`${overrideTarget.drug1} + ${overrideTarget.drug2}`}
          patientId={overrideTarget.patientId}
          tenantId={tenantId}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────
// PubMed Evidence Sub-Component
// ─────────────────────────────────────────────────────

function EvidenceCitationPanel({ articles, loading, error }: {
  articles?: PubMedArticle[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="mt-3 p-3 bg-blue-50 rounded-md flex items-center gap-2 text-sm text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        Searching PubMed for supporting evidence...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 p-3 bg-red-50 rounded-md text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-md text-sm text-gray-600">
        No PubMed articles found for this interaction.
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-blue-50 rounded-md space-y-2">
      <div className="text-xs font-medium text-blue-800 uppercase tracking-wider">
        PubMed Evidence ({articles.length} articles)
      </div>
      {articles.map(article => (
        <div key={article.pmid} className="text-sm border-b border-blue-100 pb-2 last:border-b-0">
          <div className="font-medium text-gray-900 leading-tight">{article.title}</div>
          <div className="text-xs text-gray-600 mt-0.5">
            {article.authors?.slice(0, 3).join(', ')}
            {(article.authors?.length ?? 0) > 3 ? ' et al.' : ''}
            {' — '}
            {article.journal}, {article.publication_date}
          </div>
          {article.doi && (
            <div className="text-xs mt-0.5">
              <a
                href={`https://doi.org/${article.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
              >
                DOI: {article.doi} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default DrugInteractionsTab;
