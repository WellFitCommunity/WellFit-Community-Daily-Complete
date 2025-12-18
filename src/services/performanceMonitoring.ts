// Custom Performance Monitoring Service - FREE alternative to DataDog/Sentry
// Tracks errors, performance metrics, and user behavior

import { SupabaseClient } from '@supabase/supabase-js';

interface ErrorLogData {
  error_message: string;
  error_stack?: string;
  error_type?: string;
  component_name?: string;
  page_url?: string;
  severity?: 'critical' | 'error' | 'warning' | 'info';
}

interface PerformanceMetricData {
  metric_type: 'page_load' | 'api_call' | 'component_render' | 'user_action';
  metric_name: string;
  duration_ms: number;
  page_url?: string;
  metadata?: Record<string, any>;
}

interface FeatureUsageData {
  feature_name: string;
  action: string;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private supabase: SupabaseClient | null = null;
  private userId: string | null = null;
  private sessionId: string | null = null;
  private pageLoadStart: number = 0;
  private componentTimings: Map<string, number> = new Map();

  initialize(supabase: SupabaseClient, userId?: string) {
    this.supabase = supabase;
    this.userId = userId || null;
    this.setupGlobalErrorHandler();
    this.setupPerformanceObserver();
    this.startSession();
  }

  // ========================================================================
  // ERROR TRACKING
  // ========================================================================

  private setupGlobalErrorHandler() {
    if (typeof window === 'undefined') return;

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        error_message: event.message,
        error_stack: event.error?.stack,
        error_type: 'unhandled_error',
        page_url: window.location.href,
        severity: 'error'
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        error_message: event.reason?.message || String(event.reason),
        error_stack: event.reason?.stack,
        error_type: 'unhandled_promise',
        page_url: window.location.href,
        severity: 'warning'
      });
    });
  }

  async logError(data: ErrorLogData) {
    if (!this.supabase) return;

    try {
      const { error } = await this.supabase.from('error_logs').insert({
        ...data,
        user_id: this.userId,
        user_agent: navigator.userAgent,
        browser_info: this.getBrowserInfo()
      });

      if (error) {
        // Performance metric logging error - fail silently
      }
    } catch {
      // Fail silently to avoid infinite loops
    }
  }

  // ========================================================================
  // PERFORMANCE TRACKING
  // ========================================================================

  private setupPerformanceObserver() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    try {
      // Track page load timing
      const perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            this.trackMetric({
              metric_type: 'page_load',
              metric_name: 'initial_load',
              duration_ms: entry.duration,
              page_url: window.location.href
            });
          }
        }
      });

      perfObserver.observe({ entryTypes: ['navigation'] });
    } catch {

    }
  }

  async trackMetric(data: PerformanceMetricData) {
    if (!this.supabase) return;

    try {
      await this.supabase.from('performance_metrics').insert({
        ...data,
        user_id: this.userId
      });
    } catch {

    }
  }

  // Track API calls
  trackAPICall(endpoint: string, duration: number, success: boolean) {
    this.trackMetric({
      metric_type: 'api_call',
      metric_name: endpoint,
      duration_ms: duration,
      metadata: { success }
    });
  }

  // Track component render time
  startComponentRender(componentName: string) {
    this.componentTimings.set(componentName, performance.now());
  }

  endComponentRender(componentName: string) {
    const startTime = this.componentTimings.get(componentName);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.trackMetric({
        metric_type: 'component_render',
        metric_name: componentName,
        duration_ms: duration
      });
      this.componentTimings.delete(componentName);
    }
  }

  // Track user actions (button clicks, form submissions, etc.)
  trackUserAction(actionName: string, duration?: number) {
    this.trackMetric({
      metric_type: 'user_action',
      metric_name: actionName,
      duration_ms: duration || 0,
      page_url: window.location.href
    });
  }

  // ========================================================================
  // FEATURE USAGE TRACKING
  // ========================================================================

  async trackFeatureUsage(data: FeatureUsageData) {
    if (!this.supabase) return;

    try {
      await this.supabase.from('feature_usage').insert({
        ...data,
        user_id: this.userId
      });
    } catch {

    }
  }

  // ========================================================================
  // SESSION TRACKING
  // ========================================================================

  private startSession() {
    if (!this.supabase || typeof window === 'undefined') return;

    this.sessionId = crypto.randomUUID();

    // Log session start
    this.supabase.from('user_sessions').insert({
      id: this.sessionId,
      user_id: this.userId,
      device_type: this.getDeviceType(),
      browser: this.getBrowserName(),
      os: this.getOS()
    });

    // Update session on page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }

  private endSession() {
    if (!this.supabase || !this.sessionId) return;

    const now = new Date().toISOString();
    // Fire and forget - don't wait for response
    this.supabase.from('user_sessions')
      .update({ session_end: now })
      .eq('id', this.sessionId);
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  private getBrowserName(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getOS(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Win')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const logError = (data: ErrorLogData) => performanceMonitor.logError(data);
export const trackMetric = (data: PerformanceMetricData) => performanceMonitor.trackMetric(data);
export const trackFeature = (data: FeatureUsageData) => performanceMonitor.trackFeatureUsage(data);
export const trackAPICall = (endpoint: string, duration: number, success: boolean) =>
  performanceMonitor.trackAPICall(endpoint, duration, success);
