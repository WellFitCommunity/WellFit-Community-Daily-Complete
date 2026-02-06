# Security Policy

## Automated Security Testing

This project includes comprehensive automated security testing to maintain high security standards.

### Security Scans

| **Scan Type** | **Frequency** | **Tool** | **Coverage** |
|---------------|---------------|----------|--------------|
| **Dependency Vulnerabilities** | Every push + Weekly | npm audit, CodeQL | Known CVEs in dependencies |
| **Code Security** | Every push | ESLint Security Plugin | Security anti-patterns |
| **Secret Detection** | Every push | Custom regex patterns | Hardcoded credentials |
| **CORS Configuration** | Every push | Custom checks | Wildcard origins, allowlists |
| **Security Headers** | Every push | Custom validation | CSP, XSS protection, etc. |

### Running Security Tests

#### Local Development
```bash
# Run comprehensive security check
npm run security:check

# Check for dependency vulnerabilities
npm run security:audit

# Run security-focused linting
npm run lint:security

# Fix automatically fixable vulnerabilities
npm run security:fix
```

#### Automated Pipeline
Security scans run automatically on:
- Every push to `main` or `develop` branches
- Every pull request to `main`
- Weekly schedule (Mondays at 2 AM UTC)

### Security Features Implemented

#### ✅ **Authentication & Authorization**
- Multi-factor authentication via SMS (Twilio)
- Role-based access control (RLS)
- Strong password policies (8+ chars, complexity requirements)
- Session management with configurable timeouts
- Phone verification before account creation

#### ✅ **Input Validation & Protection**
- Comprehensive input validation using Zod schemas
- SQL injection protection via Supabase ORM
- Phone number normalization and E.164 validation
- hCaptcha bot protection on registration

#### ✅ **Security Headers**
- **Content Security Policy (CSP)**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Browser XSS filtering
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

#### ✅ **CORS Security**
- Explicit origin allowlists (no wildcards)
- Proper preflight request handling
- Domain-specific CORS policies

#### ✅ **Data Protection**
- Encrypted connections (HTTPS enforced)
- Secure password reset flow
- Generic error messages (no information leakage)
- Audit logging for sensitive operations

### Content Security Policy (CSP)

Our CSP policy allows:

| **Directive** | **Allowed Sources** |
|---------------|-------------------|
| `default-src` | `'self'` |
| `script-src` | `'self'`, hCaptcha, Google services |
| `style-src` | `'self'`, Google Fonts, inline styles |
| `img-src` | `'self'`, data URIs, HTTPS sources |
| `connect-src` | `'self'`, Supabase, Twilio, MailerSend, image CDNs |
| `frame-src` | `'self'`, hCaptcha |
| `object-src` | `'none'` (blocks plugins) |

### Vulnerability Reporting

#### Responsible Disclosure
If you discover a security vulnerability, please:

1. **DO NOT** create a public GitHub issue
2. Email security details to: `security@thewellfitcommunity.org`
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if any)

#### Response Timeline
- **Acknowledgment**: Within 24 hours
- **Initial Assessment**: Within 72 hours
- **Status Updates**: Weekly until resolution
- **Fix Deployment**: Based on severity (critical: 24-48h, high: 1 week, medium: 2 weeks)

### Security Compliance

#### Current Compliance Status
- ✅ **OWASP Top 10 (2021)**: 9/10 categories compliant
- ✅ **SOC 2 Security**: Implementation ready
- ✅ **HIPAA**: Basic compliance for healthcare data
- ⚠️ **PCI DSS**: Not applicable (no card data processing)

#### Audit Schedule
- **Internal Security Review**: Every 3 months
- **External Penetration Testing**: Annually
- **Dependency Updates**: Monthly
- **Security Training**: Quarterly for development team

### Security Architecture

#### Frontend (React)
- Content Security Policy enforcement
- Input sanitization and validation
- Secure authentication context
- No `dangerouslySetInnerHTML` usage

#### Backend (Supabase Functions)
- Row Level Security (RLS) enabled
- Comprehensive input validation
- Secure error handling
- Audit logging for admin actions

#### Database (Supabase)
- Encrypted at rest and in transit
- Row Level Security policies
- Foreign key constraints
- Audit trails for sensitive operations

#### Infrastructure
- HTTPS enforced (HSTS headers)
- Environment variable security
- Regular dependency updates
- Automated vulnerability scanning

### Development Security Guidelines

#### For Developers
1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Use Zod schemas consistently
3. **Follow the principle of least privilege** - Minimal role permissions
4. **Test security features** - Run security checks before commits
5. **Keep dependencies updated** - Monthly security updates

#### Code Review Checklist
- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented
- [ ] Authorization checks in place
- [ ] Error handling doesn't leak sensitive info
- [ ] Security headers configured
- [ ] CORS properly configured

### Incident Response Plan

#### Security Incident Classification
- **P0 (Critical)**: Active data breach, system compromise
- **P1 (High)**: Authentication bypass, privilege escalation
- **P2 (Medium)**: Information disclosure, denial of service
- **P3 (Low)**: Security configuration issues

#### Response Actions
1. **Immediate**: Isolate affected systems
2. **Assessment**: Determine scope and impact
3. **Containment**: Stop the attack vector
4. **Eradication**: Remove threats and vulnerabilities
5. **Recovery**: Restore normal operations
6. **Documentation**: Incident report and lessons learned

---

**Last Updated**: February 6, 2026
**Next Review**: May 6, 2026
**Security Contact**: security@thewellfitcommunity.org