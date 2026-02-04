# 🚀 Quick Start: Get Your MailerSend API Token (The "16-Digit Code")

## TL;DR - 3 Minute Setup

### 1️⃣ Get the API Token (Your "16-Digit Code")

**Go here:** https://app.mailersend.com/api-tokens

**If you don't have an account yet:**
1. Sign up at https://www.mailersend.com/ (FREE)
2. Use email: `Maria@thewellfitcommunity.org`
3. Verify your email
4. Then go to: https://app.mailersend.com/api-tokens

**Once you're logged in:**
1. Click the big **"Generate new token"** button
2. Name it: `GitHub Actions`
3. Select permission: ☑️ **Email send**
4. Click **"Create token"**
5. **COPY THE TOKEN** - it looks like: `mlsn.abc123def456ghi789...`
   - It's NOT 16 digits - it's actually ~60+ characters starting with `mlsn.`
   - This is your "API token" (way better than a 16-digit password!)

### 2️⃣ Add Token to GitHub

**Go here:** https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete/settings/secrets/actions

1. Click **"New repository secret"**
2. Name: `MAILERSEND_API_TOKEN`
3. Value: Paste your `mlsn.abc123...` token
4. Click **"Add secret"**

### 3️⃣ Verify Your Domain (Required!)

**Go here:** https://app.mailersend.com/domains

1. Click **"Add domain"**
2. Enter: `thewellfitcommunity.org`
3. MailerSend will show DNS records you need to add

**Add these DNS records at your domain registrar:**

**Where's your domain registered?**
- Check your email for purchase confirmation
- Or try these common registrars:
  - **GoDaddy**: https://dcc.godaddy.com/
  - **Namecheap**: https://ap.www.namecheap.com/
  - **Google Domains**: https://domains.google.com/
  - **Cloudflare**: https://dash.cloudflare.com/

**What records to add:**

```
Type: TXT
Name: _mailersend (or _mailersend.thewellfitcommunity.org)
Value: (copy from MailerSend - starts with ms-domain-verification=)
TTL: 3600

Type: CNAME
Name: mail._domainkey (or mail._domainkey.thewellfitcommunity.org)
Value: mail._domainkey.mailersend.net
TTL: 3600

Type: TXT
Name: @ (or thewellfitcommunity.org)
Value: v=spf1 include:spf.mailersend.net ~all
TTL: 3600
```

4. Wait 5-10 minutes
5. Go back to MailerSend → Click **"Verify"**
6. Status should show **"Verified" ✅**

### 4️⃣ Test It!

```bash
# Trigger the workflow
git commit --allow-empty -m "test: verify MailerSend email"
git push

# Watch it run
gh run watch
```

Check your email at `maria@thewellfitcommunity.org` - you should get a security scan report!

---

## ❓ FAQs

### Q: I don't see "api-tokens" in MailerSend - where is it?

**A:** After logging in:
1. Look at the left sidebar
2. Click your profile icon (bottom left)
3. Click **"Settings"**
4. Look for **"API Tokens"** in the menu
5. OR just go directly to: https://app.mailersend.com/api-tokens

### Q: What if I already used my Gmail 16-digit App Password?

**A:** That was for Gmail SMTP (the old way). MailerSend is different:
- **Gmail**: Uses 16-digit "App Password" (xxxx-xxxx-xxxx-xxxx)
- **MailerSend**: Uses API token starting with `mlsn.` (~60 characters)

MailerSend is **better** because:
- ✅ No 2FA setup needed
- ✅ Easier to revoke
- ✅ Better deliverability
- ✅ Free tier is more generous

### Q: Do I need to delete the old Gmail secrets?

**A:** No need to delete them, but they're not used anymore. The workflow now uses:
- ❌ ~~`MAIL_USERNAME`~~ (old, not used)
- ❌ ~~`MAIL_PASSWORD`~~ (old, not used)
- ✅ `MAILERSEND_API_TOKEN` (new, required)

### Q: How do I know if domain verification worked?

**A:** In MailerSend dashboard:
1. Go to https://app.mailersend.com/domains
2. Your domain should show a **green checkmark ✅** next to "Verified"
3. If it shows **red X ❌** or **yellow warning ⚠️**, DNS records aren't set up correctly

### Q: Can I skip domain verification?

**A:** No - MailerSend requires it to prevent spam. Without verification:
- ❌ Emails won't send
- ❌ You'll get "Domain not verified" errors

It only takes 5-10 minutes to add the DNS records!

### Q: What if I get a 403 Forbidden error?

**A:** Check these:
1. ✅ Token copied correctly (starts with `mlsn.`)
2. ✅ GitHub Secret name is exactly `MAILERSEND_API_TOKEN` (case-sensitive)
3. ✅ Token has "Email send" permission enabled
4. ✅ Domain is verified (green checkmark in MailerSend)

### Q: How much does MailerSend cost?

**A:** FREE for your use case!
- Free tier: **12,000 emails/month**
- You're only sending ~120 emails/month (1 per security scan)
- That's **100x less** than the free limit
- No credit card required for free tier

### Q: Where do I find my domain registrar?

**A:** Check where you bought `thewellfitcommunity.org`:
1. Check your email for purchase receipt
2. Or use WHOIS lookup: https://whois.domaintools.com/thewellfitcommunity.org
3. Look for "Registrar" field

Common registrars:
- GoDaddy
- Namecheap
- Google Domains
- Cloudflare
- Domain.com
- NameSilo

---

## 🆘 Still Stuck?

### Can't find API tokens page?
**Direct link:** https://app.mailersend.com/api-tokens

### Can't add DNS records?
Check which registrar you use, then search:
- "how to add DNS records on [registrar name]"
- Or check: [MAILERSEND_SETUP.md](MAILERSEND_SETUP.md) for detailed instructions

### Need help with domain verification?
MailerSend has live chat support in the dashboard (bottom right icon).

---

## ✅ Checklist

- [ ] Created MailerSend account
- [ ] Generated API token (starts with `mlsn.`)
- [ ] Added `MAILERSEND_API_TOKEN` to GitHub Secrets
- [ ] Found domain registrar
- [ ] Added 3 DNS records (TXT, CNAME, TXT)
- [ ] Waited 5-10 minutes
- [ ] Clicked "Verify" in MailerSend
- [ ] Domain shows "Verified" ✅
- [ ] Pushed code to trigger workflow
- [ ] Received test email

**Once all boxes are checked, you're done! 🎉**
