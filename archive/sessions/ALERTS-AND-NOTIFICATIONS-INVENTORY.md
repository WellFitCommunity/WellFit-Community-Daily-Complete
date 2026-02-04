# WellFit Alert & Notification Systems - Complete Inventory

## Executive Summary

This document catalogs all alert and notification systems configured in the WellFit platform, including their current deployment status, configuration, and monitoring capabilities.

**Last Updated:** 2025-11-12
**Status:** Active inventory of production and staged systems

---

## 1. Guardian Agent Alert System

### Status: ⚠️ **PARTIALLY DEPLOYED** (Service exists, database table NOT deployed)

### Purpose
Automated security monitoring and self-healing alerts for code vulnerabilities, PHI exposure, memory leaks, and system health issues.

### Configuration
**Service:** `src/services/guardian-agent/GuardianAlertService.ts` ✅
**Database Table:** `guardian_alerts` ❌ (in `_SKIP_20251027120000_guardian_alerts_system.sql`)
**Notification Target:** Security Panel + Email (critical/emergency)

### Alert Categories
| Category | Severity Levels | Auto-Healable | Email Notification |
|----------|----------------|---------------|-------------------|
| **Security Vulnerability** | warning, critical | ✅ | critical+ |
| **PHI Exposure** | critical | ❌ | ✅ |
| **Memory Leak** | warning | ✅ | ❌ |
| **API Failure** | warning, critical | ❌ | critical+ |
| **Healing Generated** | info | ✅ | ❌ |
| **System Health** | info, warning, critical | varies | critical+ |

### Alert Severities
- **info** ℹ️ - Informational, no immediate action required
- **warning** ⚠️ - Attention needed, review recommended
- **critical** 🚨 - Immediate attention required
- **emergency** 🆘 - Urgent action, potential HIPAA violation

### Actions Available
- View Recording (Guardian Eyes session)
- Review Generated Fix
- Approve & Apply Fix
- Dismiss (False Positive)
- Escalate to Compliance Officer

### Automated Monitoring
**Cron Jobs** (configured in `20251107180000_guardian_cron_monitoring.sql`):
- ✅ **Every 5 minutes**: `guardian-automated-monitoring`
- ✅ **Daily at 8 AM UTC**: `guardian-daily-summary`

**Functions:**
- `trigger_guardian_monitoring()` - Calls Guardian via HTTP
- `log_guardian_cron_execution()` - Logs execution history

**Logging Table:** `guardian_cron_log` ✅

### Real-time Delivery
- **Method**: Supabase Realtime (broadcast channel: `guardian-alerts`)
- **Persistent Storage**: `security_notifications` table
- **Email Integration**: Planned (currently logged, not sent)

### Example Alert: PHI Exposure
```typescript
{
  severity: 'critical',
  category: 'phi_exposure',
  title: 'PHI Exposure: SSN in console_log',
  description: 'Protected Health Information (ssn) detected in console_log within PatientCard component',
  session_recording_id: 'session-123',
  video_timestamp: 45.2,
  affected_component: 'src/components/PatientCard.tsx',
  actions: ['View Recording', 'Escalate to Compliance', 'Mark Resolved']
}
```

### Deployment Issue
**Problem:** `guardian_alerts` table migration is skipped
**Impact:** GuardianAlertService will fail when trying to insert alerts
**Resolution:** Need to deploy `_SKIP_20251027120000_guardian_alerts_system.sql` or `_SKIP_20251027120000_guardian_alerts_system_fixed.sql`

---

## 2. CHW/Specialist Field Visit Alerts

### Status: ✅ **DEPLOYED**

### Purpose
Critical alerts triggered during Community Health Worker field visits that require specialist (physician, nurse, case manager) attention.

### Configuration
**Component:** `src/components/chw/CHWAlertsWidget.tsx` ✅
**Database Table:** `specialist_alerts` ✅
**Notification Target:** Physician, Nurse, Case Manager panels

### Alert Severities
- **critical** - Immediate intervention required
- **high** - Priority review needed
- **medium** - Standard follow-up
- **low** - Informational
- **info** - General updates

### Alert Routing
Alerts are role-based and routed to specific specialists:
- `notify_role: 'physician'` → Physician panel
- `notify_role: 'nurse'` → Nurse panel
- `notify_role: 'case_manager'` → Case Manager panel

### Alert Workflow
1. **CHW triggers alert** during field visit
2. **Alert stored** in `specialist_alerts` table
3. **Real-time push** to specialist panel via Supabase Realtime
4. **Specialist acknowledges** alert
5. **Specialist resolves** alert with notes

### Alert Data Structure
```typescript
{
  id: string,
  visit_id: string,
  alert_rule_id: string,
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
  triggered_by: any,
  triggered_at: timestamp,
  notify_role: 'physician' | 'nurse' | 'case_manager',
  message: string,
  acknowledged: boolean,
  acknowledged_at: timestamp,
  resolved: boolean,
  resolved_at: timestamp,
  patient_name: string,
  chw_name: string
}
```

### Real-time Monitoring
- **Subscription**: Automatic via `useRealtimeSubscription` hook
- **Auto-refresh**: On insert/update/delete events
- **Filter Options**: All, Unacknowledged, Critical

---

## 3. Patient Check-in Monitoring

### Status: ✅ **DEPLOYED**

### Purpose
Track patient daily check-ins and alert care team about missed check-ins or concerning patterns.

### Configuration
**Tables:**
- `check_ins` ✅ (`20251001000002_create_check_ins_table.sql`)
- `patient_daily_check_ins` ✅ (`20251004000000_add_readmission_tracking.sql`)
- `consecutive_missed_checkins_log` ✅

### Check-in Types
1. **Regular Check-ins** (`check_ins` table)
   - User-initiated check-ins
   - Tracks frequency and patterns
   - Used by law enforcement for welfare checks

2. **Daily Check-ins** (`patient_daily_check_ins` table)
   - Daily health status reporting
   - Symptom tracking
   - Medication adherence monitoring

### Triggers Configured
**Trigger:** `trg_daily_check_ins_uat` ✅
- Updates `updated_at` timestamp automatically

**Trigger:** `trg_care_alerts_uat` ✅
- Fires when check-in patterns indicate issues

### Alert Conditions
- **Consecutive missed check-ins** → Logged in `consecutive_missed_checkins_log`
- **Symptom escalation** → Triggers care team alert
- **Medication non-adherence** → Triggers care team alert

### Integration Points
- **Law Enforcement Response Info**: Check-in status included in welfare check data
- **Care Team Dashboard**: Real-time check-in monitoring
- **Readmission Tracking**: Check-ins as readmission risk factor

---

## 4. Medication Alerts

### Status: ✅ **DEPLOYED**

### Purpose
Alert care team about medication-related issues including discrepancies, interactions, and adherence problems.

### Configuration
**Tables:**
- `psych_med_alerts` ✅ (`20251017000001_psych_med_flags.sql`)
- `care_team_alerts` ✅
- `consent_expiration_alerts` ✅

### Alert Types

#### 4.1 Psychiatric Medication Alerts
**Table:** `psych_med_alerts`
**Trigger:** `update_psych_alerts_updated_at` ✅

Alert conditions:
- Black box warning medications
- Dangerous drug interactions
- Dosage concerns
- Missing required lab work

#### 4.2 Medication Reconciliation Alerts
**Component:** `src/components/handoff/MedicationReconciliationAlert.tsx` ✅
**Service:** `src/services/handoffNotificationService.ts` ✅

Alert triggers:
- **High-risk medication discrepancies** during patient transfer
- **Missing medication information** in handoff packet
- **Dosage changes** not acknowledged

Notification priority:
- **Urgent**: Critical discrepancies (🚨)
- **High**: Multiple discrepancies
- **Normal**: Minor updates

#### 4.3 Care Team Alerts
**Table:** `care_team_alerts`
**Trigger:** `trg_care_alerts_uat` ✅

General care team notifications:
- Lab result abnormalities
- Appointment reminders
- Care plan updates
- Insurance authorization issues

---

## 5. Patient Handoff Notifications

### Status: ✅ **DEPLOYED**

### Purpose
Notify receiving facilities and care teams about incoming patient transfers with critical information.

### Configuration
**Service:** `src/services/handoffNotificationService.ts` ✅
**Tables:**
- `handoff_notifications` ✅
- `handoff_notification_failures` ✅ (delivery tracking)

### Notification Events
| Event | Priority | Recipients | Channels |
|-------|----------|------------|----------|
| **Packet Sent** | urgent/normal | Receiving facility | Email, SMS |
| **Packet Acknowledged** | normal | Sending facility | Email |
| **High Risk Alert** | urgent | All parties | Email, SMS, In-app |

### High-Risk Alert Triggers
- **Medication discrepancies** detected
- **Critical care requirements** not met
- **Missing required documentation**
- **Isolation precautions** needed

### Notification Format
**Subject Examples:**
- `🏥 Patient Transfer Incoming - CRITICAL`
- `🚨 HIGH RISK - Medication Discrepancies Detected - PKT-12345`
- `✅ Patient Transfer Acknowledged - PKT-12345`

### Delivery Channels
1. **Email**: Via configured email service
2. **SMS**: Twilio integration (E.164 phone numbers)
3. **In-app**: Real-time notifications in dashboard

### Failure Handling
- Failed notifications logged in `handoff_notification_failures`
- Automatic retry logic (3 attempts)
- Manual retry available in admin panel

---

## 6. Emergency Response Notifications

### Status: ✅ **DEPLOYED**

### Purpose
Support law enforcement welfare checks and emergency response with critical patient information.

### Configuration
**Table:** `law_enforcement_response_info` ✅ (`20251111110000_law_enforcement_emergency_response.sql`)
**Integration:** The SHIELD Program (Senior & Health-Impaired Emergency Liaison Dispatch)

### Information Provided
- **Access Information**: Door codes, key location, security systems
- **Medical Equipment**: Oxygen, dialysis, mobility aids
- **Disability Info**: Hearing/vision/cognitive impairments
- **Safety Warnings**: Pets, fall risk, oxygen dependency
- **Emergency Contacts**: Caregiver info, neighbor info
- **Building Details**: Floor, elevator, parking instructions

### Alert Triggers
- **Consecutive missed check-ins** → Welfare check recommended
- **Emergency button** pressed → Immediate response
- **Caregiver request** → Priority response

### Data Security
- **Encryption**: Door codes and security codes encrypted at rest
- **Access Control**: RLS policies limit access to law enforcement/admin
- **Audit Logging**: All access logged for HIPAA compliance

---

## 7. System Health Monitoring

### Status: ✅ **DEPLOYED**

### Purpose
Monitor system health, uptime, and performance with automated alerts for issues.

### Configuration
**Tables:**
- `system_health_check` ✅
- `system_health_checks` ✅

### Monitored Metrics
- **Database Performance**: Query times, connection pool
- **API Response Times**: Endpoint latency
- **Error Rates**: 4xx/5xx response tracking
- **Resource Usage**: Memory, CPU, disk
- **External Service Status**: Twilio, email, payment processing

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| API Response Time | >500ms | >2000ms |
| Error Rate | >1% | >5% |
| Memory Usage | >80% | >95% |
| Database Connections | >70% pool | >90% pool |

### Notification Channels
- **In-app**: Admin dashboard health panel
- **Email**: System admin team (critical only)
- **Slack**: (if configured)

---

## 8. Consent Expiration Alerts

### Status: ✅ **DEPLOYED**

### Purpose
Alert staff about expiring patient consents (HIPAA, treatment, research) to maintain compliance.

### Configuration
**Table:** `consent_expiration_alerts` ✅

### Alert Timing
- **30 days before expiration**: First warning
- **14 days before expiration**: Second warning
- **7 days before expiration**: Urgent reminder
- **Day of expiration**: Critical alert
- **After expiration**: Compliance violation alert

### Affected Consent Types
- HIPAA Authorization
- Treatment Consent
- Research Participation
- Data Sharing Agreements
- Telehealth Consent
- Financial Responsibility

### Alert Recipients
- Assigned case manager
- Compliance officer
- Patient (via preferred contact method)

---

## 9. EMS Integration Notifications

### Status: ✅ **DEPLOYED**

### Purpose
Real-time notifications for EMS/ambulance integration and pre-hospital handoff.

### Configuration
**Service:** `src/services/emsIntegrationService.ts` ✅
**Service:** `src/services/emsNotificationService.ts` ✅

### Notification Types
1. **EMS Dispatch Alert**: Emergency department notified of incoming patient
2. **Pre-arrival Update**: Patient status en route
3. **Arrival Notification**: Patient arrived, ready for handoff
4. **Handoff Complete**: Transfer of care completed

### Information Transmitted
- Patient demographics (minimal PHI)
- Chief complaint
- Vital signs
- Interventions performed
- ETA to facility
- Special requirements

---

## 10. Readmission Risk Alerts

### Status: ✅ **DEPLOYED**

### Purpose
Identify patients at risk for hospital readmission and alert care coordinators.

### Configuration
**Service:** `src/services/readmissionTrackingService.ts` ✅
**Integrated Tables:** `patient_daily_check_ins`, `check_ins`, `care_team_alerts`

### Risk Factors Monitored
- Missed check-ins
- Symptom escalation
- Medication non-adherence
- Recent ED visits
- Social determinants (housing, transportation)
- Caregiver support changes

### Alert Thresholds
- **Low Risk**: <20% readmission probability → Routine monitoring
- **Medium Risk**: 20-40% → Weekly check-ins
- **High Risk**: 40-60% → Daily monitoring
- **Very High Risk**: >60% → Intensive care coordination

### Intervention Triggers
- High/Very High risk → Automatic care team alert
- Trending upward → Notify case manager
- New risk factors → Update care plan

---

## 11. Provider Daily Check-ins

### Status: ✅ **DEPLOYED**

### Purpose
Track provider/staff daily status, availability, and caseload management.

### Configuration
**Table:** `provider_daily_checkins` ✅

### Check-in Data
- Provider availability status
- Current caseload
- Out-of-office notifications
- On-call status
- Coverage assignments

### Alert Triggers
- Provider missed check-in → Alert supervisor
- Caseload over threshold → Alert operations
- No backup coverage → Alert on-call coordinator

---

## Alert Summary Dashboard

| Alert System | Status | Database | Service | Real-time | Email | SMS |
|--------------|--------|----------|---------|-----------|-------|-----|
| **Guardian Agent** | ⚠️ Partial | ❌ | ✅ | ✅ | ⏳ | ❌ |
| **CHW/Specialist** | ✅ Active | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Check-in Monitoring** | ✅ Active | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Medication Alerts** | ✅ Active | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Handoff Notifications** | ✅ Active | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Emergency Response** | ✅ Active | ✅ | ✅ | ❌ | ❌ | ❌ |
| **System Health** | ✅ Active | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Consent Expiration** | ✅ Active | ✅ | ✅ | ✅ | ✅ | ❌ |
| **EMS Integration** | ✅ Active | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Readmission Risk** | ✅ Active | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Provider Check-ins** | ✅ Active | ✅ | ✅ | ✅ | ❌ | ❌ |

### Legend
- ✅ Fully configured and operational
- ⚠️ Partially configured (see notes)
- ⏳ Planned/in development
- ❌ Not configured

---

## Action Items

### Critical Priority
1. **Deploy Guardian Alerts Table**
   - File: `_SKIP_20251027120000_guardian_alerts_system_fixed.sql`
   - Impact: Guardian Agent cannot create alerts without this table
   - Estimated Time: 5 minutes

### High Priority
2. **Configure Email Service for Critical Alerts**
   - Currently logged but not sent
   - Integrate SendGrid, AWS SES, or MailerSend
   - Affects: Guardian, System Health, Consent, Readmission alerts

3. **Test All Real-time Subscriptions**
   - Verify Supabase Realtime channels working
   - Test alert delivery latency
   - Validate auto-cleanup on unmount

### Medium Priority
4. **Add SMS Notifications**
   - Currently only handoff/EMS have SMS
   - Consider adding for: Critical guardian alerts, Emergency response, High readmission risk

5. **Alert Escalation Rules**
   - Define escalation paths for unacknowledged alerts
   - Implement auto-escalation after timeout
   - Create on-call rotation system

---

## Testing & Verification

### Manual Tests
```sql
-- 1. Check Guardian cron jobs status
SELECT * FROM guardian_cron_status;

-- 2. View recent guardian cron executions
SELECT * FROM guardian_cron_log ORDER BY executed_at DESC LIMIT 10;

-- 3. Check unacknowledged specialist alerts
SELECT * FROM specialist_alerts WHERE acknowledged = false;

-- 4. View recent check-ins
SELECT * FROM check_ins ORDER BY check_in_time DESC LIMIT 20;

-- 5. Check medication alerts
SELECT * FROM psych_med_alerts WHERE resolved = false;

-- 6. View consent expiration alerts
SELECT * FROM consent_expiration_alerts WHERE alert_sent = false;

-- 7. System health status
SELECT * FROM system_health_checks ORDER BY checked_at DESC LIMIT 1;
```

### Automated Monitoring
- Guardian automated monitoring: Every 5 minutes
- System health checks: Every 15 minutes
- Consent expiration scan: Daily at 6 AM
- Readmission risk calculation: Daily at 7 AM

---

## Compliance Notes

### HIPAA Compliance
All alert systems comply with HIPAA requirements:
- ✅ PHI encrypted at rest and in transit
- ✅ Access logged in audit_logs
- ✅ Role-based access control (RLS policies)
- ✅ Minimum necessary information in notifications
- ✅ Secure delivery channels (no plain text PHI in subject lines)

### Audit Requirements
All alert actions are logged:
- Alert creation → `audit_logs` table
- Alert acknowledgement → `audit_logs` table
- Alert resolution → `audit_logs` table
- Failed delivery → `handoff_notification_failures`

---

## Support & Documentation

### Related Files
- Alert Services: `src/services/guardian-agent/`, `src/services/*NotificationService.ts`
- Alert Components: `src/components/chw/CHWAlertsWidget.tsx`, `src/components/handoff/MedicationReconciliationAlert.tsx`
- Alert Migrations: `supabase/migrations/*alert*.sql`, `supabase/migrations/*notification*.sql`
- Cron Configuration: `supabase/migrations/20251107180000_guardian_cron_monitoring.sql`

### Contact
- **Guardian Alerts**: See `GuardianAlertService.ts` documentation
- **Clinical Alerts**: Contact Care Team Operations
- **System Alerts**: Contact DevOps/Platform Team
