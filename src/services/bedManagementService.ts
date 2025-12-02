/**
 * Bed Management Service
 *
 * Service layer for hospital bed management operations.
 * Communicates with the bed-management edge function.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  BedBoardEntry,
  UnitCapacity,
  UnitCensus,
  AvailableBed,
  BedForecast,
  BedStatus,
  BedType,
  HospitalUnit,
  Bed,
  DailyCensusSnapshot,
  BedStatusHistory,
  MLLearningFeedback,
  PredictionAccuracySummary,
} from '../types/bed';

const EDGE_FUNCTION_URL = 'bed-management';

interface EdgeFunctionResponse<T> {
  success: boolean;
  error?: string;
  beds?: T[];
  units?: T[];
  census?: T;
  available_beds?: T[];
  assignment_id?: string;
  forecast_id?: string;
  forecast?: T;
  message?: string;
}

/**
 * Call the bed-management edge function
 */
async function callBedManagementFunction<T>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_URL, {
      body: { action, ...params },
    });

    if (error) {
      await auditLogger.error('BED_MANAGEMENT_EDGE_ERROR', error, {
        category: 'CLINICAL',
        action,
      });
      return failure('EXTERNAL_SERVICE_ERROR', error.message, error);
    }

    const response = data as EdgeFunctionResponse<T>;

    if (!response.success) {
      return failure('OPERATION_FAILED', response.error || 'Operation failed');
    }

    return success(data as T);
  } catch (err) {
    await auditLogger.error('BED_MANAGEMENT_ERROR', err as Error, {
      category: 'CLINICAL',
      action,
    });
    return failure('UNKNOWN_ERROR', 'Failed to execute bed management operation', err);
  }
}

export const BedManagementService = {
  /**
   * Get real-time bed board view
   */
  async getBedBoard(options?: {
    unitId?: string;
    facilityId?: string;
  }): Promise<ServiceResult<BedBoardEntry[]>> {
    const result = await callBedManagementFunction<{ beds: BedBoardEntry[] }>(
      'get_bed_board',
      {
        unit_id: options?.unitId,
        facility_id: options?.facilityId,
      }
    );

    if (!result.success) return failure(result.error.code, result.error.message);
    return success(result.data.beds || []);
  },

  /**
   * Get unit capacity summary
   */
  async getUnitCapacity(options?: {
    unitId?: string;
    facilityId?: string;
  }): Promise<ServiceResult<UnitCapacity[]>> {
    const result = await callBedManagementFunction<{ units: UnitCapacity[] }>(
      'get_unit_capacity',
      {
        unit_id: options?.unitId,
        facility_id: options?.facilityId,
      }
    );

    if (!result.success) return failure(result.error.code, result.error.message);
    return success(result.data.units || []);
  },

  /**
   * Get real-time census for a specific unit
   */
  async getUnitCensus(unitId: string): Promise<ServiceResult<UnitCensus | null>> {
    const result = await callBedManagementFunction<{ census: UnitCensus }>(
      'get_census',
      { unit_id: unitId }
    );

    if (!result.success) return failure(result.error.code, result.error.message);
    return success(result.data.census || null);
  },

  /**
   * Find available beds matching criteria
   */
  async findAvailableBeds(options?: {
    unitId?: string;
    bedType?: BedType;
    requiresTelemetry?: boolean;
    requiresIsolation?: boolean;
    requiresNegativePressure?: boolean;
  }): Promise<ServiceResult<AvailableBed[]>> {
    const result = await callBedManagementFunction<{ available_beds: AvailableBed[] }>(
      'find_available',
      {
        unit_id: options?.unitId,
        bed_type: options?.bedType,
        requires_telemetry: options?.requiresTelemetry,
        requires_isolation: options?.requiresIsolation,
        requires_negative_pressure: options?.requiresNegativePressure,
      }
    );

    if (!result.success) return failure(result.error.code, result.error.message);
    return success(result.data.available_beds || []);
  },

  /**
   * Assign patient to bed
   */
  async assignPatientToBed(
    patientId: string,
    bedId: string,
    expectedLosDays?: number
  ): Promise<ServiceResult<{ assignmentId: string; message: string }>> {
    const result = await callBedManagementFunction<{
      assignment_id: string;
      message: string;
    }>('assign_bed', {
      patient_id: patientId,
      bed_id: bedId,
      expected_los_days: expectedLosDays,
    });

    if (!result.success) return failure(result.error.code, result.error.message);

    await auditLogger.info('PATIENT_ASSIGNED_TO_BED', {
      category: 'CLINICAL',
      patientId,
      bedId,
      assignmentId: result.data.assignment_id,
    });

    return success({
      assignmentId: result.data.assignment_id,
      message: result.data.message,
    });
  },

  /**
   * Discharge patient from bed
   */
  async dischargePatient(
    patientId: string,
    disposition: string = 'Home'
  ): Promise<ServiceResult<{ message: string }>> {
    const result = await callBedManagementFunction<{ message: string }>(
      'discharge',
      {
        patient_id: patientId,
        disposition,
      }
    );

    if (!result.success) return failure(result.error.code, result.error.message);

    await auditLogger.info('PATIENT_DISCHARGED', {
      category: 'CLINICAL',
      patientId,
      disposition,
    });

    return success({ message: result.data.message });
  },

  /**
   * Update bed status
   */
  async updateBedStatus(
    bedId: string,
    newStatus: BedStatus,
    reason?: string
  ): Promise<ServiceResult<{ message: string }>> {
    const result = await callBedManagementFunction<{ message: string }>(
      'update_status',
      {
        bed_id: bedId,
        new_status: newStatus,
        reason,
      }
    );

    if (!result.success) return failure(result.error.code, result.error.message);

    await auditLogger.info('BED_STATUS_UPDATED', {
      category: 'CLINICAL',
      bedId,
      newStatus,
      reason,
    });

    return success({ message: result.data.message });
  },

  /**
   * Generate bed availability forecast
   */
  async generateForecast(
    unitId: string,
    forecastDate?: string
  ): Promise<ServiceResult<BedForecast>> {
    const result = await callBedManagementFunction<{
      forecast_id: string;
      forecast: BedForecast;
    }>('generate_forecast', {
      unit_id: unitId,
      forecast_date: forecastDate,
    });

    if (!result.success) return failure(result.error.code, result.error.message);
    return success(result.data.forecast);
  },

  // ============================================
  // Direct Database Queries (for additional features)
  // ============================================

  /**
   * Get hospital units for the tenant
   */
  async getHospitalUnits(facilityId?: string): Promise<ServiceResult<HospitalUnit[]>> {
    try {
      let query = supabase
        .from('hospital_units')
        .select('*')
        .eq('is_active', true)
        .order('unit_name');

      if (facilityId) {
        query = query.eq('facility_id', facilityId);
      }

      const { data, error } = await query;

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch hospital units', err);
    }
  },

  /**
   * Get beds for a specific unit
   */
  async getBedsForUnit(unitId: string): Promise<ServiceResult<Bed[]>> {
    try {
      const { data, error } = await supabase
        .from('beds')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('room_number')
        .order('bed_position');

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch beds', err);
    }
  },

  /**
   * Get daily census snapshots for trending/analytics
   */
  async getDailyCensusSnapshots(
    unitId: string,
    startDate: string,
    endDate: string
  ): Promise<ServiceResult<DailyCensusSnapshot[]>> {
    try {
      const { data, error } = await supabase
        .from('daily_census_snapshots')
        .select('*')
        .eq('unit_id', unitId)
        .gte('census_date', startDate)
        .lte('census_date', endDate)
        .order('census_date', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch census snapshots', err);
    }
  },

  /**
   * Get bed status history for analytics
   */
  async getBedStatusHistory(
    bedId: string,
    limit: number = 50
  ): Promise<ServiceResult<BedStatusHistory[]>> {
    try {
      const { data, error } = await supabase
        .from('bed_status_history')
        .select('*')
        .eq('bed_id', bedId)
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch bed status history', err);
    }
  },

  /**
   * Get historical forecasts for accuracy tracking
   */
  async getHistoricalForecasts(
    unitId: string,
    startDate: string,
    endDate: string
  ): Promise<ServiceResult<BedForecast[]>> {
    try {
      const { data, error } = await supabase
        .from('bed_availability_forecasts')
        .select('*')
        .eq('unit_id', unitId)
        .gte('forecast_date', startDate)
        .lte('forecast_date', endDate)
        .order('forecast_date', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch forecasts', err);
    }
  },

  // ============================================
  // ML Learning & Feedback System
  // ============================================

  /**
   * Submit ML learning feedback to improve predictions
   */
  async submitLearningFeedback(
    feedback: Omit<MLLearningFeedback, 'id' | 'created_at'>
  ): Promise<ServiceResult<MLLearningFeedback>> {
    try {
      // Store feedback in daily_census_snapshots for now
      // This updates the actual values so the model can learn
      const { data: existingSnapshot } = await supabase
        .from('daily_census_snapshots')
        .select('id')
        .eq('unit_id', feedback.unit_id)
        .eq('census_date', feedback.feedback_date)
        .single();

      if (existingSnapshot) {
        // Update with actual values for learning
        const { error: updateError } = await supabase
          .from('daily_census_snapshots')
          .update({
            eod_census: feedback.actual_value,
            prediction_accuracy: 100 - Math.abs(feedback.variance_percentage),
          })
          .eq('id', existingSnapshot.id);

        if (updateError) {
          return failure('DATABASE_ERROR', updateError.message, updateError);
        }
      }

      // Also update forecast with actual values
      if (feedback.feedback_type === 'census_prediction') {
        const { error: forecastError } = await supabase
          .from('bed_availability_forecasts')
          .update({
            actual_census: feedback.actual_value,
            error_percentage: feedback.variance_percentage,
          })
          .eq('unit_id', feedback.unit_id)
          .eq('forecast_date', feedback.feedback_date);

        if (forecastError) {
          await auditLogger.warn('FORECAST_UPDATE_FAILED', {
            category: 'CLINICAL',
            error: forecastError.message,
          });
        }
      }

      await auditLogger.info('ML_LEARNING_FEEDBACK_SUBMITTED', {
        category: 'CLINICAL',
        feedbackType: feedback.feedback_type,
        unitId: feedback.unit_id,
        variance: feedback.variance,
      });

      return success({ ...feedback, id: 'feedback-recorded' });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to submit learning feedback', err);
    }
  },

  /**
   * Get prediction accuracy summary for ML dashboard
   */
  async getPredictionAccuracy(
    unitId: string,
    days: number = 30
  ): Promise<ServiceResult<PredictionAccuracySummary>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      const { data: forecasts, error } = await supabase
        .from('bed_availability_forecasts')
        .select('predicted_census, actual_census, forecast_error, error_percentage')
        .eq('unit_id', unitId)
        .gte('forecast_date', startDateStr)
        .not('actual_census', 'is', null);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const validForecasts = (forecasts || []).filter(
        (f) => f.predicted_census !== null && f.actual_census !== null
      );

      if (validForecasts.length === 0) {
        return success({
          unit_id: unitId,
          unit_name: '',
          prediction_type: 'census',
          total_predictions: 0,
          mean_error: 0,
          mean_absolute_error: 0,
          accuracy_percentage: 0,
          improving_trend: false,
          last_30_days_accuracy: 0,
          samples_for_improvement: 0,
        });
      }

      const errors = validForecasts.map(
        (f) => (f.actual_census ?? 0) - (f.predicted_census ?? 0)
      );
      const absErrors = errors.map(Math.abs);
      const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
      const mae = absErrors.reduce((a, b) => a + b, 0) / absErrors.length;

      // Calculate accuracy (100 - mean absolute percentage error)
      const mape =
        validForecasts.reduce((sum, f) => {
          const actual = f.actual_census ?? 0;
          if (actual === 0) return sum;
          return sum + Math.abs(((f.actual_census ?? 0) - (f.predicted_census ?? 0)) / actual) * 100;
        }, 0) / validForecasts.length;

      const accuracyPct = Math.max(0, 100 - mape);

      // Check if improving (compare first half vs second half)
      const mid = Math.floor(validForecasts.length / 2);
      const firstHalf = absErrors.slice(0, mid);
      const secondHalf = absErrors.slice(mid);
      const firstHalfMae = firstHalf.length > 0
        ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        : 0;
      const secondHalfMae = secondHalf.length > 0
        ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        : 0;
      const improving = secondHalfMae < firstHalfMae;

      return success({
        unit_id: unitId,
        unit_name: '',
        prediction_type: 'census',
        total_predictions: validForecasts.length,
        mean_error: Math.round(meanError * 100) / 100,
        mean_absolute_error: Math.round(mae * 100) / 100,
        accuracy_percentage: Math.round(accuracyPct * 10) / 10,
        improving_trend: improving,
        last_30_days_accuracy: Math.round(accuracyPct * 10) / 10,
        samples_for_improvement: validForecasts.length,
      });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to calculate prediction accuracy', err);
    }
  },

  /**
   * Update forecast with actual values for learning
   */
  async recordActualCensus(
    unitId: string,
    date: string,
    actualCensus: number,
    actualAvailable: number
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('bed_availability_forecasts')
        .update({
          actual_census: actualCensus,
          actual_available: actualAvailable,
          error_percentage: null, // Will be recalculated by generated column
        })
        .eq('unit_id', unitId)
        .eq('forecast_date', date);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('ACTUAL_CENSUS_RECORDED', {
        category: 'CLINICAL',
        unitId,
        date,
        actualCensus,
      });

      return success(undefined);
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to record actual census', err);
    }
  },

  /**
   * Get turnaround time analytics (dirty → available)
   */
  async getTurnaroundAnalytics(
    unitId: string,
    days: number = 7
  ): Promise<ServiceResult<{
    avgTurnaroundMinutes: number;
    totalTurnovers: number;
    byDayOfWeek: Record<number, number>;
    byHour: Record<number, number>;
  }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: history, error } = await supabase
        .from('bed_status_history')
        .select('previous_status, new_status, changed_at, duration_minutes')
        .eq('previous_status', 'dirty')
        .eq('new_status', 'available')
        .gte('changed_at', startDate.toISOString());

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const records = history || [];

      if (records.length === 0) {
        return success({
          avgTurnaroundMinutes: 0,
          totalTurnovers: 0,
          byDayOfWeek: {},
          byHour: {},
        });
      }

      const turnaroundTimes = records
        .filter((r) => r.duration_minutes !== null)
        .map((r) => r.duration_minutes ?? 0);

      const avg = turnaroundTimes.length > 0
        ? turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length
        : 0;

      const byDayOfWeek: Record<number, number[]> = {};
      const byHour: Record<number, number[]> = {};

      records.forEach((r) => {
        const date = new Date(r.changed_at);
        const dow = date.getDay();
        const hour = date.getHours();
        const dur = r.duration_minutes ?? 0;

        if (!byDayOfWeek[dow]) byDayOfWeek[dow] = [];
        byDayOfWeek[dow].push(dur);

        if (!byHour[hour]) byHour[hour] = [];
        byHour[hour].push(dur);
      });

      const avgByDow: Record<number, number> = {};
      Object.entries(byDayOfWeek).forEach(([dow, times]) => {
        avgByDow[parseInt(dow)] = times.reduce((a, b) => a + b, 0) / times.length;
      });

      const avgByHour: Record<number, number> = {};
      Object.entries(byHour).forEach(([hour, times]) => {
        avgByHour[parseInt(hour)] = times.reduce((a, b) => a + b, 0) / times.length;
      });

      return success({
        avgTurnaroundMinutes: Math.round(avg),
        totalTurnovers: records.length,
        byDayOfWeek: avgByDow,
        byHour: avgByHour,
      });
    } catch (err) {
      return failure('UNKNOWN_ERROR', 'Failed to get turnaround analytics', err);
    }
  },
};

export default BedManagementService;
