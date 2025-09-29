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

      const times = this.metrics.get(componentName)!;
      times.push(renderTime);

      // Keep only last 100 measurements
      if (times.length > 100) {
        times.shift();
      }

      // Log slow renders (>16ms for 60fps)
      if (renderTime > 16) {
        console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }
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

  // Log all performance stats
  logAllStats() {
    console.group('🚀 Component Performance Stats');
    for (const [component, times] of this.metrics) {
      const stats = this.getStats(component);
      if (stats) {
        console.log(`${component}: avg ${stats.avg.toFixed(2)}ms, max ${stats.max.toFixed(2)}ms (${stats.samples} samples)`);
      }
    }
    console.groupEnd();
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
        if (cls > 0.1) {
          console.warn(`High CLS detected: ${cls.toFixed(4)}`);
        }
      });
      observer.observe({ entryTypes: ['layout-shift'] });

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fid = (entry as any).processingStart - entry.startTime;
          if (fid > 100) {
            console.warn(`High FID detected: ${fid.toFixed(2)}ms`);
          }
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    }

    // Largest Contentful Paint (LCP)
    if ('LargestContentfulPaint' in window) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries[entries.length - 1];
        if (lcp.startTime > 2500) {
          console.warn(`Slow LCP detected: ${lcp.startTime.toFixed(2)}ms`);
        }
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

  // Log stats every 30 seconds
  setInterval(() => {
    monitor.logAllStats();
  }, 30000);
}