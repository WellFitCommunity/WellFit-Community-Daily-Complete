/**
 * CapabilityEnforcer - Runtime enforcement of declared tool capabilities
 *
 * Guardian tools declare `ToolCapabilities` (reads/writes/egress/databaseTables)
 * in their metadata. Historically egress was enforced (the ExecutionSandbox
 * fetch override), but DATABASE table access was declared and never enforced —
 * `ExecutionSandbox.checkDatabaseAccess()` existed but was never called. A tool
 * could touch any table regardless of its declared capabilities.
 *
 * This module makes capability declarations binding at runtime:
 *  - `wrapDatabaseClient(tool, client)` returns a Proxy that gates `.from(table)`
 *    against the tool's declared tables (and gates mutations against declared
 *    writes) — the read-by-default / write-only-when-declared direction.
 *  - `assertEgressAllowed(tool, url)` gates outbound hosts against declared egress.
 *  - Violations are recorded to an injectable sink (default: security_alerts +
 *    audit log) and counted; after `quarantineThreshold` violations a tool is
 *    quarantined and must be cleared by a human before it can run again.
 *
 * Prerequisite for overnight Option B autonomy: an autonomous tool executing
 * unattended must not be able to reach a table or host it never declared.
 * See ai-repair-authority.md and docs/trackers/guardian-option-b-autoheal-tracker.md.
 */
import type { ToolMetadata } from './ToolRegistry';
import { auditLogger } from '../auditLogger';

export type CapabilityViolationKind = 'egress' | 'db-table' | 'db-write';

export interface CapabilityViolation {
  toolId: string;
  kind: CapabilityViolationKind;
  /** The resource that was denied (host for egress, table name for db). */
  resource: string;
  reason: string;
  timestamp: Date;
  /** Running violation count for this tool after this violation. */
  violationCount: number;
  /** Whether this violation tipped the tool into quarantine. */
  quarantined: boolean;
}

/** Receives every violation. Kept injectable so the enforcer is unit-testable. */
export type ViolationSink = (violation: CapabilityViolation) => void | Promise<void>;

export interface CapabilityEnforcerOptions {
  /** Where violations are reported. Defaults to an audit-log-only sink. */
  sink?: ViolationSink;
  /** Violations before a tool is quarantined (default 3). */
  quarantineThreshold?: number;
}

/** Thrown when a tool attempts an action outside its declared capabilities. */
export class CapabilityViolationError extends Error {
  constructor(
    public readonly toolId: string,
    public readonly kind: CapabilityViolationKind,
    public readonly resource: string,
    reason: string,
  ) {
    super(`Capability violation [${kind}] by tool ${toolId}: ${reason}`);
    this.name = 'CapabilityViolationError';
  }
}

/** Supabase-style query verbs that MUTATE and therefore require write capability. */
const MUTATION_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

/** Audit-log-only fallback sink (always safe; no external dependency). */
const auditOnlySink: ViolationSink = (v) => {
  void auditLogger.warn('CAPABILITY_VIOLATION', {
    toolId: v.toolId,
    kind: v.kind,
    resource: v.resource,
    reason: v.reason,
    violationCount: v.violationCount,
    quarantined: v.quarantined,
  });
};

export class CapabilityEnforcer {
  private readonly sink: ViolationSink;
  private readonly quarantineThreshold: number;
  private readonly violationCounts = new Map<string, number>();
  private readonly quarantined = new Set<string>();

  constructor(options: CapabilityEnforcerOptions = {}) {
    this.sink = options.sink ?? auditOnlySink;
    this.quarantineThreshold = options.quarantineThreshold ?? 3;
  }

  /**
   * Assert an outbound request host is in the tool's declared egress list.
   * Complements the ExecutionSandbox fetch override by making denials count
   * toward quarantine. `'*'` in egress means unrestricted (declared, so allowed).
   */
  assertEgressAllowed(tool: ToolMetadata, url: string): void {
    const egress = tool.capabilities.egress ?? [];
    if (egress.includes('*')) return;

    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      host = url; // not a parseable URL — compare raw so it fails closed
    }

    if (!egress.includes(host)) {
      this.recordViolation(tool.id, 'egress', host, `host ${host} not in declared egress`);
      throw new CapabilityViolationError(tool.id, 'egress', host, `host ${host} not in declared egress`);
    }
  }

  /**
   * Wrap a Supabase-style client so `.from(table)` is gated by the tool's
   * declared capabilities. A table must be declared (reads/writes/databaseTables)
   * to be touched at all; mutations additionally require the table in `writes`.
   *
   * Only the first-level builder returned by `.from()` is gated — the mutation
   * verb (insert/update/upsert/delete) is always called there, so deeper chained
   * filters (`.eq`, `.select`) need no re-wrapping.
   */
  wrapDatabaseClient<T extends object>(tool: ToolMetadata, client: T): T {
    const handler: ProxyHandler<T> = {
      get: (target, prop, receiver) => {
        const original = Reflect.get(target, prop, receiver);
        if (prop === 'from' && typeof original === 'function') {
          const fromFn = original as (table: string) => object;
          return (tableName: string): object => {
            this.assertTableTouchable(tool, tableName);
            const builder = fromFn.call(target, tableName);
            return this.wrapQueryBuilder(tool, tableName, builder);
          };
        }
        return original;
      },
    };
    return new Proxy(client, handler);
  }

  /** True if the tool has exceeded the violation threshold and is disabled. */
  isQuarantined(toolId: string): boolean {
    return this.quarantined.has(toolId);
  }

  getViolationCount(toolId: string): number {
    return this.violationCounts.get(toolId) ?? 0;
  }

  /** Clear a tool's violations + quarantine — call only after human re-approval. */
  clearTool(toolId: string): void {
    this.violationCounts.delete(toolId);
    this.quarantined.delete(toolId);
    void auditLogger.info('CAPABILITY_TOOL_CLEARED', { toolId });
  }

  // --- internals ---

  private wrapQueryBuilder(tool: ToolMetadata, tableName: string, builder: object): object {
    const handler: ProxyHandler<object> = {
      get: (target, prop, receiver) => {
        const original = Reflect.get(target, prop, receiver);
        if (typeof original === 'function' && MUTATION_METHODS.has(String(prop))) {
          const method = String(prop);
          const mutationFn = original as (...args: unknown[]) => unknown;
          return (...args: unknown[]): unknown => {
            this.assertTableWritable(tool, tableName, method);
            return mutationFn.apply(target, args);
          };
        }
        // Non-mutation members (select, eq, then, ...) pass through untouched.
        return typeof original === 'function'
          ? (original as (...args: unknown[]) => unknown).bind(target)
          : original;
      },
    };
    return new Proxy(builder, handler);
  }

  private assertTableTouchable(tool: ToolMetadata, tableName: string): void {
    const caps = tool.capabilities;
    const touchable = new Set<string>([
      ...(caps.databaseTables ?? []),
      ...(caps.reads ?? []),
      ...(caps.writes ?? []),
    ]);
    if (!touchable.has(tableName)) {
      const reason = `table ${tableName} not in declared capabilities`;
      this.recordViolation(tool.id, 'db-table', tableName, reason);
      throw new CapabilityViolationError(tool.id, 'db-table', tableName, reason);
    }
  }

  private assertTableWritable(tool: ToolMetadata, tableName: string, method: string): void {
    const writable = new Set<string>(tool.capabilities.writes ?? []);
    if (!writable.has(tableName)) {
      const reason = `${method} on ${tableName} requires declared write capability`;
      this.recordViolation(tool.id, 'db-write', tableName, reason);
      throw new CapabilityViolationError(tool.id, 'db-write', tableName, reason);
    }
  }

  private recordViolation(
    toolId: string,
    kind: CapabilityViolationKind,
    resource: string,
    reason: string,
  ): void {
    const count = this.getViolationCount(toolId) + 1;
    this.violationCounts.set(toolId, count);
    const quarantined = count >= this.quarantineThreshold;
    if (quarantined) {
      this.quarantined.add(toolId);
    }

    const violation: CapabilityViolation = {
      toolId,
      kind,
      resource,
      reason,
      timestamp: new Date(),
      violationCount: count,
      quarantined,
    };

    // Invoke the sink synchronously so the violation is registered before the
    // throw propagates, but do NOT await its async work (e.g. a DB insert) — and
    // never let a sink error swallow or mask the violation itself.
    try {
      const result = this.sink(violation) as unknown;
      if (result instanceof Promise) {
        result.catch((err: unknown) =>
          auditLogger.error(
            'CAPABILITY_SINK_FAILED',
            err instanceof Error ? err : new Error(String(err)),
            { toolId, kind, resource },
          ),
        );
      }
    } catch (err: unknown) {
      void auditLogger.error(
        'CAPABILITY_SINK_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { toolId, kind, resource },
      );
    }
  }
}
