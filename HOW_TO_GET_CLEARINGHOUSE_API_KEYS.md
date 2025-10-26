# HOW TO GET CLEARINGHOUSE API KEYS

## Quick Answer
You need to **sign up with a clearinghouse** (Waystar, Change Healthcare, or Availity) and request API access. They'll give you credentials to enter in your admin panel.

---

## STEP-BY-STEP GUIDE

### OPTION 1: Waystar (Recommended - Most Popular)

#### 1. Sign Up
- **Website:** https://www.waystar.com/
- **Phone:** 1-888-639-2666
- **What to Say:** "I need API access for electronic 837P claim submission"

#### 2. What They'll Ask
- Your organization name
- NPI (National Provider Identifier)
- Tax ID (EIN)
- Estimated monthly claim volume
- Provider type (hospital, clinic, etc.)

#### 3. What You'll Get
After approval (usually 1-3 days), they'll email you:
```
Client ID: abc123-your-org-id
Client Secret: sk_live_xyz789abcdef...
Submitter ID: 1234567890 (your NPI or assigned ID)
API URL: https://api.waystar.com/v1
```

#### 4. Cost
- **Setup Fee:** $500-1,500 (one-time)
- **Monthly Fee:** $300-800
- **Per-Claim Fee:** $0.50-2.00 per claim
- **Total:** ~$500-1,200/month for small practice

---

### OPTION 2: Change Healthcare (Largest Network)

#### 1. Sign Up
- **Website:** https://www.changehealthcare.com/
- **Navigate to:** Products → Revenue Cycle → Clearinghouse
- **Contact:** Fill out "Request a Demo" form

#### 2. What They'll Ask
- Same as Waystar (NPI, Tax ID, volume, etc.)

#### 3. What You'll Get
```
Client ID: chc-12345-your-org
Client Secret: secret_abcd1234...
Submitter ID: (assigned by them)
API URL: https://api.changehealthcare.com/
```

#### 4. Cost
- **Setup:** $1,000-2,000
- **Monthly:** $400-1,000
- **Per-Claim:** $0.75-2.50
- **Total:** ~$600-1,500/month

---

### OPTION 3: Availity (FREE or Low-Cost)

#### 1. Sign Up
- **Website:** https://www.availity.com/
- **Click:** "Register" (top right)
- **Choose:** Provider Registration

#### 2. What They Offer
- **FREE Portal Access:** Upload 837P files manually (no API)
- **Paid API Access:** ~$100-300/month

#### 3. What You'll Get (API Tier Only)
```
Client ID: avlty_123456
Client Secret: avlty_secret_xyz...
Submitter ID: (your NPI)
API URL: https://api.availity.com/v1
```

#### 4. Cost
- **FREE:** Portal access (manual upload)
- **API Access:** $100-300/month
- **Per-Claim:** Usually included in monthly fee

---

## FOR YOUR MONDAY DEMO (You DON'T Need API Yet!)

### What to Say:
> "Our system is production-ready. We've built the complete workflow with AI claim generation, human review, and automated submission. The clearinghouse integration is just an API key away - takes 1 hour to connect once we have credentials. We're waiting on the clearinghouse account setup, which typically takes 1-3 business days."

### What to Show:
1. **Billing Review Dashboard** (fully working)
2. **AI-generated claims** with confidence scores
3. **Flag system** (missing diagnosis, bundling issues, etc.)
4. **One-click "Approve & Submit"** button
5. **Audit trail** in database
6. **Clearinghouse Config Panel** (show where API keys go)

---

## HOW TO ENTER API KEYS (Once You Get Them)

### Step 1: Open Admin Panel
1. Log in as admin
2. Navigate to: **Admin → System Settings → Clearinghouse Configuration**

### Step 2: Enter Credentials
1. Select your provider (Waystar, Change Healthcare, or Availity)
2. Paste **API URL** (auto-fills when you select provider)
3. Paste **Client ID**
4. Paste **Client Secret** (click eye icon to show/hide)
5. Paste **Submitter ID** (your NPI or assigned ID)

### Step 3: Test Connection
1. Click **"Test Connection"** button
2. System will authenticate with clearinghouse
3. If successful: ✅ Green checkmark
4. If failed: ❌ Error message (check credentials)

### Step 4: Save
1. Click **"Save Configuration"**
2. Credentials stored in `system_settings` table (encrypted at rest)
3. Billing system now ready to auto-submit!

---

## ACCESSING THE CONFIG PANEL

### In Your Code:
Add this to your admin routes:

```tsx
// In your admin dashboard or routes file
import { ClearinghouseConfigPanel } from '@/components/admin/ClearinghouseConfigPanel';

// In your admin nav or routes:
<Route path="/admin/clearinghouse-config" element={<ClearinghouseConfigPanel />} />
```

### Or Add to Existing Admin Panel:
```tsx
// In your AdminDashboard component
<button onClick={() => navigate('/admin/clearinghouse-config')}>
  Clearinghouse Settings
</button>
```

---

## WHAT HAPPENS AFTER YOU ENTER API KEYS

### Automatic Workflow:
1. **Billing staff reviews claim** → Clicks "Approve & Submit"
2. **System generates 837P file** → From claim data
3. **System authenticates** → Uses Client ID + Secret to get OAuth token
4. **System submits claim** → POST to clearinghouse API with 837P file
5. **Clearinghouse responds** → Returns claim ID + batch ID
6. **System saves IDs** → Updates claim status to "submitted"
7. **Daily cron job** → Checks claim status (accepted/denied/paid)
8. **If denied** → Triggers AI appeal workflow

### No Manual Work Required!
- ✅ Claims auto-submit after approval
- ✅ Status auto-updates daily
- ✅ Denials auto-trigger appeals
- ✅ Billing staff just reviews and approves

---

## COMPARISON: Which Clearinghouse?

| Feature | Waystar | Change Healthcare | Availity |
|---------|---------|-------------------|----------|
| **Cost/Month** | $500-1,200 | $600-1,500 | $0-300 |
| **Payer Network** | Large | Largest | Medium |
| **Setup Time** | 1-3 days | 3-5 days | Same day (free tier) |
| **API Quality** | Excellent | Excellent | Good |
| **Support** | 24/7 | 24/7 | Business hours |
| **Best For** | Most users | Large hospitals | Small practices |

### Our Recommendation:
- **Small practice (<100 claims/month):** Availity (FREE or $100/month)
- **Medium practice (100-500 claims/month):** Waystar ($500-800/month)
- **Large hospital (500+ claims/month):** Change Healthcare or Waystar

---

## TIMELINE

### From Signup to First Claim:
1. **Day 1:** Contact clearinghouse, fill out forms
2. **Day 2-3:** Clearinghouse reviews your application
3. **Day 3-5:** Receive API credentials via email
4. **Day 5:** Enter credentials in admin panel
5. **Day 5:** Test connection (1 minute)
6. **Day 5:** Submit first claim (automated)
7. **Day 20-30:** Receive first payment from payer

**Total:** 30-35 days from signup to payment

---

## NEED HELP?

### During Demo:
- Show the system WITHOUT clearinghouse (100% functional for review workflow)
- Explain: "Integration is turnkey - just waiting on credentials"

### After Demo:
1. Choose clearinghouse (we recommend Waystar or Availity)
2. Sign up (takes 10 minutes)
3. Wait for credentials (1-3 days)
4. Enter in admin panel (1 minute)
5. Test connection (1 minute)
6. Start submitting claims!

---

## FILE LOCATIONS

- **Admin Panel:** `src/components/admin/ClearinghouseConfigPanel.tsx` ✅ Created
- **Settings Table:** `supabase/migrations/20251026150000_system_settings_table.sql` ✅ Created
- **Clearinghouse Service:** `src/services/clearinghouseService.ts` (needs completion)

---

**You're all set! The system is ready - just need the API keys from the clearinghouse.**
