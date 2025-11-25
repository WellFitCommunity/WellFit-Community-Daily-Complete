// ============================================================================
// Prompt A/B Testing Framework
// ============================================================================
// Enables systematic testing of prompt variations for SmartScribe to optimize
// billing accuracy, provider satisfaction, and documentation quality.
//
// Features:
// - Multiple experiment support
// - Statistical significance calculation
// - Provider-level assignment consistency
// - Automatic winner selection
// - Metrics tracking and analysis
// ============================================================================

import { createLogger } from './auditLogger.ts';

const logger = createLogger('prompt-ab-testing');

// ============================================================================
// TYPES
// ============================================================================

export interface PromptVariant {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  weight: number; // Assignment weight (0-1)
  isControl: boolean;
  createdAt: string;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: PromptVariant[];
  targetMetric: string; // e.g., 'code_acceptance_rate', 'provider_satisfaction'
  minSampleSize: number;
  confidenceLevel: number; // e.g., 0.95 for 95%
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  providerId: string;
  assignedAt: string;
}

export interface ExperimentMetric {
  experimentId: string;
  variantId: string;
  providerId: string;
  sessionId: string;
  metricName: string;
  metricValue: number;
  metadata?: Record<string, unknown>;
  recordedAt: string;
}

export interface VariantStats {
  variantId: string;
  variantName: string;
  sampleSize: number;
  mean: number;
  standardDeviation: number;
  confidenceInterval: { lower: number; upper: number };
  conversionRate?: number;
}

export interface ExperimentResults {
  experimentId: string;
  experimentName: string;
  status: string;
  targetMetric: string;
  variantStats: VariantStats[];
  winner?: {
    variantId: string;
    variantName: string;
    improvement: number; // percentage improvement over control
    isStatisticallySignificant: boolean;
    pValue: number;
  };
  totalSamples: number;
  analysisDate: string;
}

// ============================================================================
// IN-MEMORY STORAGE (would be database in production)
// ============================================================================

const experiments: Map<string, Experiment> = new Map();
const assignments: Map<string, ExperimentAssignment> = new Map();
const metrics: ExperimentMetric[] = [];

// ============================================================================
// EXPERIMENT MANAGEMENT
// ============================================================================

/**
 * Create a new A/B test experiment
 */
export function createExperiment(config: {
  name: string;
  description: string;
  variants: Omit<PromptVariant, 'id' | 'createdAt'>[];
  targetMetric: string;
  minSampleSize?: number;
  confidenceLevel?: number;
}): Experiment {
  const experimentId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Normalize weights
  const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0);
  const variants: PromptVariant[] = config.variants.map(v => ({
    ...v,
    id: crypto.randomUUID(),
    weight: v.weight / totalWeight,
    createdAt: now,
  }));

  // Ensure there's exactly one control
  const controlCount = variants.filter(v => v.isControl).length;
  if (controlCount !== 1) {
    throw new Error('Experiment must have exactly one control variant');
  }

  const experiment: Experiment = {
    id: experimentId,
    name: config.name,
    description: config.description,
    status: 'draft',
    variants,
    targetMetric: config.targetMetric,
    minSampleSize: config.minSampleSize || 100,
    confidenceLevel: config.confidenceLevel || 0.95,
    createdAt: now,
    updatedAt: now,
  };

  experiments.set(experimentId, experiment);

  logger.info('Experiment created', {
    experimentId,
    name: config.name,
    variantCount: variants.length,
    targetMetric: config.targetMetric,
  });

  return experiment;
}

/**
 * Start an experiment
 */
export function startExperiment(experimentId: string): Experiment {
  const experiment = experiments.get(experimentId);
  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }

  if (experiment.status !== 'draft' && experiment.status !== 'paused') {
    throw new Error(`Cannot start experiment in ${experiment.status} status`);
  }

  experiment.status = 'running';
  experiment.startedAt = experiment.startedAt || new Date().toISOString();
  experiment.updatedAt = new Date().toISOString();

  logger.info('Experiment started', { experimentId, name: experiment.name });

  return experiment;
}

/**
 * Pause an experiment
 */
export function pauseExperiment(experimentId: string): Experiment {
  const experiment = experiments.get(experimentId);
  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }

  experiment.status = 'paused';
  experiment.updatedAt = new Date().toISOString();

  logger.info('Experiment paused', { experimentId, name: experiment.name });

  return experiment;
}

/**
 * Complete an experiment
 */
export function completeExperiment(experimentId: string): Experiment {
  const experiment = experiments.get(experimentId);
  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }

  experiment.status = 'completed';
  experiment.endedAt = new Date().toISOString();
  experiment.updatedAt = new Date().toISOString();

  logger.info('Experiment completed', { experimentId, name: experiment.name });

  return experiment;
}

/**
 * Get all experiments
 */
export function getExperiments(status?: Experiment['status']): Experiment[] {
  const all = Array.from(experiments.values());
  if (status) {
    return all.filter(e => e.status === status);
  }
  return all;
}

/**
 * Get experiment by ID
 */
export function getExperiment(experimentId: string): Experiment | undefined {
  return experiments.get(experimentId);
}

// ============================================================================
// VARIANT ASSIGNMENT
// ============================================================================

/**
 * Get or create variant assignment for a provider
 * Uses consistent hashing for stable assignments
 */
export function getVariantAssignment(
  experimentId: string,
  providerId: string
): PromptVariant | null {
  const experiment = experiments.get(experimentId);
  if (!experiment || experiment.status !== 'running') {
    return null;
  }

  // Check for existing assignment
  const assignmentKey = `${experimentId}:${providerId}`;
  const existing = assignments.get(assignmentKey);
  if (existing) {
    const variant = experiment.variants.find(v => v.id === existing.variantId);
    return variant || null;
  }

  // Create new assignment using consistent hashing
  const variant = assignVariant(experiment, providerId);

  const assignment: ExperimentAssignment = {
    experimentId,
    variantId: variant.id,
    providerId,
    assignedAt: new Date().toISOString(),
  };
  assignments.set(assignmentKey, assignment);

  logger.info('Variant assigned', {
    experimentId,
    providerId,
    variantId: variant.id,
    variantName: variant.name,
  });

  return variant;
}

/**
 * Assign a variant based on weights using consistent hashing
 */
function assignVariant(experiment: Experiment, providerId: string): PromptVariant {
  // Create a consistent hash from provider ID and experiment ID
  const hashInput = `${experiment.id}:${providerId}`;
  const hash = simpleHash(hashInput);
  const normalizedHash = (hash % 10000) / 10000; // 0-1 range

  // Assign based on cumulative weights
  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (normalizedHash < cumulative) {
      return variant;
    }
  }

  // Fallback to last variant
  return experiment.variants[experiment.variants.length - 1];
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============================================================================
// METRICS TRACKING
// ============================================================================

/**
 * Record a metric for an experiment
 */
export function recordMetric(
  experimentId: string,
  variantId: string,
  providerId: string,
  sessionId: string,
  metricName: string,
  metricValue: number,
  metadata?: Record<string, unknown>
): void {
  const metric: ExperimentMetric = {
    experimentId,
    variantId,
    providerId,
    sessionId,
    metricName,
    metricValue,
    metadata,
    recordedAt: new Date().toISOString(),
  };

  metrics.push(metric);

  logger.info('Metric recorded', {
    experimentId,
    variantId,
    metricName,
    metricValue,
  });
}

/**
 * Record code acceptance (common metric for SmartScribe)
 */
export function recordCodeAcceptance(
  experimentId: string,
  variantId: string,
  providerId: string,
  sessionId: string,
  suggestedCount: number,
  acceptedCount: number
): void {
  const acceptanceRate = suggestedCount > 0 ? acceptedCount / suggestedCount : 0;

  recordMetric(
    experimentId,
    variantId,
    providerId,
    sessionId,
    'code_acceptance_rate',
    acceptanceRate,
    { suggestedCount, acceptedCount }
  );
}

/**
 * Record provider satisfaction score
 */
export function recordProviderSatisfaction(
  experimentId: string,
  variantId: string,
  providerId: string,
  sessionId: string,
  score: number // 1-5 scale
): void {
  recordMetric(
    experimentId,
    variantId,
    providerId,
    sessionId,
    'provider_satisfaction',
    score
  );
}

/**
 * Record documentation completeness
 */
export function recordDocumentationCompleteness(
  experimentId: string,
  variantId: string,
  providerId: string,
  sessionId: string,
  completenessScore: number // 0-1 scale
): void {
  recordMetric(
    experimentId,
    variantId,
    providerId,
    sessionId,
    'documentation_completeness',
    completenessScore
  );
}

// ============================================================================
// STATISTICAL ANALYSIS
// ============================================================================

/**
 * Get experiment results with statistical analysis
 */
export function getExperimentResults(experimentId: string): ExperimentResults | null {
  const experiment = experiments.get(experimentId);
  if (!experiment) {
    return null;
  }

  const experimentMetrics = metrics.filter(
    m => m.experimentId === experimentId && m.metricName === experiment.targetMetric
  );

  const variantStats: VariantStats[] = experiment.variants.map(variant => {
    const variantMetrics = experimentMetrics.filter(m => m.variantId === variant.id);
    const values = variantMetrics.map(m => m.metricValue);

    const stats = calculateStats(values);

    return {
      variantId: variant.id,
      variantName: variant.name,
      sampleSize: values.length,
      mean: stats.mean,
      standardDeviation: stats.stdDev,
      confidenceInterval: calculateConfidenceInterval(
        stats.mean,
        stats.stdDev,
        values.length,
        experiment.confidenceLevel
      ),
      conversionRate: experiment.targetMetric.includes('rate') ? stats.mean : undefined,
    };
  });

  // Determine winner
  const control = variantStats.find(
    v => experiment.variants.find(ev => ev.id === v.variantId)?.isControl
  );
  const treatments = variantStats.filter(
    v => !experiment.variants.find(ev => ev.id === v.variantId)?.isControl
  );

  let winner: ExperimentResults['winner'] | undefined;

  if (control && treatments.length > 0) {
    // Find best performing treatment
    const bestTreatment = treatments.reduce((best, current) =>
      current.mean > best.mean ? current : best
    );

    if (bestTreatment.mean > control.mean) {
      const improvement = ((bestTreatment.mean - control.mean) / control.mean) * 100;
      const { isSignificant, pValue } = calculateSignificance(
        control,
        bestTreatment
      );

      winner = {
        variantId: bestTreatment.variantId,
        variantName: bestTreatment.variantName,
        improvement,
        isStatisticallySignificant: isSignificant,
        pValue,
      };
    }
  }

  return {
    experimentId,
    experimentName: experiment.name,
    status: experiment.status,
    targetMetric: experiment.targetMetric,
    variantStats,
    winner,
    totalSamples: experimentMetrics.length,
    analysisDate: new Date().toISOString(),
  };
}

/**
 * Calculate basic statistics
 */
function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Calculate confidence interval
 */
function calculateConfidenceInterval(
  mean: number,
  stdDev: number,
  sampleSize: number,
  confidenceLevel: number
): { lower: number; upper: number } {
  if (sampleSize === 0) {
    return { lower: 0, upper: 0 };
  }

  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  const z = zScores[confidenceLevel] || 1.96;

  const marginOfError = z * (stdDev / Math.sqrt(sampleSize));

  return {
    lower: mean - marginOfError,
    upper: mean + marginOfError,
  };
}

/**
 * Calculate statistical significance using two-sample t-test
 */
function calculateSignificance(
  control: VariantStats,
  treatment: VariantStats
): { isSignificant: boolean; pValue: number } {
  if (control.sampleSize < 2 || treatment.sampleSize < 2) {
    return { isSignificant: false, pValue: 1 };
  }

  // Welch's t-test
  const t = (treatment.mean - control.mean) / Math.sqrt(
    (Math.pow(control.standardDeviation, 2) / control.sampleSize) +
    (Math.pow(treatment.standardDeviation, 2) / treatment.sampleSize)
  );

  // Degrees of freedom (Welch-Satterthwaite approximation)
  const v1 = Math.pow(control.standardDeviation, 2) / control.sampleSize;
  const v2 = Math.pow(treatment.standardDeviation, 2) / treatment.sampleSize;
  const df = Math.pow(v1 + v2, 2) / (
    (Math.pow(v1, 2) / (control.sampleSize - 1)) +
    (Math.pow(v2, 2) / (treatment.sampleSize - 1))
  );

  // Approximate p-value using normal distribution (good for large samples)
  const pValue = 2 * (1 - normalCDF(Math.abs(t)));

  return {
    isSignificant: pValue < 0.05,
    pValue,
  };
}

/**
 * Normal CDF approximation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// ============================================================================
// PRE-BUILT EXPERIMENTS FOR SMARTSCRIBE
// ============================================================================

/**
 * Create a billing code suggestion prompt experiment
 */
export function createBillingPromptExperiment(): Experiment {
  return createExperiment({
    name: 'Billing Code Prompt Optimization',
    description: 'Test different prompt strategies for billing code suggestions',
    targetMetric: 'code_acceptance_rate',
    minSampleSize: 200,
    confidenceLevel: 0.95,
    variants: [
      {
        name: 'Control - Standard Prompt',
        description: 'Current production prompt',
        promptTemplate: 'STANDARD_BILLING_PROMPT',
        weight: 0.5,
        isControl: true,
      },
      {
        name: 'Treatment A - Detailed Reasoning',
        description: 'Prompt with more detailed code reasoning',
        promptTemplate: 'DETAILED_REASONING_PROMPT',
        weight: 0.25,
        isControl: false,
      },
      {
        name: 'Treatment B - Confidence Focus',
        description: 'Prompt emphasizing confidence scores',
        promptTemplate: 'CONFIDENCE_FOCUS_PROMPT',
        weight: 0.25,
        isControl: false,
      },
    ],
  });
}

/**
 * Create a conversational tone experiment
 */
export function createToneExperiment(): Experiment {
  return createExperiment({
    name: 'Conversational Tone Optimization',
    description: 'Test different conversation styles for provider engagement',
    targetMetric: 'provider_satisfaction',
    minSampleSize: 150,
    confidenceLevel: 0.95,
    variants: [
      {
        name: 'Control - Professional',
        description: 'Current professional tone',
        promptTemplate: 'PROFESSIONAL_TONE',
        weight: 0.5,
        isControl: true,
      },
      {
        name: 'Treatment - Friendly Colleague',
        description: 'More casual, colleague-like tone',
        promptTemplate: 'FRIENDLY_COLLEAGUE_TONE',
        weight: 0.5,
        isControl: false,
      },
    ],
  });
}

/**
 * Create a SOAP note format experiment
 */
export function createSOAPFormatExperiment(): Experiment {
  return createExperiment({
    name: 'SOAP Note Format Optimization',
    description: 'Test different SOAP note formatting approaches',
    targetMetric: 'documentation_completeness',
    minSampleSize: 100,
    confidenceLevel: 0.95,
    variants: [
      {
        name: 'Control - Standard SOAP',
        description: 'Traditional SOAP format',
        promptTemplate: 'STANDARD_SOAP',
        weight: 0.33,
        isControl: true,
      },
      {
        name: 'Treatment A - Expanded HPI',
        description: 'SOAP with expanded HPI section',
        promptTemplate: 'EXPANDED_HPI_SOAP',
        weight: 0.33,
        isControl: false,
      },
      {
        name: 'Treatment B - Bulleted Plan',
        description: 'SOAP with bulleted action items in Plan',
        promptTemplate: 'BULLETED_PLAN_SOAP',
        weight: 0.34,
        isControl: false,
      },
    ],
  });
}

// ============================================================================
// HELPER FOR GETTING PROMPT BY VARIANT
// ============================================================================

/**
 * Get the actual prompt template for a variant
 */
export function getPromptForVariant(
  variantId: string,
  experimentId: string,
  basePrompt: string
): string {
  const experiment = experiments.get(experimentId);
  if (!experiment) {
    return basePrompt;
  }

  const variant = experiment.variants.find(v => v.id === variantId);
  if (!variant) {
    return basePrompt;
  }

  // In production, this would load actual prompt templates
  // For now, we modify the base prompt based on variant
  switch (variant.promptTemplate) {
    case 'DETAILED_REASONING_PROMPT':
      return basePrompt + '\n\nIMPORTANT: Provide detailed clinical reasoning for EVERY code suggestion. Explain exactly which transcript elements support each code.';

    case 'CONFIDENCE_FOCUS_PROMPT':
      return basePrompt + '\n\nIMPORTANT: Only suggest codes with >85% confidence. For each code, explicitly state the confidence percentage and what would increase confidence.';

    case 'FRIENDLY_COLLEAGUE_TONE':
      return basePrompt.replace(
        'You are an experienced, intelligent medical scribe',
        'You are a friendly, experienced colleague who happens to be great at medical documentation'
      );

    case 'EXPANDED_HPI_SOAP':
      return basePrompt + '\n\nFor the HPI section, ensure you include ALL of the following when available: onset, location, duration, character, alleviating factors, aggravating factors, radiation, timing, severity (OLDCARTS), and relevant social/family history.';

    case 'BULLETED_PLAN_SOAP':
      return basePrompt + '\n\nFor the Plan section, format as a numbered list with clear action items. Each item should start with an action verb (e.g., "1. Order...", "2. Prescribe...", "3. Schedule...").';

    default:
      return basePrompt;
  }
}
