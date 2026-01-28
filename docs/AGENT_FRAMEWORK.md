# Agent Framework Architecture

**Version:** 1.0.0
**Last Updated:** January 2026
**Status:** Production Ready

---

## Overview

The WellFit Agent Framework provides a unified orchestration layer for all AI agents and microservices. It enables intelligent request routing, health monitoring, and predictive analytics across the platform.

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR LAYER                        │
│         (Classifies requests, routes to agents)              │
│                supabase/functions/agent-orchestrator         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────────┐
        ▼             ▼             ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   GUARDIAN   │ │    BED       │ │     BED      │ │     MCP      │
│    AGENT     │ │  MANAGEMENT  │ │  OPTIMIZER   │ │   SERVERS    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │             │                 │                 │
        └─────────────┴────────┬────────┴─────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    HEALTH MONITOR                            │
│         (Watches all agents, restarts on failure)            │
│              supabase/functions/health-monitor               │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Agent Orchestrator

**Location:** `supabase/functions/agent-orchestrator/index.ts`

Single entry point that classifies incoming requests and routes them to the appropriate specialized agent.

#### Features
- Pattern-based routing (regex matching on action names)
- Keyword-based routing (payload inspection)
- Hint-based routing for explicit agent selection
- Confidence scoring (minimum 0.3 threshold)
- Timeout handling with configurable limits

#### Routing Rules

| Pattern | Keywords | Target Agent |
|---------|----------|--------------|
| `monitor`, `security`, `audit`, `heal` | security, alert, phi, hipaa | guardian-agent |
| `check_all`, `check_one`, `get_status`, `recover` | health, monitor, watchdog | health-monitor |
| `get_bed`, `assign`, `discharge`, `update_status` | bed, room, census, admission | bed-management |
| `forecast`, `predict`, `optimize`, `surge` | forecast, prediction, capacity, los | bed-optimizer |
| `fhir`, `patient_data`, `condition`, `observation` | fhir, patient, medication | mcp-fhir-server |
| `claim`, `billing`, `837`, `835`, `prior_auth` | claim, billing, reimbursement | mcp-clearinghouse |
| `lookup_code`, `search_icd`, `search_cpt` | icd10, cpt, hcpcs, snomed | mcp-medical-codes |
| `npi`, `provider_lookup`, `validate_npi` | npi, provider, taxonomy | mcp-npi-server |

#### Usage

```typescript
// Direct call to orchestrator
const response = await fetch('https://[project].supabase.co/functions/v1/agent-orchestrator', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Origin': 'https://yourdomain.com'
  },
  body: JSON.stringify({
    action: 'predict_los',
    payload: {
      diagnosis_category: 'cardiac'
    },
    hints: {
      preferred_agent: 'bed-optimizer', // Optional: explicit routing
      timeout_ms: 30000
    }
  })
});

// Response
{
  "request_id": "uuid",
  "agent": "bed-optimizer",
  "success": true,
  "data": { ... },
  "metadata": {
    "processing_time_ms": 245,
    "routing_confidence": 0.8,
    "routed_to": "bed-optimizer"
  }
}
```

---

### 2. Health Monitor

**Location:** `supabase/functions/health-monitor/index.ts`

Watchdog service that monitors all agents, detects failures, and triggers recovery actions.

#### Actions

| Action | Description |
|--------|-------------|
| `check_all` | Run health checks on all registered agents |
| `check_one` | Run health check on a specific agent by name |
| `get_status` | Get aggregated health summary with 24h metrics |
| `recover` | Attempt to recover a failed agent |
| `health` | Health check endpoint for the monitor itself |

#### Health Statuses

| Status | Description |
|--------|-------------|
| `healthy` | Agent responding normally (<5s) |
| `degraded` | Agent responding slowly (>5s) or returning 4xx |
| `unhealthy` | Agent returning 5xx errors |
| `unreachable` | Agent not responding (timeout) |

#### Incident Management

The health monitor automatically:
1. Records all health check results to `agent_health_checks` table
2. Tracks consecutive failures per agent
3. Creates incidents after `max_consecutive_failures` (default: 3)
4. Notifies Guardian Agent for critical agent failures
5. Auto-resolves incidents when agent recovers

#### Usage

```typescript
// Check all agents
const response = await fetch('https://[project].supabase.co/functions/v1/health-monitor', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`,
    'Origin': 'https://yourdomain.com'
  },
  body: JSON.stringify({ action: 'check_all' })
});

// Response
{
  "success": true,
  "summary": {
    "healthy": 7,
    "degraded": 2,
    "unhealthy": 0,
    "total": 9
  },
  "results": [
    {
      "agent": "guardian-agent",
      "status": "healthy",
      "response_time_ms": 104
    },
    // ...
  ]
}
```

---

### 3. Bed Optimizer

**Location:** `supabase/functions/bed-optimizer/index.ts`

Predictive analytics and optimization algorithms for bed management.

#### Actions

| Action | Description | Required Parameters |
|--------|-------------|---------------------|
| `predict_los` | Predict length of stay by diagnosis | `diagnosis_category` |
| `forecast_capacity` | Generate 24-72 hour capacity forecast | `unit_id` |
| `check_surge` | Check surge status for facility | `facility_id` (optional) |
| `recommend_placement` | Get optimal bed placement recommendations | `patient_id` |
| `optimize_throughput` | Analyze throughput optimization (WIP) | - |
| `health` | Health check endpoint | - |

#### LOS Prediction

Predicts length of stay based on diagnosis category with confidence intervals.

```typescript
// Request
{
  "action": "predict_los",
  "diagnosis_category": "cardiac"
}

// Response
{
  "success": true,
  "prediction": {
    "predicted_los_hours": 96,
    "confidence_interval": {
      "lower": 48,
      "upper": 144
    },
    "based_on_samples": 1000,
    "diagnosis_category": "cardiac"
  }
}
```

**Default LOS by Diagnosis:**

| Category | Average Hours |
|----------|---------------|
| cardiac | 96 |
| respiratory | 72 |
| surgical | 48 |
| medical | 72 |
| observation | 24 |
| stroke | 120 |
| trauma | 96 |
| sepsis | 144 |

#### Capacity Forecasting

Generates hourly predictions for unit occupancy.

```typescript
// Request
{
  "action": "forecast_capacity",
  "unit_id": "uuid",
  "forecast_hours": 24
}

// Response
{
  "success": true,
  "forecasts": [
    {
      "hour": 0,
      "date": "2026-01-28T12:00:00Z",
      "predicted_census": 28,
      "predicted_available": 4,
      "confidence": { "lower": 22, "upper": 34 },
      "risk_level": "medium"
    },
    // ... 24 hours
  ]
}
```

#### Surge Detection

Monitors facility occupancy and triggers escalation protocols.

| Level | Occupancy | Actions |
|-------|-----------|---------|
| `normal` | <85% | No action |
| `warning` | 85-92% | Monitor hourly, accelerate discharges |
| `critical` | 92-98% | Surge protocol, open overflow |
| `diversion` | >98% | Divert protocol, expedite transfers |

#### Placement Recommendations

Scores available beds based on requirements and load balancing.

```typescript
// Request
{
  "action": "recommend_placement",
  "patient_id": "uuid",
  "requirements": {
    "requires_telemetry": true,
    "requires_isolation": false,
    "preferred_unit": "uuid"
  }
}

// Response
{
  "success": true,
  "recommendations": [
    {
      "bed_id": "uuid",
      "unit_id": "uuid",
      "unit_name": "Cardiac ICU",
      "room_number": "4B-201",
      "score": 87.5,
      "factors": {
        "availability": 1.0,
        "requirements_match": 0.9,
        "unit_load_balance": 0.7,
        "predicted_turnover": 0.5
      }
    }
  ]
}
```

---

## Database Schema

### Agent Registry

```sql
CREATE TABLE agent_registry (
  id uuid PRIMARY KEY,
  agent_name text UNIQUE NOT NULL,
  agent_type text CHECK (agent_type IN ('system', 'domain', 'business', 'mcp')),
  endpoint text NOT NULL,
  is_critical boolean DEFAULT false,
  health_check_interval_seconds integer DEFAULT 60,
  max_consecutive_failures integer DEFAULT 3
);
```

### Health Checks

```sql
CREATE TABLE agent_health_checks (
  id uuid PRIMARY KEY,
  agent_id uuid REFERENCES agent_registry(id),
  status text CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unreachable')),
  response_time_ms integer,
  error_message text,
  metadata jsonb,
  checked_at timestamptz DEFAULT now()
);
```

### Incidents

```sql
CREATE TABLE agent_incidents (
  id uuid PRIMARY KEY,
  agent_id uuid REFERENCES agent_registry(id),
  incident_type text CHECK (incident_type IN ('failure', 'timeout', 'degraded', 'recovered')),
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Bed Optimizer Tables

```sql
-- LOS predictions by diagnosis
CREATE TABLE los_predictions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  diagnosis_category text NOT NULL,
  avg_los_hours numeric NOT NULL,
  std_dev_hours numeric,
  sample_size integer
);

-- Capacity forecasts
CREATE TABLE capacity_forecasts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  unit_id uuid,
  forecast_date date NOT NULL,
  forecast_hour integer,
  predicted_census integer NOT NULL,
  confidence_lower integer,
  confidence_upper integer
);

-- Surge events
CREATE TABLE surge_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  event_type text CHECK (event_type IN ('capacity_warning', 'capacity_critical', 'diversion', 'surge_protocol', 'normalized')),
  trigger_threshold numeric,
  actual_value numeric,
  affected_units uuid[],
  resolved_at timestamptz
);

-- Placement recommendations
CREATE TABLE placement_recommendations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  recommended_bed_id uuid,
  score numeric NOT NULL,
  factors jsonb NOT NULL,
  status text DEFAULT 'pending',
  expires_at timestamptz
);
```

---

## Registered Agents

| Agent | Type | Critical | Interval |
|-------|------|----------|----------|
| guardian-agent | system | Yes | 30s |
| agent-orchestrator | system | Yes | 30s |
| health-monitor | system | Yes | 30s |
| bed-management | domain | Yes | 60s |
| bed-optimizer | domain | No | 120s |
| bed-capacity-monitor | domain | Yes | 60s |
| mcp-fhir-server | mcp | Yes | 60s |
| mcp-clearinghouse-server | mcp | No | 120s |
| mcp-medical-codes-server | mcp | No | 120s |
| mcp-npi-server | mcp | No | 120s |

---

## TypeScript Types

All types are defined in `src/types/agentOrchestrator.ts`:

```typescript
import type {
  AgentType,
  AgentRequest,
  AgentResponse,
  RoutingDecision,
  HealthCheckResult,
  AgentHealthSummary,
  LOSPrediction,
  CapacityForecast,
  SurgeStatus,
  PlacementRecommendation
} from '../types/agentOrchestrator';
```

---

## Deployment

### Deploy Functions

```bash
# Deploy all agent framework functions
npx supabase functions deploy agent-orchestrator --no-verify-jwt
npx supabase functions deploy health-monitor --no-verify-jwt
npx supabase functions deploy bed-optimizer --no-verify-jwt
```

### Run Migrations

```bash
npx supabase db push
```

### Verify Deployment

```bash
# Test health monitor
curl -X POST "https://[project].supabase.co/functions/v1/health-monitor" \
  -H "Content-Type: application/json" \
  -H "Origin: https://wellfitcommunity.live" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"action": "health"}'
```

---

## Cron Setup

For automated health monitoring, configure a cron job:

```sql
-- Run health checks every minute
SELECT cron.schedule(
  'health-monitor-check',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Origin', 'https://wellfitcommunity.live'
    ),
    body := '{"action": "check_all"}'::jsonb
  );
  $$
);
```

---

## Security

### CORS
All functions validate Origin headers against `ALLOWED_ORIGINS` environment variable. No wildcards allowed per HIPAA compliance.

### Authentication
- User requests require valid JWT in Authorization header
- Health checks between agents use service role key
- Internal health checks include `x-health-check: true` header

### RLS
All database tables have Row Level Security enabled with tenant isolation.

---

## Monitoring Dashboard

Query for agent health dashboard:

```sql
SELECT * FROM get_agent_health_summary();
```

Returns:
- Agent name and type
- Current status
- Last check timestamp
- Average response time (24h)
- Failure count (24h)
- Open incident flag

---

## Related Documentation

- [AI First Architecture](./AI_FIRST_ARCHITECTURE.md)
- [MCP Server Architecture](./MCP_ARCHITECTURE.md)
- [Bed Management System](./BED_MANAGEMENT.md)
- [HIPAA Compliance](./HIPAA_COMPLIANCE.md)
