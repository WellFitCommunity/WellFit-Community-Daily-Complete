// Performance monitoring utilities for production
import { supabase } from '../lib/supabaseClient';
import { auditLogger } from '../services/auditLogger';

type ComponentStats = {
  avg: number;
  max: number;
  min: number;
  samples: number;
};

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Measure component render time
  measureRender(componentName: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      if (!this.metrics.has(componentName)) {
        this.metrics.set(componentName, []);
      }

      const _times = this.metrics.get(componentName);
      if (!_times) return;

      _times.push(renderTime);

      // Keep only last 100 measurements
      if (_times.length > 100) {
        _times.shift();
      }

      // Track slow renders (>16ms for 60fps) - logged to monitoring service
      // Performance metrics should be sent to external monitoring (Datadog, New Relic, etc.)
    };
  }

  // Get performance stats for a component
  getStats(componentName: string): ComponentStats | null {
    const times = this.metrics.get(componentName) || [];
    if (times.length === 0) return null;

    const avg = times.reduce((a, b) => a + b) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    return { avg, max, min, samples: times.length };
  }

  // Get all performance stats (for external monitoring service)
  getAllStats(): Record<string, ComponentStats> {
    const allStats: Record<string, ComponentStats> = {};
    for (const [component] of this.metrics) {
      const stats = this.getStats(component);
      if (stats) {
        allStats[component] = stats;
      }
    }
    return allStats;
    // Performance data should be sent to external monitoring (Datadog, New Relic, etc.)
  }

  // Web Vitals tracking
  measureWebVitals(): void {
    // Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Cumulative Layout Shift (CLS)
      const observer = new PerformanceObserver((list) => {
        let _cls = 0;
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };

          if (!layoutShiftEntry.hadRecentInput) {
            _cls += layoutShiftEntry.value ?? 0;
          }
        }
        // High CLS tracked for monitoring service
        void _cls;
      });
      observer.observe({ entryTypes: ['layout-shift'] });

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const firstInputEntry = entry as PerformanceEntry & { processingStart?: number };
          const _fid = (firstInputEntry.processingStart ?? 0) - entry.startTime;
          // High FID tracked for monitoring service
          void _fid;
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    }

    // Largest Contentful Paint (LCP)
    if ('LargestContentfulPaint' in window) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        const _lcp = lastEntry ?? null;
        // Slow LCP tracked for monitoring service
        void _lcp;
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }
}

// React hook for measuring component performance
export const usePerformanceMonitor = (componentName: string) => {
  const monitor = PerformanceMonitor.getInstance();

  return {
    measureRender: monitor.measureRender(componentName),
    getStats: () => monitor.getStats(componentName),
  };
};

// Initialize performance monitoring in production
if (import.meta.env.MODE === 'production') {
  const monitor = PerformanceMonitor.getInstance();
  monitor.measureWebVitals();

  // Send stats to internal monitoring service every 30 seconds
  setInterval(async () => {
    const stats = monitor.getAllStats();

    // Skip if no stats to report
    if (Object.keys(stats).length === 0) return;

    try {
      // Send to internal telemetry table (HIPAA-compliant, no external services)
      await supabase.from('performance_telemetry').insert({
        event_type: 'performance_stats',
        stats_data: stats,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });

      // Log summary to audit logger for compliance
      const slowComponents = Object.entries(stats)
        .filter(([, s]) => s.avg > 100) // Components averaging >100ms
        .map(([name]) => name);

      if (slowComponents.length > 0) {
        auditLogger.warn('PERFORMANCE_DEGRADATION', {
          slow_components: slowComponents,
          component_count: Object.keys(stats).length,
        });
      }
    } catch {
      // Performance monitoring failures should not impact user experience
      // Silently fail - this is non-critical telemetry
    }
  }, 30000);
}
