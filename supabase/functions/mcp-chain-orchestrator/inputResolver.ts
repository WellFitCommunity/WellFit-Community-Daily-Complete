// ============================================================
// MCP Chain Orchestrator — Input Resolver
//
// Resolves JSONPath-like references in step input_mapping:
//   $.input.field_name      — from chain start input
//   $.steps.step_key.field  — from a prior step's output
//   $.literal.value         — hardcoded value
//
// Also evaluates condition expressions for conditional steps.
// ============================================================

import type { ChainStepResult } from "./types.ts";

/** Context available for resolving references */
export interface ResolveContext {
  /** Original chain input params */
  input: Record<string, unknown>;
  /** Map of step_key → output_data from completed prior steps */
  stepOutputs: Map<string, Record<string, unknown>>;
}

/**
 * Resolves a single JSONPath reference against the context.
 *
 * Supported paths:
 *   $.input.field         — chain input params
 *   $.steps.key.field     — prior step output
 *   $.steps.key.a.b       — nested field in prior step output
 *   $.literal.value       — the literal string "value"
 */
function resolveReference(path: string, ctx: ResolveContext): unknown {
  if (!path.startsWith("$.")) {
    // Not a reference — return as literal
    return path;
  }

  const segments = path.slice(2).split(".");

  if (segments[0] === "input") {
    // $.input.field_name
    return drillDown(ctx.input, segments.slice(1));
  }

  if (segments[0] === "steps" && segments.length >= 3) {
    // $.steps.step_key.field[.nested...]
    const stepKey = segments[1];
    const output = ctx.stepOutputs.get(stepKey);
    if (!output) return undefined;
    return drillDown(output, segments.slice(2));
  }

  if (segments[0] === "literal" && segments.length >= 2) {
    // $.literal.value — return the rest joined by dots
    return segments.slice(1).join(".");
  }

  return undefined;
}

/** Drill into a nested object following dot-separated segments */
function drillDown(obj: Record<string, unknown>, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Resolves all references in a step's input_mapping to produce
 * the actual tool arguments.
 */
export function resolveInputMapping(
  mapping: Record<string, string>,
  ctx: ResolveContext
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [argName, ref] of Object.entries(mapping)) {
    resolved[argName] = resolveReference(ref, ctx);
  }
  return resolved;
}

/**
 * Evaluates a simple condition expression against prior step outputs.
 *
 * Supported formats:
 *   $.steps.step_key.field == true
 *   $.steps.step_key.field == false
 *   $.steps.step_key.field == "string_value"
 *   $.steps.step_key.field != null
 *
 * Returns true if condition is met (step should execute).
 * Returns true if expression is empty/null (unconditional).
 */
export function evaluateCondition(
  expression: string | null,
  ctx: ResolveContext
): boolean {
  if (!expression || expression.trim().length === 0) return true;

  const trimmed = expression.trim();

  // Parse: left_path operator right_value
  const eqMatch = trimmed.match(/^(\$\.[^\s]+)\s*==\s*(.+)$/);
  if (eqMatch) {
    const leftPath = eqMatch[1];
    const rightRaw = eqMatch[2].trim();
    const leftValue = resolveReference(leftPath, ctx);
    const rightValue = parseConditionValue(rightRaw);
    return leftValue === rightValue;
  }

  const neqMatch = trimmed.match(/^(\$\.[^\s]+)\s*!=\s*(.+)$/);
  if (neqMatch) {
    const leftPath = neqMatch[1];
    const rightRaw = neqMatch[2].trim();
    const leftValue = resolveReference(leftPath, ctx);
    const rightValue = parseConditionValue(rightRaw);
    return leftValue !== rightValue;
  }

  // Unknown expression format — default to true (execute the step)
  return true;
}

/** Parse the right-hand side of a condition expression */
function parseConditionValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw === "undefined") return undefined;

  // Quoted string
  const strMatch = raw.match(/^["'](.*)["']$/);
  if (strMatch) return strMatch[1];

  // Number
  const num = Number(raw);
  if (!isNaN(num)) return num;

  return raw;
}

/**
 * Builds a ResolveContext from completed step results.
 */
export function buildResolveContext(
  chainInput: Record<string, unknown>,
  completedSteps: ChainStepResult[]
): ResolveContext {
  const stepOutputs = new Map<string, Record<string, unknown>>();
  for (const step of completedSteps) {
    if (step.output_data && step.status === "completed") {
      stepOutputs.set(step.step_key, step.output_data);
    }
  }
  return { input: chainInput, stepOutputs };
}
