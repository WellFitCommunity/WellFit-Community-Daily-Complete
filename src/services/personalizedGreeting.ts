/**
 * Personalized Greeting Service
 *
 * Generates context-aware greetings for users based on:
 * - Role (physician, nurse, admin, super_admin)
 * - Time of day
 * - User's name and title
 * - Recent activity patterns
 *
 * Used across all role-specific panels to create inviting, intelligent UX
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  email: string;
  tenantId?: string;
  tenantName?: string;
}

export interface GreetingContext {
  greeting: string; // "Good morning"
  message: string; // "Dr. Johnson! Ready to see your patients?"
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  userName: string; // "Dr. Johnson"
  fullGreeting: string; // Complete greeting with context
}

/**
 * Get time-based greeting
 */
export function getTimeBasedGreeting(): { greeting: string; timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' } {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return { greeting: 'Good morning', timeOfDay: 'morning' };
  } else if (hour >= 12 && hour < 17) {
    return { greeting: 'Good afternoon', timeOfDay: 'afternoon' };
  } else if (hour >= 17 && hour < 21) {
    return { greeting: 'Good evening', timeOfDay: 'evening' };
  } else {
    return { greeting: 'Good evening', timeOfDay: 'night' };
  }
}

/**
 * Format user name with appropriate title based on role
 */
export function formatUserName(profile: UserProfile): string {
  const { firstName, lastName, role } = profile;
  const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'User';

  // Add professional titles
  const roleLower = (role || '').toLowerCase();

  if (roleLower.includes('physician') || roleLower.includes('doctor')) {
    return `Dr. ${lastName || name}`;
  } else if (roleLower.includes('nurse_practitioner') || roleLower === 'np') {
    return `${firstName || name}, NP`;
  } else if (roleLower.includes('nurse')) {
    return `Nurse ${lastName || name}`;
  } else if (roleLower.includes('case_manager')) {
    return `${firstName || name}`;
  } else if (roleLower.includes('social_worker')) {
    return `${firstName || name}`;
  } else if (roleLower.includes('admin') || roleLower.includes('super_admin')) {
    return firstName || name;
  }

  return firstName || name;
}

/**
 * Generate role-specific contextual message
 */
export function getRoleSpecificMessage(role: string, timeOfDay: string): string {
  const roleLower = (role || '').toLowerCase();

  if (roleLower.includes('physician') || roleLower.includes('doctor')) {
    if (timeOfDay === 'morning') {
      return "Ready to see your patients?";
    } else if (timeOfDay === 'afternoon') {
      return "Hope you're having a productive day!";
    } else {
      return "Wrapping up for the day?";
    }
  } else if (roleLower.includes('nurse')) {
    if (timeOfDay === 'morning') {
      return "Let's check on your patients!";
    } else if (timeOfDay === 'afternoon') {
      return "Time for afternoon vitals checks?";
    } else {
      return "Almost done with your shift!";
    }
  } else if (roleLower.includes('case_manager')) {
    if (timeOfDay === 'morning') {
      return "Ready to help your clients today?";
    } else {
      return "How are your cases going?";
    }
  } else if (roleLower.includes('social_worker')) {
    if (timeOfDay === 'morning') {
      return "Let's make a difference today!";
    } else {
      return "Great work supporting our community!";
    }
  } else if (roleLower.includes('super_admin')) {
    if (timeOfDay === 'morning') {
      return "Welcome to the Master Control Panel";
    } else {
      return "Monitoring platform health";
    }
  } else if (roleLower.includes('admin')) {
    if (timeOfDay === 'morning') {
      return "Let's see what needs attention today!";
    } else {
      return "Here's your system overview";
    }
  }

  return "Welcome back!";
}

/**
 * Fetch user profile from database
 */
export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, full_name, role, email, tenant_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return null;
    }

    // Fetch tenant name if tenant_id exists
    let tenantName: string | undefined;
    if (profile.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', profile.tenant_id)
        .single();

      tenantName = tenant?.name;
    }

    return {
      userId,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      fullName: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      role: profile.role || 'user',
      email: profile.email || '',
      tenantId: profile.tenant_id,
      tenantName
    };
  } catch (error) {
    return null;
  }
}

/**
 * Generate personalized greeting context
 */
export async function generateGreeting(
  supabase: SupabaseClient,
  userId: string
): Promise<GreetingContext | null> {
  const profile = await fetchUserProfile(supabase, userId);

  if (!profile) {
    return null;
  }

  const { greeting, timeOfDay } = getTimeBasedGreeting();
  const userName = formatUserName(profile);
  const message = getRoleSpecificMessage(profile.role, timeOfDay);

  const fullGreeting = `${greeting}, ${userName}! ${message}`;

  return {
    greeting,
    message,
    timeOfDay,
    userName,
    fullGreeting
  };
}

/**
 * Get quick stats for role-specific dashboard
 * Returns aggregated, non-PHI metrics
 */
export async function getRoleSpecificStats(
  supabase: SupabaseClient,
  userId: string,
  role: string,
  tenantId?: string
): Promise<Record<string, any>> {
  const roleLower = (role || '').toLowerCase();
  const stats: Record<string, any> = {};

  try {
    // Physician stats
    if (roleLower.includes('physician') || roleLower.includes('doctor')) {
      // Patient count (assigned to this physician)
      const { count: patientCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'senior');

      // Pending alerts count
      const { count: alertCount } = await supabase
        .from('guardian_agent_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      stats.patientCount = patientCount || 0;
      stats.pendingAlerts = alertCount || 0;
    }

    // Nurse stats
    if (roleLower.includes('nurse')) {
      // Active patients
      const { count: activePatients } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'senior');

      // Vitals due today (approximate - based on last check-in)
      const today = new Date().toISOString().split('T')[0];
      const { count: vitalsDue } = await supabase
        .from('health_data')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', `${today}T00:00:00Z`);

      stats.activePatients = activePatients || 0;
      stats.vitalsDueToday = vitalsDue || 0;
    }

    // Admin stats
    if (roleLower.includes('admin')) {
      // Total users in tenant
      const { count: userCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      // Pending approvals (photo consent, etc.)
      const { count: pendingApprovals } = await supabase
        .from('consent_photos')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('approved', false);

      stats.totalUsers = userCount || 0;
      stats.pendingApprovals = pendingApprovals || 0;
    }

    // Super Admin stats (NO PHI - aggregated only)
    if (roleLower.includes('super_admin')) {
      // Total tenants
      const { count: tenantCount } = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: true });

      // Platform-wide health score (derived from Guardian alerts)
      const { count: criticalAlerts } = await supabase
        .from('guardian_agent_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .eq('status', 'pending');

      stats.totalTenants = tenantCount || 0;
      stats.criticalAlerts = criticalAlerts || 0;
      stats.platformHealth = (criticalAlerts || 0) === 0 ? 100 : Math.max(0, 100 - ((criticalAlerts || 0) * 5));
    }
  } catch (error) {
    // Fail gracefully - return empty stats
  }

  return stats;
}
