/**
 * Offline Data Sync Manager
 * Handles offline data capture and synchronization for rural areas with poor connectivity
 */

import { supabase } from '../../lib/supabaseClient';

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
   * Saves data offline
   */
  async saveOffline(
    storeName: 'visits' | 'assessments' | 'photos' | 'alerts',
    data: any
  ): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

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

        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Gets all unsynced data from a store
   */
  async getUnsynced(
    storeName: 'visits' | 'assessments' | 'photos' | 'alerts'
  ): Promise<any[]> {
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

      request.onsuccess = () => resolve(request.result);
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
    const unsynced = await this.getUnsynced('photos');
    let syncedCount = 0;

    for (const photo of unsynced) {
      try {
        // Convert base64 to blob if needed
        let fileData = photo.data;
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

          continue;
        }

        await this.markAsSynced('photos', photo.id);
        syncedCount++;
      } catch (error) {

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

      const items = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      totalSize += JSON.stringify(items).length;
    }

    return totalSize;
  }
}

// Singleton instance
export const offlineSync = new OfflineDataSync();
