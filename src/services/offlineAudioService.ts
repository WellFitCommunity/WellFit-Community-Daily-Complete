// ============================================================================
// Offline Audio Service
// ============================================================================
// Provides resilient audio recording with local buffering and queue management
// for SmartScribe. Handles network interruptions gracefully.
//
// Features:
// - Local audio buffering using IndexedDB
// - Automatic queue management for failed uploads
// - Background sync when connection restored
// - Graceful degradation during network issues
// ============================================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { auditLogger } from './auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export interface AudioChunk {
  id: string;
  sessionId: string;
  providerId: string;
  patientId?: string;
  timestamp: number;
  data: ArrayBuffer;
  mimeType: string;
  duration: number; // milliseconds
  sequence: number;
  status: 'pending' | 'uploaded' | 'failed';
  retryCount: number;
  createdAt: string;
}

export interface OfflineSession {
  id: string;
  providerId: string;
  patientId?: string;
  startedAt: string;
  endedAt?: string;
  totalDuration: number;
  chunkCount: number;
  status: 'recording' | 'completed' | 'syncing' | 'synced' | 'failed';
  transcript?: string;
  syncAttempts: number;
  lastSyncAttempt?: string;
  error?: string;
}

export interface ConnectionStatus {
  online: boolean;
  websocketConnected: boolean;
  lastCheck: number;
  latencyMs?: number;
}

export interface OfflineServiceConfig {
  maxChunkSize: number; // bytes
  chunkDuration: number; // milliseconds
  maxRetries: number;
  retryDelayMs: number;
  maxOfflineStorageMB: number;
  autoSyncEnabled: boolean;
}

// ============================================================================
// INDEXEDDB SCHEMA
// ============================================================================

interface OfflineAudioDB extends DBSchema {
  'audio-chunks': {
    key: string;
    value: AudioChunk;
    indexes: {
      'by-session': string;
      'by-status': string;
      'by-timestamp': number;
    };
  };
  'offline-sessions': {
    key: string;
    value: OfflineSession;
    indexes: {
      'by-provider': string;
      'by-status': string;
    };
  };
  'sync-queue': {
    key: string;
    value: {
      id: string;
      sessionId: string;
      priority: number;
      createdAt: string;
    };
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: OfflineServiceConfig = {
  maxChunkSize: 256 * 1024, // 256KB per chunk
  chunkDuration: 5000, // 5 seconds per chunk
  maxRetries: 3,
  retryDelayMs: 5000,
  maxOfflineStorageMB: 500, // 500MB max storage
  autoSyncEnabled: true,
};

// ============================================================================
// OFFLINE AUDIO SERVICE CLASS
// ============================================================================

export class OfflineAudioService {
  private static instance: OfflineAudioService | null = null;
  private db: IDBPDatabase<OfflineAudioDB> | null = null;
  private config: OfflineServiceConfig;
  private connectionStatus: ConnectionStatus = {
    online: navigator.onLine,
    websocketConnected: false,
    lastCheck: Date.now(),
  };
  private syncInProgress = false;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  private constructor(config: Partial<OfflineServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupConnectionListeners();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<OfflineServiceConfig>): OfflineAudioService {
    if (!OfflineAudioService.instance) {
      OfflineAudioService.instance = new OfflineAudioService(config);
    }
    return OfflineAudioService.instance;
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB<OfflineAudioDB>('wellfit-offline-audio', 1, {
        upgrade(db) {
          // Audio chunks store
          if (!db.objectStoreNames.contains('audio-chunks')) {
            const chunksStore = db.createObjectStore('audio-chunks', { keyPath: 'id' });
            chunksStore.createIndex('by-session', 'sessionId');
            chunksStore.createIndex('by-status', 'status');
            chunksStore.createIndex('by-timestamp', 'timestamp');
          }

          // Offline sessions store
          if (!db.objectStoreNames.contains('offline-sessions')) {
            const sessionsStore = db.createObjectStore('offline-sessions', { keyPath: 'id' });
            sessionsStore.createIndex('by-provider', 'providerId');
            sessionsStore.createIndex('by-status', 'status');
          }

          // Sync queue store
          if (!db.objectStoreNames.contains('sync-queue')) {
            db.createObjectStore('sync-queue', { keyPath: 'id' });
          }
        },
      });

      auditLogger.info('OFFLINE_AUDIO_DB_INITIALIZED', {
        dbName: 'wellfit-offline-audio',
        version: 1,
      });

      // Start auto-sync if enabled
      if (this.config.autoSyncEnabled) {
        this.startAutoSync();
      }
    } catch (error) {
      auditLogger.error('OFFLINE_AUDIO_DB_INIT_FAILED', error instanceof Error ? error : new Error('DB init failed'));
      throw error;
    }
  }

  /**
   * Setup network connection listeners
   */
  private setupConnectionListeners(): void {
    window.addEventListener('online', () => {
      this.connectionStatus.online = true;
      this.connectionStatus.lastCheck = Date.now();
      this.emit('connection-change', this.connectionStatus);
      auditLogger.info('NETWORK_ONLINE', {});

      // Trigger sync when coming back online
      if (this.config.autoSyncEnabled) {
        this.syncPendingSessions();
      }
    });

    window.addEventListener('offline', () => {
      this.connectionStatus.online = false;
      this.connectionStatus.websocketConnected = false;
      this.connectionStatus.lastCheck = Date.now();
      this.emit('connection-change', this.connectionStatus);
      auditLogger.info('NETWORK_OFFLINE', {});
    });
  }

  /**
   * Start a new offline recording session
   */
  async startSession(providerId: string, patientId?: string): Promise<string> {
    await this.initialize();

    const sessionId = crypto.randomUUID();
    const session: OfflineSession = {
      id: sessionId,
      providerId,
      patientId,
      startedAt: new Date().toISOString(),
      totalDuration: 0,
      chunkCount: 0,
      status: 'recording',
      syncAttempts: 0,
    };

    await this.db!.put('offline-sessions', session);

    auditLogger.info('OFFLINE_SESSION_STARTED', {
      sessionId,
      providerId,
      hasPatient: !!patientId,
    });

    return sessionId;
  }

  /**
   * Save an audio chunk to local storage
   */
  async saveChunk(
    sessionId: string,
    data: ArrayBuffer,
    mimeType: string,
    duration: number
  ): Promise<string> {
    await this.initialize();

    // Check storage quota
    const usage = await this.getStorageUsage();
    if (usage.usedMB >= this.config.maxOfflineStorageMB) {
      await this.cleanupOldData();
    }

    const session = await this.db!.get('offline-sessions', sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const chunkId = crypto.randomUUID();
    const chunk: AudioChunk = {
      id: chunkId,
      sessionId,
      providerId: session.providerId,
      patientId: session.patientId,
      timestamp: Date.now(),
      data,
      mimeType,
      duration,
      sequence: session.chunkCount,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await this.db!.put('audio-chunks', chunk);

    // Update session
    session.chunkCount++;
    session.totalDuration += duration;
    await this.db!.put('offline-sessions', session);

    this.emit('chunk-saved', { sessionId, chunkId, sequence: chunk.sequence });

    return chunkId;
  }

  /**
   * End a recording session
   */
  async endSession(sessionId: string, transcript?: string): Promise<OfflineSession> {
    await this.initialize();

    const session = await this.db!.get('offline-sessions', sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.endedAt = new Date().toISOString();
    session.status = 'completed';
    session.transcript = transcript;

    await this.db!.put('offline-sessions', session);

    // Add to sync queue
    await this.addToSyncQueue(sessionId);

    auditLogger.info('OFFLINE_SESSION_ENDED', {
      sessionId,
      duration: session.totalDuration,
      chunkCount: session.chunkCount,
      hasTranscript: !!transcript,
    });

    // Trigger sync if online
    if (this.connectionStatus.online && this.config.autoSyncEnabled) {
      this.syncPendingSessions();
    }

    return session;
  }

  /**
   * Add session to sync queue
   */
  private async addToSyncQueue(sessionId: string, priority: number = 1): Promise<void> {
    await this.db!.put('sync-queue', {
      id: crypto.randomUUID(),
      sessionId,
      priority,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Sync pending sessions to server
   */
  async syncPendingSessions(): Promise<{ synced: number; failed: number }> {
    if (this.syncInProgress || !this.connectionStatus.online) {
      return { synced: 0, failed: 0 };
    }

    await this.initialize();
    this.syncInProgress = true;
    this.emit('sync-started', {});

    let synced = 0;
    let failed = 0;

    try {
      const sessions = await this.db!.getAllFromIndex(
        'offline-sessions',
        'by-status',
        'completed'
      );

      for (const session of sessions) {
        if (session.syncAttempts >= this.config.maxRetries) {
          session.status = 'failed';
          await this.db!.put('offline-sessions', session);
          failed++;
          continue;
        }

        try {
          session.status = 'syncing';
          session.syncAttempts++;
          session.lastSyncAttempt = new Date().toISOString();
          await this.db!.put('offline-sessions', session);

          // Get all chunks for this session
          const chunks = await this.db!.getAllFromIndex(
            'audio-chunks',
            'by-session',
            session.id
          );

          // Sort by sequence
          chunks.sort((a, b) => a.sequence - b.sequence);

          // Combine audio data
          const combinedAudio = this.combineAudioChunks(chunks);

          // Upload to server (implement actual upload logic)
          await this.uploadSession(session, combinedAudio);

          // Mark as synced
          session.status = 'synced';
          await this.db!.put('offline-sessions', session);

          // Mark chunks as uploaded
          for (const chunk of chunks) {
            chunk.status = 'uploaded';
            await this.db!.put('audio-chunks', chunk);
          }

          synced++;
          this.emit('session-synced', { sessionId: session.id });

          auditLogger.info('OFFLINE_SESSION_SYNCED', {
            sessionId: session.id,
            duration: session.totalDuration,
            chunkCount: session.chunkCount,
          });
        } catch (error) {
          session.status = 'completed'; // Reset to completed for retry
          session.error = error instanceof Error ? error.message : String(error);
          await this.db!.put('offline-sessions', session);

          auditLogger.error('OFFLINE_SESSION_SYNC_FAILED', error instanceof Error ? error : new Error('Sync failed'), {
            sessionId: session.id,
            attempt: session.syncAttempts,
          });
        }
      }
    } finally {
      this.syncInProgress = false;
      this.emit('sync-completed', { synced, failed });
    }

    return { synced, failed };
  }

  /**
   * Combine audio chunks into single ArrayBuffer
   */
  private combineAudioChunks(chunks: AudioChunk[]): ArrayBuffer {
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
    const combined = new Uint8Array(totalSize);

    let offset = 0;
    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk.data), offset);
      offset += chunk.data.byteLength;
    }

    return combined.buffer;
  }

  /**
   * Upload session to server
   */
  private async uploadSession(session: OfflineSession, audioData: ArrayBuffer): Promise<void> {
    // This would be implemented to upload to your transcription service
    // For now, we'll simulate the upload
    const formData = new FormData();
    formData.append('sessionId', session.id);
    formData.append('providerId', session.providerId);
    if (session.patientId) {
      formData.append('patientId', session.patientId);
    }
    formData.append('duration', session.totalDuration.toString());
    formData.append('audio', new Blob([audioData], { type: 'audio/webm' }));
    if (session.transcript) {
      formData.append('transcript', session.transcript);
    }

    // Actual upload would happen here
    // const response = await fetch('/api/upload-offline-session', {
    //   method: 'POST',
    //   body: formData,
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`Upload failed: ${response.status}`);
    // }

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Start automatic sync interval
   */
  private startAutoSync(): void {
    setInterval(() => {
      if (this.connectionStatus.online && !this.syncInProgress) {
        this.syncPendingSessions();
      }
    }, 60000); // Check every minute
  }

  /**
   * Get storage usage statistics
   */
  async getStorageUsage(): Promise<{
    usedMB: number;
    maxMB: number;
    percentUsed: number;
    chunkCount: number;
    sessionCount: number;
  }> {
    await this.initialize();

    const chunks = await this.db!.getAll('audio-chunks');
    const sessions = await this.db!.getAll('offline-sessions');

    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
    const usedMB = totalBytes / (1024 * 1024);

    return {
      usedMB: Math.round(usedMB * 100) / 100,
      maxMB: this.config.maxOfflineStorageMB,
      percentUsed: Math.round((usedMB / this.config.maxOfflineStorageMB) * 100),
      chunkCount: chunks.length,
      sessionCount: sessions.length,
    };
  }

  /**
   * Cleanup old synced data
   */
  async cleanupOldData(olderThanDays: number = 7): Promise<number> {
    await this.initialize();

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    // Delete old chunks
    const chunks = await this.db!.getAllFromIndex('audio-chunks', 'by-status', 'uploaded');
    for (const chunk of chunks) {
      if (chunk.timestamp < cutoffTime) {
        await this.db!.delete('audio-chunks', chunk.id);
        deletedCount++;
      }
    }

    // Delete old synced sessions
    const sessions = await this.db!.getAllFromIndex('offline-sessions', 'by-status', 'synced');
    for (const session of sessions) {
      const sessionTime = new Date(session.startedAt).getTime();
      if (sessionTime < cutoffTime) {
        await this.db!.delete('offline-sessions', session.id);
        deletedCount++;
      }
    }

    auditLogger.info('OFFLINE_DATA_CLEANUP', {
      deletedCount,
      olderThanDays,
    });

    return deletedCount;
  }

  /**
   * Get pending sessions count
   */
  async getPendingSessionsCount(): Promise<number> {
    await this.initialize();
    const sessions = await this.db!.getAllFromIndex('offline-sessions', 'by-status', 'completed');
    return sessions.length;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Update WebSocket connection status
   */
  setWebSocketConnected(connected: boolean): void {
    this.connectionStatus.websocketConnected = connected;
    this.connectionStatus.lastCheck = Date.now();
    this.emit('connection-change', this.connectionStatus);
  }

  /**
   * Event emitter methods
   */
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        auditLogger.error('OFFLINE_EVENT_HANDLER_ERROR', error instanceof Error ? error : new Error('Event handler error'), {
          event,
        });
      }
    });
  }

  /**
   * Export session data for debugging
   */
  async exportSessionData(sessionId: string): Promise<{
    session: OfflineSession | undefined;
    chunks: AudioChunk[];
  }> {
    await this.initialize();

    const session = await this.db!.get('offline-sessions', sessionId);
    const chunks = await this.db!.getAllFromIndex('audio-chunks', 'by-session', sessionId);

    return {
      session,
      chunks: chunks.map(c => ({ ...c, data: new ArrayBuffer(0) })), // Don't export actual audio data
    };
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get the singleton offline audio service instance
 */
export function getOfflineAudioService(config?: Partial<OfflineServiceConfig>): OfflineAudioService {
  return OfflineAudioService.getInstance(config);
}

/**
 * Check if offline mode is needed
 */
export function isOfflineModeNeeded(): boolean {
  return !navigator.onLine;
}

/**
 * Get current network status
 */
export function getNetworkStatus(): { online: boolean; effectiveType?: string } {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,
  };
}
