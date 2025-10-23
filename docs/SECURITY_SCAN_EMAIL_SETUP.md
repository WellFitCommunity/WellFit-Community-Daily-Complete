# Security Scan Email Notification Setup

**Company:** Envision VirtualEdge Group LLC
**Application:** WellFit Community Healthcare Platform
**Last Updated:** 2025-10-23

---

## Overview

The security scan workflow has been configured to send weekly email reports to:
- maria@thewellfitcommunity.org
- akima@thewellfitcommunity.org

**Schedule:** Every Monday at 2:00 AM UTC

---

## Configuration Steps

### 1. Set Up GitHub Secrets

The email notification requires two GitHub secrets to be configured:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:

#### Required Secrets

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `MAIL_USERNAME` | Email account username (Gmail recommended) | `security@thewellfitcommunity.org` |
| `MAIL_PASSWORD` | App-specific password (NOT your regular password) | `abcd efgh ijkl mnop` |

### 2. Gmail App Password Setup

If using Gmail (recommended), you need to create an **App Password**:

1. Go to your Google Account: https://myaccount.google.com
2. Select **Security** from the left menu
3. Under "Signing in to Google," select **2-Step Verification** (you must enable this first)
4. At the bottom of the page, select **App passwords**
5. Select **Mail** for the app and **Other** for the device
6. Enter "WellFit Security Scan" as the device name
7. Click **Generate**
8. Copy the 16-character password (spaces removed)
9. Use this password for the `MAIL_PASSWORD` secret

### 3. Alternative Email Services

If not using Gmail, you can configure other SMTP services:

#### SendGrid
```yaml
server_address: smtp.sendgrid.net
server_port: 587
username: apikey
password: ${{secrets.SENDGRID_API_KEY}}
```

#### Mailgun
```yaml
server_address: smtp.mailgun.org
server_port: 587
username: postmaster@yourdomain.mailgun.org
password: ${{secrets.MAILGUN_PASSWORD}}
```

#### Microsoft 365 / Outlook
```yaml
server_address: smtp.office365.com
server_port: 587
username: ${{secrets.MAIL_USERNAME}}
password: ${{secrets.MAIL_PASSWORD}}
```

---

## Email Recipients

To change email recipients, edit the workflow file:

**File:** `.github/workflows/security-scan.yml`

**Line 13:**
```yaml
env:
  NOTIFICATION_EMAILS: "maria@thewellfitcommunity.org,akima@thewellfitcommunity.org"
```

To add more recipients, separate email addresses with commas:
```yaml
env:
  NOTIFICATION_EMAILS: "maria@thewellfitcommunity.org,akima@thewellfitcommunity.org,tech@example.com"
```

---

## Email Content

The automated emails include:

### Plain Text Version
- Scan status (Success/Failure)
- GitHub Actions workflow link
- Branch and commit information
- Timestamp

### HTML Version
Professional formatted email with:
- Color-coded status indicators
- Direct link button to view full report
- Scan details table
- Action items for addressing findings
- Company branding

---

## Troubleshooting

### Email Not Sending

**Check 1: Verify Secrets**
```bash
# In GitHub Actions, you can test if secrets are set (without revealing values)
if [ -z "${{ secrets.MAIL_USERNAME }}" ]; then
  echo "MAIL_USERNAME secret is not set"
fi
```

**Check 2: SMTP Connection**
- Verify your email provider allows SMTP connections
- Check if firewall rules block port 587
- Confirm 2FA and App Passwords are configured (for Gmail)

**Check 3: Email Delivery**
- Check spam/junk folders
- Verify recipient email addresses are correct
- Check email provider's sending limits

### Gmail Specific Issues

**"Less secure app access"**
- Gmail requires App Passwords (not regular passwords)
- Enable 2-Step Verification first
- Generate an App Password specifically for this workflow

**Rate Limiting**
- Gmail has sending limits (typically 500/day for regular accounts)
- Consider using Google Workspace for higher limits

---

## Testing

To test the email notification without waiting for the weekly schedule:

### Option 1: Manual Workflow Trigger
1. Go to GitHub Actions
2. Select the "Security Scan" workflow
3. Click "Run workflow"
4. Select the branch
5. Click "Run workflow"

### Option 2: Test with Push
Push a commit to the `main` or `develop` branch, which will trigger the workflow immediately:

```bash
git commit --allow-empty -m "Test security scan email notification"
git push origin main
```

---

## Security Considerations

### 1. Protect Email Credentials
- **NEVER** commit email passwords to the repository
- **ALWAYS** use GitHub Secrets
- Use App Passwords, not regular account passwords
- Rotate passwords periodically (every 90 days recommended)

### 2. Email Content Security
- The emails contain links to GitHub Actions (private repository)
- Ensure recipients have appropriate GitHub access
- Do NOT include sensitive scan data in email body
- Direct users to secure GitHub Actions page for full details

### 3. Recipient Verification
- Verify all recipient email addresses are current employees
- Remove email addresses when team members leave
- Use distribution lists for teams when possible

---

## Schedule Modification

The security scan is currently scheduled for **weekly** execution.

### Current Schedule
```yaml
schedule:
  - cron: '0 2 * * 1'  # Every Monday at 2:00 AM UTC
```

### Common Schedule Modifications

**Daily:**
```yaml
schedule:
  - cron: '0 2 * * *'  # Every day at 2:00 AM UTC
```

**Bi-weekly:**
```yaml
schedule:
  - cron: '0 2 * * 1'  # Every Monday at 2:00 AM UTC
  - cron: '0 2 * * 4'  # AND every Thursday at 2:00 AM UTC
```

**Monthly:**
```yaml
schedule:
  - cron: '0 2 1 * *'  # First day of every month at 2:00 AM UTC
```

**Cron Syntax Reference:**
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

---

## Compliance Notes

### HIPAA Compliance
- Email notifications do NOT contain PHI
- Only scan results summary and links are included
- Full scan data remains in secure GitHub Actions environment

### SOC2 Compliance
- Automated security testing documentation (CC7.1)
- Weekly testing cadence meets periodic evaluation requirements
- Email notifications ensure stakeholder awareness

### Audit Trail
- All workflow runs are logged in GitHub Actions
- Email delivery can be audited via SMTP logs
- Scan results archived for 30 days in GitHub

---

## Support

### GitHub Actions Documentation
- https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
- https://docs.github.com/en/actions/security-guides/encrypted-secrets

### Email Action Documentation
- https://github.com/dawidd6/action-send-mail

### Contact
For questions or issues with the security scan:
- Create an issue in the repository
- Contact: tech@thewellfitcommunity.org

---

**Document Control:**
- **Version:** 1.0
- **Next Review:** 2026-01-23
- **Owner:** Envision VirtualEdge Group LLC

**END OF DOCUMENTATION**
