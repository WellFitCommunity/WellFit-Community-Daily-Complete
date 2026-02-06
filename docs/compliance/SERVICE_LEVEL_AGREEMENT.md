# Service Level Agreement (SLA)

**Envision Virtual Edge Group LLC**
**Effective Date:** February 6, 2026
**Version:** 1.0
**Next Review:** August 6, 2026

---

## Purpose

This document defines the service level commitments for the WellFit Community and Envision Atlus platforms provided by Envision Virtual Edge Group LLC to its customers (healthcare organizations, community health centers, and clinical partners).

---

## Service Definitions

| Service | Description | Classification |
|---------|-------------|----------------|
| **WellFit Community** | Community engagement platform (check-ins, meals, activities, wellness tracking) | Core |
| **Envision Atlus** | Clinical care management engine (FHIR, care plans, risk assessment, AI clinical services) | Core |
| **SHIELD Dispatch** | Welfare check coordination and dispatch system | Core |
| **Interoperability** | FHIR R4, HL7 v2.x, X12 837/835 claim processing | Integration |
| **AI Clinical Services** | 40+ Claude-powered clinical intelligence features | Enhanced |
| **Notifications** | SMS (Twilio) and email (MailerSend) delivery | Supporting |

---

## Availability Commitments

### Platform Availability

| Service Tier | Monthly Uptime | Max Downtime/Month | Applies To |
|-------------|:-------------:|:-------------------:|------------|
| **Core Services** | 99.9% | 43 minutes | WellFit, Envision Atlus, SHIELD |
| **Integration Services** | 99.5% | 3.6 hours | FHIR, HL7, claims processing |
| **Enhanced Services** | 99.0% | 7.3 hours | AI clinical services |
| **Supporting Services** | 99.0% | 7.3 hours | SMS, email notifications |

### Measurement

- Uptime measured from Supabase and Vercel status monitoring
- Scheduled maintenance windows excluded from calculations
- Third-party outages (Anthropic, Twilio, MailerSend) tracked but reported separately
- Monthly availability reports provided to contracted customers

### Scheduled Maintenance

| Parameter | Policy |
|-----------|--------|
| Maintenance window | Sundays 02:00-06:00 CT |
| Advance notice | 72 hours minimum |
| Emergency maintenance | 4 hours notice when possible |
| Maximum scheduled downtime | 4 hours per month |

---

## Performance Targets

### Response Time

| Operation | Target (p95) | Maximum |
|-----------|:------------:|:-------:|
| Page load (initial) | < 2 seconds | 5 seconds |
| Page navigation (SPA) | < 500ms | 2 seconds |
| Database query (simple) | < 100ms | 500ms |
| Database query (complex/aggregate) | < 500ms | 2 seconds |
| Edge Function execution | < 1 second | 5 seconds |
| AI clinical analysis | < 10 seconds | 30 seconds |
| FHIR resource retrieval | < 500ms | 2 seconds |
| HL7 message processing | < 2 seconds | 10 seconds |

### Throughput

| Metric | Capacity |
|--------|----------|
| Concurrent users per tenant | 500+ |
| Daily check-ins processed | 10,000+ |
| FHIR resources per sync | 1,000+ per batch |
| AI operations per hour | 500+ |
| Claims submissions per day | 1,000+ |

---

## Incident Response

### Severity Classification

| Severity | Definition | Examples |
|----------|-----------|----------|
| **P0 - Critical** | Complete service outage or confirmed data breach | Database down, PHI exposure, authentication failure |
| **P1 - Major** | Significant degradation affecting clinical workflows | AI services down, FHIR sync broken, claims processing halted |
| **P2 - Minor** | Limited impact, workaround available | Single feature unavailable, slow performance, notification delays |
| **P3 - Low** | Cosmetic or non-urgent issues | UI rendering issues, minor display errors |

### Response Time Commitments

| Severity | Acknowledgment | Status Update | Resolution Target |
|----------|:--------------:|:-------------:|:-----------------:|
| **P0** | 15 minutes | Every 30 minutes | 4 hours |
| **P1** | 1 hour | Every 2 hours | 8 hours |
| **P2** | 4 hours | Daily | 3 business days |
| **P3** | 1 business day | Weekly | 10 business days |

### Escalation Path

| Level | Timeframe | Contact |
|-------|-----------|---------|
| L1 - Engineering | Immediate | engineering@thewellfitcommunity.org |
| L2 - Clinical Director | P0: 15 min / P1: 1 hour | maria@wellfitcommunity.com |
| L3 - Executive | P0: 1 hour / P1: 4 hours | Executive team |

---

## Data Protection

### Backup and Recovery

| Commitment | Target |
|------------|--------|
| Recovery Point Objective (RPO) | 5 minutes (PITR) |
| Recovery Time Objective (RTO) - Database | 1 hour |
| Recovery Time Objective (RTO) - Full platform | 24 hours |
| Backup frequency | Daily automated + continuous WAL |
| Backup retention | 30 days |
| Backup encryption | AES-256 |

### Data Residency

| Data Type | Location | Encryption |
|-----------|----------|------------|
| All PHI | US (AWS us-east-1) | AES-256 at rest + TLS 1.3 in transit |
| Application-layer encrypted fields | US (AWS us-east-1) | Additional AES encryption |
| Backups | US (AWS) | AES-256 |
| CDN cache | Global edge (no PHI) | TLS 1.3 |

---

## Support

### Support Channels

| Channel | Availability | Response Target |
|---------|:------------:|:---------------:|
| Email (support@thewellfitcommunity.org) | 24/7 | 4 hours (P0-P1), 1 business day (P2-P3) |
| Security issues (security@thewellfitcommunity.org) | 24/7 | 24-hour acknowledgment |
| Phone (emergency) | 24/7 for P0 | Immediate |

### Support Scope

| Included | Not Included |
|----------|-------------|
| Platform availability issues | End-user device configuration |
| Clinical workflow support | Custom report development |
| Integration troubleshooting (FHIR, HL7) | Third-party system configuration |
| Security incident response | Network infrastructure at customer site |
| Bug fixes and patches | Feature requests (tracked separately) |

---

## Compliance Commitments

| Standard | Commitment | Evidence |
|----------|-----------|----------|
| HIPAA Security Rule | Full compliance | Annual risk assessment, BAAs with all processors |
| HIPAA Privacy Rule | Full compliance | PHI data flow documentation, access controls |
| SOC 2 Type II | Infrastructure compliance via Supabase | Supabase SOC 2 report available |
| FHIR R4 | Conformance | FHIR validation on all resources |
| HL7 v2.x | ADT, ORU, ORM message support | Message validation and ACK generation |
| X12 837P/837I | Claims submission compliance | EDI validation before submission |
| WCAG 2.1 AA | Accessibility compliance | Senior-friendly UI with 44px touch targets, 16px+ fonts |

---

## Exclusions

The following are excluded from SLA calculations:

1. **Force majeure** - Natural disasters, acts of war, government actions
2. **Customer-caused issues** - Misconfiguration, unauthorized modifications
3. **Third-party outages** - Anthropic, Twilio, MailerSend, clearinghouse downtime (tracked separately)
4. **Scheduled maintenance** - Within announced maintenance windows
5. **Beta/preview features** - Features explicitly marked as beta
6. **Connectivity issues** - Customer internet or network problems

---

## Reporting

### Monthly Reports

Contracted customers receive monthly service reports including:
- Platform availability percentage
- Incident summary (if any)
- Performance metrics against targets
- Upcoming maintenance schedule

### Quarterly Business Reviews

Enterprise customers receive quarterly reviews including:
- Trend analysis of platform usage
- AI service utilization and cost
- Security posture updates
- Feature roadmap preview

---

## SLA Credits

| Monthly Uptime | Credit (% of monthly fee) |
|:--------------:|:-------------------------:|
| 99.9% - 99.0% | 0% (within commitment) |
| 99.0% - 98.0% | 10% |
| 98.0% - 95.0% | 25% |
| Below 95.0% | 50% |

**Credit Request Process:**
1. Customer submits credit request within 30 days of incident
2. Envision Virtual Edge Group LLC validates downtime against monitoring data
3. Credit applied to next billing cycle
4. Maximum credit: 50% of monthly fee per incident

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-06 | Initial SLA document |

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
