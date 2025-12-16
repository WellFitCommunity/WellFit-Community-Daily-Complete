import { supabase } from '../lib/supabaseClient';

const GUARDIAN_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guardian-agent-api`;

interface GuardianResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function performSecurityScan(): Promise<GuardianResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    // EARLY RETURN: Skip API call if user is not authenticated
    if (!session?.access_token) {
      return {
        success: false,
        error: 'Not authenticated - skipping security scan'
      };
    }

    const response = await fetch(GUARDIAN_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'security_scan',
        payload: {}
      })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function logGuardianAuditEvent(event: {
  event_type: string;
  severity?: string;
  description: string;
  requires_investigation?: boolean;
}): Promise<GuardianResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    // EARLY RETURN: Skip API call if user is not authenticated
    // This prevents 401 errors and request spam when logged out
    if (!session?.access_token) {
      return {
        success: false,
        error: 'Not authenticated - skipping audit log'
      };
    }

    const response = await fetch(GUARDIAN_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'audit_log',
        payload: event
      })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function monitorSystemHealth(): Promise<GuardianResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    // EARLY RETURN: Skip API call if user is not authenticated
    if (!session?.access_token) {
      return {
        success: false,
        error: 'Not authenticated - skipping health monitor'
      };
    }

    const response = await fetch(GUARDIAN_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'monitor_health',
        payload: {}
      })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
