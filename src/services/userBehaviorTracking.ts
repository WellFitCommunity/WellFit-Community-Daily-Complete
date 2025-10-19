/**
 * User Behavior Tracking Service
 *
 * Tracks what admin panel sections users interact with most
 * to enable intelligent dashboard personalization
 */

import { supabase } from '../lib/supabaseClient';

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
  private static STORAGE_KEY_PREFIX = 'admin_behavior_';

  /**
   * Track user interaction with dashboard section
   */
  static async trackInteraction(interaction: UserInteraction): Promise<void> {
    try {
      // Store in Supabase for long-term analytics
      await supabase.from('admin_usage_tracking').insert({
        user_id: interaction.userId,
        section_id: interaction.sectionId,
        section_name: interaction.sectionName,
        action: interaction.action,
        time_spent: interaction.timeSpent,
        role: interaction.role,
        created_at: interaction.timestamp.toISOString()
      });

      // Also update localStorage for instant client-side personalization
      this.updateLocalUsageData(interaction);
    } catch (error) {
      console.error('Failed to track interaction:', error);
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

      const { data, error } = await supabase
        .from('admin_usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      // Aggregate usage data by section
      const sectionStats = new Map<string, {
        name: string;
        opens: number;
        totalTime: number;
        lastAccess: Date;
      }>();

      data?.forEach(record => {
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
      console.error('Failed to get user patterns:', error);
      return this.getLocalUsageData(userId);
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
   * Update local storage for instant personalization (fallback)
   */
  private static updateLocalUsageData(interaction: UserInteraction): void {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${interaction.userId}`;
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : { sections: {} };

      if (!data.sections[interaction.sectionId]) {
        data.sections[interaction.sectionId] = {
          name: interaction.sectionName,
          count: 0,
          lastAccess: null
        };
      }

      data.sections[interaction.sectionId].count++;
      data.sections[interaction.sectionId].lastAccess = interaction.timestamp.toISOString();

      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to update local usage data:', error);
    }
  }

  /**
   * Get local usage data (fallback when DB is unavailable)
   */
  private static getLocalUsageData(userId: string): UsagePattern[] {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      const data = localStorage.getItem(key);

      if (!data) return [];

      const parsed = JSON.parse(data);
      const patterns: UsagePattern[] = [];

      Object.entries(parsed.sections || {}).forEach(([sectionId, stats]: [string, any]) => {
        patterns.push({
          sectionId,
          sectionName: stats.name,
          openCount: stats.count,
          totalTimeSpent: 0,
          lastAccessed: new Date(stats.lastAccess),
          frequencyScore: stats.count
        });
      });

      return patterns.sort((a, b) => b.openCount - a.openCount);
    } catch (error) {
      console.error('Failed to get local usage data:', error);
      return [];
    }
  }

  /**
   * Clear user tracking data (for privacy/reset)
   */
  static async clearUserData(userId: string): Promise<void> {
    try {
      // Clear from database
      await supabase
        .from('admin_usage_tracking')
        .delete()
        .eq('user_id', userId);

      // Clear from localStorage
      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  }
}
