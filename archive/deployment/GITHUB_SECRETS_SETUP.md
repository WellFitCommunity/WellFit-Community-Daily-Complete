# GitHub Secrets Setup for Email Notifications

## Problem
The security scan workflow is failing to send email notifications with error:
```
Mail command failed: 530-5.7.0 Authentication Required
```

## Solution: Add Gmail App Passwords as GitHub Secrets

### Step 1: Create Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Click "Security" in the left menu
3. Under "How you sign in to Google", click "2-Step Verification" (you MUST have 2FA enabled)
4. Scroll down and click "App passwords"
5. Select app: "Mail"
6. Select device: "Other" → Type "GitHub Actions WellFit"
7. Click "Generate"
8. **COPY THE 16-CHARACTER PASSWORD** (you won't see it again)

### Step 2: Add Secrets to GitHub Repository

1. Go to your repository: https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete
2. Click "Settings" tab
3. Click "Secrets and variables" → "Actions" in left sidebar
4. Click "New repository secret"

**Add these two secrets:**

| Name | Value | Description |
|------|-------|-------------|
| `MAIL_USERNAME` | `Maria@thewellfitcommunity.org` | Your Gmail email address |
| `MAIL_PASSWORD` | `(16-char app password)` | The app password from Step 1 |

### Step 3: Verify Email in GitHub

Additionally, make sure your email is verified in GitHub:

1. Go to https://github.com/settings/emails
2. Check if `Maria@thewellfitcommunity.org` is listed
3. If not, click "Add email address"
4. Enter `Maria@thewellfitcommunity.org`
5. Click "Add"
6. Check your email for verification link
7. Click the link to verify

### Step 4: Alternative - Use GitHub's No-Reply Email

If you don't want to use Gmail, you can use GitHub's no-reply email instead.

Edit `.github/workflows/security-scan.yml` line 374:

```yaml
# Change from:
from: security-scan@thewellfitcommunity.org

# To:
from: 160789098+WellFitCommunity@users.noreply.github.com
```

And in line 13, change:

```yaml
env:
  NOTIFICATION_EMAILS: "160789098+WellFitCommunity@users.noreply.github.com"
```

### Step 5: Test the Workflow

After adding secrets:

```bash
git commit --allow-empty -m "test: trigger security scan with email"
git push
```

Then check: https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/actions

---

## Alternative: Disable Email Notifications Temporarily

If you want to disable email notifications until you set up the secrets:

Edit `.github/workflows/security-scan.yml` and add `if: false` to the email step:

```yaml
- name: Send email notification
  if: false  # ← Add this line to disable
  uses: dawidd6/action-send-mail@v3
```

---

## Security Note

**NEVER commit your Gmail app password or any passwords to git!** Always use GitHub Secrets for sensitive credentials.
