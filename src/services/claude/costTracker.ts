/**
 * Per-user Claude API cost tracking + budget enforcement
 *
 * Extracted from claudeService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

import { ClaudeModel, CostInfo } from '../../types/claude';
import { auditLogger } from '../auditLogger';

export class CostTracker {
  private dailySpend: Map<string, number> = new Map();
  private monthlySpend: Map<string, number> = new Map();
  private readonly dailyLimit: number = 25; // $25 daily limit per user
  private readonly monthlyLimit: number = 350; // $350 monthly limit per user

  private readonly modelCosts = {
    [ClaudeModel.HAIKU_3_5]: { input: 0.0001, output: 0.0005 }, // Haiku 4.5 — fast tier
    [ClaudeModel.SONNET_3_5]: { input: 0.003, output: 0.015 }, // Sonnet 4.5 — accurate tier
    [ClaudeModel.OPUS_4_5]: { input: 0.015, output: 0.075 }, // Opus 4.5 — complex tier
  };

  calculateCost(model: ClaudeModel, inputTokens: number, outputTokens: number): number {
    const costs = this.modelCosts[model];
    return (inputTokens / 1000 * costs.input) + (outputTokens / 1000 * costs.output);
  }

  estimateCost(model: ClaudeModel, inputText: string, expectedOutputTokens: number = 1000): number {
    const inputTokens = Math.ceil(inputText.length / 4); // Rough estimation
    return this.calculateCost(model, inputTokens, expectedOutputTokens);
  }

  canAffordRequest(userId: string, estimatedCost: number): boolean {
    const dailySpend = this.dailySpend.get(userId) || 0;
    const monthlySpend = this.monthlySpend.get(userId) || 0;

    return (dailySpend + estimatedCost) <= this.dailyLimit &&
           (monthlySpend + estimatedCost) <= this.monthlyLimit;
  }

  recordSpending(userId: string, cost: number): void {
    const currentDaily = this.dailySpend.get(userId) || 0;
    const currentMonthly = this.monthlySpend.get(userId) || 0;

    this.dailySpend.set(userId, currentDaily + cost);
    this.monthlySpend.set(userId, currentMonthly + cost);

    // Log budget alerts
    this.checkBudgetAlerts(userId, currentMonthly + cost);
  }

  private checkBudgetAlerts(userId: string, currentSpend: number): void {
    const percentUsed = (currentSpend / this.monthlyLimit) * 100;

    if (percentUsed >= 80) {
      // Fire-and-forget budget warning (RF-3): previously this block was empty
      // with a comment claiming it logged — it did nothing. Now it actually emits.
      void auditLogger.warn('CLAUDE_BUDGET_ALERT', {
        userId,
        monthlySpend: Number(currentSpend.toFixed(2)),
        monthlyLimit: this.monthlyLimit,
        percentUsed: Number(percentUsed.toFixed(1)),
      });
    }
  }

  getCostInfo(userId: string): CostInfo {
    const dailySpend = this.dailySpend.get(userId) || 0;
    const monthlySpend = this.monthlySpend.get(userId) || 0;

    return {
      estimatedCost: 0,
      actualCost: 0,
      dailySpend,
      monthlySpend,
      remainingBudget: this.monthlyLimit - monthlySpend
    };
  }

  // Reset daily counters (call this daily via cron job)
  resetDailySpend(): void {
    this.dailySpend.clear();
  }

  // Get spending summary for reporting
  getSpendingSummary(): { totalDaily: number; totalMonthly: number; userCount: number } {
    const totalDaily = Array.from(this.dailySpend.values()).reduce((sum, spend) => sum + spend, 0);
    const totalMonthly = Array.from(this.monthlySpend.values()).reduce((sum, spend) => sum + spend, 0);

    return {
      totalDaily,
      totalMonthly,
      userCount: this.monthlySpend.size
    };
  }
}
