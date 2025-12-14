# Caregiver Suite (Family Access)

Allows family caregivers to view senior health information using a PIN shared by the senior.

## Key Principle

**NO REGISTRATION REQUIRED for caregivers** - just need senior's phone + PIN + their own name/phone for logging.

## Flow Diagram

```
Senior sets 4-digit PIN in Settings
         │
         │ Shares PIN with family
         ▼
Caregiver goes to /caregiver-access
         │
         │ Enters: Senior phone + PIN + Their name/phone
         ▼
30-minute read-only session granted
         │
         │ All access is logged
         ▼
Senior can see "Who viewed my data" in Settings
```

## Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/caregiver-access` | Public entry point for caregivers | None (PIN-based) |
| `/senior-view/:seniorId` | Read-only health dashboard | Session token |
| `/senior-reports/:seniorId` | Printable health reports | Session token |
| `/set-caregiver-pin` | Senior sets their 4-digit PIN | Authenticated |
| `/caregiver-dashboard` | Legacy route for registered caregivers (role_code 6) | Authenticated |

## Database Tables

| Table | Purpose |
|-------|---------|
| `caregiver_pins` | Stores hashed PINs (PBKDF2 via `hash-pin` edge function) |
| `caregiver_access_log` | HIPAA audit trail of all access |
| `caregiver_sessions` | Active session management with 30-min expiry |

## Key Database Functions

| Function | Purpose |
|----------|---------|
| `create_caregiver_session(...)` | Creates session after PIN verification |
| `validate_caregiver_session(token)` | Validates active session |
| `end_caregiver_session(token)` | Ends session and logs |
| `get_my_access_history(limit)` | Senior views who accessed their data |
| `log_caregiver_page_view(token, page)` | Logs which pages were viewed |

## Components

| Component | Purpose |
|-----------|---------|
| `CaregiverAccessPage` | Public PIN entry form |
| `SeniorViewPage` | Read-only dashboard (check-ins, mood trends, meds) |
| `SeniorReportsPage` | Printable health reports |
| `CaregiverAccessHistory` | "Who viewed my data" in senior settings |

## Security

- Sessions auto-expire after 30 minutes
- All access logged with caregiver identity (name + phone)
- PIN hashed with PBKDF2 (100,000 iterations)
- Senior can change PIN to revoke all access
- Senior can view complete access history
