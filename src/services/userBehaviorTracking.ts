/**
 * User Behavior Tracking Service
 *
 * Tracks what admin panel sections users interact with most
 * to enable intelligent dashboard personalization
 */

import { supabase } from '../lib/supabaseClient';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';

export interface UserInteraction {
  userId: string;
  sectionId: string;
  sectionName: string;
  action: 'open' | 'close' | 'click' | 'view';
  timestamp: Date;
  timeSpent?: number; // seconds
  role?: string;
}

export interface UsagePattern {
  sectionId: string;
  sectionName: string;
  openCount: number;
  totalTimeSpent: number;
  lastAccessed: Date;
  frequencyScore: number; // 0-100
}

export interface UserPreferences {
  userId: string;
  role: string;
  topSections: UsagePattern[];
  preferredStartSection?: string;
  timePatterns?: {
    morningPreference?: string;
    afternoonPreference?: string;
    eveningPreference?: string;
  };
  lastUpdated: Date;
}

export class UserBehaviorTracker {
  /**
   * Track user interaction with dashboard section
   * HIPAA COMPLIANCE: Only stores in database (no localStorage)
   */
  static async trackInteraction(interaction: UserInteraction): Promise<void> {
    try {
      // Store in Supabase with RLS policies enforced
      await supabase.from('admin_usage_tracking').insert({
        user_id: interaction.userId,
        section_id: interaction.sectionId,
        section_name: interaction.sectionName, // Must be generic, no PHI
        action: interaction.action,
        time_spent: interaction.timeSpent,
        role: interaction.role,
        created_at: interaction.timestamp.toISOString()
      });
    } catch (error) {

      // Fail silently - tracking should never break the app
    }
  }

  /**
   * Get user's usage patterns from last 30 days
   */
  static async getUserPatterns(userId: string): Promise<UsagePattern[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const query = supabase
        .from('admin_usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Apply pagination limit to prevent unbounded queries
      // Limit to 200 most recent tracking events for performance
      const data = await applyLimit<any>(query, PAGINATION_LIMITS.TRACKING_EVENTS);

      // Aggregate usage data by section
      const sectionStats = new Map<string, {
        name: string;
        opens: number;
        totalTime: number;
        lastAccess: Date;
      }>();

      data.forEach(record => {
        const existing = sectionStats.get(record.section_id) || {
          name: record.section_name,
          opens: 0,
          totalTime: 0,
          lastAccess: new Date(record.created_at)
        };

        if (record.action === 'open') existing.opens++;
        if (record.time_spent) existing.totalTime += record.time_spent;

        const recordDate = new Date(record.created_at);
        if (recordDate > existing.lastAccess) {
          existing.lastAccess = recordDate;
        }

        sectionStats.set(record.section_id, existing);
      });

      // Convert to UsagePattern array with frequency scores
      const patterns: UsagePattern[] = [];
      const maxOpens = Math.max(...Array.from(sectionStats.values()).map(s => s.opens));

      sectionStats.forEach((stats, sectionId) => {
        patterns.push({
          sectionId,
          sectionName: stats.name,
          openCount: stats.opens,
          totalTimeSpent: stats.totalTime,
          lastAccessed: stats.lastAccess,
          frequencyScore: maxOpens > 0 ? (stats.opens / maxOpens) * 100 : 0
        });
      });

      // Sort by frequency score
      return patterns.sort((a, b) => b.frequencyScore - a.frequencyScore);
    } catch (error) {

      return []; // Return empty array on error (no localStorage fallback)
    }
  }

  /**
   * Get user preferences including top sections and time patterns
   */
  static async getUserPreferences(userId: string, role: string): Promise<UserPreferences> {
    const patterns = await this.getUserPatterns(userId);
    const topSections = patterns.slice(0, 5); // Top 5 most used

    return {
      userId,
      role,
      topSections,
      preferredStartSection: topSections[0]?.sectionId,
      lastUpdated: new Date()
    };
  }

  /**
   * Clear user tracking data (for privacy/reset)
   * HIPAA COMPLIANCE: Only database storage, no localStorage
   */
  static async clearUserData(userId: string): Promise<void> {
    try {
      // Clear from database only (RLS enforced)
      await supabase
        .from('admin_usage_tracking')
        .delete()
        .eq('user_id', userId);
    } catch (error) {

    }
  }
}
