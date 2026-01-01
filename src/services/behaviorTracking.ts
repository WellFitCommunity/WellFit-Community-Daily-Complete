/**
 * Behavior Tracking Service for Smart Admin Panel Learning
 *
 * Tracks user interaction patterns to enable intelligent dashboard personalization:
 * - Section access frequency
 * - Time-of-day usage patterns
 * - Commonly used features
 * - Navigation flows
 *
 * Powers the Intelligent Admin Panel's adaptive layout and predictive suggestions
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface BehaviorEvent {
  userId: string;
  tenantId: string;
  eventType: 'section_opened' | 'section_closed' | 'action_executed' | 'navigation' | 'feature_used';
  sectionId?: string;
  actionId?: string;
  featureId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
}

export interface SectionStats {
  sectionId: string;
  accessCount: number;
  totalTimeSpent: number; // milliseconds
  lastAccessed: Date;
  avgTimeSpent: number;
  frequencyScore: number; // 0-100
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface UserBehaviorProfile {
  userId: string;
  sectionStats: SectionStats[];
  mostUsedSections: string[]; // Top 5
  preferredWorkingHours: { start: number; end: number }; // 0-23
  totalSessions: number;
  avgSessionDuration: number;
  lastUpdated: Date;
}

/**
 * Get time of day category
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Track a user behavior event
 */
export async function trackBehaviorEvent(
  supabase: SupabaseClient,
  event: Omit<BehaviorEvent, 'timestamp' | 'timeOfDay' | 'dayOfWeek'>
): Promise<void> {
  try {
    const now = new Date();
    const fullEvent: BehaviorEvent = {
      ...event,
      timestamp: now,
      timeOfDay: getTimeOfDay(),
      dayOfWeek: now.getDay()
    };

    // Store in localStorage for client-side tracking (faster, no DB calls)
    const storageKey = `behavior_${event.userId}`;
    const existingData = localStorage.getItem(storageKey);
    const events: BehaviorEvent[] = existingData ? JSON.parse(existingData) : [];

    // Keep only last 1000 events to avoid storage bloat
    events.push(fullEvent);
    if (events.length > 1000) {
      events.shift();
    }

    localStorage.setItem(storageKey, JSON.stringify(events));

    // Optionally sync to database periodically (every 10th event)
    if (events.length % 10 === 0) {
      await syncBehaviorToDatabase(supabase, event.userId, events);
    }
  } catch {
    // Fail silently - behavior tracking should never break functionality
  }
}

/**
 * Sync behavior events to database for persistence
 */
async function syncBehaviorToDatabase(
  supabase: SupabaseClient,
  userId: string,
  events: BehaviorEvent[]
): Promise<void> {
  try {
    // Calculate aggregated stats from events
    const stats = calculateBehaviorStats(events);

    // Upsert user behavior profile
    await supabase
      .from('user_behavior_profiles')
      .upsert({
        user_id: userId,
        section_stats: stats.sectionStats,
        most_used_sections: stats.mostUsedSections,
        preferred_working_hours: stats.preferredWorkingHours,
        total_sessions: stats.totalSessions,
        avg_session_duration: stats.avgSessionDuration,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
  } catch {
    // Database sync failed - data still persists in localStorage
  }
}

/**
 * Calculate behavior statistics from event history
 */
function calculateBehaviorStats(events: BehaviorEvent[]): Omit<UserBehaviorProfile, 'userId' | 'lastUpdated'> {
  const sectionAccessMap = new Map<string, {
    count: number;
    totalTime: number;
    lastAccessed: Date;
    timeOfDayMap: Map<string, number>;
  }>();

  // Process events
  events.forEach(event => {
    if (event.eventType === 'section_opened' && event.sectionId) {
      const existing = sectionAccessMap.get(event.sectionId) || {
        count: 0,
        totalTime: 0,
        lastAccessed: event.timestamp,
        timeOfDayMap: new Map()
      };

      existing.count++;
      existing.lastAccessed = event.timestamp;

      // Track time of day preference
      const todCount = existing.timeOfDayMap.get(event.timeOfDay) || 0;
      existing.timeOfDayMap.set(event.timeOfDay, todCount + 1);

      sectionAccessMap.set(event.sectionId, existing);
    }
  });

  // Calculate section stats
  const sectionStats: SectionStats[] = [];
  sectionAccessMap.forEach((stats, sectionId) => {
    // Find preferred time of day
    let maxCount = 0;
    let preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
    stats.timeOfDayMap.forEach((count, tod) => {
      if (count > maxCount) {
        maxCount = count;
        preferredTimeOfDay = tod as typeof preferredTimeOfDay;
      }
    });

    // Calculate frequency score (0-100)
    const maxAccessCount = Math.max(...Array.from(sectionAccessMap.values()).map(s => s.count));
    const frequencyScore = maxAccessCount > 0 ? Math.round((stats.count / maxAccessCount) * 100) : 0;

    sectionStats.push({
      sectionId,
      accessCount: stats.count,
      totalTimeSpent: stats.totalTime,
      lastAccessed: stats.lastAccessed,
      avgTimeSpent: stats.totalTime / stats.count,
      frequencyScore,
      preferredTimeOfDay
    });
  });

  // Sort by frequency
  sectionStats.sort((a, b) => b.frequencyScore - a.frequencyScore);

  // Get top 5 most used sections
  const mostUsedSections = sectionStats.slice(0, 5).map(s => s.sectionId);

  // Calculate preferred working hours
  const hourMap = new Map<number, number>();
  events.forEach(event => {
    const hour = event.timestamp.getHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  });

  let maxHourCount = 0;
  let preferredStartHour = 9;
  hourMap.forEach((count, hour) => {
    if (count > maxHourCount) {
      maxHourCount = count;
      preferredStartHour = hour;
    }
  });

  return {
    sectionStats,
    mostUsedSections,
    preferredWorkingHours: {
      start: preferredStartHour,
      end: (preferredStartHour + 8) % 24 // Assume 8-hour work session
    },
    totalSessions: Math.ceil(events.length / 20), // Rough estimate
    avgSessionDuration: 30 * 60 * 1000 // 30 minutes default
  };
}

/**
 * Get user behavior profile
 */
export async function getUserBehaviorProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserBehaviorProfile | null> {
  try {
    // Try localStorage first (faster)
    const storageKey = `behavior_${userId}`;
    const existingData = localStorage.getItem(storageKey);

    if (existingData) {
      const events: BehaviorEvent[] = JSON.parse(existingData);
      const stats = calculateBehaviorStats(events);

      return {
        userId,
        ...stats,
        lastUpdated: new Date()
      };
    }

    // Fallback to database
    // Use maybeSingle() to avoid 406 when no profile exists yet
    const { data, error } = await supabase
      .from('user_behavior_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      userId: data.user_id,
      sectionStats: data.section_stats || [],
      mostUsedSections: data.most_used_sections || [],
      preferredWorkingHours: data.preferred_working_hours || { start: 9, end: 17 },
      totalSessions: data.total_sessions || 0,
      avgSessionDuration: data.avg_session_duration || 0,
      lastUpdated: new Date(data.updated_at)
    };
  } catch {
    return null;
  }
}

/**
 * Get smart suggestions based on behavior patterns
 */
export function getSmartSuggestions(profile: UserBehaviorProfile | null): string[] {
  if (!profile) {
    return [];
  }

  const suggestions: string[] = [];
  const now = new Date();
  const currentHour = now.getHours();
  const currentTimeOfDay = getTimeOfDay();

  // Suggest based on time-of-day patterns
  if (profile.sectionStats.length > 0) {
    const sectionsForThisTime = profile.sectionStats
      .filter(s => s.preferredTimeOfDay === currentTimeOfDay)
      .slice(0, 2);

    if (sectionsForThisTime.length > 0) {
      suggestions.push(
        `You usually work on ${sectionsForThisTime[0].sectionId.replace(/-/g, ' ')} at this time`
      );
    }
  }

  // Suggest most used features
  if (profile.mostUsedSections.length > 0) {
    const topSection = profile.mostUsedSections[0];
    suggestions.push(
      `${topSection.replace(/-/g, ' ')} is your most frequently used section`
    );
  }

  // Suggest based on work hours
  if (
    currentHour < profile.preferredWorkingHours.start &&
    profile.preferredWorkingHours.start - currentHour <= 1
  ) {
    suggestions.push("You usually start working in about an hour");
  }

  return suggestions;
}

/**
 * Get recommended section order based on behavior
 */
export function getRecommendedSectionOrder(
  profile: UserBehaviorProfile | null,
  allSectionIds: string[]
): string[] {
  if (!profile || profile.sectionStats.length === 0) {
    return allSectionIds; // Return default order
  }

  // Create a map of section IDs to their frequency scores
  const scoreMap = new Map<string, number>();
  profile.sectionStats.forEach(stat => {
    scoreMap.set(stat.sectionId, stat.frequencyScore);
  });

  // Sort sections by frequency score (highest first)
  const sorted = [...allSectionIds].sort((a, b) => {
    const scoreA = scoreMap.get(a) || 0;
    const scoreB = scoreMap.get(b) || 0;
    return scoreB - scoreA;
  });

  return sorted;
}

/**
 * Check if section should be auto-expanded
 */
export function shouldAutoExpand(
  profile: UserBehaviorProfile | null,
  sectionId: string
): boolean {
  if (!profile) {
    return false;
  }

  const currentTimeOfDay = getTimeOfDay();

  const sectionStat = profile.sectionStats.find(s => s.sectionId === sectionId);

  if (!sectionStat) {
    return false;
  }

  // Auto-expand if:
  // 1. It's in top 3 most used sections
  // 2. Preferred time of day matches current time
  // 3. Frequency score > 70

  const isTop3 = profile.mostUsedSections.slice(0, 3).includes(sectionId);
  const isPreferredTime = sectionStat.preferredTimeOfDay === currentTimeOfDay;
  const isHighFrequency = sectionStat.frequencyScore > 70;

  return isTop3 && isPreferredTime && isHighFrequency;
}
