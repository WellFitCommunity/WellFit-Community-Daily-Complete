# /fhir-check — FHIR Interoperability Health Check

Verify FHIR R4 server, patient data access, EHR connections, and SMART app readiness. Run before demos or after FHIR-related changes.

## Steps

### Step 1: FHIR Server Health

Call the MCP FHIR server ping:

```bash
curl -s "https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/mcp-fhir-server" | head -c 500
```

**Pass:** HTTP 200 with server info. **Fail:** Any error or timeout.

### Step 2: FHIR Metadata Endpoint

```bash
curl -s "https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/fhir-metadata" | head -c 500
```

**Pass:** Returns FHIR CapabilityStatement. **Fail:** Missing or malformed.

### Step 3: EHR Connections

```sql
-- Run via Supabase SQL
SELECT id, ehr_system, status, last_sync_at FROM fhir_connections WHERE status = 'active' LIMIT 10;
```

Report: number of active connections, last sync times.

### Step 4: FHIR Resource Counts

```sql
SELECT
  (SELECT count(*) FROM fhir_patients) as patients,
  (SELECT count(*) FROM fhir_conditions) as conditions,
  (SELECT count(*) FROM fhir_observations) as observations,
  (SELECT count(*) FROM fhir_medication_requests) as medications,
  (SELECT count(*) FROM fhir_procedures) as procedures;
```

Report the counts. Flag if any critical resource type has 0 records.

### Step 5: SMART App Configuration

```sql
SELECT app_name, status, launch_url FROM smart_apps WHERE status = 'active' LIMIT 10;
```

Report: number of registered SMART apps, their status.

### Step 6: Report

```
FHIR Health Check
─────────────────
[1] FHIR Server:     ✅/❌ (response time)
[2] Metadata:        ✅/❌
[3] EHR Connections: X active (last sync: date)
[4] Resources:       X patients, X conditions, X observations, X meds, X procedures
[5] SMART Apps:      X registered, X active
```
