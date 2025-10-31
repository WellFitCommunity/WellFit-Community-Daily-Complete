/**
 * Learning System - Adaptive machine learning for pattern recognition
 */

import {
  DetectedIssue,
  HealingAction,
  HealingResult,
  // KnowledgeEntry,
  ErrorContext
} from './types';

interface Pattern {
  features: string[];
  frequency: number;
  context: string[];
  outcomes: { success: boolean; strategy: string }[];
}

export class LearningSystem {
  private patterns: Map<string, Pattern> = new Map();
  private successRates: Map<string, number[]> = new Map();
  private featureExtractor: FeatureExtractor;

  constructor() {
    this.featureExtractor = new FeatureExtractor();
  }

  /**
   * Learns from successful and failed healing attempts
   */
  async learn(issue: DetectedIssue, action: HealingAction, result: HealingResult): Promise<void> {
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

    // Analyze patterns for insights
    if (pattern.frequency >= 5) {
      await this.analyzePattern(pattern);
    }
  }

  /**
   * Learns a new error pattern that hasn't been seen before
   */
  async learnNewPattern(errorInfo: any, context: ErrorContext): Promise<void> {
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
    const similarPatterns = this.findSimilarPatterns(features);
    if (similarPatterns.length > 0) {
    }
  }

  /**
   * Analyzes a pattern for insights and optimizations
   */
  private async analyzePattern(pattern: Pattern): Promise<void> {
    // Calculate overall success rate
    const successCount = pattern.outcomes.filter(o => o.success).length;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const successRate = successCount / pattern.outcomes.length;

    // Find best performing strategy
    const strategyPerformance = new Map<string, { success: number; total: number }>();

    for (const outcome of pattern.outcomes) {
      const stats = strategyPerformance.get(outcome.strategy) || { success: 0, total: 0 };
      stats.total++;
      if (outcome.success) stats.success++;
      strategyPerformance.set(outcome.strategy, stats);
    }

    // Identify optimal strategies
    const optimalStrategies = Array.from(strategyPerformance.entries())
      .filter(([_, stats]) => stats.total >= 3) // Need at least 3 attempts
      .sort((a, b) => (b[1].success / b[1].total) - (a[1].success / a[1].total))
      .slice(0, 3);

    if (optimalStrategies.length > 0) {
    }

    // Detect anti-patterns (consistently failing strategies)
    const failingStrategies = Array.from(strategyPerformance.entries())
      .filter(([_, stats]) => stats.total >= 3 && (stats.success / stats.total) < 0.3);

    if (failingStrategies.length > 0) {
    }
  }

  /**
   * Finds similar patterns based on feature similarity
   */
  private findSimilarPatterns(features: string[]): Pattern[] {
    const similar: Pattern[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      strategyStats
    };
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
  extractFromError(errorInfo: any, context: ErrorContext): string[] {
    const features: string[] = [];

    // Error type
    features.push(`error:${errorInfo.name}`);

    // Message keywords
    const keywords = this.extractKeywords(errorInfo.message);
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
