# FHIR Interoperability Integration Guide

## Overview

The WellFit Community Platform now includes a complete FHIR interoperability system that enables seamless integration with Electronic Health Record (EHR) systems like Epic, Cerner, and Allscripts. This system provides bi-directional data synchronization, real-time patient monitoring, and comprehensive compliance tracking.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Features](#features)
3. [Setup Instructions](#setup-instructions)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Usage Examples](#usage-examples)
7. [Security & Compliance](#security--compliance)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The FHIR Interoperability system consists of several key components:

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard                          │
│        (FHIRInteroperabilityDashboard.tsx)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  React Hook Layer                            │
│              (useFHIRIntegration.ts)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                 │
│                (fhirSync.ts)                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Core Integration Service                        │
│       (fhirInteroperabilityIntegrator.ts)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            ↓                     ↓
┌───────────────────┐   ┌──────────────────┐
│  FHIR Integration │   │   SMART on FHIR  │
│     Service       │   │      Client      │
│ (Existing)        │   │   (Existing)     │
└───────────────────┘   └──────────────────┘
            │                     │
            └──────────┬──────────┘
                       ↓
            ┌────────────────────┐
            │  EHR Systems        │
            │  (Epic, Cerner, etc)│
            └────────────────────┘
```

### File Structure

```
src/
├── services/
│   └── fhirInteroperabilityIntegrator.ts  # Core integration logic
├── api/
│   └── fhirSync.ts                        # API endpoints
├── hooks/
│   └── useFHIRIntegration.ts              # React hook
├── components/
│   └── admin/
│       └── FHIRInteroperabilityDashboard.tsx  # Admin UI
└── lib/
    └── smartOnFhir.ts                     # SMART on FHIR client

supabase/
└── migrations/
    └── 20251016000000_fhir_interoperability_system.sql
```

---

## Features

### 1. Connection Management
- Create and manage multiple FHIR server connections
- Support for Epic, Cerner, Allscripts, and custom EHR systems
- Connection testing and validation
- OAuth 2.0 and SMART on FHIR authentication

### 2. Data Synchronization
- **Pull (FHIR → Community)**: Import patient data from EHR systems
- **Push (Community → FHIR)**: Export patient data to EHR systems
- **Bi-directional**: Sync data in both directions
- Automatic and manual sync modes
- Configurable sync frequency (realtime, hourly, daily, manual)

### 3. Patient Mapping
- Map community users to FHIR patient IDs
- Track sync status for each patient
- Support for multiple EHR connections per patient

### 4. Resource Tracking
- Track individual FHIR resource syncs
- Support for Patient, Observation, Encounter, and more
- Version control and conflict detection

### 5. Conflict Resolution
- Automatic conflict detection
- Manual resolution workflow
- Support for multiple resolution strategies

### 6. Analytics & Reporting
- Sync success rates and statistics
- FHIR compliance metrics
- Population health insights
- Sync history and audit logs

---

## Setup Instructions

### 1. Database Setup

Run the migration to create FHIR interoperability tables:

```bash
# If using Supabase CLI
npx supabase migration up

# Or apply manually through Supabase dashboard
# Run the SQL from: supabase/migrations/20251016000000_fhir_interoperability_system.sql
```

### 2. Environment Configuration

Copy and configure environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` and configure FHIR settings:

```env
# Enable FHIR integrations
REACT_APP_FHIR_ENABLED=true

# Default FHIR server settings
REACT_APP_FHIR_DEFAULT_SERVER=https://fhir.example.com/R4
REACT_APP_FHIR_CLIENT_ID=wellfit-community-app

# FHIR Sync Settings
REACT_APP_FHIR_AUTO_SYNC_ENABLED=false
REACT_APP_FHIR_SYNC_BATCH_SIZE=50
REACT_APP_FHIR_SYNC_RETRY_ATTEMPTS=3

# Epic EHR Configuration (if using Epic)
REACT_APP_EPIC_FHIR_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=your_epic_client_id

# Cerner EHR Configuration (if using Cerner)
REACT_APP_CERNER_FHIR_URL=https://fhir-ehr-code.cerner.com/r4/your-tenant-id
REACT_APP_CERNER_CLIENT_ID=your_cerner_client_id
```

### 3. EHR Registration

#### For Epic:
1. Register your app at: https://fhir.epic.com/Developer/Apps
2. Request access to these scopes:
   - `patient/*.read`
   - `user/*.read`
   - `launch/patient`
   - `openid`
   - `fhirUser`
3. Set redirect URI to: `https://yourdomain.com/smart-callback`
4. Obtain Client ID and add to `.env.local`

#### For Cerner:
1. Register at: https://code-console.cerner.com/
2. Configure similar scopes as Epic
3. Obtain tenant ID and Client ID
4. Add to `.env.local`

### 4. Add Dashboard to Admin Routes

Update your admin routing to include the FHIR dashboard:

```typescript
// src/App.tsx or your routing file
import { FHIRInteroperabilityDashboard } from './components/admin/FHIRInteroperabilityDashboard';

// Add to your admin routes
<Route path="/admin/fhir-integration" element={<FHIRInteroperabilityDashboard />} />
```

---

## Database Schema

### Tables

#### `fhir_connections`
Stores EHR/FHIR server connection configurations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Connection name |
| fhir_server_url | TEXT | FHIR server base URL |
| ehr_system | TEXT | Epic, Cerner, Allscripts, Custom |
| client_id | TEXT | OAuth client ID |
| status | TEXT | active, inactive, error |
| sync_frequency | TEXT | realtime, hourly, daily, manual |
| sync_direction | TEXT | pull, push, bidirectional |
| access_token | TEXT | OAuth access token (encrypted) |
| last_sync | TIMESTAMPTZ | Last sync timestamp |

#### `fhir_patient_mappings`
Maps community users to FHIR patient IDs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| community_user_id | UUID | Reference to auth.users |
| fhir_patient_id | TEXT | FHIR Patient resource ID |
| connection_id | UUID | Reference to fhir_connections |
| sync_status | TEXT | synced, pending, conflict, error |
| last_synced_at | TIMESTAMPTZ | Last sync timestamp |

#### `fhir_sync_logs`
Tracks all sync operations and their results.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| connection_id | UUID | Reference to fhir_connections |
| sync_type | TEXT | full, incremental, manual |
| direction | TEXT | pull, push, bidirectional |
| status | TEXT | success, partial, failed |
| records_processed | INTEGER | Total records processed |
| records_succeeded | INTEGER | Successfully synced records |
| errors | JSONB | Array of error objects |
| summary | JSONB | Sync summary statistics |

#### `fhir_resource_sync`
Tracks individual resource syncs.

#### `fhir_sync_conflicts`
Tracks data conflicts requiring manual resolution.

---

## API Reference

### Connection Management

#### Get All Connections
```typescript
import { getFHIRConnections } from './api/fhirSync';

const response = await getFHIRConnections();
// Returns: { success: boolean, data: FHIRConnection[] }
```

#### Create Connection
```typescript
import { createFHIRConnection } from './api/fhirSync';

const response = await createFHIRConnection({
  name: 'Epic Production',
  fhirServerUrl: 'https://fhir.epic.com/...',
  ehrSystem: 'EPIC',
  clientId: 'your-client-id',
  status: 'inactive',
  syncFrequency: 'hourly',
  syncDirection: 'pull'
});
```

#### Test Connection
```typescript
import { testFHIRConnection } from './api/fhirSync';

const result = await testFHIRConnection(connectionId);
// Returns: { success: boolean, message: string, metadata?: any }
```

### Synchronization

#### Pull from FHIR
```typescript
import { syncFromFHIR } from './api/fhirSync';

const result = await syncFromFHIR(connectionId, [userId1, userId2]);
// Returns: { success: boolean, data: SyncResult }
```

#### Push to FHIR
```typescript
import { syncToFHIR } from './api/fhirSync';

const result = await syncToFHIR(connectionId, [userId1, userId2]);
```

#### Bi-directional Sync
```typescript
import { syncBidirectional } from './api/fhirSync';

const result = await syncBidirectional(connectionId);
// Returns both pull and push results
```

### Patient Mapping

#### Create Mapping
```typescript
import { createPatientMapping } from './api/fhirSync';

await createPatientMapping(communityUserId, fhirPatientId, connectionId);
```

#### Get Mapping
```typescript
import { getPatientMapping } from './api/fhirSync';

const mapping = await getPatientMapping(communityUserId, connectionId);
```

---

## Usage Examples

### Using the React Hook

```typescript
import { useFHIRIntegration } from './hooks/useFHIRIntegration';

function MyComponent() {
  const {
    connections,
    loading,
    error,
    syncing,
    syncProgress,
    createConnection,
    syncFromFHIR,
    testConnection
  } = useFHIRIntegration();

  const handleSync = async (connectionId: string) => {
    const result = await syncFromFHIR(connectionId);
    if (result) {
      console.log(`Synced ${result.recordsSucceeded} records`);
    }
  };

  return (
    <div>
      {syncing && syncProgress && (
        <div>
          <p>{syncProgress.message}</p>
          <progress value={syncProgress.progress} max={100} />
        </div>
      )}

      <button onClick={() => handleSync(connections[0]?.id)}>
        Sync Data
      </button>
    </div>
  );
}
```

### Direct Service Usage

```typescript
import { fhirIntegrator } from './services/fhirInteroperabilityIntegrator';

// Create a connection
const connection = await fhirIntegrator.createConnection({
  name: 'Epic Sandbox',
  fhirServerUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
  ehrSystem: 'EPIC',
  clientId: 'my-client-id',
  status: 'active',
  syncFrequency: 'hourly',
  syncDirection: 'pull'
});

// Test the connection
const testResult = await fhirIntegrator.testConnection(connection.id);

// Sync data
const syncResult = await fhirIntegrator.syncFromFHIR(connection.id);
console.log(`Synced: ${syncResult.recordsSucceeded}/${syncResult.recordsProcessed}`);

// Create patient mapping
await fhirIntegrator.createPatientMapping(
  'community-user-id',
  'fhir-patient-id',
  connection.id
);
```

---

## Security & Compliance

### Authentication
- OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- SMART on FHIR app launch framework
- Secure token storage (encrypted in database)
- Automatic token refresh

### Data Protection
- All PHI is encrypted at rest
- TLS 1.2+ for all FHIR communications
- Row Level Security (RLS) enforced on all tables
- Audit logging for all sync operations

### HIPAA Compliance
- Complete audit trail of all data access
- 90-day retention of sync logs (configurable)
- User access controls via admin/super_admin roles
- Encrypted storage of access tokens

### Access Control
- **Admins**: Full access to all FHIR operations
- **Users**: Can view their own patient mappings and sync status
- **Super Admins**: Can configure connections and manage system

---

## Troubleshooting

### Connection Test Fails

**Symptoms**: Test connection returns error or timeout

**Solutions**:
1. Verify FHIR server URL is correct
2. Check that client ID is registered with EHR
3. Ensure network allows outbound HTTPS to FHIR server
4. Verify OAuth scopes are configured correctly
5. Check if access token is expired (refresh if needed)

### Sync Fails with 401 Unauthorized

**Cause**: Access token is expired or invalid

**Solution**:
```typescript
// Refresh the token or re-authenticate
await fhirIntegrator.updateConnectionStatus(connectionId, 'inactive');
// User needs to re-authenticate through SMART launch flow
```

### Data Conflicts

**Symptoms**: Sync shows "partial" status with conflicts

**Solution**:
1. Navigate to "Analytics" tab in dashboard
2. Review conflicts in `fhir_sync_conflicts` table
3. Use manual resolution workflow:
   - Choose "use_fhir" to keep FHIR data
   - Choose "use_community" to keep community data
   - Choose "merge" for custom merge logic

### Patient Mapping Not Found

**Cause**: Patient hasn't been mapped yet

**Solution**:
```typescript
// Create the mapping
await createPatientMapping(communityUserId, fhirPatientId, connectionId);

// Then sync
await syncFromFHIR(connectionId, [communityUserId]);
```

### Performance Issues with Large Syncs

**Symptoms**: Sync takes too long or times out

**Solutions**:
1. Reduce batch size in environment variables:
   ```env
   REACT_APP_FHIR_SYNC_BATCH_SIZE=25
   ```
2. Use incremental sync instead of full sync
3. Schedule syncs during off-peak hours
4. Consider using pagination for large datasets

---

## Advanced Topics

### Custom Resource Mapping

To map additional FHIR resources beyond Patient and Observation:

1. Update `fhirInteroperabilityIntegrator.ts`:
```typescript
// Add new mapping function
private async mapCustomResource(fhirResource: any, userId: string) {
  // Your custom mapping logic
}
```

2. Update sync logic to include new resources

### Webhook Integration

For real-time updates from EHR systems:

1. Create webhook endpoint in your API
2. Register webhook URL with EHR system
3. Update sync logic to handle webhook events

### Multi-Tenant Support

To support multiple organizations with separate FHIR connections:

1. Add `organization_id` to `fhir_connections` table
2. Update RLS policies to filter by organization
3. Modify connection management to scope by organization

---

## Support & Resources

- **FHIR Specification**: https://www.hl7.org/fhir/
- **SMART on FHIR**: https://docs.smarthealthit.org/
- **Epic Documentation**: https://fhir.epic.com/
- **Cerner Documentation**: https://engineering.cerner.com/smart-on-fhir-tutorial/

For issues or questions, please check:
- Your login table issues
- hCaptcha configuration
- FHIR connection settings
- Database migration status

---

## Changelog

### Version 1.0.0 (2025-10-16)
- Initial FHIR interoperability system
- Support for Epic, Cerner, and Allscripts
- Bi-directional data synchronization
- Patient mapping and conflict resolution
- Analytics and compliance tracking
- Admin dashboard for management

---

## Next Steps

Now that your FHIR interoperability system is set up, you can:

1. **Test the Integration**:
   - Navigate to `/admin/fhir-integration` in your app
   - Create a connection to your EHR sandbox
   - Test the connection
   - Map a test patient
   - Perform a sync

2. **Address Your Login Issues**:
   - Check user authentication flow
   - Verify login table permissions
   - Review session management

3. **Fix hCaptcha Issues**:
   - Review [HCaptchaWidget.tsx](../src/components/HCaptchaWidget.tsx:1)
   - Verify hCaptcha site key configuration
   - Check network requests

Need help with any of these? Let me know!
