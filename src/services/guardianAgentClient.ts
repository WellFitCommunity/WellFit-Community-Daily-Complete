import { supabase } from '../lib/supabaseClient';

const GUARDIAN_FUNCTION_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/guardian-agent-api`;

interface GuardianResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function performSecurityScan(): Promise<GuardianResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(GUARDIAN_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
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

    const response = await fetch(GUARDIAN_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
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

    const response = await fetch(GUARDIAN_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
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
