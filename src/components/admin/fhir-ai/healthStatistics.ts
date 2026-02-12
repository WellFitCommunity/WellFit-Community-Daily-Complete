// FHIR AI Service — Health Statistics Module
// Daily/weekly health data aggregation, compliance calculations, and statistical helpers

import type {
  VitalsReading,
  DailyHealthLog,
  DailyAggregates,
  WeeklyHealthSummary,
  WeeklyTrends,
  HealthStatistics,
  OverallStatistics,
} from './types';

// ---- Utility Helpers ----

/** Extract YYYY-MM-DD date string from a timestamp */
function getDateString(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/** Calculate arithmetic average of a number array */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/** Get the most frequently occurring string in an array */
function getMostFrequent(items: string[]): string | null {
  if (items.length === 0) return null;

  const frequency = new Map<string, number>();
  for (const item of items) {
    frequency.set(item, (frequency.get(item) || 0) + 1);
  }

  let maxCount = 0;
  let mostFrequent = items[0];
  for (const [item, count] of frequency) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = item;
    }
  }

  return mostFrequent;
}

/** Calculate trend direction from two values */
function calculateTrend(first: number | null | undefined, last: number | null | undefined): 'RISING' | 'FALLING' | 'STABLE' {
  if (first == null || last == null) return 'STABLE';

  const change = ((last - first) / first) * 100;

  if (change > 5) return 'RISING';
  if (change < -5) return 'FALLING';
  return 'STABLE';
}

/** Calculate the number of days between two date strings */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ---- Aggregation ----

/** Create an empty DailyAggregates object */
function getEmptyAggregates(): DailyAggregates {
  return {
    bloodPressure: { systolic: null, diastolic: null, count: 0 },
    heartRate: { avg: null, min: null, max: null, count: 0 },
    bloodSugar: { avg: null, min: null, max: null, count: 0 },
    bloodOxygen: { avg: null, min: null, max: null, count: 0 },
    weight: { avg: null, count: 0 },
    mood: { predominant: null, entries: [] },
    physicalActivity: { entries: [] },
    socialEngagement: { entries: [] },
    symptoms: { entries: [] }
  };
}

/** Calculate daily aggregates from an array of vitals readings */
function calculateDailyAggregates(readings: VitalsReading[]): DailyAggregates {
  const aggregates = getEmptyAggregates();

  // Arrays to collect numeric values
  const bpSystolic: number[] = [];
  const bpDiastolic: number[] = [];
  const heartRates: number[] = [];
  const bloodSugars: number[] = [];
  const bloodOxygens: number[] = [];
  const weights: number[] = [];
  const moods: string[] = [];

  // Collect all values - FIX: Handle field name variations from both self_reports and check_ins
  for (const reading of readings) {
    // Blood pressure
    if (reading.bp_systolic != null) bpSystolic.push(reading.bp_systolic);
    if (reading.bp_diastolic != null) bpDiastolic.push(reading.bp_diastolic);

    // Heart rate
    if (reading.heart_rate != null) heartRates.push(reading.heart_rate);

    // Blood sugar - handle both field names
    if (reading.blood_sugar != null) bloodSugars.push(reading.blood_sugar);
    if (reading.glucose_mg_dl != null) bloodSugars.push(reading.glucose_mg_dl);

    // Blood oxygen - handle all three field names
    if (reading.blood_oxygen != null) bloodOxygens.push(reading.blood_oxygen);
    if (reading.spo2 != null) bloodOxygens.push(reading.spo2);
    if (reading.pulse_oximeter != null) bloodOxygens.push(reading.pulse_oximeter);

    // Weight
    if (reading.weight != null) weights.push(reading.weight);

    // Mood
    if (reading.mood) moods.push(reading.mood);

    // Activities (safe: getEmptyAggregates() guarantees non-null)
    if (reading.physical_activity) aggregates.physicalActivity.entries.push(reading.physical_activity);
    if (reading.social_engagement) aggregates.socialEngagement.entries.push(reading.social_engagement);

    // Symptoms and notes
    if (reading.symptoms) aggregates.symptoms.entries.push(reading.symptoms);
    if (reading.activity_description) aggregates.symptoms.entries.push(reading.activity_description);
  }

  // Calculate blood pressure (safe: getEmptyAggregates() guarantees non-null)
  if (bpSystolic.length > 0 && bpDiastolic.length > 0) {
    aggregates.bloodPressure.systolic = Math.round(average(bpSystolic));
    aggregates.bloodPressure.diastolic = Math.round(average(bpDiastolic));
    aggregates.bloodPressure.count = Math.min(bpSystolic.length, bpDiastolic.length);
  }

  // Calculate heart rate
  if (heartRates.length > 0) {
    aggregates.heartRate.avg = Math.round(average(heartRates));
    aggregates.heartRate.min = Math.min(...heartRates);
    aggregates.heartRate.max = Math.max(...heartRates);
    aggregates.heartRate.count = heartRates.length;
  }

  // Calculate blood sugar
  if (bloodSugars.length > 0) {
    aggregates.bloodSugar.avg = Math.round(average(bloodSugars));
    aggregates.bloodSugar.min = Math.min(...bloodSugars);
    aggregates.bloodSugar.max = Math.max(...bloodSugars);
    aggregates.bloodSugar.count = bloodSugars.length;
  }

  // Calculate blood oxygen
  if (bloodOxygens.length > 0) {
    aggregates.bloodOxygen.avg = Math.round(average(bloodOxygens));
    aggregates.bloodOxygen.min = Math.min(...bloodOxygens);
    aggregates.bloodOxygen.max = Math.max(...bloodOxygens);
    aggregates.bloodOxygen.count = bloodOxygens.length;
  }

  // Calculate weight
  if (weights.length > 0) {
    aggregates.weight.avg = parseFloat(average(weights).toFixed(1));
    aggregates.weight.count = weights.length;
  }

  // Calculate mood
  if (moods.length > 0) {
    aggregates.mood.predominant = getMostFrequent(moods);
    aggregates.mood.entries = moods;
  }

  return aggregates;
}

/** Calculate weekly trends from daily data */
function calculateWeeklyTrends(weeklyData: DailyHealthLog[]): WeeklyTrends {
  const daysWithData = weeklyData.filter(day => day.readings.length > 0);

  if (daysWithData.length < 2) {
    return {
      bloodPressure: 'STABLE',
      heartRate: 'STABLE',
      bloodSugar: 'STABLE',
      bloodOxygen: 'STABLE',
      weight: 'STABLE',
      mood: 'STABLE'
    };
  }

  const firstDay = daysWithData[0].aggregates;
  const lastDay = daysWithData[daysWithData.length - 1].aggregates;

  return {
    bloodPressure: calculateTrend(firstDay.bloodPressure?.systolic, lastDay.bloodPressure?.systolic),
    heartRate: calculateTrend(firstDay.heartRate?.avg, lastDay.heartRate?.avg),
    bloodSugar: calculateTrend(firstDay.bloodSugar?.avg, lastDay.bloodSugar?.avg),
    bloodOxygen: calculateTrend(firstDay.bloodOxygen?.avg, lastDay.bloodOxygen?.avg),
    weight: calculateTrend(firstDay.weight?.avg, lastDay.weight?.avg),
    mood: 'STABLE' // Mood trend would require more complex analysis
  };
}

/** Calculate a weekly summary from daily logs */
function calculateWeeklySummary(weeklyData: DailyHealthLog[], startDate: string, endDate: string): WeeklyHealthSummary {
  // Flatten all readings from the week
  const allReadings = weeklyData.flatMap(day => day.readings);

  // Calculate weekly aggregates
  const weeklyAggregates = calculateDailyAggregates(allReadings);

  // Calculate trends
  const trends = calculateWeeklyTrends(weeklyData);

  return {
    weekStart: startDate,
    weekEnd: endDate,
    daysWithData: weeklyData.filter(day => day.readings.length > 0).length,
    totalReadings: allReadings.length,
    aggregates: weeklyAggregates,
    trends
  };
}

/** Calculate overall statistics from all readings */
function calculateOverallStatistics(allReadings: VitalsReading[]): OverallStatistics {
  const aggregates = calculateDailyAggregates(allReadings);
  // Type guard filter to narrow created_at from undefined
  const readingsWithDates = allReadings.filter(
    (r): r is VitalsReading & { created_at: string } => r.created_at !== undefined && r.created_at !== null
  );

  return {
    totalReadings: allReadings.length,
    dateRange: {
      start: readingsWithDates.length > 0 ? getDateString(readingsWithDates[readingsWithDates.length - 1].created_at) : null,
      end: readingsWithDates.length > 0 ? getDateString(readingsWithDates[0].created_at) : null
    },
    averages: aggregates,
    complianceRate: calculateComplianceRate(allReadings)
  };
}

/** Calculate compliance rate from readings */
function calculateComplianceRate(readings: VitalsReading[]): number {
  if (readings.length === 0) return 0;

  // Type guard filter to narrow created_at from undefined
  const readingsWithDates = readings.filter(
    (r): r is VitalsReading & { created_at: string } => r.created_at !== undefined && r.created_at !== null
  );
  if (readingsWithDates.length === 0) return 0;

  const dates = new Set(readingsWithDates.map(r => getDateString(r.created_at)));
  const daysSinceFirst = daysBetween(
    readingsWithDates[readingsWithDates.length - 1].created_at,
    readingsWithDates[0].created_at
  );

  if (daysSinceFirst === 0) return 100;

  return Math.round((dates.size / daysSinceFirst) * 100);
}

// ---- Public API ----

/**
 * Compute daily health logs by aggregating all vitals from self_reports and check_ins for each day
 * @param healthData Array of health entries (self_reports, check_ins, etc.)
 * @returns Map of date strings to aggregated daily statistics
 */
export function computeDailyHealthLogs(healthData: VitalsReading[]): Map<string, DailyHealthLog> {
  const dailyLogs = new Map<string, DailyHealthLog>();

  // Group data by date
  for (const entry of healthData) {
    if (!entry.created_at) continue;
    const dateStr = getDateString(entry.created_at);

    if (!dailyLogs.has(dateStr)) {
      dailyLogs.set(dateStr, {
        date: dateStr,
        readings: [],
        aggregates: getEmptyAggregates()
      });
    }

    const log = dailyLogs.get(dateStr);
    if (log) {
      log.readings.push(entry);
    }
  }

  // Calculate aggregates for each day
  for (const [, log] of dailyLogs) {
    log.aggregates = calculateDailyAggregates(log.readings);
  }

  return dailyLogs;
}

/**
 * Compute weekly averages from daily logs
 * @param dailyLogs Map of daily health logs
 * @returns Array of weekly statistics
 */
export function computeWeeklyAverages(dailyLogs: Map<string, DailyHealthLog>): WeeklyHealthSummary[] {
  const weeklySummaries: WeeklyHealthSummary[] = [];
  const sortedDates = Array.from(dailyLogs.keys()).sort();

  // Group dates into weeks (7-day periods)
  let weekStart = 0;
  while (weekStart < sortedDates.length) {
    const weekEnd = Math.min(weekStart + 7, sortedDates.length);
    const weekDates = sortedDates.slice(weekStart, weekEnd);

    const weeklyData = weekDates.map(date => dailyLogs.get(date)).filter((log): log is DailyHealthLog => log !== undefined);
    const weekSummary = calculateWeeklySummary(weeklyData, weekDates[0], weekDates[weekDates.length - 1]);

    weeklySummaries.push(weekSummary);
    weekStart = weekEnd;
  }

  return weeklySummaries;
}

/**
 * Get comprehensive health statistics for a patient
 * @param healthData Array of all health entries
 * @returns Structured daily and weekly statistics
 */
export async function computeHealthStatistics(healthData: VitalsReading[]): Promise<HealthStatistics> {
  const dailyLogs = computeDailyHealthLogs(healthData);
  const weeklyAverages = computeWeeklyAverages(dailyLogs);

  // Compute overall statistics
  const allReadings = Array.from(dailyLogs.values()).flatMap(log => log.readings);
  const overallStats = calculateOverallStatistics(allReadings);

  return {
    dailyLogs: Array.from(dailyLogs.values()).sort((a, b) => b.date.localeCompare(a.date)),
    weeklyAverages: weeklyAverages.reverse(), // Most recent first
    overallStats,
    lastUpdated: new Date().toISOString(),
    dataPoints: allReadings.length
  };
}
