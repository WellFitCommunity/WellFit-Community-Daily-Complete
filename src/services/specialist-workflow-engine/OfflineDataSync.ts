/**
 * Offline Data Sync Manager
 * Handles offline data capture and synchronization for rural areas with poor connectivity
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

// Background sync tag for Envision Atlus specialist workflows
const SYNC_TAG_SPECIALIST = 'sync-specialist-data';

/**
 * Base interface for all offline-stored records
 */
interface OfflineRecord {
  id: string;
  synced: boolean;
  timestamp: number;
  offline_captured: boolean;
  synced_at?: number;
}

/**
 * Field visit record stored offline
 */
export interface OfflineVisit extends OfflineRecord {
  patient_id: string;
  specialist_id: string;
  visit_type: string;
  scheduled_date: string;
  status: string;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

/**
 * Assessment record stored offline
 */
export interface OfflineAssessment extends OfflineRecord {
  visit_id: string;
  assessment_type: string;
  findings: Record<string, unknown>;
  recommendations?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Photo record stored offline
 */
export interface OfflinePhoto extends OfflineRecord {
  visit_id: string;
  data: string | Blob;
  type?: string;
  contentType?: string;
  description?: string;
}

/**
 * Alert record stored offline
 */
export interface OfflineAlert extends OfflineRecord {
  visit_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  acknowledged: boolean;
}

/**
 * Union type for all offline record types
 */
type OfflineData = OfflineVisit | OfflineAssessment | OfflinePhoto | OfflineAlert;

/**
 * Input data type (before offline enrichment)
 * Accepts any object at the system boundary; id is validated at runtime
 * This is intentionally permissive as existing code passes various typed objects
 *
 * NOTE: Using object type here as a system boundary cast - the runtime validation
 * ensures the id property exists before storing to IndexedDB
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OfflineInputData = { id?: string } & Record<string, any>;

export class OfflineDataSync {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'WellFitSpecialistOffline';
  private readonly DB_VERSION = 1;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes IndexedDB for offline storage
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores for offline data
        if (!db.objectStoreNames.contains('visits')) {
          const visitStore = db.createObjectStore('visits', { keyPath: 'id' });
          visitStore.createIndex('synced', 'synced', { unique: false });
          visitStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('assessments')) {
          const assessmentStore = db.createObjectStore('assessments', { keyPath: 'id' });
          assessmentStore.createIndex('visit_id', 'visit_id', { unique: false });
          assessmentStore.createIndex('synced', 'synced', { unique: false });
        }

        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
          photoStore.createIndex('visit_id', 'visit_id', { unique: false });
          photoStore.createIndex('synced', 'synced', { unique: false });
        }

        if (!db.objectStoreNames.contains('alerts')) {
          const alertStore = db.createObjectStore('alerts', { keyPath: 'id' });
          alertStore.createIndex('visit_id', 'visit_id', { unique: false });
          alertStore.createIndex('synced', 'synced', { unique: false });
        }


      };
    });
  }

  /**
   * Saves data offline with background sync registration
   * @param storeName - The IndexedDB store to write to
   * @param data - Data object with required 'id' field; structure varies by store type
   */
  async saveOffline(
    storeName: 'visits' | 'assessments' | 'photos' | 'alerts',
    data: OfflineInputData
  ): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    // Validate id exists at runtime (required for IndexedDB keyPath)
    if (typeof data.id !== 'string' || !data.id) {
      throw new Error('Data must have a valid string id property');
    }

    // Enrich with sync metadata at system boundary
    const enrichedData = {
      ...data,
      synced: false,
      timestamp: Date.now(),
      offline_captured: true
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction([storeName], 'readwrite');
      if (!transaction) {
        reject(new Error('Database transaction failed'));
        return;
      }
      const store = transaction.objectStore(storeName);
      const request = store.put(enrichedData);

      request.onsuccess = () => {
        // Register for background sync so data syncs even if tab closes
        void this.triggerBackgroundSync();
        auditLogger.info('Specialist data saved offline', {
          storeName,
          recordId: data.id
        });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Trigger background sync registration for specialist data
   */
  private async triggerBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      if ('sync' in registration) {
        const syncManager = registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        };
        await syncManager.sync.register(SYNC_TAG_SPECIALIST);
      }
    } catch (err: unknown) {
      // Background Sync registration failed - not critical
      auditLogger.warn('Background sync registration failed', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * Gets all unsynced data from a store
   */
  async getUnsynced<T extends OfflineData = OfflineData>(
    storeName: 'visits' | 'assessments' | 'photos' | 'alerts'
  ): Promise<T[]> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction([storeName], 'readonly');
      if (!transaction) {
        reject(new Error('Database transaction failed'));
        return;
      }
      const store = transaction.objectStore(storeName);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(0)); // 0 = false/unsynced

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Marks data as synced
   */
  async markAsSynced(
    storeName: 'visits' | 'assessments' | 'photos' | 'alerts',
    id: string
  ): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction([storeName], 'readwrite');
      if (!transaction) {
        reject(new Error('Database transaction failed'));
        return;
      }
      const store = transaction.objectStore(storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.synced = true;
          data.synced_at = Date.now();
          const updateRequest = store.put(data);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Starts automatic sync when connection is available
   */
  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        await this.syncAll();
      }
    }, intervalMs);

    // Also sync on network reconnection
    window.addEventListener('online', () => {

      this.syncAll();
    });


  }

  /**
   * Stops automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;

    }
  }

  /**
   * Syncs all pending data to server
   */
  async syncAll(): Promise<{
    visits: number;
    assessments: number;
    photos: number;
    alerts: number;
    errors: string[];
  }> {
    const result = {
      visits: 0,
      assessments: 0,
      photos: 0,
      alerts: 0,
      errors: [] as string[]
    };

    try {
      // Sync visits first (they're parents)
      result.visits = await this.syncStore('visits', 'field_visits');

      // Then assessments
      result.assessments = await this.syncStore('assessments', 'specialist_assessments');

      // Then photos
      result.photos = await this.syncPhotos();

      // Finally alerts
      result.alerts = await this.syncStore('alerts', 'specialist_alerts');


    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMsg);

    }

    return result;
  }

  /**
   * Syncs a specific store to a Supabase table
   */
  private async syncStore(
    storeName: 'visits' | 'assessments' | 'alerts',
    tableName: string
  ): Promise<number> {
    const unsynced = await this.getUnsynced(storeName);
    let syncedCount = 0;

    for (const item of unsynced) {
      try {
        // Remove IndexedDB-specific fields
        const { synced, timestamp, offline_captured, ...cleanData } = item;

        // Upsert to Supabase
        const { error } = await supabase
          .from(tableName)
          .upsert(cleanData, { onConflict: 'id' });

        if (error) {

          continue;
        }

        // Mark as synced in IndexedDB
        await this.markAsSynced(storeName, item.id);
        syncedCount++;
      } catch (error) {

      }
    }

    return syncedCount;
  }

  /**
   * Syncs photos (requires special handling for file upload)
   */
  private async syncPhotos(): Promise<number> {
    const unsynced = await this.getUnsynced<OfflinePhoto>('photos');
    let syncedCount = 0;

    for (const photo of unsynced) {
      try {
        // Convert base64 to blob if needed
        let fileData: string | Blob = photo.data;
        if (typeof photo.data === 'string' && photo.data.startsWith('data:')) {
          const response = await fetch(photo.data);
          fileData = await response.blob();
        }

        // Upload to Supabase Storage
        const fileName = `${photo.visit_id}/${photo.id}.${photo.type || 'jpg'}`;
        const { error: uploadError } = await supabase.storage
          .from('specialist-photos')
          .upload(fileName, fileData, {
            contentType: photo.contentType || 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          auditLogger.warn('Photo upload failed', { photoId: photo.id, error: uploadError.message });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('specialist-photos')
          .getPublicUrl(fileName);

        // Update visit with photo URL
        const { error: updateError } = await supabase.rpc('add_photo_to_visit', {
          visit_id: photo.visit_id,
          photo_url: urlData.publicUrl
        });

        if (updateError) {
          auditLogger.warn('Photo visit update failed', { photoId: photo.id, error: updateError.message });
          continue;
        }

        await this.markAsSynced('photos', photo.id);
        syncedCount++;
      } catch (err: unknown) {
        auditLogger.error('Photo sync error', err instanceof Error ? err.message : 'Unknown error', { photoId: photo.id });

      }
    }

    return syncedCount;
  }

  /**
   * Gets sync status
   */
  async getSyncStatus(): Promise<{
    pending: {
      visits: number;
      assessments: number;
      photos: number;
      alerts: number;
    };
    lastSync?: number;
  }> {
    const status = {
      pending: {
        visits: (await this.getUnsynced('visits')).length,
        assessments: (await this.getUnsynced('assessments')).length,
        photos: (await this.getUnsynced('photos')).length,
        alerts: (await this.getUnsynced('alerts')).length
      },
      lastSync: undefined as number | undefined
    };

    // Get last sync time from IndexedDB metadata
    // (Could be enhanced to store this in a separate metadata store)

    return status;
  }

  /**
   * Clears all synced data (for cleanup)
   */
  async clearSynced(): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const stores: Array<'visits' | 'assessments' | 'photos' | 'alerts'> = [
      'visits',
      'assessments',
      'photos',
      'alerts'
    ];

    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('synced');
      const request = index.openCursor(IDBKeyRange.only(1)); // 1 = true/synced items

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }


  }

  /**
   * Gets the total size of offline data
   */
  async getStorageSize(): Promise<number> {
    if (!this.db) return 0;

    let totalSize = 0;
    const stores: Array<'visits' | 'assessments' | 'photos' | 'alerts'> = [
      'visits',
      'assessments',
      'photos',
      'alerts'
    ];

    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      const items = await new Promise<OfflineData[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as OfflineData[]);
        request.onerror = () => reject(request.error);
      });

      totalSize += JSON.stringify(items).length;
    }

    return totalSize;
  }

  /**
   * Request immediate sync via service worker message
   */
  async requestImmediateSync(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ type: 'SYNC_SPECIALIST_NOW' });
    } catch (err: unknown) {
      auditLogger.warn('Failed to request immediate sync', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
}

// Singleton instance
export const offlineSync = new OfflineDataSync();
