/**
 * QuestionnaireStatsPanel - Response statistics for a deployed FHIR questionnaire
 *
 * Purpose: Surfaces the get_questionnaire_stats RPC (EMR/Atlus FHIR questionnaire
 *          system) in the FHIR Form Builder library view.
 * Used by: FHIRFormBuilderEnhanced
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import type { FHIRQuestionnaireService } from '../../services/fhirQuestionnaireService';

type UnknownRecord = Record<string, unknown>;

interface QuestionnaireStats {
  total_responses: number;
  completed_responses: number;
  completion_rate: number | null;
  average_score: number | null;
  high_risk_count: number;
}

interface QuestionnaireStatsPanelProps {
  questionnaireId: number;
  questionnaireTitle: string;
  fhirService: Pick<FHIRQuestionnaireService, 'getQuestionnaireStats'>;
  onClose: () => void;
}

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function parseStats(raw: UnknownRecord): QuestionnaireStats {
  return {
    total_responses: asNumber(raw.total_responses) ?? 0,
    completed_responses: asNumber(raw.completed_responses) ?? 0,
    completion_rate: asNumber(raw.completion_rate),
    average_score: asNumber(raw.average_score),
    high_risk_count: asNumber(raw.high_risk_count) ?? 0,
  };
}

const StatTile: React.FC<{ label: string; value: string; emphasize?: boolean }> = ({
  label,
  value,
  emphasize,
}) => (
  <div className="border rounded-lg p-4 text-center">
    <div
      className={`text-2xl font-semibold ${emphasize ? 'text-red-700' : 'text-gray-900'}`}
    >
      {value}
    </div>
    <div className="text-sm text-gray-600 mt-1">{label}</div>
  </div>
);

export const QuestionnaireStatsPanel: React.FC<QuestionnaireStatsPanelProps> = ({
  questionnaireId,
  questionnaireTitle,
  fhirService,
  onClose,
}) => {
  const [stats, setStats] = useState<QuestionnaireStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const raw = await fhirService.getQuestionnaireStats(questionnaireId);
      setStats(parseStats(raw));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load questionnaire statistics');
    } finally {
      setIsLoading(false);
    }
  }, [fhirService, questionnaireId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <Card className="mt-3 border-blue-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            📊 Response Statistics — {questionnaireTitle}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Close statistics panel"
          >
            ✕
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-gray-600 py-4" role="status">
            Loading statistics…
          </p>
        )}

        {!isLoading && error && (
          <Alert>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={loadStats}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatTile label="Total responses" value={String(stats.total_responses)} />
              <StatTile label="Completed" value={String(stats.completed_responses)} />
              <StatTile
                label="Completion rate"
                value={stats.completion_rate === null ? '—' : `${stats.completion_rate}%`}
              />
              <StatTile
                label="Average score"
                value={stats.average_score === null ? '—' : String(stats.average_score)}
              />
              <StatTile
                label="High-risk responses"
                value={String(stats.high_risk_count)}
                emphasize={stats.high_risk_count > 0}
              />
            </div>
            {stats.total_responses === 0 && (
              <p className="text-sm text-gray-500 mt-3">
                No responses collected yet for this questionnaire.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default QuestionnaireStatsPanel;
