/**
 * Field Visit Optimizer Service
 *
 * Frontend service for AI-powered field visit route optimization.
 * Optimizes community health worker (CHW) visit schedules for:
 * - Travel time minimization
 * - Visit priority balancing (urgent vs routine)
 * - Geographic clustering
 * - Time window constraints
 * - Traffic pattern awareness
 * - Visit duration estimation
 *
 * Uses Claude Haiku 4.5 for fast route optimization.
 *
 * @module fieldVisitOptimizerService
 * @skill #49 - Field Visit Optimizer
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export type VisitPriority = 'urgent' | 'high' | 'routine' | 'follow_up' | 'preventive';
export type VisitType =
  | 'wellness_check'
  | 'medication_review'
  | 'chronic_care'
  | 'post_discharge'
  | 'assessment'
  | 'education'
  | 'social_services'
  | 'other';
export type TransportMode = 'car' | 'public_transit' | 'walking' | 'bicycle';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  zip?: string;
}

export interface TimeWindow {
  earliest: string; // HH:mm format
  latest: string;
  preferredTime?: string;
}

export interface PatientVisit {
  visitId: string;
  patientId: string;
  patientName: string;
  location: GeoLocation;
  visitType: VisitType;
  priority: VisitPriority;
  estimatedDuration: number; // minutes
  timeWindow?: TimeWindow;
  specialInstructions?: string;
  requiresEquipment?: string[];
  lastVisitDate?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface WorkerProfile {
  workerId: string;
  workerName: string;
  startLocation: GeoLocation;
  endLocation?: GeoLocation;
  transportMode: TransportMode;
  workingHours: {
    start: string; // HH:mm
    end: string;
  };
  breakTime?: {
    start: string;
    duration: number; // minutes
  };
  certifications?: string[];
  preferredAreas?: string[];
  maxVisitsPerDay?: number;
}

export interface OptimizedRoute {
  workerId: string;
  visits: OptimizedVisit[];
  totalDistance: number; // miles
  totalTravelTime: number; // minutes
  totalVisitTime: number; // minutes
  totalWorkTime: number; // minutes
  efficiency: number; // percentage of time spent on visits vs travel
}

export interface OptimizedVisit {
  visitId: string;
  patientId: string;
  patientName: string;
  location: GeoLocation;
  visitType: VisitType;
  priority: VisitPriority;
  scheduledArrival: string; // ISO datetime
  scheduledDeparture: string;
  estimatedDuration: number;
  travelTimeFromPrevious: number;
  distanceFromPrevious: number;
  sequenceNumber: number;
  notes?: string;
}

export interface UnscheduledVisit {
  visit: PatientVisit;
  reason: string;
  alternativeDates?: string[];
}

export interface OptimizationRequest {
  visits: PatientVisit[];
  worker: WorkerProfile;
  date: string; // YYYY-MM-DD
  tenantId?: string;
  optimizationPreference?: 'time' | 'distance' | 'priority' | 'balanced';
  avoidHighways?: boolean;
  accountForTraffic?: boolean;
}

export interface OptimizationResult {
  route: OptimizedRoute;
  unscheduledVisits: UnscheduledVisit[];
  suggestions: string[];
  alternativeRoutes?: OptimizedRoute[];
  metadata: {
    generatedAt: string;
    responseTimeMs: number;
    model: string;
    visitsProcessed: number;
    optimizationIterations: number;
  };
}

export interface MultiWorkerOptimizationRequest {
  visits: PatientVisit[];
  workers: WorkerProfile[];
  date: string;
  tenantId?: string;
  allowReassignment?: boolean;
  optimizationPreference?: 'time' | 'distance' | 'priority' | 'balanced';
}

export interface MultiWorkerOptimizationResult {
  routes: OptimizedRoute[];
  unscheduledVisits: UnscheduledVisit[];
  workloadBalance: {
    workerId: string;
    workerName: string;
    visitCount: number;
    totalWorkTime: number;
    efficiency: number;
  }[];
  overallMetrics: {
    totalVisits: number;
    scheduledVisits: number;
    totalDistance: number;
    averageEfficiency: number;
  };
  metadata: {
    generatedAt: string;
    responseTimeMs: number;
    model: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_WEIGHTS: Record<VisitPriority, number> = {
  urgent: 100,
  high: 75,
  routine: 50,
  follow_up: 40,
  preventive: 30,
};

const VISIT_TYPE_DURATIONS: Record<VisitType, number> = {
  wellness_check: 30,
  medication_review: 45,
  chronic_care: 60,
  post_discharge: 45,
  assessment: 60,
  education: 30,
  social_services: 45,
  other: 30,
};

// Average travel speed by transport mode (mph)
const TRAVEL_SPEEDS: Record<TransportMode, number> = {
  car: 25, // Urban average with traffic
  public_transit: 15,
  walking: 3,
  bicycle: 10,
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
  // Haversine formula for distance calculation
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.latitude)) *
      Math.cos(toRad(loc2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function calculateTravelTime(
  distance: number,
  transportMode: TransportMode,
  accountForTraffic: boolean
): number {
  let speed = TRAVEL_SPEEDS[transportMode];

  // Add traffic factor for car during peak hours
  if (accountForTraffic && transportMode === 'car') {
    speed *= 0.7; // 30% reduction for traffic
  }

  return Math.round((distance / speed) * 60); // Convert to minutes
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function sortByPriority(visits: PatientVisit[]): PatientVisit[] {
  return [...visits].sort(
    (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
  );
}

function clusterByProximity(visits: PatientVisit[], maxDistance: number = 3): PatientVisit[][] {
  const clusters: PatientVisit[][] = [];
  const assigned = new Set<string>();

  visits.forEach((visit) => {
    if (assigned.has(visit.visitId)) return;

    const cluster: PatientVisit[] = [visit];
    assigned.add(visit.visitId);

    visits.forEach((other) => {
      if (assigned.has(other.visitId)) return;
      const distance = calculateDistance(visit.location, other.location);
      if (distance <= maxDistance) {
        cluster.push(other);
        assigned.add(other.visitId);
      }
    });

    clusters.push(cluster);
  });

  return clusters;
}

// ============================================================================
// Service
// ============================================================================

export const FieldVisitOptimizerService = {
  /**
   * Optimize route for a single worker
   */
  async optimizeRoute(
    request: OptimizationRequest
  ): Promise<ServiceResult<OptimizationResult>> {
    const startTime = Date.now();

    try {
      const {
        visits,
        worker,
        date,
        tenantId,
        optimizationPreference = 'balanced',
        avoidHighways = false,
        accountForTraffic = true,
      } = request;

      if (!visits || visits.length === 0) {
        return failure('VALIDATION_ERROR', 'At least one visit is required');
      }

      if (!worker) {
        return failure('VALIDATION_ERROR', 'Worker profile is required');
      }

      // Quick local optimization
      const localResult = optimizeLocally(visits, worker, date, {
        preference: optimizationPreference,
        accountForTraffic,
      });

      // Try AI enhancement via edge function
      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'ai-field-visit-optimizer',
        {
          body: {
            visits: visits.map((v) => ({
              ...v,
              estimatedDuration: v.estimatedDuration || VISIT_TYPE_DURATIONS[v.visitType],
            })),
            worker,
            date,
            optimizationPreference,
            avoidHighways,
            accountForTraffic,
            tenantId,
          },
        }
      );

      let finalResult: OptimizationResult;

      if (aiError) {
        await auditLogger.error(
          'FIELD_VISIT_OPTIMIZER_EDGE_ERROR',
          aiError instanceof Error ? aiError : new Error(String(aiError)),
          { workerId: worker.workerId, visitCount: visits.length }
        );

        // Use local optimization result
        finalResult = {
          ...localResult,
          metadata: {
            ...localResult.metadata,
            model: 'local-greedy',
          },
        };
      } else if (aiData) {
        // Use AI-optimized result if better
        const aiResult = aiData as OptimizationResult;
        if (aiResult.route.efficiency > localResult.route.efficiency) {
          finalResult = aiResult;
        } else {
          finalResult = localResult;
        }
      } else {
        finalResult = localResult;
      }

      // Generate suggestions
      finalResult.suggestions = generateSuggestions(
        finalResult.route,
        finalResult.unscheduledVisits
      );

      await auditLogger.info('FIELD_VISIT_OPTIMIZATION_COMPLETE', {
        workerId: worker.workerId,
        date,
        visitsScheduled: finalResult.route.visits.length,
        unscheduledCount: finalResult.unscheduledVisits.length,
        efficiency: finalResult.route.efficiency,
        responseTimeMs: Date.now() - startTime,
      });

      return success({
        ...finalResult,
        metadata: {
          ...finalResult.metadata,
          responseTimeMs: Date.now() - startTime,
        },
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'FIELD_VISIT_OPTIMIZATION_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { workerId: request.worker.workerId }
      );

      return failure('OPERATION_FAILED', 'Failed to optimize field visit route');
    }
  },

  /**
   * Optimize routes for multiple workers
   */
  async optimizeMultipleRoutes(
    request: MultiWorkerOptimizationRequest
  ): Promise<ServiceResult<MultiWorkerOptimizationResult>> {
    const startTime = Date.now();

    try {
      const { visits, workers, date, tenantId: _tenantId, allowReassignment = true, optimizationPreference = 'balanced' } = request;

      if (!visits || visits.length === 0) {
        return failure('VALIDATION_ERROR', 'At least one visit is required');
      }

      if (!workers || workers.length === 0) {
        return failure('VALIDATION_ERROR', 'At least one worker is required');
      }

      const routes: OptimizedRoute[] = [];
      const allUnscheduled: UnscheduledVisit[] = [];
      let remainingVisits = [...visits];

      if (allowReassignment) {
        // Distribute visits optimally across workers
        const clusters = clusterByProximity(visits);

        // Sort workers by their start location proximity to clusters
        workers.forEach((worker) => {
          const workerVisits: PatientVisit[] = [];

          clusters.forEach((cluster) => {
            if (cluster.length === 0) return;

            const clusterCenter = cluster[0].location;
            const distanceToWorker = calculateDistance(worker.startLocation, clusterCenter);

            // Assign cluster to this worker if closest
            const isClosest = workers.every((w) => {
              const otherDistance = calculateDistance(w.startLocation, clusterCenter);
              return w.workerId === worker.workerId || distanceToWorker <= otherDistance;
            });

            if (isClosest) {
              workerVisits.push(...cluster);
              cluster.length = 0; // Clear cluster
            }
          });

          if (workerVisits.length > 0) {
            remainingVisits = remainingVisits.filter(
              (v) => !workerVisits.find((wv) => wv.visitId === v.visitId)
            );
          }

          const result = optimizeLocally(workerVisits, worker, date, {
            preference: optimizationPreference,
            accountForTraffic: true,
          });

          routes.push(result.route);
          allUnscheduled.push(...result.unscheduledVisits);
        });
      } else {
        // Optimize each worker's assigned visits independently
        for (const worker of workers) {
          const workerVisits = visits.filter(
            (v) =>
              v.location.zip &&
              worker.preferredAreas?.includes(v.location.zip)
          );

          const result = optimizeLocally(workerVisits, worker, date, {
            preference: optimizationPreference,
            accountForTraffic: true,
          });

          routes.push(result.route);
          allUnscheduled.push(...result.unscheduledVisits);
        }
      }

      // Handle any remaining unassigned visits
      remainingVisits.forEach((visit) => {
        allUnscheduled.push({
          visit,
          reason: 'No available worker in area',
          alternativeDates: [getNextBusinessDay(date)],
        });
      });

      const workloadBalance = routes.map((route) => {
        const worker = workers.find((w) => w.workerId === route.workerId);
        return {
          workerId: route.workerId,
          workerName: worker?.workerName || 'Unknown',
          visitCount: route.visits.length,
          totalWorkTime: route.totalWorkTime,
          efficiency: route.efficiency,
        };
      });

      const result: MultiWorkerOptimizationResult = {
        routes,
        unscheduledVisits: allUnscheduled,
        workloadBalance,
        overallMetrics: {
          totalVisits: visits.length,
          scheduledVisits: routes.reduce((sum, r) => sum + r.visits.length, 0),
          totalDistance: routes.reduce((sum, r) => sum + r.totalDistance, 0),
          averageEfficiency:
            routes.reduce((sum, r) => sum + r.efficiency, 0) / routes.length,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: Date.now() - startTime,
          model: 'local-cluster',
        },
      };

      await auditLogger.info('MULTI_WORKER_OPTIMIZATION_COMPLETE', {
        workerCount: workers.length,
        totalVisits: visits.length,
        scheduledVisits: result.overallMetrics.scheduledVisits,
        averageEfficiency: result.overallMetrics.averageEfficiency,
        responseTimeMs: result.metadata.responseTimeMs,
      });

      return success(result);
    } catch (err: unknown) {
      await auditLogger.error(
        'MULTI_WORKER_OPTIMIZATION_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { workerCount: request.workers.length }
      );

      return failure('OPERATION_FAILED', 'Failed to optimize multi-worker routes');
    }
  },

  /**
   * Get historical visit efficiency metrics
   */
  async getEfficiencyMetrics(
    tenantId: string,
    options?: {
      workerId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<
    ServiceResult<{
      averageEfficiency: number;
      averageVisitsPerDay: number;
      averageTravelTime: number;
      topPerformingAreas: Array<{ zip: string; efficiency: number }>;
      trendData: Array<{ date: string; efficiency: number; visits: number }>;
    }>
  > {
    try {
      let query = supabase
        .from('field_visit_metrics')
        .select('*')
        .eq('tenant_id', tenantId);

      if (options?.workerId) {
        query = query.eq('worker_id', options.workerId);
      }
      if (options?.startDate) {
        query = query.gte('visit_date', options.startDate);
      }
      if (options?.endDate) {
        query = query.lte('visit_date', options.endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const metrics = data || [];

      // Calculate aggregates
      const averageEfficiency =
        metrics.reduce((sum, m) => sum + (m.efficiency as number), 0) / (metrics.length || 1);
      const averageVisitsPerDay =
        metrics.reduce((sum, m) => sum + (m.visit_count as number), 0) / (metrics.length || 1);
      const averageTravelTime =
        metrics.reduce((sum, m) => sum + (m.travel_time as number), 0) / (metrics.length || 1);

      // Group by area
      const areaMap = new Map<string, number[]>();
      metrics.forEach((m) => {
        const zip = m.primary_zip as string;
        if (zip) {
          const existing = areaMap.get(zip) || [];
          existing.push(m.efficiency as number);
          areaMap.set(zip, existing);
        }
      });

      const topPerformingAreas = Array.from(areaMap.entries())
        .map(([zip, efficiencies]) => ({
          zip,
          efficiency: efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length,
        }))
        .sort((a, b) => b.efficiency - a.efficiency)
        .slice(0, 5);

      // Trend data
      const trendData = metrics
        .map((m) => ({
          date: m.visit_date as string,
          efficiency: m.efficiency as number,
          visits: m.visit_count as number,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      return success({
        averageEfficiency,
        averageVisitsPerDay,
        averageTravelTime,
        topPerformingAreas,
        trendData,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'FIELD_VISIT_METRICS_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId }
      );

      return failure('DATABASE_ERROR', 'Failed to retrieve efficiency metrics');
    }
  },
};

// ============================================================================
// Local Optimization Algorithm
// ============================================================================

function optimizeLocally(
  visits: PatientVisit[],
  worker: WorkerProfile,
  date: string,
  options: { preference: string; accountForTraffic: boolean }
): OptimizationResult {
  const workStart = parseTime(worker.workingHours.start);
  const workEnd = parseTime(worker.workingHours.end);
  const _availableMinutes = workEnd - workStart; // Reserved for future capacity calculations

  // Sort by priority first
  const sortedVisits = sortByPriority(visits);

  const optimizedVisits: OptimizedVisit[] = [];
  const unscheduledVisits: UnscheduledVisit[] = [];

  let currentTime = workStart;
  let currentLocation = worker.startLocation;
  let totalDistance = 0;
  let totalTravelTime = 0;

  // Greedy nearest-neighbor with priority consideration
  const remainingVisits = [...sortedVisits];

  while (remainingVisits.length > 0 && currentTime < workEnd - 30) {
    // Find best next visit using for loop for proper type narrowing
    let bestVisitIndex = -1;
    let bestScore = -Infinity;

    for (let index = 0; index < remainingVisits.length; index++) {
      const visit = remainingVisits[index];
      const distance = calculateDistance(currentLocation, visit.location);
      const travelTime = calculateTravelTime(
        distance,
        worker.transportMode,
        options.accountForTraffic
      );
      const duration = visit.estimatedDuration || VISIT_TYPE_DURATIONS[visit.visitType];

      // Check if visit fits in remaining time
      if (currentTime + travelTime + duration > workEnd) continue;

      // Check time window constraints
      if (visit.timeWindow) {
        const _earliest = parseTime(visit.timeWindow.earliest); // Reserved for wait-time optimization
        const latest = parseTime(visit.timeWindow.latest);
        const arrivalTime = currentTime + travelTime;

        if (arrivalTime > latest) continue;
      }

      // Calculate score based on preference
      let score = 0;

      if (options.preference === 'priority') {
        score = PRIORITY_WEIGHTS[visit.priority] * 10 - distance;
      } else if (options.preference === 'distance') {
        score = 100 - distance * 10;
      } else if (options.preference === 'time') {
        score = 100 - travelTime;
      } else {
        // Balanced
        score = PRIORITY_WEIGHTS[visit.priority] * 5 - distance * 5 - travelTime * 0.5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestVisitIndex = index;
      }
    }

    if (bestVisitIndex === -1) break;

    // Schedule the visit
    const selectedVisit = remainingVisits[bestVisitIndex];
    const distance = calculateDistance(currentLocation, selectedVisit.location);
    const travelTime = calculateTravelTime(
      distance,
      worker.transportMode,
      options.accountForTraffic
    );
    const duration = selectedVisit.estimatedDuration || VISIT_TYPE_DURATIONS[selectedVisit.visitType];

    const arrivalTime = currentTime + travelTime;
    const departureTime = arrivalTime + duration;

    optimizedVisits.push({
      visitId: selectedVisit.visitId,
      patientId: selectedVisit.patientId,
      patientName: selectedVisit.patientName,
      location: selectedVisit.location,
      visitType: selectedVisit.visitType,
      priority: selectedVisit.priority,
      scheduledArrival: `${date}T${formatTime(arrivalTime)}:00`,
      scheduledDeparture: `${date}T${formatTime(departureTime)}:00`,
      estimatedDuration: duration,
      travelTimeFromPrevious: travelTime,
      distanceFromPrevious: Math.round(distance * 10) / 10,
      sequenceNumber: optimizedVisits.length + 1,
    });

    totalDistance += distance;
    totalTravelTime += travelTime;
    currentTime = departureTime;
    currentLocation = selectedVisit.location;

    remainingVisits.splice(bestVisitIndex, 1);
  }

  // Mark remaining visits as unscheduled
  remainingVisits.forEach((visit) => {
    unscheduledVisits.push({
      visit,
      reason: currentTime >= workEnd - 30 ? 'No time remaining' : 'Could not fit in schedule',
      alternativeDates: [getNextBusinessDay(date)],
    });
  });

  const totalVisitTime = optimizedVisits.reduce((sum, v) => sum + v.estimatedDuration, 0);
  const totalWorkTime = totalTravelTime + totalVisitTime;
  const efficiency = totalWorkTime > 0 ? Math.round((totalVisitTime / totalWorkTime) * 100) : 0;

  return {
    route: {
      workerId: worker.workerId,
      visits: optimizedVisits,
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTravelTime,
      totalVisitTime,
      totalWorkTime,
      efficiency,
    },
    unscheduledVisits,
    suggestions: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      responseTimeMs: 0,
      model: 'local-greedy',
      visitsProcessed: visits.length,
      optimizationIterations: 1,
    },
  };
}

function generateSuggestions(
  route: OptimizedRoute,
  unscheduled: UnscheduledVisit[]
): string[] {
  const suggestions: string[] = [];

  if (route.efficiency < 60) {
    suggestions.push(
      'Consider grouping visits by geographic area to improve efficiency'
    );
  }

  if (unscheduled.length > 0) {
    const urgentUnscheduled = unscheduled.filter((u) => u.visit.priority === 'urgent');
    if (urgentUnscheduled.length > 0) {
      suggestions.push(
        `${urgentUnscheduled.length} urgent visit(s) could not be scheduled - consider extending hours or adding staff`
      );
    }
  }

  if (route.totalTravelTime > route.totalVisitTime) {
    suggestions.push(
      'Travel time exceeds visit time - consider reassigning visits to closer workers'
    );
  }

  if (suggestions.length === 0) {
    suggestions.push('Route is well optimized');
  }

  return suggestions;
}

function getNextBusinessDay(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);

  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }

  return d.toISOString().split('T')[0];
}

export default FieldVisitOptimizerService;
