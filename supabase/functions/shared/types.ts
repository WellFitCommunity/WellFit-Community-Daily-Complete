// supabase/functions/shared/types.ts

// -------- Database Types (minimal but practical) --------
export interface DatabaseTypes {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          last_checkin_at?: string | null;
          is_admin: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          last_checkin_at?: string | null;
          is_admin?: boolean;
        };
        Update: Partial<DatabaseTypes['public']['Tables']['users']['Insert']>;
      };
      device_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'android' | 'ios' | 'web';
          created_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: 'android' | 'ios' | 'web';
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
        Update: Partial<DatabaseTypes['public']['Tables']['device_tokens']['Insert']>;
      };
      inactivity_reminder_log: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string; // YYYY-MM-DD
          sent_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          week_start_date: string;
          sent_at?: string;
        };
        Update: Partial<DatabaseTypes['public']['Tables']['inactivity_reminder_log']['Insert']>;
      };
      check_ins: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          mood_score?: number | null;
          notes?: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          mood_score?: number | null;
          notes?: string | null;
        };
        Update: Partial<DatabaseTypes['public']['Tables']['check_ins']['Insert']>;
      };
      community_moments: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<DatabaseTypes['public']['Tables']['community_moments']['Insert']>;
      };
      admin_actions: {
        Row: {
          id: string;
          admin_user_id: string;
          action_type: string;
          target_user_id?: string | null;
          details: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          action_type: string;
          target_user_id?: string | null;
          details?: any;
          created_at?: string;
        };
        Update: Partial<DatabaseTypes['public']['Tables']['admin_actions']['Insert']>;
      };
      interaction_log: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          details: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          details?: any;
          created_at?: string;
        };
        Update: Partial<DatabaseTypes['public']['Tables']['interaction_log']['Insert']>;
      };
    };
  };
}

// -------- Structured Logger --------
export interface Logger {
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

export const createLogger = (functionName: string): Logger => ({
  info: (message: string, data?: any) =>
    console.log(JSON.stringify({
      level: 'info',
      function: functionName,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data })
    })),
  warn: (message: string, data?: any) =>
    console.warn(JSON.stringify({
      level: 'warn',
      function: functionName,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data })
    })),
  error: (message: string, data?: any) =>
    console.error(JSON.stringify({
      level: 'error',
      function: functionName,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data })
    })),
});

// -------- Time Helpers --------
export const getChicagoTime = (): Date => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
};

/** Sunday-start week by default; pass startOnMonday=true if you want Monday week starts */
export const getWeekStart = (date: Date, startOnMonday = false): string => {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 = Sun..Sat
  const offset = startOnMonday ? (day === 0 ? -6 : 1 - day) : -day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

/** Returns true if current Chicago time is at target hour and within 0..minutesMax minutes */
export const isWithinWindowChicago = (hourTarget: number, minutesMax: number): boolean => {
  const ct = getChicagoTime();
  const h = ct.getHours();
  const m = ct.getMinutes();
  return h === hourTarget && m <= minutesMax;
};

// -------- Env Validation --------
export const validateEnvVars = (required: string[]): void => {
  const missing = required.filter((key) => !Deno.env.get(key));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
