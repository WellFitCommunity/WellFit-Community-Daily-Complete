# MailerSend Setup for GitHub Actions Email Notifications

## Why MailerSend Instead of Gmail?

✅ **Better for automated emails** (no App Password hassle)
✅ **Higher deliverability** (dedicated transactional email service)
✅ **Better tracking** (open rates, click rates, bounces)
✅ **Easier setup** (just one API token, no 2FA required)
✅ **Free tier**: 12,000 emails/month (more than enough for security scans)

---

## Step 1: Get Your MailerSend API Token

### Option A: If You Already Have a MailerSend Account

1. Go to https://www.mailersend.com/
2. Click "Sign In" (top right)
3. Enter your credentials and log in
4. Once logged in, go to: https://app.mailersend.com/api-tokens
5. Click "Generate new token"
6. Give it a name: `GitHub Actions WellFit Security Scan`
7. Select permissions:
   - ✅ Email send (required)
   - ✅ Analytics (optional, for tracking)
8. Click "Create token"
9. **COPY THE TOKEN IMMEDIATELY** - it looks like: `mlsn.abc123def456...` (you won't see it again)

### Option B: If You DON'T Have a MailerSend Account Yet

1. Go to https://www.mailersend.com/
2. Click "Sign Up Free" or "Get Started"
3. Fill in:
   - **Email**: `Maria@thewellfitcommunity.org`
   - **Password**: (create a strong password)
   - **Company name**: `WellFit Community` or `Envision VirtualEdge Group LLC`
4. Verify your email (check inbox for verification link)
5. Complete the onboarding wizard:
   - Use case: "Transactional Emails"
   - Volume: "Less than 10,000/month"
6. Once in the dashboard, go to: https://app.mailersend.com/api-tokens
7. Click "Generate new token"
8. Name: `GitHub Actions Security Scan`
9. Permissions: ✅ Email send
10. Click "Create"
11. **COPY THE TOKEN** - starts with `mlsn.`

---

## Step 2: Verify Your Sender Domain (IMPORTANT!)

MailerSend requires you to verify the domain you're sending from:

1. In MailerSend dashboard, go to: https://app.mailersend.com/domains
2. Click "Add domain"
3. Enter: `thewellfitcommunity.org`
4. MailerSend will show you DNS records to add:
   - **TXT record** (for domain verification)
   - **CNAME records** (for DKIM signing)
   - **MX record** (optional, for receiving)

### Add DNS Records (Go to Your Domain Registrar)

**Where to add these records depends on where you bought your domain:**
- GoDaddy: https://dcc.godaddy.com/manage/thewellfitcommunity.org/dns
- Namecheap: https://ap.www.namecheap.com/domains/domaincontrolpanel/thewellfitcommunity.org/advancedns
- Cloudflare: https://dash.cloudflare.com/
- Google Domains: https://domains.google.com/registrar/thewellfitcommunity.org/dns

**Add these records exactly as MailerSend shows them:**

```
Type: TXT
Name: _mailersend.thewellfitcommunity.org
Value: ms-domain-verification=... (copy from MailerSend)
TTL: 3600

Type: CNAME
Name: mail._domainkey.thewellfitcommunity.org
Value: mail._domainkey.mailersend.net
TTL: 3600

Type: TXT
Name: thewellfitcommunity.org
Value: v=spf1 include:spf.mailersend.net ~all
TTL: 3600
```

5. Wait 5-10 minutes for DNS propagation
6. Go back to MailerSend → Domains → Click "Verify"
7. Status should change to "Verified" ✅

---

## Step 3: Add MailerSend API Token to GitHub Secrets

1. Go to: https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/settings/secrets/actions
2. Click "New repository secret"
3. Add:
   - **Name**: `MAILERSEND_API_TOKEN`
   - **Value**: `mlsn.abc123def456...` (paste your token)
4. Click "Add secret"

---

## Step 4: Update GitHub Actions Workflow

I'll update the workflow file for you automatically, but here's what changes:

**Old (Gmail SMTP):**
```yaml
- name: Send email notification
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 587
    username: ${{secrets.MAIL_USERNAME}}
    password: ${{secrets.MAIL_PASSWORD}}
```

**New (MailerSend API):**
```yaml
- name: Send email notification via MailerSend
  run: |
    curl -X POST https://api.mailersend.com/v1/email \
      -H "Authorization: Bearer ${{ secrets.MAILERSEND_API_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{
        "from": {
          "email": "security-scan@thewellfitcommunity.org",
          "name": "WellFit Security Scan"
        },
        "to": [
          {
            "email": "maria@thewellfitcommunity.org",
            "name": "Maria"
          }
        ],
        "subject": "Security Scan Report - ${{ job.status }}",
        "html": "...",
        "text": "..."
      }'
```

---

## Step 5: Test the Setup

```bash
# Trigger the workflow
git commit --allow-empty -m "test: verify MailerSend email notifications"
git push

# Watch the workflow run
gh run watch
```

Check your email at `maria@thewellfitcommunity.org` for the security scan notification!

---

## Troubleshooting

### Problem: "Domain not verified"
**Solution**: Complete Step 2 above - add DNS records to your domain registrar

### Problem: "Invalid API token"
**Solution**: Make sure you copied the full token starting with `mlsn.`

### Problem: "Rate limit exceeded"
**Solution**: MailerSend free tier allows 12,000 emails/month, 100/hour. You're probably fine, but check usage at https://app.mailersend.com/usage

### Problem: Still getting 403 errors
**Solution**: Make sure the GitHub secret name is exactly `MAILERSEND_API_TOKEN` (case-sensitive)

---

## Security Notes

✅ **MailerSend API tokens are safer than Gmail passwords**
✅ **Stored in GitHub Secrets (encrypted)**
✅ **Never commit the token to git**
✅ **Can be revoked anytime from MailerSend dashboard**

---

## Next Steps After Setup

1. ✅ Verify domain ownership (add DNS records)
2. ✅ Get API token from MailerSend
3. ✅ Add token to GitHub Secrets
4. ✅ Update workflow (I'll do this next)
5. ✅ Test with a commit
6. ✅ Check email delivery

---

## Alternative: GitHub Actions Native Email (No External Service)

If you don't want to use MailerSend, GitHub also has a simple notification action:

```yaml
- name: Send email via GitHub
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: 'Security scan completed! Check the Actions tab for details.'
      })
```

But this only posts comments to PRs, not actual emails. **MailerSend is better for true email notifications.**
