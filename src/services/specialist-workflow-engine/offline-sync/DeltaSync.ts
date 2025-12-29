/**
 * Delta Sync Service
 *
 * Provides efficient differential synchronization for offline healthcare data.
 * Only transmits changes (patches) rather than full records.
 *
 * Features:
 * - JSON Patch (RFC 6902) for change tracking
 * - Compression for large payloads (CompressionStream API)
 * - Bandwidth optimization for rural/metered connections
 * - Change tracking with versioning
 */

import { auditLogger } from '../../auditLogger';
import type { ServiceResult } from '../../_base/ServiceResult';
import { success, failure } from '../../_base/ServiceResult';
import type {
  EnterpriseOfflineRecord,
  DeltaChange,
  JSONPatchOperation,
} from './types';

/**
 * Delta computation result
 */
export interface DeltaResult {
  /** Whether changes exist */
  hasChanges: boolean;

  /** The computed delta */
  delta?: DeltaChange;

  /** Original size in bytes */
  originalSize: number;

  /** Delta size in bytes */
  deltaSize: number;

  /** Compression ratio (deltaSize / originalSize) */
  compressionRatio: number;
}

/**
 * Compression options
 */
export interface CompressionOptions {
  /** Whether to compress (default: auto based on size) */
  enabled?: boolean;

  /** Minimum size in bytes before compression (default: 1KB) */
  minSizeForCompression?: number;

  /** Compression format */
  format?: 'gzip' | 'deflate';
}

/**
 * Cached record for delta computation
 */
interface CachedRecord {
  id: string;
  version: number;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * Delta Sync Service
 */
export class DeltaSyncService {
  private serverSnapshots: Map<string, CachedRecord> = new Map();
  private compressionSupported: boolean;
  private defaultOptions: CompressionOptions;

  constructor(options?: CompressionOptions) {
    this.defaultOptions = {
      enabled: true,
      minSizeForCompression: 1024, // 1KB
      format: 'gzip',
      ...options,
    };

    // Check if CompressionStream is supported
    this.compressionSupported =
      typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  }

  /**
   * Compute delta between local and server versions
   */
  computeDelta(
    local: EnterpriseOfflineRecord,
    server: EnterpriseOfflineRecord | null
  ): ServiceResult<DeltaResult> {
    try {
      // If no server version, this is a new record (full sync needed)
      if (!server) {
        const localJson = JSON.stringify(local);
        return success({
          hasChanges: true,
          originalSize: localJson.length,
          deltaSize: localJson.length,
          compressionRatio: 1,
        });
      }

      // Compute JSON Patch - cast at boundary for property access
      const patches = this.createPatch(
        server as unknown as Record<string, unknown>,
        local as unknown as Record<string, unknown>
      );

      if (patches.length === 0) {
        return success({
          hasChanges: false,
          originalSize: 0,
          deltaSize: 0,
          compressionRatio: 0,
        });
      }

      const originalJson = JSON.stringify(local);
      const patchJson = JSON.stringify(patches);

      const delta: DeltaChange = {
        recordId: local.id,
        recordType: (local as unknown as Record<string, unknown>)['recordType'] as string || 'unknown',
        baseVersion: server.localVersion,
        targetVersion: local.localVersion,
        patches,
        isCompressed: false,
        checksum: this.computeChecksum(patchJson),
      };

      return success({
        hasChanges: true,
        delta,
        originalSize: originalJson.length,
        deltaSize: patchJson.length,
        compressionRatio: patchJson.length / originalJson.length,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Failed to compute delta: ${errorMessage}`, err);
    }
  }

  /**
   * Compute delta with optional compression
   */
  async computeDeltaWithCompression(
    local: EnterpriseOfflineRecord,
    server: EnterpriseOfflineRecord | null,
    options?: CompressionOptions
  ): Promise<ServiceResult<DeltaResult>> {
    const deltaResult = this.computeDelta(local, server);

    if (!deltaResult.success || !deltaResult.data?.hasChanges || !deltaResult.data.delta) {
      return deltaResult;
    }

    const opts = { ...this.defaultOptions, ...options };

    // Check if compression should be applied
    if (
      !opts.enabled ||
      !this.compressionSupported ||
      deltaResult.data.deltaSize < (opts.minSizeForCompression || 1024)
    ) {
      return deltaResult;
    }

    try {
      const patchJson = JSON.stringify(deltaResult.data.delta.patches);
      const compressed = await this.compress(patchJson, opts.format || 'gzip');

      // Only use compression if it actually reduces size
      if (compressed.length < patchJson.length) {
        const compressedDelta: DeltaChange = {
          ...deltaResult.data.delta,
          compressedPatches: compressed,
          isCompressed: true,
          patches: [], // Clear uncompressed patches
        };

        return success({
          hasChanges: true,
          delta: compressedDelta,
          originalSize: deltaResult.data.originalSize,
          deltaSize: compressed.length,
          compressionRatio: compressed.length / deltaResult.data.originalSize,
        });
      }

      return deltaResult;
    } catch (err: unknown) {
      // Compression failed, return uncompressed result
      await auditLogger.warn('DELTA_COMPRESSION_FAILED', {
        recordId: local.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });

      return deltaResult;
    }
  }

  /**
   * Apply a delta to a base record
   */
  applyDelta<T extends EnterpriseOfflineRecord>(
    base: T,
    delta: DeltaChange
  ): ServiceResult<T> {
    try {
      // Verify version compatibility
      if (base.localVersion !== delta.baseVersion) {
        return failure(
          'VALIDATION_ERROR',
          `Version mismatch: base ${base.localVersion} !== delta base ${delta.baseVersion}`
        );
      }

      // Get patches (decompress if needed)
      const patches = delta.isCompressed ? [] : delta.patches;

      if (patches.length === 0 && !delta.isCompressed) {
        return success(base); // No changes
      }

      // Apply each patch operation - use intermediate Record type for patching
      let resultObj = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;

      for (const patch of patches) {
        resultObj = this.applyPatchOperation(resultObj, patch);
      }

      // Cast back to T at boundary
      const result = resultObj as unknown as T;

      // Update version
      result.localVersion = delta.targetVersion;

      return success(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Failed to apply delta: ${errorMessage}`, err);
    }
  }

  /**
   * Apply a delta with decompression
   */
  async applyDeltaWithDecompression<T extends EnterpriseOfflineRecord>(
    base: T,
    delta: DeltaChange
  ): Promise<ServiceResult<T>> {
    if (!delta.isCompressed) {
      return this.applyDelta(base, delta);
    }

    try {
      if (!delta.compressedPatches) {
        return failure('VALIDATION_ERROR', 'Compressed delta missing patch data');
      }

      const patchJson = await this.decompress(delta.compressedPatches);
      const patches = JSON.parse(patchJson) as JSONPatchOperation[];

      const uncompressedDelta: DeltaChange = {
        ...delta,
        patches,
        isCompressed: false,
      };

      return this.applyDelta(base, uncompressedDelta);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return failure('OPERATION_FAILED', `Failed to decompress delta: ${errorMessage}`, err);
    }
  }

  /**
   * Cache server snapshot for delta computation
   */
  cacheServerSnapshot(record: EnterpriseOfflineRecord): void {
    this.serverSnapshots.set(record.id, {
      id: record.id,
      version: record.localVersion,
      data: JSON.parse(JSON.stringify(record)) as Record<string, unknown>,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached server snapshot
   */
  getServerSnapshot(recordId: string): EnterpriseOfflineRecord | null {
    const cached = this.serverSnapshots.get(recordId);
    if (!cached) return null;

    return cached.data as unknown as EnterpriseOfflineRecord;
  }

  /**
   * Clear old snapshots (memory cleanup)
   */
  clearOldSnapshots(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleared = 0;

    for (const [id, snapshot] of this.serverSnapshots.entries()) {
      if (snapshot.timestamp < cutoff) {
        this.serverSnapshots.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Estimate bandwidth savings from using delta sync
   */
  estimateBandwidthSavings(records: EnterpriseOfflineRecord[]): {
    fullSyncSize: number;
    deltaSyncSize: number;
    savingsPercent: number;
  } {
    let fullSyncSize = 0;
    let deltaSyncSize = 0;

    for (const record of records) {
      const recordJson = JSON.stringify(record);
      fullSyncSize += recordJson.length;

      const snapshot = this.getServerSnapshot(record.id);
      if (snapshot) {
        const deltaResult = this.computeDelta(record, snapshot);
        if (deltaResult.success && deltaResult.data) {
          deltaSyncSize += deltaResult.data.deltaSize;
        } else {
          deltaSyncSize += recordJson.length;
        }
      } else {
        deltaSyncSize += recordJson.length;
      }
    }

    const savingsPercent =
      fullSyncSize > 0 ? ((fullSyncSize - deltaSyncSize) / fullSyncSize) * 100 : 0;

    return {
      fullSyncSize,
      deltaSyncSize,
      savingsPercent,
    };
  }

  // Private helper methods

  /**
   * Create JSON Patch from two objects
   */
  private createPatch(
    original: Record<string, unknown>,
    modified: Record<string, unknown>
  ): JSONPatchOperation[] {
    const patches: JSONPatchOperation[] = [];

    // Fields to skip (metadata that shouldn't be patched)
    const skipFields = new Set([
      'syncState',
      'syncedAt',
      'serverTimestamp',
      'localVersion',
      'serverVersion',
      'vectorClock',
      'checksum',
    ]);

    // Find additions and changes
    for (const [key, value] of Object.entries(modified)) {
      if (skipFields.has(key)) continue;

      const path = `/${key}`;

      if (!(key in original)) {
        // New field
        patches.push({ op: 'add', path, value });
      } else if (!this.deepEqual(original[key], value)) {
        // Changed field
        patches.push({ op: 'replace', path, value });
      }
    }

    // Find removals
    for (const key of Object.keys(original)) {
      if (skipFields.has(key)) continue;

      if (!(key in modified)) {
        patches.push({ op: 'remove', path: `/${key}` });
      }
    }

    return patches;
  }

  /**
   * Apply a single patch operation
   */
  private applyPatchOperation<T extends Record<string, unknown>>(
    target: T,
    patch: JSONPatchOperation
  ): T {
    const path = patch.path.split('/').filter(Boolean);

    if (path.length === 0) {
      throw new Error('Invalid patch path');
    }

    // For simple paths (single level)
    if (path.length === 1) {
      const key = path[0];

      switch (patch.op) {
        case 'add':
        case 'replace':
          (target as Record<string, unknown>)[key] = patch.value;
          break;
        case 'remove':
          delete (target as Record<string, unknown>)[key];
          break;
        case 'test':
          if (!this.deepEqual((target as Record<string, unknown>)[key], patch.value)) {
            throw new Error(`Test failed at ${patch.path}`);
          }
          break;
        default:
          throw new Error(`Unsupported patch operation: ${patch.op}`);
      }

      return target;
    }

    // For nested paths, recursively navigate
    const key = path[0];
    const nestedPath = '/' + path.slice(1).join('/');
    const nestedPatch = { ...patch, path: nestedPath };

    if (!(key in target)) {
      if (patch.op === 'add') {
        (target as Record<string, unknown>)[key] = {};
      } else {
        throw new Error(`Path not found: ${patch.path}`);
      }
    }

    (target as Record<string, unknown>)[key] = this.applyPatchOperation(
      (target as Record<string, unknown>)[key] as Record<string, unknown>,
      nestedPatch
    );

    return target;
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, idx) => this.deepEqual(val, b[idx]));
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);

      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every((key) => this.deepEqual(aObj[key], bObj[key]));
    }

    return false;
  }

  /**
   * Compute checksum for integrity verification
   */
  private computeChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `cksum-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Compress data using CompressionStream API
   */
  private async compress(data: string, format: 'gzip' | 'deflate'): Promise<string> {
    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(data);

    const cs = new CompressionStream(format);
    const writer = cs.writable.getWriter();
    void writer.write(inputBytes);
    void writer.close();

    const compressedChunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();

    // Read all compressed chunks
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        compressedChunks.push(result.value);
      }
    }

    // Combine chunks
    const totalLength = compressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of compressedChunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...compressed));
  }

  /**
   * Decompress data using DecompressionStream API
   */
  private async decompress(compressedBase64: string): Promise<string> {
    // Convert from base64
    const binary = atob(compressedBase64);
    const compressed = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      compressed[i] = binary.charCodeAt(i);
    }

    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    void writer.write(compressed);
    void writer.close();

    const decompressedChunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();

    // Read all decompressed chunks
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        decompressedChunks.push(result.value);
      }
    }

    // Combine chunks and decode
    const totalLength = decompressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const decompressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of decompressedChunks) {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    }

    const decoder = new TextDecoder();
    return decoder.decode(decompressed);
  }
}

/**
 * Create a delta sync service instance
 */
export function createDeltaSync(options?: CompressionOptions): DeltaSyncService {
  return new DeltaSyncService(options);
}
