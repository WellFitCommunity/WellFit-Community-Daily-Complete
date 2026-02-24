/**
 * Learning System - Adaptive machine learning for pattern recognition
 * Persists learned patterns to database (tenant-scoped) so learning
 * survives page refreshes and can be shared within a tenant.
 */

import {
  DetectedIssue,
  HealingAction,
  HealingResult,
  ErrorContext
} from './types';
import { supabase } from '../../lib/supabaseClient';

interface Pattern {
  features: string[];
  frequency: number;
  context: string[];
  outcomes: { success: boolean; strategy: string }[];
}

/** Shape of a row in guardian_learning_patterns */
interface PatternRow {
  pattern_key: string;
  features: string[];
  frequency: number;
  contexts: string[];
  outcomes: { success: boolean; strategy: string }[];
}

/** Shape of a row in guardian_strategy_success_rates */
interface StrategyRow {
  strategy: string;
  recent_results: number[];
}

export class LearningSystem {
  private patterns: Map<string, Pattern> = new Map();
  private successRates: Map<string, number[]> = new Map();
  private featureExtractor: FeatureExtractor;
  private tenantId: string | undefined;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private loaded = false;

  constructor(tenantId?: string) {
    this.featureExtractor = new FeatureExtractor();
    this.tenantId = tenantId;
  }

  /**
   * Set the tenant scope for this learning system
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
    this.loaded = false; // Force reload with new tenant
  }

  /**
   * Load persisted patterns from database for the current tenant
   */
  async loadFromDatabase(): Promise<void> {
    if (!this.tenantId || this.loaded) return;

    try {
      // Load patterns
      const { data: patternRows } = await supabase
        .from('guardian_learning_patterns')
        .select('pattern_key, features, frequency, contexts, outcomes')
        .eq('tenant_id', this.tenantId);

      if (patternRows) {
        for (const row of patternRows as PatternRow[]) {
          this.patterns.set(row.pattern_key, {
            features: row.features,
            frequency: row.frequency,
            context: row.contexts,
            outcomes: row.outcomes,
          });
        }
      }

      // Load success rates
      const { data: strategyRows } = await supabase
        .from('guardian_strategy_success_rates')
        .select('strategy, recent_results')
        .eq('tenant_id', this.tenantId);

      if (strategyRows) {
        for (const row of strategyRows as StrategyRow[]) {
          this.successRates.set(row.strategy, row.recent_results);
        }
      }

      this.loaded = true;
    } catch {
      // Silently fail — in-memory fallback is fine
    }
  }

  /**
   * Persist current patterns to database (debounced — called after mutations)
   */
  private schedulePersist(): void {
    if (!this.tenantId) return;
    this.dirty = true;

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    // Debounce: persist 5 seconds after last mutation
    this.persistTimer = setTimeout(() => {
      void this.persistToDatabase();
    }, 5000);
  }

  /**
   * Write all patterns and success rates to database
   */
  async persistToDatabase(): Promise<void> {
    if (!this.tenantId || !this.dirty) return;

    try {
      // Upsert patterns
      const patternRows = Array.from(this.patterns.entries()).map(
        ([key, pattern]) => ({
          tenant_id: this.tenantId,
          pattern_key: key,
          features: pattern.features,
          frequency: pattern.frequency,
          contexts: pattern.context,
          outcomes: pattern.outcomes,
        })
      );

      if (patternRows.length > 0) {
        await supabase
          .from('guardian_learning_patterns')
          .upsert(patternRows, { onConflict: 'tenant_id,pattern_key' });
      }

      // Upsert success rates
      const strategyRows = Array.from(this.successRates.entries()).map(
        ([strategy, results]) => ({
          tenant_id: this.tenantId,
          strategy,
          recent_results: results,
        })
      );

      if (strategyRows.length > 0) {
        await supabase
          .from('guardian_strategy_success_rates')
          .upsert(strategyRows, { onConflict: 'tenant_id,strategy' });
      }

      this.dirty = false;
    } catch {
      // Silently fail — data remains in memory
    }
  }

  /**
   * Learns from successful and failed healing attempts
   */
  async learn(issue: DetectedIssue, action: HealingAction, result: HealingResult): Promise<void> {
    await this.loadFromDatabase();

    const features = this.featureExtractor.extract(issue);
    const patternKey = this.generatePatternKey(features);

    // Update pattern database
    const pattern = this.patterns.get(patternKey) || {
      features,
      frequency: 0,
      context: [],
      outcomes: []
    };

    pattern.frequency++;
    pattern.outcomes.push({
      success: result.success,
      strategy: action.strategy
    });

    // Add context information
    if (issue.context.component) {
      pattern.context.push(issue.context.component);
    }

    this.patterns.set(patternKey, pattern);

    // Update success rate tracking
    const successHistory = this.successRates.get(action.strategy) || [];
    successHistory.push(result.success ? 1 : 0);
    if (successHistory.length > 100) {
      successHistory.shift(); // Keep last 100
    }
    this.successRates.set(action.strategy, successHistory);

    // Schedule persistence
    this.schedulePersist();

    // Analyze patterns for insights
    if (pattern.frequency >= 5) {
      await this.analyzePattern(pattern);
    }
  }

  /**
   * Learns a new error pattern that hasn't been seen before
   */
  async learnNewPattern(errorInfo: Record<string, unknown>, context: ErrorContext): Promise<void> {
    await this.loadFromDatabase();

    const features = this.featureExtractor.extractFromError(errorInfo, context);
    const patternKey = this.generatePatternKey(features);

    // Create new pattern entry
    this.patterns.set(patternKey, {
      features,
      frequency: 1,
      context: context.component ? [context.component] : [],
      outcomes: []
    });

    // Suggest potential healing strategies based on similar patterns
    this.findSimilarPatterns(features);

    // Schedule persistence
    this.schedulePersist();
  }

  /**
   * Analyzes a pattern for insights and optimizations
   */
  private async analyzePattern(pattern: Pattern): Promise<void> {
    // Find best performing strategy
    const strategyPerformance = new Map<string, { success: number; total: number }>();

    for (const outcome of pattern.outcomes) {
      const stats = strategyPerformance.get(outcome.strategy) || { success: 0, total: 0 };
      stats.total++;
      if (outcome.success) stats.success++;
      strategyPerformance.set(outcome.strategy, stats);
    }

    // Identify optimal strategies (unused assignment removed — analysis is side-effect free for now)
    Array.from(strategyPerformance.entries())
      .filter(([_, stats]) => stats.total >= 3)
      .sort((a, b) => (b[1].success / b[1].total) - (a[1].success / a[1].total))
      .slice(0, 3);

    // Detect anti-patterns (consistently failing strategies)
    Array.from(strategyPerformance.entries())
      .filter(([_, stats]) => stats.total >= 3 && (stats.success / stats.total) < 0.3);
  }

  /**
   * Finds similar patterns based on feature similarity
   */
  private findSimilarPatterns(features: string[]): Pattern[] {
    const similar: Pattern[] = [];

    for (const [_key, pattern] of this.patterns) {
      const similarity = this.calculateSimilarity(features, pattern.features);
      if (similarity > 0.7) {
        similar.push(pattern);
      }
    }

    return similar;
  }

  /**
   * Calculates similarity between two feature sets (Jaccard similarity)
   */
  private calculateSimilarity(features1: string[], features2: string[]): number {
    const set1 = new Set(features1);
    const set2 = new Set(features2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Generates a unique key for pattern identification
   */
  private generatePatternKey(features: string[]): string {
    return features.sort().join('|');
  }

  /**
   * Gets strategy recommendations based on learned patterns
   */
  getStrategyRecommendations(issue: DetectedIssue): Array<{ strategy: string; confidence: number }> {
    const features = this.featureExtractor.extract(issue);
    const patternKey = this.generatePatternKey(features);

    const pattern = this.patterns.get(patternKey);
    if (!pattern || pattern.outcomes.length === 0) {
      return [];
    }

    // Calculate confidence for each strategy
    const recommendations = new Map<string, { success: number; total: number }>();

    for (const outcome of pattern.outcomes) {
      const stats = recommendations.get(outcome.strategy) || { success: 0, total: 0 };
      stats.total++;
      if (outcome.success) stats.success++;
      recommendations.set(outcome.strategy, stats);
    }

    return Array.from(recommendations.entries())
      .map(([strategy, stats]) => ({
        strategy,
        confidence: stats.success / stats.total
      }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Gets overall system learning statistics
   */
  getStatistics() {
    const totalPatterns = this.patterns.size;
    const totalObservations = Array.from(this.patterns.values()).reduce(
      (sum, p) => sum + p.frequency,
      0
    );

    const strategyStats = Array.from(this.successRates.entries()).map(([strategy, rates]) => ({
      strategy,
      successRate: rates.reduce((sum, r) => sum + r, 0) / rates.length,
      observations: rates.length
    }));

    return {
      totalPatterns,
      totalObservations,
      strategyStats,
      persisted: this.loaded,
    };
  }

  /**
   * Flush pending persistence and clean up timer
   */
  async dispose(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persistToDatabase();
  }
}

/**
 * Feature extractor for machine learning
 */
class FeatureExtractor {
  /**
   * Extracts features from a detected issue
   */
  extract(issue: DetectedIssue): string[] {
    const features: string[] = [];

    // Error category
    features.push(`category:${issue.signature.category}`);

    // Severity
    features.push(`severity:${issue.severity}`);

    // Context features
    if (issue.context.component) {
      features.push(`component:${issue.context.component}`);
    }

    if (issue.context.apiEndpoint) {
      features.push(`api:${issue.context.apiEndpoint}`);
    }

    // Time-based features
    const hour = issue.timestamp.getHours();
    features.push(`hour:${hour}`);

    // Stack trace patterns
    if (issue.stackTrace) {
      if (issue.stackTrace.includes('async')) {
        features.push('async:true');
      }
      if (issue.stackTrace.includes('Promise')) {
        features.push('promise:true');
      }
      if (issue.stackTrace.includes('useEffect')) {
        features.push('react-hook:useEffect');
      }
    }

    return features;
  }

  /**
   * Extracts features from raw error information
   */
  extractFromError(errorInfo: Record<string, unknown>, context: ErrorContext): string[] {
    const features: string[] = [];

    // Error type
    features.push(`error:${String(errorInfo.name ?? 'unknown')}`);

    // Message keywords
    const keywords = this.extractKeywords(String(errorInfo.message ?? ''));
    keywords.forEach(kw => features.push(`keyword:${kw}`));

    // Context
    if (context.component) {
      features.push(`component:${context.component}`);
    }

    if (context.apiEndpoint) {
      features.push(`api:${context.apiEndpoint}`);
    }

    return features;
  }

  /**
   * Extracts keywords from error message
   */
  private extractKeywords(message: string): string[] {
    const stopWords = new Set(['a', 'an', 'the', 'is', 'at', 'of', 'to', 'in', 'for']);

    return message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5); // Top 5 keywords
  }
}
