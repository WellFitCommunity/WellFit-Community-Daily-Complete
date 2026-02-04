# Patient Telehealth Access Guide

## How Patients Get Their Telehealth Links

Currently, there are **two ways** patients can access telehealth sessions:

### Option 1: Future Patient Portal (Recommended - Not Yet Built)
This is the ideal workflow you should implement:

1. **Patient gets SMS/Email notification**
   - When physician starts a telehealth session, system sends patient a link
   - Uses Twilio (already configured in your `.env.local`)

2. **Patient clicks link** → Goes to patient portal
   - Example: `https://wellfitcommunity.live/telehealth/join?session=SESSION_ID`

3. **Patient enters waiting room** → Provider admits them

**To implement this, you need to:**

```typescript
// 1. Create a new page: src/pages/PatientTelehealthJoinPage.tsx
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function PatientTelehealthJoinPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const { user } = useAuth();

  const joinSession = async () => {
    // Call the Edge Function to get patient token
    const { data, error } = await supabase.functions.invoke(
      'create-patient-telehealth-token',
      {
        body: {
          session_id: sessionId,
          patient_name: user?.email || 'Patient'
        }
      }
    );

    if (error) {
      alert('Failed to join session: ' + error.message);
      return;
    }

    // Join the Daily.co room with patient token
    window.location.href = `${data.room_url}?t=${data.token}`;
  };

  return (
    <div className="p-8">
      <h1>Join Telehealth Session</h1>
      <button onClick={joinSession}>Join Video Call</button>
    </div>
  );
}

// 2. Add route to App.tsx
import PatientTelehealthJoinPage from './pages/PatientTelehealthJoinPage';

// In your routes:
<Route path="/telehealth/join" element={<PatientTelehealthJoinPage />} />

// 3. Send SMS when provider starts session
// Add to TelehealthConsultation.tsx after room is created:
const sendPatientInvite = async (sessionId: string, patientPhone: string) => {
  await supabase.functions.invoke('send-sms', {
    body: {
      to: patientPhone,
      message: `Your doctor is ready for your telehealth visit! Join here: https://wellfitcommunity.live/telehealth/join?session=${sessionId}`
    }
  });
};
```

### Option 2: Manual Provider Link (Current Temporary Solution)

**For NOW, until you build the patient portal:**

1. **Provider starts telehealth session** in PhysicianPanel
2. **Provider shares screen or sends link manually** to patient
   - Provider gets the Daily.co room URL after creating session
   - Provider can share this link via phone, text, or verbally
3. **Patient clicks link** → Joins directly

**This works but is less professional.**

---

## API Key System - Connecting External Systems

Your API key generator (I can see you have `api_keys` table) is for **third-party systems** that want to integrate with WellFit.

### What API Keys Are Used For

API keys let external systems (like other hospitals, EMRs, or partner apps) securely access your WellFit data.

**Example Use Cases:**
1. **External EMR wants patient data** → They use API key to authenticate
2. **Partner telehealth app** → Wants to create encounters in WellFit
3. **Billing system** → Needs to pull encounter data for claims

### How API Keys Work

```
┌─────────────────┐
│  External App   │ (e.g., Epic EMR, Cerner)
└────────┬────────┘
         │ HTTP Request with API Key
         │ Header: X-API-Key: abc123xyz
         ▼
┌─────────────────┐
│  WellFit API    │ ← Validates key in api_keys table
└────────┬────────┘
         │ If valid → returns data
         ▼
┌─────────────────┐
│  Supabase DB    │
└─────────────────┘
```

### Generating and Using API Keys

**1. Generate an API Key** (for external partners):

```sql
-- Run in Supabase SQL Editor
INSERT INTO api_keys (
  key_name,
  key_value,
  created_by,
  organization,
  permissions,
  is_active
) VALUES (
  'Epic EMR Integration',
  gen_random_uuid()::text, -- Or use a secure random string
  'YOUR_ADMIN_USER_ID',
  'Epic Systems',
  jsonb_build_object('read', true, 'write', false),
  true
);
```

**2. External System Uses the Key:**

```bash
# External system makes API call to WellFit
curl -H "X-API-Key: THE_GENERATED_KEY" \
     https://wellfitcommunity.live/api/patients/123
```

**3. Your API Validates the Key** (you need to create this):

```typescript
// Create: src/api/middleware/validateApiKey.ts
import { supabase } from '../../lib/supabaseClient';

export async function validateApiKey(apiKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_value', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return false;
  }

  // Check if key is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return false;
  }

  return true;
}

// Use in your API routes:
app.get('/api/patients/:id', async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!await validateApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Continue with request...
});
```

---

## Daily.co API vs WellFit API Keys

**These are DIFFERENT things:**

### Daily.co API Key
- **Purpose**: WellFit uses this to create video rooms
- **Direction**: WellFit → Daily.co
- **Already configured**: In your `.env.local` as `DAILY_VIDEO_API_KEY`
- **Used by**: Your Supabase Edge Functions

```
┌──────────┐  Creates rooms using    ┌──────────┐
│ WellFit  │ ────────────────────>   │ Daily.co │
│          │  DAILY_VIDEO_API_KEY    │          │
└──────────┘                          └──────────┘
```

### WellFit API Keys
- **Purpose**: External systems use these to access WellFit data
- **Direction**: External System → WellFit
- **You generate**: For each partner/integration
- **Used by**: External EMRs, billing systems, partner apps

```
┌──────────────┐  Fetches data using   ┌──────────┐
│ External EMR │ ──────────────────>   │ WellFit  │
│ (Epic/Cerner)│  WELLFIT_API_KEY      │          │
└──────────────┘                        └──────────┘
```

---

## Quick Summary for Sleep

**Patient gets telehealth link:**
- **NOW**: Provider manually shares Daily.co link
- **FUTURE** (what you need to build):
  1. SMS/Email sent automatically to patient
  2. Patient clicks → joins via patient portal page
  3. Uses Edge Function `create-patient-telehealth-token`

**API Keys:**
- **Daily.co key**: You use it to create video rooms (already set up ✅)
- **WellFit API keys**: Partners use them to connect their systems to your app
  - You generate keys via `api_keys` table
  - They send key in `X-API-Key` header
  - You validate it before allowing access

**Sleep well! Your telehealth is ready to use right now. The patient portal is just a nice-to-have enhancement.**

---

## Next Steps (When You Wake Up)

1. ✅ Telehealth works right now - test it!
2. Build patient portal page (30 mins)
3. Add SMS notification (15 mins - Twilio already configured)
4. Optional: Create API key management UI for admins

The hard part (Daily.co integration) is done. Everything else is just UI/UX polish.
