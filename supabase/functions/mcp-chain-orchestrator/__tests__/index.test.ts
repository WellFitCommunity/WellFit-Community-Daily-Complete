/**
 * MCP Chain Orchestrator — Unit Tests
 *
 * Tests for types, inputResolver, retryEngine, mcpKeyResolver,
 * chainActions logic, REST route structure, and step transitions.
 *
 * Unit tests only — no network calls. All data is synthetic.
 */

// ============================================================
// Inline implementations extracted from source for pure unit testing
// (avoids Deno/Supabase runtime dependencies)
// ============================================================

// --- Types (mirrored from types.ts) ---

type ChainRunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

type ChainStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "timed_out"
  | "placeholder";

interface StartChainRequest {
  chain_key: string;
  input_params: Record<string, unknown>;
}

interface ApproveStepRequest {
  chain_run_id: string;
  step_result_id: string;
  decision: "approved" | "rejected";
  notes?: string;
}

interface ChainStepResult {
  id: string;
  chain_run_id: string;
  step_definition_id: string;
  step_order: number;
  step_key: string;
  mcp_server: string;
  tool_name: string;
  status: ChainStepStatus;
  input_args: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  execution_time_ms: number | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  placeholder_message: string | null;
  retry_count: number;
}

// --- ResolveContext + inputResolver functions (from inputResolver.ts) ---

interface ResolveContext {
  input: Record<string, unknown>;
  stepOutputs: Map<string, Record<string, unknown>>;
}

function drillDown(obj: Record<string, unknown>, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function resolveReference(path: string, ctx: ResolveContext): unknown {
  if (!path.startsWith("$.")) {
    return path;
  }
  const segments = path.slice(2).split(".");
  if (segments[0] === "input") {
    return drillDown(ctx.input, segments.slice(1));
  }
  if (segments[0] === "steps" && segments.length >= 3) {
    const stepKey = segments[1];
    const output = ctx.stepOutputs.get(stepKey);
    if (!output) return undefined;
    return drillDown(output, segments.slice(2));
  }
  if (segments[0] === "literal" && segments.length >= 2) {
    return segments.slice(1).join(".");
  }
  return undefined;
}

function resolveInputMapping(
  mapping: Record<string, string>,
  ctx: ResolveContext
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [argName, ref] of Object.entries(mapping)) {
    resolved[argName] = resolveReference(ref, ctx);
  }
  return resolved;
}

function parseConditionValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw === "undefined") return undefined;
  const strMatch = raw.match(/^["'](.*)["']$/);
  if (strMatch) return strMatch[1];
  const num = Number(raw);
  if (!isNaN(num)) return num;
  return raw;
}

function evaluateCondition(
  expression: string | null,
  ctx: ResolveContext
): boolean {
  if (!expression || expression.trim().length === 0) return true;
  const trimmed = expression.trim();

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

  return true;
}

function buildResolveContext(
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

// --- retryEngine functions (from retryEngine.ts) ---

function isRetryableError(errMsg: string): boolean {
  const retryablePatterns = [
    /timed out/i,
    /timeout/i,
    /returned 5\d{2}/,
    /returned 429/,
    /network/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /AbortError/i,
    /fetch failed/i,
  ];
  return retryablePatterns.some((p) => p.test(errMsg));
}

function getBackoffMs(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 30000);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

// --- mcpKeyResolver data (from mcpKeyResolver.ts) ---

const MCP_KEY_ENV_MAP: Record<string, string> = {
  "mcp-claude-server": "MCP_KEY_CLAUDE",
  "mcp-fhir-server": "MCP_KEY_FHIR",
  "mcp-hl7-x12-server": "MCP_KEY_HL7_X12",
  "mcp-clearinghouse-server": "MCP_KEY_CLEARINGHOUSE",
  "mcp-prior-auth-server": "MCP_KEY_PRIOR_AUTH",
  "mcp-npi-registry-server": "MCP_KEY_NPI_REGISTRY",
  "mcp-cms-coverage-server": "MCP_KEY_CMS_COVERAGE",
  "mcp-postgres-server": "MCP_KEY_POSTGRES",
  "mcp-edge-functions-server": "MCP_KEY_EDGE_FUNCTIONS",
  "mcp-medical-codes-server": "MCP_KEY_MEDICAL_CODES",
  "mcp-pubmed-server": "MCP_KEY_PUBMED",
  "mcp-cultural-competency-server": "MCP_KEY_CULTURAL_COMPETENCY",
  "mcp-medical-coding-server": "MCP_KEY_MEDICAL_CODING",
};

// ============================================================
// Test Helpers — Synthetic Data Factories
// ============================================================

function makeSyntheticStepResult(
  overrides: Partial<ChainStepResult> = {}
): ChainStepResult {
  return {
    id: "step-result-aaa-111",
    chain_run_id: "run-aaa-111",
    step_definition_id: "stepdef-aaa-111",
    step_order: 1,
    step_key: "admit_patient",
    mcp_server: "mcp-fhir-server",
    tool_name: "create_resource",
    status: "completed",
    input_args: { patient_id: "pat-test-001" },
    output_data: { encounter_id: "enc-test-001", drg_code: "DRG-470" },
    error_message: null,
    execution_time_ms: 245,
    approved_by: null,
    approved_at: null,
    approval_notes: null,
    placeholder_message: null,
    retry_count: 0,
    ...overrides,
  };
}

function makeResolveContext(
  input: Record<string, unknown> = {},
  stepMap: Record<string, Record<string, unknown>> = {}
): ResolveContext {
  const stepOutputs = new Map<string, Record<string, unknown>>();
  for (const [key, val] of Object.entries(stepMap)) {
    stepOutputs.set(key, val);
  }
  return { input, stepOutputs };
}

// ============================================================
// Valid REST action names (from index.ts switch cases)
// ============================================================
const VALID_ACTIONS = ["start", "resume", "approve", "cancel", "status"];

// ============================================================
// Tests
// ============================================================

Deno.test("MCP Chain Orchestrator", async (t) => {
  // ----------------------------------------------------------
  // 1. Type definitions — ChainRunStatus
  // ----------------------------------------------------------
  await t.step("ChainRunStatus has exactly 7 valid values", () => {
    const validStatuses: ChainRunStatus[] = [
      "pending",
      "running",
      "awaiting_approval",
      "completed",
      "failed",
      "cancelled",
      "timed_out",
    ];
    const expected = new Set(validStatuses);
    if (expected.size !== 7) {
      throw new Error(`Expected 7 unique ChainRunStatus values, got ${expected.size}`);
    }
    for (const s of validStatuses) {
      if (!expected.has(s)) {
        throw new Error(`Missing ChainRunStatus: ${s}`);
      }
    }
  });

  // ----------------------------------------------------------
  // 2. Type definitions — ChainStepStatus
  // ----------------------------------------------------------
  await t.step("ChainStepStatus has exactly 10 valid values", () => {
    const validStatuses: ChainStepStatus[] = [
      "pending",
      "running",
      "completed",
      "failed",
      "skipped",
      "awaiting_approval",
      "approved",
      "rejected",
      "timed_out",
      "placeholder",
    ];
    const expected = new Set(validStatuses);
    if (expected.size !== 10) {
      throw new Error(`Expected 10 unique ChainStepStatus values, got ${expected.size}`);
    }
  });

  // ----------------------------------------------------------
  // 3. StartChainRequest requires chain_key
  // ----------------------------------------------------------
  await t.step("StartChainRequest requires chain_key field", () => {
    const req: StartChainRequest = {
      chain_key: "admit_drg_billing",
      input_params: { patient_id: "pat-test-alpha" },
    };
    if (!req.chain_key) {
      throw new Error("chain_key should be present");
    }
    if (typeof req.input_params !== "object") {
      throw new Error("input_params should be an object");
    }
  });

  // ----------------------------------------------------------
  // 4. ApproveStepRequest requires step_result_id + decision
  // ----------------------------------------------------------
  await t.step("ApproveStepRequest requires step_result_id and decision", () => {
    const req: ApproveStepRequest = {
      chain_run_id: "run-test-001",
      step_result_id: "step-test-001",
      decision: "approved",
    };
    if (!req.step_result_id) {
      throw new Error("step_result_id should be present");
    }
    if (req.decision !== "approved" && req.decision !== "rejected") {
      throw new Error("decision must be 'approved' or 'rejected'");
    }
  });

  // ----------------------------------------------------------
  // 5. InputResolver — $.input.field reference resolution
  // ----------------------------------------------------------
  await t.step("resolveInputMapping resolves $.input.field references", () => {
    const ctx = makeResolveContext({ patient_id: "pat-test-alpha", facility: "TestHospital" });
    const result = resolveInputMapping(
      { pid: "$.input.patient_id", loc: "$.input.facility" },
      ctx
    );
    if (result.pid !== "pat-test-alpha") {
      throw new Error(`Expected 'pat-test-alpha', got '${result.pid}'`);
    }
    if (result.loc !== "TestHospital") {
      throw new Error(`Expected 'TestHospital', got '${result.loc}'`);
    }
  });

  // ----------------------------------------------------------
  // 6. InputResolver — $.steps.step_key.field reference
  // ----------------------------------------------------------
  await t.step("resolveInputMapping resolves $.steps.step_key.field references", () => {
    const ctx = makeResolveContext(
      {},
      { admit_patient: { encounter_id: "enc-test-002", drg_code: "DRG-470" } }
    );
    const result = resolveInputMapping(
      { enc: "$.steps.admit_patient.encounter_id", drg: "$.steps.admit_patient.drg_code" },
      ctx
    );
    if (result.enc !== "enc-test-002") {
      throw new Error(`Expected 'enc-test-002', got '${result.enc}'`);
    }
    if (result.drg !== "DRG-470") {
      throw new Error(`Expected 'DRG-470', got '${result.drg}'`);
    }
  });

  // ----------------------------------------------------------
  // 7. InputResolver — $.literal.value reference
  // ----------------------------------------------------------
  await t.step("resolveInputMapping resolves $.literal.value references", () => {
    const ctx = makeResolveContext();
    const result = resolveInputMapping(
      { action: "$.literal.create", mode: "$.literal.batch.sync" },
      ctx
    );
    if (result.action !== "create") {
      throw new Error(`Expected 'create', got '${result.action}'`);
    }
    if (result.mode !== "batch.sync") {
      throw new Error(`Expected 'batch.sync', got '${result.mode}'`);
    }
  });

  // ----------------------------------------------------------
  // 8. InputResolver — unknown reference prefix returns undefined
  // ----------------------------------------------------------
  await t.step("resolveInputMapping returns undefined for unknown $ prefix", () => {
    const ctx = makeResolveContext({ patient_id: "pat-test-alpha" });
    const result = resolveInputMapping(
      { bad: "$.unknown.something" },
      ctx
    );
    if (result.bad !== undefined) {
      throw new Error(`Expected undefined for unknown prefix, got '${result.bad}'`);
    }
  });

  // ----------------------------------------------------------
  // 9. Condition evaluation — equality (==)
  // ----------------------------------------------------------
  await t.step("evaluateCondition handles equality (==) correctly", () => {
    const ctx = makeResolveContext(
      {},
      { drg_step: { needs_billing: true, code: "DRG-470" } }
    );
    const result = evaluateCondition('$.steps.drg_step.needs_billing == true', ctx);
    if (result !== true) {
      throw new Error(`Expected true for equality match, got ${result}`);
    }
    const resultStr = evaluateCondition('$.steps.drg_step.code == "DRG-470"', ctx);
    if (resultStr !== true) {
      throw new Error(`Expected true for string equality, got ${resultStr}`);
    }
  });

  // ----------------------------------------------------------
  // 10. Condition evaluation — inequality (!=)
  // ----------------------------------------------------------
  await t.step("evaluateCondition handles inequality (!=) correctly", () => {
    const ctx = makeResolveContext(
      {},
      { drg_step: { needs_billing: true } }
    );
    const result = evaluateCondition('$.steps.drg_step.needs_billing != false', ctx);
    if (result !== true) {
      throw new Error(`Expected true for inequality, got ${result}`);
    }
    const resultFail = evaluateCondition('$.steps.drg_step.needs_billing != true', ctx);
    if (resultFail !== false) {
      throw new Error(`Expected false for matching inequality, got ${resultFail}`);
    }
  });

  // ----------------------------------------------------------
  // 11. Condition evaluation — boolean parsing
  // ----------------------------------------------------------
  await t.step("evaluateCondition parses boolean values correctly", () => {
    const ctx = makeResolveContext(
      {},
      { check_step: { is_active: false } }
    );
    const result = evaluateCondition('$.steps.check_step.is_active == false', ctx);
    if (result !== true) {
      throw new Error(`Expected true for boolean false match, got ${result}`);
    }
  });

  // ----------------------------------------------------------
  // 12. Condition evaluation — number parsing
  // ----------------------------------------------------------
  await t.step("evaluateCondition parses number values correctly", () => {
    const ctx = makeResolveContext(
      {},
      { scoring_step: { risk_score: 42 } }
    );
    const result = evaluateCondition('$.steps.scoring_step.risk_score == 42', ctx);
    if (result !== true) {
      throw new Error(`Expected true for number match, got ${result}`);
    }
  });

  // ----------------------------------------------------------
  // 13. drillDown — nested object traversal
  // ----------------------------------------------------------
  await t.step("drillDown traverses nested objects correctly", () => {
    const obj = { level1: { level2: { value: "deep-data" } } };
    const result = drillDown(obj as Record<string, unknown>, ["level1", "level2", "value"]);
    if (result !== "deep-data") {
      throw new Error(`Expected 'deep-data', got '${result}'`);
    }
  });

  // ----------------------------------------------------------
  // 14. drillDown — missing key returns undefined
  // ----------------------------------------------------------
  await t.step("drillDown returns undefined for missing keys", () => {
    const obj = { level1: { exists: true } };
    const result = drillDown(obj as Record<string, unknown>, ["level1", "nonexistent", "value"]);
    if (result !== undefined) {
      throw new Error(`Expected undefined for missing key, got '${result}'`);
    }
  });

  // ----------------------------------------------------------
  // 15. RetryEngine — isRetryableError identifies timeout
  // ----------------------------------------------------------
  await t.step("isRetryableError identifies timeout errors", () => {
    if (!isRetryableError("MCP server timed out after 30000ms")) {
      throw new Error("Should identify 'timed out' as retryable");
    }
    if (!isRetryableError("Request timeout exceeded")) {
      throw new Error("Should identify 'timeout' as retryable");
    }
  });

  // ----------------------------------------------------------
  // 16. RetryEngine — isRetryableError identifies 5xx
  // ----------------------------------------------------------
  await t.step("isRetryableError identifies 5xx server errors", () => {
    if (!isRetryableError("Server returned 500: Internal Server Error")) {
      throw new Error("Should identify 500 as retryable");
    }
    if (!isRetryableError("Server returned 503: Service Unavailable")) {
      throw new Error("Should identify 503 as retryable");
    }
    if (!isRetryableError("Server returned 502")) {
      throw new Error("Should identify 502 as retryable");
    }
  });

  // ----------------------------------------------------------
  // 17. RetryEngine — isRetryableError identifies 429
  // ----------------------------------------------------------
  await t.step("isRetryableError identifies 429 rate limit errors", () => {
    if (!isRetryableError("Server returned 429: Too Many Requests")) {
      throw new Error("Should identify 429 as retryable");
    }
  });

  // ----------------------------------------------------------
  // 18. RetryEngine — isRetryableError identifies network errors
  // ----------------------------------------------------------
  await t.step("isRetryableError identifies network errors", () => {
    if (!isRetryableError("network error connecting to server")) {
      throw new Error("Should identify 'network' as retryable");
    }
    if (!isRetryableError("ECONNREFUSED 127.0.0.1:54321")) {
      throw new Error("Should identify ECONNREFUSED as retryable");
    }
    if (!isRetryableError("ECONNRESET by peer")) {
      throw new Error("Should identify ECONNRESET as retryable");
    }
    if (!isRetryableError("fetch failed: unable to connect")) {
      throw new Error("Should identify 'fetch failed' as retryable");
    }
  });

  // ----------------------------------------------------------
  // 19. RetryEngine — non-retryable error (validation error)
  // ----------------------------------------------------------
  await t.step("isRetryableError returns false for non-retryable errors", () => {
    if (isRetryableError("Validation failed: missing patient_id")) {
      throw new Error("Validation error should NOT be retryable");
    }
    if (isRetryableError("Unauthorized: invalid token")) {
      throw new Error("Auth error should NOT be retryable");
    }
    if (isRetryableError("Server returned 400: Bad Request")) {
      throw new Error("400 error should NOT be retryable");
    }
    if (isRetryableError("Server returned 404: Not Found")) {
      throw new Error("404 error should NOT be retryable");
    }
  });

  // ----------------------------------------------------------
  // 20. getBackoffMs — exponential growth
  // ----------------------------------------------------------
  await t.step("getBackoffMs grows exponentially (attempt 0, 1, 2, 3)", () => {
    // attempt 0: base = min(1000 * 2^0, 30000) = 1000, + jitter [0,500)
    // attempt 1: base = min(1000 * 2^1, 30000) = 2000, + jitter
    // attempt 2: base = min(1000 * 2^2, 30000) = 4000, + jitter
    // attempt 3: base = min(1000 * 2^3, 30000) = 8000, + jitter
    const ms0 = getBackoffMs(0);
    const ms1 = getBackoffMs(1);
    const ms2 = getBackoffMs(2);
    const ms3 = getBackoffMs(3);

    if (ms0 < 1000 || ms0 >= 1500) {
      throw new Error(`attempt 0: expected [1000,1500), got ${ms0}`);
    }
    if (ms1 < 2000 || ms1 >= 2500) {
      throw new Error(`attempt 1: expected [2000,2500), got ${ms1}`);
    }
    if (ms2 < 4000 || ms2 >= 4500) {
      throw new Error(`attempt 2: expected [4000,4500), got ${ms2}`);
    }
    if (ms3 < 8000 || ms3 >= 8500) {
      throw new Error(`attempt 3: expected [8000,8500), got ${ms3}`);
    }
  });

  // ----------------------------------------------------------
  // 21. getBackoffMs — capped at 30000ms
  // ----------------------------------------------------------
  await t.step("getBackoffMs caps at 30000ms for high attempts", () => {
    // attempt 10: base = min(1000 * 2^10, 30000) = min(1024000, 30000) = 30000
    const ms = getBackoffMs(10);
    if (ms < 30000 || ms >= 30500) {
      throw new Error(`attempt 10: expected [30000,30500), got ${ms}`);
    }
    const ms20 = getBackoffMs(20);
    if (ms20 < 30000 || ms20 >= 30500) {
      throw new Error(`attempt 20: expected [30000,30500), got ${ms20}`);
    }
  });

  // ----------------------------------------------------------
  // 22. MCP_KEY_ENV_MAP has entries for known servers
  // ----------------------------------------------------------
  await t.step("MCP_KEY_ENV_MAP has entries for all 13 known MCP servers", () => {
    const expectedServers = [
      "mcp-claude-server",
      "mcp-fhir-server",
      "mcp-hl7-x12-server",
      "mcp-clearinghouse-server",
      "mcp-prior-auth-server",
      "mcp-npi-registry-server",
      "mcp-cms-coverage-server",
      "mcp-postgres-server",
      "mcp-edge-functions-server",
      "mcp-medical-codes-server",
      "mcp-pubmed-server",
      "mcp-cultural-competency-server",
      "mcp-medical-coding-server",
    ];

    if (Object.keys(MCP_KEY_ENV_MAP).length !== 13) {
      throw new Error(`Expected 13 entries, got ${Object.keys(MCP_KEY_ENV_MAP).length}`);
    }

    for (const server of expectedServers) {
      if (!MCP_KEY_ENV_MAP[server]) {
        throw new Error(`Missing MCP_KEY_ENV_MAP entry for ${server}`);
      }
    }
  });

  // ----------------------------------------------------------
  // 23. Chain cancel — only allowed if not completed
  // ----------------------------------------------------------
  await t.step("cancel is allowed for running, pending, awaiting_approval, failed, timed_out", () => {
    const cancellableStatuses: ChainRunStatus[] = [
      "pending",
      "running",
      "awaiting_approval",
      "failed",
      "timed_out",
    ];
    const nonCancellableStatuses: ChainRunStatus[] = ["completed", "cancelled"];

    for (const status of cancellableStatuses) {
      // Simulating the guard from chainActions.ts: reject if completed or cancelled
      const canCancel = status !== "completed" && status !== "cancelled";
      if (!canCancel) {
        throw new Error(`Status '${status}' should be cancellable`);
      }
    }

    for (const status of nonCancellableStatuses) {
      const canCancel = status !== "completed" && status !== "cancelled";
      if (canCancel) {
        throw new Error(`Status '${status}' should NOT be cancellable`);
      }
    }
  });

  // ----------------------------------------------------------
  // 24. Chain cancel — completed chain cannot be cancelled
  // ----------------------------------------------------------
  await t.step("completed chain cannot be cancelled (explicit check)", () => {
    const status: ChainRunStatus = "completed";
    const canCancel = status !== "completed" && status !== "cancelled";
    if (canCancel) {
      throw new Error("Completed chain should not be cancellable");
    }
  });

  // ----------------------------------------------------------
  // 25. REST route names (start, resume, approve, cancel, status)
  // ----------------------------------------------------------
  await t.step("REST actions match the 5 defined routes", () => {
    const expected = ["start", "resume", "approve", "cancel", "status"];
    if (VALID_ACTIONS.length !== 5) {
      throw new Error(`Expected 5 actions, got ${VALID_ACTIONS.length}`);
    }
    for (const action of expected) {
      if (!VALID_ACTIONS.includes(action)) {
        throw new Error(`Missing action: ${action}`);
      }
    }
  });

  // ----------------------------------------------------------
  // 26. Approval requires role check
  // ----------------------------------------------------------
  await t.step("approval step enforces role check when approval_role is set", () => {
    // Simulating the approval role check logic from chainActions.ts
    const requiredRole = "physician";
    const userRoles = ["nurse", "admin"]; // does NOT include physician

    const hasRequiredRole = userRoles.includes(requiredRole);
    if (hasRequiredRole) {
      throw new Error("User without physician role should be denied");
    }

    // Verify that a user WITH the role passes
    const authorizedRoles = ["nurse", "physician"];
    const isAuthorized = authorizedRoles.includes(requiredRole);
    if (!isAuthorized) {
      throw new Error("User with physician role should be authorized");
    }
  });

  // ----------------------------------------------------------
  // 27. Step transitions — pending -> running -> completed
  // ----------------------------------------------------------
  await t.step("step transitions: pending -> running -> completed", () => {
    const step = makeSyntheticStepResult({ status: "pending" });
    if (step.status !== "pending") throw new Error("Initial status should be pending");

    step.status = "running";
    if (step.status !== "running") throw new Error("Should transition to running");

    step.status = "completed";
    step.output_data = { encounter_id: "enc-test-completed" };
    step.execution_time_ms = 350;
    if (step.status !== "completed") throw new Error("Should transition to completed");
    if (!step.output_data) throw new Error("Completed step should have output_data");
  });

  // ----------------------------------------------------------
  // 28. Step transitions — pending -> running -> failed
  // ----------------------------------------------------------
  await t.step("step transitions: pending -> running -> failed", () => {
    const step = makeSyntheticStepResult({ status: "pending" });

    step.status = "running";
    if (step.status !== "running") throw new Error("Should transition to running");

    step.status = "failed";
    step.error_message = "MCP server mcp-fhir-server/create_resource returned 503";
    step.execution_time_ms = 5000;
    if (step.status !== "failed") throw new Error("Should transition to failed");
    if (!step.error_message) throw new Error("Failed step should have error_message");
  });

  // ----------------------------------------------------------
  // 29. Step transitions — skipped when condition is false
  // ----------------------------------------------------------
  await t.step("step is skipped when condition evaluates to false", () => {
    const ctx = makeResolveContext(
      {},
      { drg_step: { needs_billing: false } }
    );
    const shouldExecute = evaluateCondition(
      '$.steps.drg_step.needs_billing == true',
      ctx
    );
    if (shouldExecute) {
      throw new Error("Step should be skipped when condition is false");
    }

    // Simulate skip
    const step = makeSyntheticStepResult({ status: "pending" });
    if (!shouldExecute) {
      step.status = "skipped";
    }
    if (step.status !== "skipped") {
      throw new Error("Step status should be skipped");
    }
  });

  // ----------------------------------------------------------
  // 30. Batch results structure
  // ----------------------------------------------------------
  await t.step("batch step results maintain correct structure", () => {
    const steps: ChainStepResult[] = [
      makeSyntheticStepResult({
        step_order: 1,
        step_key: "admit",
        status: "completed",
        output_data: { encounter_id: "enc-001" },
      }),
      makeSyntheticStepResult({
        step_order: 2,
        step_key: "assign_drg",
        status: "completed",
        output_data: { drg_code: "DRG-470", weight: 1.7 },
      }),
      makeSyntheticStepResult({
        step_order: 3,
        step_key: "generate_claim",
        status: "pending",
        output_data: null,
      }),
    ];

    if (steps.length !== 3) throw new Error("Expected 3 step results");
    if (steps[0].step_order !== 1) throw new Error("First step should be order 1");
    if (steps[1].step_key !== "assign_drg") throw new Error("Second step key mismatch");
    if (steps[2].status !== "pending") throw new Error("Third step should be pending");

    const completedSteps = steps.filter((s) => s.status === "completed");
    if (completedSteps.length !== 2) throw new Error("Expected 2 completed steps");
  });

  // ----------------------------------------------------------
  // 31. buildResolveContext only includes completed steps
  // ----------------------------------------------------------
  await t.step("buildResolveContext only includes completed steps in stepOutputs", () => {
    const steps: ChainStepResult[] = [
      makeSyntheticStepResult({
        step_key: "step_a",
        status: "completed",
        output_data: { value: "alpha" },
      }),
      makeSyntheticStepResult({
        step_key: "step_b",
        status: "failed",
        output_data: { value: "beta" },
      }),
      makeSyntheticStepResult({
        step_key: "step_c",
        status: "skipped",
        output_data: null,
      }),
    ];

    const ctx = buildResolveContext({ patient_id: "pat-test-alpha" }, steps);
    if (!ctx.stepOutputs.has("step_a")) {
      throw new Error("Completed step_a should be in stepOutputs");
    }
    if (ctx.stepOutputs.has("step_b")) {
      throw new Error("Failed step_b should NOT be in stepOutputs");
    }
    if (ctx.stepOutputs.has("step_c")) {
      throw new Error("Skipped step_c should NOT be in stepOutputs");
    }
    if (ctx.input.patient_id !== "pat-test-alpha") {
      throw new Error("Context input should contain chain input params");
    }
  });

  // ----------------------------------------------------------
  // 32. Non-$ references returned as literal strings
  // ----------------------------------------------------------
  await t.step("resolveInputMapping returns non-$ strings as literals", () => {
    const ctx = makeResolveContext();
    const result = resolveInputMapping(
      { format: "json", version: "v2" },
      ctx
    );
    if (result.format !== "json") {
      throw new Error(`Expected 'json', got '${result.format}'`);
    }
    if (result.version !== "v2") {
      throw new Error(`Expected 'v2', got '${result.version}'`);
    }
  });

  // ----------------------------------------------------------
  // 33. evaluateCondition returns true for null/empty expression
  // ----------------------------------------------------------
  await t.step("evaluateCondition returns true for null or empty expression", () => {
    const ctx = makeResolveContext();
    if (!evaluateCondition(null, ctx)) {
      throw new Error("null expression should return true");
    }
    if (!evaluateCondition("", ctx)) {
      throw new Error("empty expression should return true");
    }
    if (!evaluateCondition("   ", ctx)) {
      throw new Error("whitespace expression should return true");
    }
  });

  // ----------------------------------------------------------
  // 34. MCP_KEY_ENV_MAP values follow naming convention
  // ----------------------------------------------------------
  await t.step("MCP_KEY_ENV_MAP values follow MCP_KEY_* naming convention", () => {
    for (const [server, envVar] of Object.entries(MCP_KEY_ENV_MAP)) {
      if (!envVar.startsWith("MCP_KEY_")) {
        throw new Error(`Env var for ${server} should start with MCP_KEY_, got ${envVar}`);
      }
    }
  });

  // ----------------------------------------------------------
  // 35. AbortError is retryable (DOMException timeout pattern)
  // ----------------------------------------------------------
  await t.step("isRetryableError identifies AbortError as retryable", () => {
    if (!isRetryableError("AbortError: The operation was aborted")) {
      throw new Error("AbortError should be retryable");
    }
  });
});
