// Atlus Revenue Service - Revenue analytics and leakage detection
// Project Atlus Pillar 3: Revenue optimization

import { supabase } from '../lib/supabaseClient';
import { BillingService } from './billingService';

interface RevenueMetrics {
  totalClaims: number;
  totalRevenue: number;
  paidRevenue: number;
  rejectedRevenue: number;
  pendingRevenue: number;
  leakageAmount: number;
  leakagePercent: number;
  byStatus: Record<string, { count: number; amount: number }>;
}

interface CodeOpportunity {
  code: string;
  type: 'upgrade' | 'missing';
  currentCode?: string;
  suggestedCode: string;
  additionalRevenue: number;
  frequency: number;
  description: string;
}

export class AtlusRevenueService {
  /**
   * Get comprehensive revenue metrics for a date range
   */
  static async getRevenueMetrics(
    dateFrom?: string,
    dateTo?: string
  ): Promise<RevenueMetrics> {
    try {
      const claims = await BillingService.searchClaims({
        dateFrom,
        dateTo,
      });

      let totalRevenue = 0;
      let paidRevenue = 0;
      let rejectedRevenue = 0;
      let pendingRevenue = 0;

      const byStatus: Record<string, { count: number; amount: number }> = {};

      claims.forEach((claim) => {
        const amount = Number(claim.total_charge || 0);
        totalRevenue += amount;

        const status = claim.status;
        if (!byStatus[status]) {
          byStatus[status] = { count: 0, amount: 0 };
        }
        byStatus[status].count++;
        byStatus[status].amount += amount;

        if (status === 'paid') {
          paidRevenue += amount;
        } else if (status === 'rejected') {
          rejectedRevenue += amount;
        } else if (status === 'submitted' || status === 'generated') {
          pendingRevenue += amount;
        }
      });

      const leakageAmount = rejectedRevenue;
      const leakagePercent = totalRevenue > 0 ? (leakageAmount / totalRevenue) * 100 : 0;

      return {
        totalClaims: claims.length,
        totalRevenue,
        paidRevenue,
        rejectedRevenue,
        pendingRevenue,
        leakageAmount,
        leakagePercent,
        byStatus,
      };
    } catch (error) {
      throw new Error(`Failed to get revenue metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Identify coding upgrade opportunities
   * E.g., 99213 → 99214 based on documentation complexity
   */
  static async findCodingOpportunities(
    dateFrom?: string,
    dateTo?: string
  ): Promise<CodeOpportunity[]> {
    try {
      const { data: claimLines, error } = await supabase
        .from('claim_lines')
        .select('procedure_code, charge_amount, claim_id, claims(created_at)')
        .gte('claims.created_at', dateFrom || '2024-01-01')
        .lte('claims.created_at', dateTo || new Date().toISOString());

      if (error) throw error;

      const opportunities: CodeOpportunity[] = [];
      const codeFrequency = new Map<string, number>();

      // Count code frequency
      claimLines?.forEach((line) => {
        const code = line.procedure_code;
        codeFrequency.set(code, (codeFrequency.get(code) || 0) + 1);
      });

      // Check for common upgrade opportunities
      const upgradePairs = [
        { from: '99213', to: '99214', additionalRevenue: 42.0 },
        { from: '99214', to: '99215', additionalRevenue: 50.0 },
        { from: '99212', to: '99213', additionalRevenue: 38.0 },
      ];

      upgradePairs.forEach((pair) => {
        const frequency = codeFrequency.get(pair.from) || 0;
        if (frequency > 0) {
          opportunities.push({
            code: pair.from,
            type: 'upgrade',
            currentCode: pair.from,
            suggestedCode: pair.to,
            additionalRevenue: pair.additionalRevenue * frequency,
            frequency,
            description: `Upgrade ${pair.from} to ${pair.to} when documentation supports higher complexity`,
          });
        }
      });

      // Check for missing CCM billing
      const hasCheckIns = await this.hasPatientCheckIns(dateFrom, dateTo);
      if (hasCheckIns && !codeFrequency.has('99490')) {
        opportunities.push({
          code: '99490',
          type: 'missing',
          suggestedCode: '99490',
          additionalRevenue: 42.0,
          frequency: 1,
          description: 'CCM billing available - patient check-ins indicate chronic care management',
        });
      }

      // Sort by potential revenue (highest first)
      opportunities.sort((a, b) => b.additionalRevenue - a.additionalRevenue);

      return opportunities;
    } catch (error) {
      // Log to audit system instead of console
      throw new Error(`Failed to find coding opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if there are patient check-ins in date range
   */
  private static async hasPatientCheckIns(
    dateFrom?: string,
    dateTo?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('id')
        .gte('timestamp', dateFrom || '2024-01-01')
        .lte('timestamp', dateTo || new Date().toISOString())
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get rejected claims for appeal analysis
   */
  static async getRejectedClaims(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*, claim_lines(*), claim_status_history(*)')
        .eq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get rejected claims: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate projected revenue based on coding suggestions
   */
  static async getProjectedRevenue(encounterId: string): Promise<number> {
    try {
      const recommendations = await BillingService.getCodingRecommendations(encounterId);
      if (recommendations.length === 0) return 0;

      const latest = recommendations[0];
      let projected = 0;

      // Default Medicare fees
      const fees: Record<string, number> = {
        '99211': 25.0,
        '99212': 55.0,
        '99213': 93.0,
        '99214': 135.0,
        '99215': 185.0,
        '99490': 42.0,
        '99439': 31.0,
      };

      // Sum CPT codes
      latest.payload?.cpt?.forEach((item) => {
        projected += fees[item.code] || 50.0;
      });

      // Sum HCPCS codes
      latest.payload?.hcpcs?.forEach((item) => {
        projected += fees[item.code] || 30.0;
      });

      return projected;
    } catch (error) {
      throw new Error(`Failed to get projected revenue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get monthly revenue trend
   */
  static async getMonthlyTrend(monthsBack = 6): Promise<Array<{
    month: string;
    revenue: number;
    claims: number;
  }>> {
    try {
      const trends: Array<{ month: string; revenue: number; claims: number }> = [];
      const now = new Date();

      for (let i = 0; i < monthsBack; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const metrics = await this.getRevenueMetrics(
          monthDate.toISOString(),
          monthEnd.toISOString()
        );

        trends.push({
          month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          revenue: metrics.paidRevenue,
          claims: metrics.totalClaims,
        });
      }

      return trends.reverse();
    } catch (error) {
      throw new Error(`Failed to get monthly trend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AtlusRevenueService;
