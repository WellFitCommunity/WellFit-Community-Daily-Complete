# 🚀 Add MailerSend API Token to GitHub - Quick Steps

## Step 1: Get API Token from MailerSend

**Go to:** https://app.mailersend.com/api-tokens

1. Log in to MailerSend
2. Click **"Generate new token"**
3. **Name:** `Github Actions Envision Atlus`
4. **Permissions:** ☑️ Email send
5. Click **"Create token"**
6. **COPY THE TOKEN** (starts with `mlsn.` - about 60 characters)
   - ⚠️ You won't see it again after closing this window!

---

## Step 2: Add Token to GitHub Secrets

**Go to:** https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/settings/secrets/actions

1. Click **"New repository secret"**
2. **Name:** `MAILERSEND_API_TOKEN` (exactly this - case sensitive)
3. **Secret:** Paste your `mlsn.abc123...` token
4. Click **"Add secret"**

---

## Step 3: Test It

```bash
git commit --allow-empty -m "test: verify MailerSend integration"
git push
```

Watch the workflow run:
```bash
gh run watch
```

Or check: https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/actions

---

## ✅ You'll Know It's Working When:

- Email notification step shows ✅ (green checkmark)
- You receive email at `maria@thewellfitcommunity.org`
- Email subject: "WellFit Security Scan Report - success" (or "failure")

---

## 🆘 Troubleshooting

**Problem:** Still getting 403 error
**Fix:** Make sure secret name is exactly `MAILERSEND_API_TOKEN` (check spelling)

**Problem:** Can't find API tokens page
**Fix:** Direct link → https://app.mailersend.com/api-tokens

**Problem:** Domain not verified
**Fix:** Go to https://app.mailersend.com/domains and verify `thewellfitcommunity.org`

---

**That's it! Once the token is added, the workflow will automatically send email notifications.** 🎉
