# Access Control Policy

**Document ID:** ACP-002
**Owner:** AI Systems Director (Maria)
**Approver:** Chief Compliance and Accountability Officer (Akima)
**Effective Date:** `<YYYY-MM-DD>`
**Last Reviewed:** `<YYYY-MM-DD>`
**Review Cadence:** Annual, with quarterly access reviews
**Classification:** Internal — Confidential

---

## 1. Purpose

This policy defines how access to Company systems, data, and infrastructure is granted, reviewed, and revoked, to ensure that individuals and services have only the minimum access necessary to perform their duties (principle of least privilege).

---

## 2. Scope

Applies to all access to:
- Supabase (database, edge functions, auth)
- GitHub repositories
- Third-party SaaS (Anthropic, MailerSend, Twilio, Vercel)
- Patient PHI and customer data
- Source code and build systems

---

## 3. Policy Statements

### 3.1 Authentication

3.1.1 All human access to production systems requires:
- Unique user account (no shared credentials)
- Strong password meeting policy (minimum 12 characters, complexity enforced)
- Multi-factor authentication (MFA/TOTP) for administrative access

3.1.2 Machine-to-machine access uses API keys or JWTs issued by Supabase. Keys follow the naming convention documented in `/.claude/rules/supabase.md` §13-14 (primary: `SB_*`, legacy fallback: `SUPABASE_*`).

3.1.3 All edge functions must authenticate callers via `supabase.auth.getUser(token)` before processing requests (reference: `/.claude/rules/adversarial-audit-lessons.md` §2). Zero-auth edge functions are a Tier 4 forbidden pattern.

### 3.2 Authorization

3.2.1 Authorization is enforced at two layers:
- **Application layer:** Role checks via `user_roles` table and `profiles.role_id`
- **Database layer:** PostgreSQL Row Level Security (RLS) policies, which are authoritative

3.2.2 Roles are defined as:
| Role ID | Role Name | Description |
|---------|-----------|-------------|
| 1 | super_admin | Full system access; may modify any tenant |
| 2 | admin | Tenant-scoped administration |
| 3 | clinical | Clinical staff (nurses, providers) within their tenant |
| 4 | member | End users (patients, community members) |

3.2.3 Tenant isolation is enforced via `get_current_tenant_id()` in all multi-tenant RLS policies. No query may access data from a tenant other than the caller's, except through explicit super_admin role and audit logging.

3.2.4 Service role keys (Supabase `SB_SECRET_KEY`) bypass RLS and are restricted to edge functions performing system operations. Service role access is audit-logged.

### 3.3 Provisioning and Deprovisioning

3.3.1 **Onboarding:** New personnel are granted access via:
- Supabase Auth account creation
- Role assignment in `user_roles` table
- GitHub collaborator invitation (with appropriate permission level)
- Documented in `docs/compliance/onboarding/<user-name>-onboarding-YYYYMMDD.md`

3.3.2 **Offboarding:** Upon termination or role change:
- Supabase account disabled within 4 hours (critical path)
- GitHub access revoked within 4 hours
- Third-party SaaS access revoked within 24 hours
- Documented in `docs/compliance/offboarding/<user-name>-offboarding-YYYYMMDD.md`

3.3.3 **Role changes:** Require documented justification and approval by the AI Systems Director.

### 3.4 Access Reviews

3.4.1 Quarterly access reviews are performed by the AI Systems Director. Each review:
- Enumerates all accounts with `super_admin` and `admin` roles
- Validates each account's continued business need
- Removes unnecessary access
- Documents the review in `docs/compliance/access-reviews/YYYY-Q#-access-review.md`

3.4.2 Annual comprehensive reviews additionally cover:
- All third-party service accounts
- API key inventory and rotation status
- Service role usage patterns

### 3.5 Privileged Access

3.5.1 Super admin actions are logged to `admin_audit_log` with full context.

3.5.2 Emergency "break-the-glass" access (when implemented per ONC-9) requires:
- Explicit request with justification
- Time-limited elevation
- Notification to both Maria and Akima
- Post-event review

### 3.6 Password and Secret Management

3.6.1 Passwords are hashed using bcrypt (never plaintext).

3.6.2 API keys and secrets are stored in Supabase secrets or environment variables — never in source code. The security scan pipeline detects patterns in committed files.

3.6.3 `VITE_*` environment variables are browser-visible and must not contain secrets. This is enforced by rule `/.claude/rules/adversarial-audit-lessons.md` §3.

3.6.4 Key rotation cadence:
| Key Type | Rotation |
|----------|----------|
| `SB_SECRET_KEY` (Supabase) | Annual or upon suspected compromise |
| JWT signing keys | Every 90 days (zero-downtime rotation via standby keys) |
| Anthropic API key | Annual or upon personnel change |
| Third-party API keys | Per vendor recommendation, minimum annual |

---

## 4. Roles and Responsibilities

| Role | Responsibilities |
|------|------------------|
| AI Systems Director | Approves access grants; performs quarterly reviews; owns this policy |
| Chief Compliance Officer | Approves clinical access; reviews PHI access patterns |
| All Personnel | Maintain password hygiene; report lost credentials within 1 hour; complete MFA setup |

---

## 5. Evidence and Controls

| Control | Location | TSC Mapping |
|---------|----------|-------------|
| RLS policies | `supabase/migrations/*` | CC6.1 |
| User roles table | `user_roles`, `profiles.role_id` | CC6.2 |
| JWT verification in edge functions | All edge functions per `/.claude/rules/adversarial-audit-lessons.md` §2 | CC6.1 |
| Tenant isolation | `get_current_tenant_id()` function | CC6.1 |
| Audit logs | `admin_audit_log`, `phi_access_logs` | CC6.3 |
| MFA infrastructure | `envision-totp-setup`, `envision-totp-verify` edge functions | CC6.6 |
| Password hashing | `hash-pin`, `bcryptjs` usage | CC6.7 |
| Secret scan pipeline | `.github/workflows/security-scan.yml` | CC6.7 |

---

## 6. Policy Exceptions

Exceptions require written approval from the AI Systems Director and are documented in `docs/compliance/exceptions/` with a time-bound remediation plan.

---

## 7. Enforcement

- Unauthorized access attempts are logged to `security_events` and investigated per the Incident Response Policy.
- Repeated policy violations may result in access revocation.
- RLS policies that do not enforce identity (e.g., `WITH CHECK (true)` on audit tables) are automatically flagged as violations.

---

## 8. Related Documents

- Information Security Policy (ISP-001)
- Incident Response Policy (IRP-003)
- `/.claude/rules/supabase.md` (technical controls)
- `/.claude/rules/adversarial-audit-lessons.md` (regression prevention)

---

## 9. Approval and Signatures

**AI Systems Director**
Name: Maria LeBlanc
Signature: _______________________________
Date: _____________________________________

**Chief Compliance and Accountability Officer**
Name: Akima Nelson
Signature: _______________________________
Date: _____________________________________

---

## Revision History

| Version | Date | Author | Change Summary |
|---------|------|--------|----------------|
| 1.0 | `<YYYY-MM-DD>` | Maria LeBlanc | Initial policy |
