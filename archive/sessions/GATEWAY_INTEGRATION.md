# Gateway - Secure One-Way EHR Integration Portal

## Overview

**Gateway** is the secure, one-way EHR integration portal for Envision: The Healthcare Navigation System. Data flows from external EHR systems (Epic, Cerner, etc.) into the system, where it's validated, de-duplicated, and securely stored. Gateway never sends data back to your EHR - it's a one-way portal for maximum security and compliance.

Part of **Envision: The Healthcare Navigation System**:
- **Atlas** - Comprehensive billing intelligence (revenue map)
- **Compass Riley** - Conversational AI scribe partner (your guide)
- **Gateway** - Secure one-way EHR integration (this document - your data port)

---

## Key Principle: One-Way Flow

```
┌─────────────┐           ┌─────────────┐           ┌─────────────┐
│             │           │             │           │             │
│  EHR System │  ──────>  │   Gateway   │  ──────>  │  Envision   │
│  (Epic, etc)│           │             │           │  Platform   │
│             │           │             │           │             │
└─────────────┘           └─────────────┘           └─────────────┘

                          Data flows IN only
                          Never flows back ←
```

**Why One-Way?**
1. **Security** - Eliminates risk of data leakage back to EHR
2. **Compliance** - Simpler HIPAA audit trail (read-only from EHR perspective)
3. **Safety** - Can't accidentally corrupt EHR data
4. **Trust** - Healthcare organizations comfortable with read-only access
5. **Simplicity** - Fewer integration points, fewer failure modes

---

## What Gateway Does

### 1. **Secure Data Import**
- Connects to EHR via HL7, FHIR, or custom APIs
- Authenticates using OAuth 2.0 / API keys
- Pulls patient demographics, encounters, medications, diagnoses
- Encrypts data in transit (TLS 1.3)

### 2. **Data Validation**
- Validates FHIR resources against schemas
- Checks for required fields (patient ID, MRN, etc.)
- Flags incomplete or malformed records
- Logs validation errors for review

### 3. **De-duplication**
- Matches patients across systems using MRN, DOB, name
- Identifies duplicate encounters
- Merges records intelligently (most recent wins)
- Maintains audit trail of merges

### 4. **Data Transformation**
- Normalizes EHR-specific codes to standard formats
- Maps custom fields to Envision schema
- Enriches data with calculated fields
- Maintains original data for audit purposes

### 5. **Secure Storage**
- Stores in Envision's HIPAA-compliant database
- Encrypts PHI at rest (AES-256)
- Row-level security policies
- Comprehensive audit logging

---

## Architecture

### Components

#### Gateway API (Supabase Edge Function)
- **Endpoint**: `POST /functions/v1/gateway-import`
- **Authentication**: Service role key or API key
- **Rate Limiting**: Configurable per organization
- **Payload**: FHIR Bundle or custom JSON

#### Gateway Processing Pipeline
```typescript
1. Receive FHIR Bundle
2. Authenticate request
3. Validate bundle structure
4. De-identify PHI (if required)
5. Check for duplicates
6. Transform to Envision schema
7. Write to database
8. Log audit trail
9. Return import summary
```

#### Database Tables
- `ehr_patient_mappings` - Maps EHR patient IDs to Envision user_ids
- `fhir_encounters` - Stores encounter data
- `fhir_observations` - Stores vitals, labs, etc.
- `gateway_import_log` - Audit trail of all imports
- `gateway_errors` - Failed imports for review

---

## Integration Methods

### Option 1: FHIR API (Recommended)
```bash
POST /functions/v1/gateway-import
Authorization: Bearer YOUR_API_KEY
Content-Type: application/fhir+json

{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-123",
        "identifier": [{"system": "MRN", "value": "12345"}],
        "name": [{"family": "Doe", "given": ["John"]}],
        "birthDate": "1980-01-01"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "imported": 42,
  "duplicates": 3,
  "errors": 0,
  "import_id": "uuid-here",
  "summary": {
    "patients": 10,
    "encounters": 25,
    "observations": 150
  }
}
```

### Option 2: HL7 v2 Messages
Gateway can receive HL7 ADT/ORU messages via MLLP or HTTP:
```
MSH|^~\&|EPIC|HOSPITAL|ENVISION|GATEWAY|20250101120000||ADT^A01|12345|P|2.5
PID|1||MRN12345^^^HOSPITAL^MR||DOE^JOHN^||19800101|M|||123 MAIN ST^^CITY^ST^12345
```

### Option 3: Custom CSV/Excel Upload
For manual imports or legacy systems:
1. Upload file via Gateway web interface
2. Map columns to Envision fields
3. Preview and validate
4. Confirm import

---

## Security & Compliance

### HIPAA Compliance
✅ **Encryption in Transit**: TLS 1.3
✅ **Encryption at Rest**: AES-256
✅ **Access Controls**: Role-based with RLS
✅ **Audit Logging**: Every import logged with timestamp, user, IP
✅ **De-identification**: Optional PHI scrubbing before storage
✅ **BAA Available**: Business Associate Agreement on file

### Authentication Methods
1. **API Keys** - For automated EHR integrations
2. **OAuth 2.0** - For interactive/delegated access
3. **Service Role** - For internal Envision services
4. **mTLS** - Mutual TLS for high-security organizations

### Rate Limiting
- Default: 100 requests/minute per organization
- Burst: Up to 500 requests in 10-second window
- Custom limits available for enterprise

---

## Monitoring & Observability

### Real-Time Dashboard
- Import success rate (target: >99.5%)
- Average processing time
- Error rates by type
- Duplicate detection rate

### Alerts
- Email/Slack when error rate >1%
- Daily summary of imports
- Failed import notifications

### Audit Trail
Every import logged with:
- Timestamp
- Source EHR system
- User/API key
- Records imported
- Duplicates detected
- Errors encountered
- Processing time

---

## Error Handling

### Common Errors

**1. Invalid FHIR Resource**
```json
{
  "error": "FHIR validation failed",
  "details": "Patient.birthDate is required",
  "resource_id": "patient-123"
}
```
**Resolution**: Fix FHIR resource structure

**2. Duplicate Patient**
```json
{
  "warning": "Duplicate patient detected",
  "action": "merged",
  "existing_id": "uuid-1",
  "new_id": "uuid-2",
  "matched_on": ["MRN", "DOB"]
}
```
**Resolution**: Automatic merge, no action needed

**3. Missing Required Field**
```json
{
  "error": "Missing required field",
  "field": "patient.identifier.MRN",
  "resource_id": "patient-456"
}
```
**Resolution**: Add MRN to patient record

---

## Configuration

### EHR Connection Setup

```typescript
// Gateway configuration (stored in gateway_connections table)
{
  "organization_id": "org-uuid",
  "ehr_system": "Epic",
  "connection_type": "fhir",
  "endpoint": "https://ehr.hospital.com/fhir/R4",
  "auth_method": "oauth2",
  "credentials": {
    "client_id": "encrypted",
    "client_secret": "encrypted"
  },
  "sync_schedule": "0 2 * * *", // Daily at 2 AM
  "enabled": true,
  "last_sync": "2025-10-21T02:00:00Z",
  "next_sync": "2025-10-22T02:00:00Z"
}
```

### Field Mappings

Map EHR-specific fields to Envision schema:
```typescript
{
  "patient": {
    "epic.id": "profiles.mrn",
    "epic.name.family": "profiles.last_name",
    "epic.name.given[0]": "profiles.first_name",
    "epic.birthDate": "profiles.dob"
  },
  "encounter": {
    "epic.class.code": "fhir_encounters.class_code",
    "epic.period.start": "fhir_encounters.start_time"
  }
}
```

---

## API Reference

### Import Endpoint

**POST** `/functions/v1/gateway-import`

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/fhir+json
```

**Request Body:**
```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [/* FHIR resources */]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "import_id": "uuid",
  "imported": 42,
  "duplicates": 3,
  "errors": 0,
  "processing_time_ms": 1250
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid FHIR bundle",
  "details": ["Patient.birthDate is required"]
}
```

---

## Best Practices

### 1. **Incremental Sync**
Don't re-import entire patient database daily. Use:
- `_lastUpdated` FHIR parameter to get only changed records
- Track last sync timestamp per organization
- Sync deltas only (new/modified records)

### 2. **Batch Imports**
For large imports:
- Send FHIR Bundles with max 100 resources
- Use async processing for >1000 resources
- Poll import status endpoint for completion

### 3. **Error Recovery**
- Failed imports stored in `gateway_errors` table
- Retry with exponential backoff (1min, 5min, 15min, 1hr)
- Manual review after 3 failed attempts
- Email admins for persistent failures

### 4. **Data Quality**
- Validate critical fields before import (MRN, DOB, name)
- Flag suspicious duplicates for manual review
- Maintain original EHR data for audit trail
- Regular data quality reports

---

## Branding & Messaging

**Product Name:** Gateway

**Tagline:** "Your secure port of entry"

**Full Tagline:** "Where EHR data arrives safely, stays securely - one-way flow only"

**Positioning:**
- Backend: "Gateway - Secure One-Way EHR Integration Portal (Part of Envision: The Healthcare Navigation System)"
- Sales/Marketing: "Gateway brings your EHR data into the system safely and automatically"

**Key Messages:**
- ✅ One-way only - data never flows back to your EHR
- ✅ HIPAA-compliant from end to end
- ✅ Automated de-duplication and validation
- ✅ Works with Epic, Cerner, and any FHIR-compatible EHR
- ✅ Set it and forget it - scheduled automatic syncs

---

## Roadmap

### Q1 2025
- ✅ FHIR R4 support (Epic, Cerner)
- ✅ Basic de-duplication
- ✅ Manual CSV upload

### Q2 2025
- 🔄 HL7 v2 message support
- 🔄 Real-time sync (webhooks)
- 🔄 Advanced duplicate detection (fuzzy matching)

### Q3 2025
- 📋 Bi-directional sync (read-write) for select use cases
- 📋 SMART on FHIR app integration
- 📋 Multi-EHR orchestration (pull from multiple sources)

### Q4 2025
- 📋 AI-powered data quality checks
- 📋 Automated field mapping suggestions
- 📋 FHIR Bulk Data API support

---

## Support

**Documentation:** https://docs.envision.health/gateway
**API Reference:** https://api.envision.health/docs
**Status Page:** https://status.envision.health
**Support Email:** support@envision.health
**Integration Help:** gateway-support@envision.health

---

**Bottom Line**: Gateway is your secure, reliable bridge from any EHR system into the Envision platform. One-way flow for maximum security. FHIR-native for maximum compatibility. Set it up once, let it run automatically.
