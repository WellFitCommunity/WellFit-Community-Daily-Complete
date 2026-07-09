// Shared health-probe contract (2026-07-09).
//
// The health-monitor watchdog liveness-probes every registered agent by POSTing
// `{action:'health'}` with an `x-health-check: true` header (see health-monitor
// checkAgentHealth). Auth-gated functions were rejecting that probe at their auth
// step (401/403) and action-dispatch functions were 400-ing on the unknown action —
// so the watchdog read healthy functions as "degraded" (false signal).
//
// The contract: a monitored function should recognise a health probe and return a
// 200 liveness response BEFORE its auth/business logic. The probe carries no
// credentials for the target function and needs none — a liveness check only proves
// the function booted and its handler runs. The response is a static, PHI-free
// `{status:'healthy'}` — it exposes nothing.
//
// Usage (place right after CORS handling, BEFORE any auth check):
//   if (isHealthCheckRequest(req)) return healthCheckResponse('my-fn', corsHeaders);

export function isHealthCheckRequest(req: Request): boolean {
  return req.headers.get('x-health-check') === 'true';
}

export function healthCheckResponse(
  agentName: string,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ status: 'healthy', agent: agentName }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
