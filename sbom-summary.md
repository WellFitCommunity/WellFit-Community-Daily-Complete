# Software Bill of Materials (SBOM) Summary

**Generated:** 2025-09-25T17:15:45.563Z
**Application:** WellFit Community Healthcare Platform v0.1.0

## 📊 Component Overview
- **Total Components:** 60
- **Production Dependencies:** 28
- **Development Dependencies:** 28
- **High-Risk Components:** 0
- **Security-Relevant Components:** 7

## 🔐 Security-Critical Dependencies

### Authentication & Security
- **@supabase/auth-helpers-shared** (0.7.0) - Component dependency
- **@types/bcryptjs** (2.4.6) - Component dependency
- **bcryptjs** (3.0.2) - Password hashing for user security
- **supabase** (2.40.7) - Component dependency

### Healthcare Data Processing
- **@hcaptcha/react-hcaptcha** (1.12.1) - Bot protection for forms
- **@supabase/supabase-js** (2.57.2) - Healthcare database and authentication
- **@types/bcryptjs** (2.4.6) - Component dependency
- **bcryptjs** (3.0.2) - Password hashing for user security
- **react** (18.3.1) - UI framework for healthcare dashboard
- **supabase** (2.40.7) - Component dependency

### Encryption & Privacy
- **@types/bcryptjs** (2.4.6) - Component dependency
- **bcryptjs** (3.0.2) - Password hashing for user security

## ⚠️ High-Risk Components
*No high-risk components identified*

## 🔍 Monitoring Recommendations

1. **Daily**: Monitor high-risk and security-critical components
2. **Weekly**: Check for new vulnerability advisories
3. **Monthly**: Update dependencies and regenerate SBOM
4. **Quarterly**: Comprehensive security audit of all components

## 📋 Compliance Notes

This SBOM is generated for:
- **HIPAA Compliance**: Healthcare data protection requirements
- **Security Auditing**: Vulnerability management and tracking
- **Supply Chain Security**: Component provenance and integrity

For questions about this SBOM, contact: security@thewellfitcommunity.org
