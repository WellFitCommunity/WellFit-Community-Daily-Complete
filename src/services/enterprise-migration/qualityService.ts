/**
 * Enterprise Migration Engine — Quality Scoring Service
 *
 * Post-migration data quality reports with grading.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from '../auditLogger';
import type { QualityScore } from './types';

export class QualityScoringService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Calculate quality score for a migration batch */
  async calculateScore(batchId: string): Promise<QualityScore> {
    const { data, error } = await this.supabase.rpc('calculate_migration_quality', {
      p_batch_id: batchId
    });

    if (error) {
      auditLogger.error('Quality', 'Failed to calculate quality score', { error: error.message });
      return {
        overallScore: 0,
        completenessScore: 0,
        accuracyScore: 0,
        consistencyScore: 0,
        uniquenessScore: 0,
        grade: 'F',
        recommendations: ['Unable to calculate quality score'],
        readyForProduction: false
      };
    }

    const result = data as Record<string, unknown>;

    return {
      overallScore: result.overall_score as number,
      completenessScore: result.completeness as number,
      accuracyScore: result.accuracy as number,
      consistencyScore: result.consistency as number,
      uniquenessScore: result.uniqueness as number,
      grade: result.grade as string,
      recommendations: result.recommendations as string[],
      readyForProduction: result.ready_for_production as boolean
    };
  }

  /** Get historical quality scores */
  async getHistoricalScores(organizationId: string, limit: number = 10): Promise<QualityScore[]> {
    const { data } = await this.supabase
      .from('migration_quality_scores')
      .select('overall_score, completeness_score, accuracy_score, consistency_score, uniqueness_score, recommendations, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map(row => ({
      overallScore: row.overall_score,
      completenessScore: row.completeness_score,
      accuracyScore: row.accuracy_score,
      consistencyScore: row.consistency_score,
      uniquenessScore: row.uniqueness_score,
      grade: this.calculateGrade(row.overall_score),
      recommendations: row.recommendations || [],
      readyForProduction: row.overall_score >= 85 && row.accuracy_score >= 90
    }));
  }

  private calculateGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}
