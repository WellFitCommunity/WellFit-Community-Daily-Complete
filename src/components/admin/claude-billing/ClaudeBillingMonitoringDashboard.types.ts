/**
 * Types for Claude & Billing Monitoring Dashboard
 *
 * @module ClaudeBillingMonitoringDashboard.types
 */

export interface ClaudeUsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;

  // Cost tracking
  totalCost: number;
  costByModel: Record<string, number>;
  costTrend: Array<{ date: string; cost: number }>;

  // Token usage
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTokensPerRequest: number;

  // Performance
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;

  // Rate limiting
  rateLimitHits: number;
  budgetExceeded: number;

  // User distribution
  topUsers: Array<{ userId: string; requests: number; cost: number }>;
}

export interface BillingWorkflowMetrics {
  totalWorkflows: number;
  successRate: number;
  averageProcessingTime: number;
  manualReviewRate: number;

  // Financial
  totalCharges: number;
  estimatedReimbursement: number;
  reimbursementRate: number;

  // Errors
  topErrors: Array<{ code: string; count: number; message: string }>;

  // Workflow distribution
  workflowsByType: Record<string, number>;

  // AI integration
  aiSuggestionsUsed: number;
  aiAcceptanceRate: number;
  sdohEnhanced: number;
}

export interface CostOptimizationInsight {
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  potentialSavings?: number;
  actionItems: string[];
}

export interface ServiceStatus {
  isHealthy: boolean;
  circuitBreakerState: string;
  lastHealthCheck: Date;
}

export interface SpendingSummary {
  totalDaily: number;
  totalMonthly: number;
  userCount: number;
}

export type DateRange = '7d' | '30d' | '90d';

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: { value: number; direction: 'up' | 'down' };
}
