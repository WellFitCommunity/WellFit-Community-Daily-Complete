/**
 * Enterprise Migration Engine — Deduplication Service
 *
 * Fuzzy deduplication using Soundex, Levenshtein distance,
 * and composite similarity scoring.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CryptoUtils } from './cryptoUtils';
import type { DedupCandidate } from './types';

export class DeduplicationService {
  private supabase: SupabaseClient;
  private threshold: number;

  constructor(supabase: SupabaseClient, threshold: number = 0.8) {
    this.supabase = supabase;
    this.threshold = threshold;
  }

  /** Find potential duplicates in data */
  async findDuplicates(
    batchId: string,
    data: Record<string, unknown>[]
  ): Promise<DedupCandidate[]> {
    const candidates: DedupCandidate[] = [];

    // Compare each pair
    for (let i = 0; i < data.length - 1; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const recordA = data[i];
        const recordB = data[j];

        const similarity = this.calculateSimilarity(recordA, recordB);

        if (similarity.overall >= this.threshold) {
          const candidate: DedupCandidate = {
            candidateId: crypto.randomUUID(),
            recordAId: String(recordA['id'] || i),
            recordAData: recordA,
            recordBId: String(recordB['id'] || j),
            recordBData: recordB,
            overallSimilarity: similarity.overall,
            nameSimilarity: similarity.name,
            dobMatch: similarity.dobMatch,
            phoneSimilarity: similarity.phone,
            emailSimilarity: similarity.email,
            matchMethod: 'composite',
            resolution: 'pending',
            requiresHumanReview: similarity.overall < 0.95
          };

          candidates.push(candidate);

          // Store in database
          await this.supabase.from('migration_dedup_candidates').insert({
            candidate_id: candidate.candidateId,
            migration_batch_id: batchId,
            record_a_source: 'source',
            record_a_id: candidate.recordAId,
            record_a_data: candidate.recordAData,
            record_b_source: 'source',
            record_b_id: candidate.recordBId,
            record_b_data: candidate.recordBData,
            overall_similarity: candidate.overallSimilarity,
            name_similarity: candidate.nameSimilarity,
            dob_match: candidate.dobMatch,
            phone_similarity: candidate.phoneSimilarity,
            email_similarity: candidate.emailSimilarity,
            match_method: candidate.matchMethod,
            requires_human_review: candidate.requiresHumanReview
          });
        }
      }
    }

    return candidates;
  }

  /** Calculate similarity between two records */
  private calculateSimilarity(
    recordA: Record<string, unknown>,
    recordB: Record<string, unknown>
  ): {
    overall: number;
    name?: number;
    dobMatch?: boolean;
    phone?: number;
    email?: number;
  } {
    let totalWeight = 0;
    let weightedScore = 0;

    // Name similarity (weight: 0.4)
    const nameA = `${recordA['first_name'] || ''} ${recordA['last_name'] || ''}`.trim();
    const nameB = `${recordB['first_name'] || ''} ${recordB['last_name'] || ''}`.trim();
    const nameSim = nameA && nameB ? CryptoUtils.nameSimilarity(nameA, nameB) : 0;
    if (nameA && nameB) {
      weightedScore += nameSim * 0.4;
      totalWeight += 0.4;
    }

    // DOB match (weight: 0.25)
    const dobA = recordA['date_of_birth'] || recordA['dob'];
    const dobB = recordB['date_of_birth'] || recordB['dob'];
    const dobMatch = Boolean(dobA && dobB && String(dobA) === String(dobB));
    if (dobA && dobB) {
      weightedScore += (dobMatch ? 1 : 0) * 0.25;
      totalWeight += 0.25;
    }

    // Phone similarity (weight: 0.2)
    const phoneA = String(recordA['phone'] || recordA['phone_mobile'] || '').replace(/\D/g, '');
    const phoneB = String(recordB['phone'] || recordB['phone_mobile'] || '').replace(/\D/g, '');
    const phoneSim = phoneA && phoneB && phoneA === phoneB ? 1 : 0;
    if (phoneA && phoneB) {
      weightedScore += phoneSim * 0.2;
      totalWeight += 0.2;
    }

    // Email similarity (weight: 0.15)
    const emailA = String(recordA['email'] || '').toLowerCase();
    const emailB = String(recordB['email'] || '').toLowerCase();
    const emailSim = emailA && emailB && emailA === emailB ? 1 : 0;
    if (emailA && emailB) {
      weightedScore += emailSim * 0.15;
      totalWeight += 0.15;
    }

    const overall = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return {
      overall,
      name: nameSim,
      dobMatch,
      phone: phoneSim,
      email: emailSim
    };
  }

  /** Resolve a duplicate */
  async resolveDuplicate(
    candidateId: string,
    resolution: DedupCandidate['resolution'],
    resolvedBy: string,
    notes?: string
  ): Promise<void> {
    await this.supabase
      .from('migration_dedup_candidates')
      .update({
        resolution,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes
      })
      .eq('candidate_id', candidateId);
  }

  /** Get pending duplicates for review */
  async getPendingDuplicates(batchId: string): Promise<DedupCandidate[]> {
    const { data, error } = await this.supabase
      .from('migration_dedup_candidates')
      .select('candidate_id, record_a_id, record_a_data, record_b_id, record_b_data, overall_similarity, name_similarity, dob_match, phone_similarity, email_similarity, match_method, resolution, requires_human_review')
      .eq('migration_batch_id', batchId)
      .eq('resolution', 'pending')
      .order('overall_similarity', { ascending: false });

    if (error) return [];

    return (data || []).map(row => ({
      candidateId: row.candidate_id,
      recordAId: row.record_a_id,
      recordAData: row.record_a_data,
      recordBId: row.record_b_id,
      recordBData: row.record_b_data,
      overallSimilarity: row.overall_similarity,
      nameSimilarity: row.name_similarity,
      dobMatch: row.dob_match,
      phoneSimilarity: row.phone_similarity,
      emailSimilarity: row.email_similarity,
      matchMethod: row.match_method,
      resolution: row.resolution,
      requiresHumanReview: row.requires_human_review
    }));
  }
}
