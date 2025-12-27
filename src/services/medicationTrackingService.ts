/**
 * Medication Tracking Service
 *
 * Comprehensive medication adherence tracking system:
 * - Medication management (CRUD)
 * - Reminder scheduling
 * - Dose logging and adherence tracking
 * - Refill management
 * - Integration with notification service
 *
 * Database Tables:
 * - medications: Core medication information
 * - medication_reminders: Reminder schedules
 * - medication_doses_taken: Dose tracking
 * - medication_image_extractions: AI label scanning
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { getNotificationService } from './notificationService';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';

/**
 * Medication record
 */
export interface Medication {
  id: string;
  user_id: string;
  medication_name: string;
  generic_name?: string;
  brand_name?: string;
  dosage?: string;
  dosage_form?: string;
  strength?: string;
  instructions?: string;
  frequency?: string;
  route?: string;
  prescribed_by?: string;
  prescribed_date?: string;
  prescription_number?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  quantity?: number;
  refills_remaining?: number;
  last_refill_date?: string;
  next_refill_date?: string;
  ndc_code?: string;
  purpose?: string;
  side_effects?: string[];
  warnings?: string[];
  interactions?: string[];
  status: 'active' | 'discontinued' | 'completed';
  discontinued_date?: string;
  discontinued_reason?: string;
  ai_confidence?: number;
  extraction_notes?: string;
  needs_review?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Medication reminder schedule
 */
export interface MedicationReminder {
  id: string;
  medication_id: string;
  user_id: string;
  time_of_day: string; // HH:MM format
  days_of_week: number[]; // 0=Sunday, 6=Saturday
  enabled: boolean;
  notification_method: 'push' | 'sms' | 'email' | 'all';
  last_reminded_at?: string;
  next_reminder_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Dose taken record
 */
export interface DoseTaken {
  id: string;
  medication_id: string;
  user_id: string;
  reminder_id?: string;
  taken_at: string;
  scheduled_time?: string;
  dose_amount?: string;
  status: 'taken' | 'missed' | 'skipped';
  skip_reason?: string;
  notes?: string;
  side_effects_noted?: string[];
  created_at: string;
}

/**
 * Adherence statistics
 */
export interface AdherenceStats {
  medication_id: string;
  medication_name: string;
  total_scheduled: number;
  total_taken: number;
  adherence_rate: number;
}

/**
 * Upcoming reminder
 */
export interface UpcomingReminder {
  reminder_id: string;
  medication_id: string;
  medication_name: string;
  dosage?: string;
  instructions?: string;
  next_reminder_at: string;
  time_of_day: string;
}

/**
 * Medication create input
 */
export interface CreateMedicationInput {
  medication_name: string;
  generic_name?: string;
  brand_name?: string;
  dosage?: string;
  dosage_form?: string;
  strength?: string;
  instructions?: string;
  frequency?: string;
  route?: string;
  prescribed_by?: string;
  prescribed_date?: string;
  prescription_number?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  quantity?: number;
  refills_remaining?: number;
  next_refill_date?: string;
  ndc_code?: string;
  purpose?: string;
  side_effects?: string[];
  warnings?: string[];
  interactions?: string[];
}

/**
 * Medication Tracking Service
 */
export class MedicationTrackingService {
  // ============================================================================
  // MEDICATION CRUD
  // ============================================================================

  /**
   * Get all active medications for a user
   */
  async getActiveMedications(userId: string): Promise<ServiceResult<Medication[]>> {
    try {
      const { data, error } = await supabase.rpc('get_active_medications', {
        user_id_param: userId,
      });

      if (error) {
        await auditLogger.error('GET_MEDICATIONS_FAILED', error.message, { userId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await auditLogger.error('GET_MEDICATIONS_ERROR', errorMessage, { userId });
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Get a single medication by ID
   */
  async getMedication(medicationId: string, userId: string): Promise<ServiceResult<Medication>> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('id', medicationId)
        .eq('user_id', userId)
        .single();

      if (error) {
        await auditLogger.error('GET_MEDICATION_FAILED', error.message, { medicationId, userId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      if (!data) {
        return failure('NOT_FOUND', 'Medication not found');
      }

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Create a new medication
   */
  async createMedication(
    userId: string,
    input: CreateMedicationInput
  ): Promise<ServiceResult<Medication>> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .insert({
          user_id: userId,
          ...input,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('CREATE_MEDICATION_FAILED', error.message, {
          userId,
          medicationName: input.medication_name,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('MEDICATION_CREATED', {
        userId,
        medicationId: data.id,
        medicationName: input.medication_name,
      });

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Update a medication
   */
  async updateMedication(
    medicationId: string,
    userId: string,
    updates: Partial<CreateMedicationInput>
  ): Promise<ServiceResult<Medication>> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .update(updates)
        .eq('id', medicationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('UPDATE_MEDICATION_FAILED', error.message, {
          medicationId,
          userId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('MEDICATION_UPDATED', {
        medicationId,
        userId,
        updatedFields: Object.keys(updates),
      });

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Discontinue a medication
   */
  async discontinueMedication(
    medicationId: string,
    userId: string,
    reason: string
  ): Promise<ServiceResult<Medication>> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .update({
          status: 'discontinued',
          discontinued_date: new Date().toISOString().split('T')[0],
          discontinued_reason: reason,
        })
        .eq('id', medicationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('DISCONTINUE_MEDICATION_FAILED', error.message, {
          medicationId,
          userId,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      // Disable all reminders for this medication
      await supabase
        .from('medication_reminders')
        .update({ enabled: false })
        .eq('medication_id', medicationId)
        .eq('user_id', userId);

      await auditLogger.info('MEDICATION_DISCONTINUED', {
        medicationId,
        userId,
        reason,
      });

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  // ============================================================================
  // REMINDER MANAGEMENT
  // ============================================================================

  /**
   * Get reminders for a medication
   */
  async getReminders(medicationId: string, userId: string): Promise<ServiceResult<MedicationReminder[]>> {
    try {
      const { data, error } = await supabase
        .from('medication_reminders')
        .select('*')
        .eq('medication_id', medicationId)
        .eq('user_id', userId)
        .order('time_of_day', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Create a reminder for a medication
   */
  async createReminder(
    medicationId: string,
    userId: string,
    timeOfDay: string,
    daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6],
    notificationMethod: 'push' | 'sms' | 'email' | 'all' = 'push'
  ): Promise<ServiceResult<MedicationReminder>> {
    try {
      const { data, error } = await supabase
        .from('medication_reminders')
        .insert({
          medication_id: medicationId,
          user_id: userId,
          time_of_day: timeOfDay,
          days_of_week: daysOfWeek,
          notification_method: notificationMethod,
          enabled: true,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('CREATE_REMINDER_FAILED', error.message, {
          medicationId,
          userId,
          timeOfDay,
        });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('MEDICATION_REMINDER_CREATED', {
        medicationId,
        userId,
        reminderId: data.id,
        timeOfDay,
      });

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Update a reminder
   */
  async updateReminder(
    reminderId: string,
    userId: string,
    updates: Partial<{
      time_of_day: string;
      days_of_week: number[];
      enabled: boolean;
      notification_method: 'push' | 'sms' | 'email' | 'all';
    }>
  ): Promise<ServiceResult<MedicationReminder>> {
    try {
      const { data, error } = await supabase
        .from('medication_reminders')
        .update(updates)
        .eq('id', reminderId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(reminderId: string, userId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('medication_reminders')
        .delete()
        .eq('id', reminderId)
        .eq('user_id', userId);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(undefined);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Get upcoming reminders for a user
   */
  async getUpcomingReminders(
    userId: string,
    hoursAhead: number = 24
  ): Promise<ServiceResult<UpcomingReminder[]>> {
    try {
      const { data, error } = await supabase.rpc('get_upcoming_reminders', {
        user_id_param: userId,
        hours_ahead: hoursAhead,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  // ============================================================================
  // DOSE TRACKING
  // ============================================================================

  /**
   * Log a dose as taken
   */
  async logDoseTaken(
    medicationId: string,
    userId: string,
    options?: {
      reminderId?: string;
      scheduledTime?: string;
      doseAmount?: string;
      notes?: string;
      sideEffects?: string[];
    }
  ): Promise<ServiceResult<DoseTaken>> {
    try {
      const { data, error } = await supabase
        .from('medication_doses_taken')
        .insert({
          medication_id: medicationId,
          user_id: userId,
          reminder_id: options?.reminderId,
          scheduled_time: options?.scheduledTime,
          dose_amount: options?.doseAmount,
          status: 'taken',
          notes: options?.notes,
          side_effects_noted: options?.sideEffects,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LOG_DOSE_FAILED', error.message, { medicationId, userId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      // Update last reminded time if reminder was provided
      if (options?.reminderId) {
        await supabase
          .from('medication_reminders')
          .update({ last_reminded_at: new Date().toISOString() })
          .eq('id', options.reminderId);
      }

      await auditLogger.info('DOSE_TAKEN', {
        medicationId,
        userId,
        doseId: data.id,
      });

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Log a dose as missed
   */
  async logDoseMissed(
    medicationId: string,
    userId: string,
    scheduledTime: string,
    reminderId?: string
  ): Promise<ServiceResult<DoseTaken>> {
    try {
      const { data, error } = await supabase
        .from('medication_doses_taken')
        .insert({
          medication_id: medicationId,
          user_id: userId,
          reminder_id: reminderId,
          scheduled_time: scheduledTime,
          status: 'missed',
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.warn('DOSE_MISSED', {
        medicationId,
        userId,
        scheduledTime,
      });

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Log a dose as skipped
   */
  async logDoseSkipped(
    medicationId: string,
    userId: string,
    reason: string,
    scheduledTime?: string,
    reminderId?: string
  ): Promise<ServiceResult<DoseTaken>> {
    try {
      const { data, error } = await supabase
        .from('medication_doses_taken')
        .insert({
          medication_id: medicationId,
          user_id: userId,
          reminder_id: reminderId,
          scheduled_time: scheduledTime,
          status: 'skipped',
          skip_reason: reason,
        })
        .select()
        .single();

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('DOSE_SKIPPED', {
        medicationId,
        userId,
        reason,
      });

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Get dose history for a medication
   */
  async getDoseHistory(
    medicationId: string,
    userId: string,
    limit: number = 30
  ): Promise<ServiceResult<DoseTaken[]>> {
    try {
      const { data, error } = await supabase
        .from('medication_doses_taken')
        .select('*')
        .eq('medication_id', medicationId)
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  // ============================================================================
  // ADHERENCE TRACKING
  // ============================================================================

  /**
   * Get adherence statistics for a user
   */
  async getAdherenceStats(
    userId: string,
    daysBack: number = 30
  ): Promise<ServiceResult<AdherenceStats[]>> {
    try {
      const { data, error } = await supabase.rpc('get_medication_adherence_rate', {
        user_id_param: userId,
        days_back: daysBack,
      });

      if (error) {
        await auditLogger.error('GET_ADHERENCE_STATS_FAILED', error.message, { userId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Get overall adherence rate for a user
   */
  async getOverallAdherenceRate(
    userId: string,
    daysBack: number = 30
  ): Promise<ServiceResult<number>> {
    const result = await this.getAdherenceStats(userId, daysBack);
    if (!result.success) {
      return failure(result.error.code, result.error.message, result.error.details);
    }

    const stats = result.data;
    if (stats.length === 0) {
      return success(100); // No medications = 100% adherence
    }

    const totalScheduled = stats.reduce((sum, s) => sum + s.total_scheduled, 0);
    const totalTaken = stats.reduce((sum, s) => sum + s.total_taken, 0);

    if (totalScheduled === 0) {
      return success(100);
    }

    const rate = (totalTaken / totalScheduled) * 100;
    return success(Math.round(rate * 100) / 100);
  }

  // ============================================================================
  // REFILL MANAGEMENT
  // ============================================================================

  /**
   * Get medications needing refill soon
   */
  async getMedicationsNeedingRefill(
    userId: string,
    daysThreshold: number = 7
  ): Promise<ServiceResult<Medication[]>> {
    try {
      const { data, error } = await supabase.rpc('get_medications_needing_refill', {
        user_id_param: userId,
        days_threshold: daysThreshold,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  /**
   * Record a refill
   */
  async recordRefill(
    medicationId: string,
    userId: string,
    refillDetails: {
      quantity: number;
      refillsRemaining?: number;
      nextRefillDate?: string;
    }
  ): Promise<ServiceResult<Medication>> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .update({
          quantity: refillDetails.quantity,
          refills_remaining: refillDetails.refillsRemaining,
          last_refill_date: new Date().toISOString().split('T')[0],
          next_refill_date: refillDetails.nextRefillDate,
        })
        .eq('id', medicationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        await auditLogger.error('RECORD_REFILL_FAILED', error.message, { medicationId, userId });
        return failure('DATABASE_ERROR', error.message, error);
      }

      await auditLogger.info('MEDICATION_REFILLED', {
        medicationId,
        userId,
        quantity: refillDetails.quantity,
      });

      return success(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return failure('UNKNOWN_ERROR', errorMessage, err);
    }
  }

  // ============================================================================
  // NOTIFICATION INTEGRATION
  // ============================================================================

  /**
   * Send medication reminder notification
   */
  async sendReminderNotification(
    userId: string,
    medication: Medication,
    scheduledTime: string
  ): Promise<void> {
    const notificationService = getNotificationService();

    await notificationService.sendMedicationReminder(
      { userId },
      {
        medicationName: medication.medication_name,
        dosage: medication.dosage || 'As prescribed',
        scheduledTime,
        instructions: medication.instructions,
      }
    );

    await auditLogger.info('MEDICATION_REMINDER_SENT', {
      userId,
      medicationId: medication.id,
      medicationName: medication.medication_name,
    });
  }

  /**
   * Send refill reminder notification
   */
  async sendRefillReminder(userId: string, medication: Medication): Promise<void> {
    const notificationService = getNotificationService();

    await notificationService.send({
      title: `Refill Reminder: ${medication.medication_name}`,
      body: `Your prescription for ${medication.medication_name} needs to be refilled soon. ${
        medication.refills_remaining !== undefined
          ? `Refills remaining: ${medication.refills_remaining}`
          : ''
      }`,
      category: 'medication',
      priority: 'high',
      target: { userId },
      data: {
        medicationId: medication.id,
        medicationName: medication.medication_name,
        nextRefillDate: medication.next_refill_date,
        pharmacy: medication.pharmacy_name,
        pharmacyPhone: medication.pharmacy_phone,
      },
    });

    await auditLogger.info('REFILL_REMINDER_SENT', {
      userId,
      medicationId: medication.id,
      medicationName: medication.medication_name,
    });
  }

  /**
   * Check and send all due reminders (called by scheduler)
   */
  async processDueReminders(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Get all due reminders
      const { data: dueReminders, error } = await supabase
        .from('medication_reminders')
        .select(
          `
          *,
          medication:medications(*)
        `
        )
        .eq('enabled', true)
        .lte('next_reminder_at', new Date().toISOString());

      if (error) {
        await auditLogger.error('PROCESS_REMINDERS_FAILED', error.message);
        return { processed: 0, errors: 1 };
      }

      for (const reminder of dueReminders || []) {
        try {
          const medication = reminder.medication as Medication;
          if (!medication || medication.status !== 'active') {
            continue;
          }

          await this.sendReminderNotification(
            reminder.user_id,
            medication,
            reminder.time_of_day
          );

          processed++;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          await auditLogger.error('REMINDER_NOTIFICATION_FAILED', errorMessage, {
            reminderId: reminder.id,
          });
          errors++;
        }
      }

      return { processed, errors };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await auditLogger.error('PROCESS_REMINDERS_ERROR', errorMessage);
      return { processed, errors: errors + 1 };
    }
  }
}

/**
 * Global medication tracking service instance
 */
let globalMedicationService: MedicationTrackingService | null = null;

export function getMedicationTrackingService(): MedicationTrackingService {
  if (!globalMedicationService) {
    globalMedicationService = new MedicationTrackingService();
  }
  return globalMedicationService;
}
