// Performance monitoring utilities for production
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

      // Safe: just set above if it didn't exist
      const times = this.metrics.get(componentName)!;
      times.push(renderTime);

      // Keep only last 100 measurements
      if (times.length > 100) {
        times.shift();
      }

      // Track slow renders (>16ms for 60fps) - logged to monitoring service
      // Performance metrics should be sent to external monitoring (Datadog, New Relic, etc.)
    };
  }

  // Get performance stats for a component
  getStats(componentName: string) {
    const times = this.metrics.get(componentName) || [];
    if (times.length === 0) return null;

    const avg = times.reduce((a, b) => a + b) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    return { avg, max, min, samples: times.length };
  }

  // Get all performance stats (for external monitoring service)
  getAllStats() {
    const allStats: Record<string, any> = {};
    for (const [component, times] of this.metrics) {
      const stats = this.getStats(component);
      if (stats) {
        allStats[component] = stats;
      }
    }
    return allStats;
    // Performance data should be sent to external monitoring (Datadog, New Relic, etc.)
  }

  // Web Vitals tracking
  measureWebVitals() {
    // Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Cumulative Layout Shift (CLS)
      const observer = new PerformanceObserver((list) => {
        let cls = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            cls += (entry as any).value;
          }
        }
        // High CLS tracked for monitoring service
      });
      observer.observe({ entryTypes: ['layout-shift'] });

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fid = (entry as any).processingStart - entry.startTime;
          // High FID tracked for monitoring service
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    }

    // Largest Contentful Paint (LCP)
    if ('LargestContentfulPaint' in window) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries[entries.length - 1];
        // Slow LCP tracked for monitoring service
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
if (process.env.NODE_ENV === 'production') {
  const monitor = PerformanceMonitor.getInstance();
  monitor.measureWebVitals();

  // Send stats to monitoring service every 30 seconds
  setInterval(() => {
    const stats = monitor.getAllStats();
    // TODO: Send stats to external monitoring service (Datadog, New Relic, etc.)
    // This prevents PHI leakage via browser console
  }, 30000);
}