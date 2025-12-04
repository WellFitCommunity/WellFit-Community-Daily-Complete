/**
 * Guardian Eyes - Visual Session Recorder
 *
 * Uses rrweb to capture actual visual recordings of what happens
 * when Guardian Agent detects and fixes issues.
 *
 * Workflow:
 * 1. Guardian Agent detects issue → triggers startRecording()
 * 2. Guardian Agent fixes issue → triggers stopRecording()
 * 3. Recording saved to Supabase Storage
 * 4. SOC staff can approve fix in dashboard
 * 5. Anyone can watch the recording later to review what happened
 * 6. After 7-10 days → auto-deleted (unless "Save Forever" clicked)
 */

import * as rrweb from 'rrweb';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

// Define types locally to avoid import issues
type EventWithTime = {
  type: number;
  data: unknown;
  timestamp: number;
};

export interface GuardianEyesSession {
  sessionId: string;
  triggerType: 'security_vulnerability' | 'phi_exposure' | 'memory_leak' | 'api_failure' | 'healing_operation' | 'manual' | 'system_health';
  triggerAlertId?: string;
  triggerDescription: string;
  startedAt: Date;
  endedAt?: Date;
  events: EventWithTime[];
  userId?: string;
  tenantId?: string;
}

export interface RecordingMetadata {
  sessionId: string;
  storagePath: string;
  durationSeconds: number;
  eventCount: number;
  triggerType: string;
  triggerAlertId?: string;
  triggerDescription: string;
}

class GuardianEyesRecorderClass {
  private currentSession: GuardianEyesSession | null = null;
  private stopFn: (() => void) | null = null;
  private isRecording = false;
  private maxRecordingDuration = 5 * 60 * 1000; // 5 minutes max
  private recordingTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Start recording when Guardian Agent detects an issue
   * Called automatically - no manual trigger needed
   */
  async startRecording(params: {
    triggerType: GuardianEyesSession['triggerType'];
    triggerAlertId?: string;
    triggerDescription: string;
    userId?: string;
    tenantId?: string;
  }): Promise<string> {
    // Don't start if already recording
    if (this.isRecording) {
      await auditLogger.info('GUARDIAN_EYES_ALREADY_RECORDING', {
        currentSession: this.currentSession?.sessionId,
        newTrigger: params.triggerType,
      });
      return this.currentSession?.sessionId || '';
    }

    const sessionId = `ge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.currentSession = {
      sessionId,
      triggerType: params.triggerType,
      triggerAlertId: params.triggerAlertId,
      triggerDescription: params.triggerDescription,
      startedAt: new Date(),
      events: [],
      userId: params.userId,
      tenantId: params.tenantId,
    };

    this.isRecording = true;

    // Start rrweb recording
    const stopFn = rrweb.record({
      emit: (event) => {
        if (this.currentSession) {
          this.currentSession.events.push(event as EventWithTime);
        }
      },
      // Privacy settings - mask sensitive inputs
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        // Mask fields that might contain PHI
        text: false,
        textarea: false,
      },
      // Block recording of elements with these selectors (PHI protection)
      blockSelector: '.phi-data, .sensitive-data, [data-phi], [data-sensitive]',
      // Mask text in elements with these selectors
      maskTextSelector: '.mask-text, .patient-name, .ssn, .mrn',
      // Capture canvas content
      recordCanvas: false,
      // Sample mousemove to reduce size
      sampling: {
        mousemove: true,
        mouseInteraction: true,
        scroll: 150,
        input: 'last',
      },
    });

    this.stopFn = stopFn || null;

    // Set max recording duration to prevent runaway recordings
    this.recordingTimeout = setTimeout(() => {
      if (this.isRecording) {
        auditLogger.warn('GUARDIAN_EYES_MAX_DURATION', {
          sessionId,
          maxDuration: this.maxRecordingDuration,
        });
        this.stopRecording('Max recording duration reached');
      }
    }, this.maxRecordingDuration);

    await auditLogger.info('GUARDIAN_EYES_RECORDING_STARTED', {
      sessionId,
      triggerType: params.triggerType,
      triggerAlertId: params.triggerAlertId,
    });

    return sessionId;
  }

  /**
   * Stop recording and save to Supabase Storage
   * Called when Guardian Agent finishes fixing the issue
   */
  async stopRecording(reason?: string): Promise<RecordingMetadata | null> {
    if (!this.isRecording || !this.currentSession) {
      return null;
    }

    // Stop rrweb recording
    if (this.stopFn) {
      this.stopFn();
      this.stopFn = null;
    }

    // Clear timeout
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    this.isRecording = false;
    this.currentSession.endedAt = new Date();

    const session = this.currentSession;
    const endTime = session.endedAt || new Date();
    const durationSeconds = Math.round(
      (endTime.getTime() - session.startedAt.getTime()) / 1000
    );

    try {
      // Compress and save recording
      const metadata = await this.saveRecording(session, durationSeconds);

      await auditLogger.info('GUARDIAN_EYES_RECORDING_SAVED', {
        sessionId: session.sessionId,
        durationSeconds,
        eventCount: session.events.length,
        storagePath: metadata.storagePath,
        reason,
      });

      this.currentSession = null;
      return metadata;
    } catch (error) {
      await auditLogger.error(
        'GUARDIAN_EYES_SAVE_FAILED',
        error instanceof Error ? error : new Error(String(error)),
        { sessionId: session.sessionId }
      );
      this.currentSession = null;
      return null;
    }
  }

  /**
   * Save recording to Supabase Storage and create metadata record
   */
  private async saveRecording(
    session: GuardianEyesSession,
    durationSeconds: number
  ): Promise<RecordingMetadata> {
    const storagePath = `recordings/${session.triggerType}/${session.sessionId}.json`;

    // Prepare recording data
    const recordingData = {
      sessionId: session.sessionId,
      events: session.events,
      metadata: {
        triggerType: session.triggerType,
        triggerAlertId: session.triggerAlertId,
        triggerDescription: session.triggerDescription,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString(),
        durationSeconds,
        eventCount: session.events.length,
      },
    };

    const jsonData = JSON.stringify(recordingData);
    const blob = new Blob([jsonData], { type: 'application/json' });

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('guardian-eyes-recordings')
      .upload(storagePath, blob, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Create metadata record in database
    const { error: dbError } = await supabase
      .from('guardian_eyes_sessions')
      .insert({
        session_id: session.sessionId,
        recording_started_at: session.startedAt.toISOString(),
        recording_ended_at: session.endedAt?.toISOString(),
        trigger_type: session.triggerType,
        trigger_alert_id: session.triggerAlertId,
        trigger_description: session.triggerDescription,
        storage_path: storagePath,
        storage_size_bytes: blob.size,
        is_compressed: false,
        duration_seconds: durationSeconds,
        event_count: session.events.length,
        user_id: session.userId,
        tenant_id: session.tenantId,
        retention_type: 'standard', // Default: auto-delete after 10 days
      });

    if (dbError) {
      // Try to clean up storage if db insert fails
      await supabase.storage.from('guardian-eyes-recordings').remove([storagePath]);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    return {
      sessionId: session.sessionId,
      storagePath,
      durationSeconds,
      eventCount: session.events.length,
      triggerType: session.triggerType,
      triggerAlertId: session.triggerAlertId,
      triggerDescription: session.triggerDescription,
    };
  }

  /**
   * Get recording status
   */
  getStatus(): {
    isRecording: boolean;
    sessionId?: string;
    eventCount?: number;
    durationSeconds?: number;
  } {
    if (!this.isRecording || !this.currentSession) {
      return { isRecording: false };
    }

    const durationSeconds = Math.round(
      (Date.now() - this.currentSession.startedAt.getTime()) / 1000
    );

    return {
      isRecording: true,
      sessionId: this.currentSession.sessionId,
      eventCount: this.currentSession.events.length,
      durationSeconds,
    };
  }

  /**
   * Load a recording from storage for playback
   */
  async loadRecording(sessionId: string): Promise<{
    events: EventWithTime[];
    metadata: RecordingMetadata;
  } | null> {
    try {
      // Get metadata from database
      const { data: sessionData, error: dbError } = await supabase
        .from('guardian_eyes_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (dbError || !sessionData) {
        await auditLogger.warn('GUARDIAN_EYES_SESSION_NOT_FOUND', { sessionId });
        return null;
      }

      // Download recording from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('guardian-eyes-recordings')
        .download(sessionData.storage_path);

      if (downloadError || !fileData) {
        await auditLogger.error(
          'GUARDIAN_EYES_DOWNLOAD_FAILED',
          new Error(downloadError?.message || 'No data returned'),
          { sessionId, storagePath: sessionData.storage_path }
        );
        return null;
      }

      const text = await fileData.text();
      const recordingData = JSON.parse(text);

      return {
        events: recordingData.events,
        metadata: {
          sessionId: sessionData.session_id,
          storagePath: sessionData.storage_path,
          durationSeconds: sessionData.duration_seconds,
          eventCount: sessionData.event_count,
          triggerType: sessionData.trigger_type,
          triggerAlertId: sessionData.trigger_alert_id,
          triggerDescription: sessionData.trigger_description,
        },
      };
    } catch (error) {
      await auditLogger.error(
        'GUARDIAN_EYES_LOAD_FAILED',
        error instanceof Error ? error : new Error(String(error)),
        { sessionId }
      );
      return null;
    }
  }

  /**
   * Extend recording retention to 30 days (called from UI "Save for 30 Days" button)
   * Use this for recordings that need more review time but don't need to be kept forever
   */
  async saveFor30Days(sessionId: string, reason: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('extend_recording_retention', {
      p_session_id: sessionId,
      p_reason: reason,
    });

    if (error) {
      await auditLogger.error(
        'GUARDIAN_EYES_EXTEND_RETENTION_FAILED',
        new Error(error.message),
        { sessionId, reason }
      );
      return false;
    }

    await auditLogger.info('GUARDIAN_EYES_RETENTION_EXTENDED', {
      sessionId,
      reason,
      newRetention: '30 days',
    });

    return data === true;
  }

  /**
   * Mark recording as reviewed
   */
  async markReviewed(sessionId: string, notes?: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('mark_recording_reviewed', {
      p_session_id: sessionId,
      p_notes: notes,
    });

    if (error) {
      await auditLogger.error(
        'GUARDIAN_EYES_MARK_REVIEWED_FAILED',
        new Error(error.message),
        { sessionId }
      );
      return false;
    }

    return data === true;
  }

  /**
   * Get recordings pending review
   */
  async getPendingRecordings(limit = 20): Promise<RecordingMetadata[]> {
    const { data, error } = await supabase.rpc('get_pending_recordings', {
      p_limit: limit,
    });

    if (error) {
      await auditLogger.error(
        'GUARDIAN_EYES_GET_PENDING_FAILED',
        new Error(error.message)
      );
      return [];
    }

    return (data || []).map((row: any) => ({
      sessionId: row.session_id,
      storagePath: row.storage_path,
      durationSeconds: row.duration_seconds,
      eventCount: 0, // Not returned by RPC
      triggerType: row.trigger_type,
      triggerAlertId: row.trigger_alert_id,
      triggerDescription: row.trigger_description,
    }));
  }

  /**
   * Get signed URL for downloading recording (for playback)
   */
  async getRecordingUrl(storagePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('guardian-eyes-recordings')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) {
      return null;
    }

    return data.signedUrl;
  }
}

// Global singleton instance
export const guardianEyesRecorder = new GuardianEyesRecorderClass();

// Export class for testing
export { GuardianEyesRecorderClass };
