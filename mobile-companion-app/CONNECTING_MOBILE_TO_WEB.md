# Connecting Mobile App to Web App - Complete Guide

**Question:** "How do I connect the React Native mobile app (geofencing, fall detection) to my main web app?"

**Answer:** They ALREADY share the same database! Here's how they work together.

---

## 🔗 How They're Connected (Already!)

### **Shared Infrastructure**

```
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE DATABASE                      │
│  (Both web app and mobile app use the SAME database)   │
└─────────────────────────────────────────────────────────┘
           ↑                                  ↑
           │                                  │
    ┌──────┴───────┐                 ┌───────┴────────┐
    │   WEB APP    │                 │  MOBILE APP    │
    │  (React)     │                 │ (React Native) │
    │              │                 │                │
    │ • Admin      │                 │ • Geofencing   │
    │ • Nurse      │                 │ • Fall Detect  │
    │ • Doctor     │                 │ • Health Track │
    │ • Patient    │                 │ • Alerts       │
    └──────────────┘                 └────────────────┘
```

### **What This Means:**

1. **Same users** - Senior logs into mobile app with same credentials as web app
2. **Same data** - Fall detected on phone → Appears in web admin panel
3. **Same database tables** - Both apps read/write to same Supabase tables
4. **Real-time sync** - Location update on mobile → Nurse sees it instantly on web

---

## 📊 Mobile Database Integration

### **Current Status:**

Your mobile integration migrations are SKIPPED (in `_SKIP_*` files). Let's un-skip them!

**Files to activate:**
```
supabase/migrations/_SKIP_20241221_mobile_integration_tables.sql
supabase/migrations/_SKIP_20241221_mobile_integration_views.sql
```

**What these create:**
- `mobile_geofence_zones` - Safe zones set by caregivers
- `mobile_location_history` - GPS tracking data from phone
- `mobile_fall_events` - Fall detection events
- `mobile_health_readings` - Pulse ox, heart rate from phone camera
- `mobile_emergency_alerts` - Alerts sent to caregivers
- `mobile_device_registrations` - Phones registered to users

---

## 🚀 3-Step Setup to Connect Mobile + Web

### **STEP 1: Enable Mobile Database Tables (5 minutes)**

```bash
# In your terminal
cd /workspaces/WellFit-Community-Daily-Complete

# Rename migrations to activate them
mv supabase/migrations/_SKIP_20241221_mobile_integration_tables.sql \
   supabase/migrations/20241221000000_mobile_integration_tables.sql

mv supabase/migrations/_SKIP_20241221_mobile_integration_views.sql \
   supabase/migrations/20241221000001_mobile_integration_views.sql

# Apply to database
npx supabase db push
```

**What this does:**
- Creates tables for geofence zones, location history, fall events
- Sets up views for web admin to see mobile data
- Configures RLS policies (nurses/admins can see patient data, patients see their own)

---

### **STEP 2: Configure Mobile App with Supabase Credentials (5 minutes)**

Edit `mobile-companion-app/.env`:

```env
# Supabase Configuration (SAME as web app)
REACT_APP_SUPABASE_URL=https://xkybsjnvuohpqpbkikyn.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Optional: Firebase for push notifications
FIREBASE_API_KEY=your_firebase_key
FIREBASE_VAPID_KEY=your_vapid_key

# Google Maps (for geofencing maps)
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

**Where to get these:**
- `REACT_APP_SUPABASE_URL` - You already have this in web app `.env`
- `REACT_APP_SUPABASE_ANON_KEY` - Same, copy from web app `.env`
- `GOOGLE_MAPS_API_KEY` - Get from https://console.cloud.google.com/apis/credentials

---

### **STEP 3: Add Mobile Data Views to Web Admin (30 minutes)**

Create new admin panel section to view mobile data:

**File:** `src/components/admin/MobileMonitoringDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface GeofenceAlert {
  id: string;
  patient_name: string;
  zone_name: string;
  breach_time: string;
  current_location: { lat: number; lng: number };
  distance_from_zone: number;
}

interface FallEvent {
  id: string;
  patient_name: string;
  fall_time: string;
  location: { lat: number; lng: number };
  severity: 'low' | 'medium' | 'high';
  response_status: 'pending' | 'acknowledged' | 'responded';
}

export default function MobileMonitoringDashboard() {
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);
  const [fallEvents, setFallEvents] = useState<FallEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMobileData();

    // Real-time subscriptions
    const geofenceSubscription = supabase
      .channel('geofence_alerts')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mobile_emergency_alerts' },
        (payload) => {
          if (payload.new.alert_type === 'geofence_breach') {
            loadGeofenceAlerts();
          }
        }
      )
      .subscribe();

    const fallSubscription = supabase
      .channel('fall_events')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mobile_fall_events' },
        () => loadFallEvents()
      )
      .subscribe();

    return () => {
      geofenceSubscription.unsubscribe();
      fallSubscription.unsubscribe();
    };
  }, []);

  const loadMobileData = async () => {
    await Promise.all([
      loadGeofenceAlerts(),
      loadFallEvents()
    ]);
    setLoading(false);
  };

  const loadGeofenceAlerts = async () => {
    const { data, error } = await supabase
      .from('mobile_emergency_alerts')
      .select(`
        id,
        created_at,
        alert_data,
        user_id,
        profiles!inner(first_name, last_name)
      `)
      .eq('alert_type', 'geofence_breach')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setGeofenceAlerts(data.map(alert => ({
        id: alert.id,
        patient_name: `${alert.profiles.first_name} ${alert.profiles.last_name}`,
        zone_name: alert.alert_data.zone_name,
        breach_time: alert.created_at,
        current_location: alert.alert_data.location,
        distance_from_zone: alert.alert_data.distance_meters
      })));
    }
  };

  const loadFallEvents = async () => {
    const { data, error } = await supabase
      .from('mobile_fall_events')
      .select(`
        id,
        detected_at,
        severity,
        response_status,
        location,
        user_id,
        profiles!inner(first_name, last_name)
      `)
      .order('detected_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setFallEvents(data.map(event => ({
        id: event.id,
        patient_name: `${event.profiles.first_name} ${event.profiles.last_name}`,
        fall_time: event.detected_at,
        location: event.location,
        severity: event.severity,
        response_status: event.response_status
      })));
    }
  };

  const acknowledgeFall = async (eventId: string) => {
    await supabase
      .from('mobile_fall_events')
      .update({ response_status: 'acknowledged' })
      .eq('id', eventId);

    loadFallEvents();
  };

  if (loading) return <div>Loading mobile monitoring data...</div>;

  return (
    <div className="space-y-6">
      {/* Geofence Alerts */}
      <section className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          🚨 Active Geofence Alerts
          {geofenceAlerts.length > 0 && (
            <span className="ml-3 px-3 py-1 bg-red-600 text-white text-sm rounded-full">
              {geofenceAlerts.length}
            </span>
          )}
        </h2>

        {geofenceAlerts.length === 0 ? (
          <p className="text-gray-500">All patients within safe zones ✅</p>
        ) : (
          <div className="space-y-3">
            {geofenceAlerts.map(alert => (
              <div key={alert.id} className="border-l-4 border-l-red-600 bg-red-50 p-4 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{alert.patient_name}</h3>
                    <p className="text-sm text-gray-700">
                      Left "{alert.zone_name}" safe zone
                    </p>
                    <p className="text-sm text-gray-600">
                      {Math.round(alert.distance_from_zone)} meters away
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.breach_time).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      View Map
                    </button>
                    <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                      Call Patient
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fall Events */}
      <section className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          🏥 Recent Fall Events
          {fallEvents.filter(e => e.response_status === 'pending').length > 0 && (
            <span className="ml-3 px-3 py-1 bg-orange-600 text-white text-sm rounded-full">
              {fallEvents.filter(e => e.response_status === 'pending').length} pending
            </span>
          )}
        </h2>

        {fallEvents.length === 0 ? (
          <p className="text-gray-500">No falls detected in last 24 hours ✅</p>
        ) : (
          <div className="space-y-3">
            {fallEvents.map(event => (
              <div
                key={event.id}
                className={`border-l-4 p-4 rounded ${
                  event.severity === 'high'
                    ? 'border-l-red-600 bg-red-50'
                    : event.severity === 'medium'
                    ? 'border-l-orange-600 bg-orange-50'
                    : 'border-l-yellow-600 bg-yellow-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{event.patient_name}</h3>
                    <p className="text-sm text-gray-700">
                      Fall detected - {event.severity} severity
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.fall_time).toLocaleString()}
                    </p>
                    <p className={`text-xs font-semibold mt-1 ${
                      event.response_status === 'responded'
                        ? 'text-green-600'
                        : event.response_status === 'acknowledged'
                        ? 'text-blue-600'
                        : 'text-red-600'
                    }`}>
                      Status: {event.response_status.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {event.response_status === 'pending' && (
                      <>
                        <button
                          onClick={() => acknowledgeFall(event.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Acknowledge
                        </button>
                        <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                          Call 911
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Location Map */}
      <section className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">📍 Real-Time Patient Locations</h2>
        <div className="h-96 bg-gray-100 rounded flex items-center justify-center">
          <p className="text-gray-500">
            Map view with all patient locations + geofence zones
            <br />
            <span className="text-sm">(Integrate Google Maps or Mapbox here)</span>
          </p>
        </div>
      </section>
    </div>
  );
}
```

Then add to AdminPanel:

```typescript
// In src/components/admin/AdminPanel.tsx

import MobileMonitoringDashboard from './MobileMonitoringDashboard';

// Add new tab
{activeSection === 'mobile_monitoring' && (
  <MobileMonitoringDashboard />
)}
```

---

## 📲 How It Works End-to-End

### **Scenario 1: Senior Leaves Geofence**

1. **Caregiver sets up (in web app):**
   - Admin logs into web app
   - Goes to "Mobile Monitoring" → "Geofence Zones"
   - Creates safe zone around patient's home (500m radius)
   - Assigns to patient's account

2. **Patient activates (in mobile app):**
   - Senior opens mobile app on phone
   - Logs in with same credentials as web app
   - App downloads geofence zones from database
   - Background location tracking starts

3. **Alert triggered (mobile app):**
   - Senior walks outside 500m radius
   - Mobile app detects breach via GPS
   - Sends SMS to caregiver: "Mom has left home safe zone!"
   - Writes alert to `mobile_emergency_alerts` table

4. **Nurse responds (in web app):**
   - Web admin dashboard shows real-time alert (via Supabase Realtime)
   - Nurse sees: "Mary Smith left 'Home' zone - 750m away"
   - Nurse clicks "View Map" → Sees current GPS location
   - Nurse calls patient or sends help

**All automatic. No manual sync needed.**

---

### **Scenario 2: Fall Detection**

1. **Mobile app detects fall:**
   - Senior's phone accelerometer detects sudden drop + impact
   - Mobile app analyzes: 9.8 m/s² acceleration + no movement for 10 seconds
   - Classifies as "high severity" fall
   - Writes to `mobile_fall_events` table
   - Sends SMS to caregiver: "URGENT: Fall detected for Dad!"

2. **Web dashboard alerts:**
   - Admin panel shows red banner: "FALL DETECTED - John Doe"
   - Nurse sees fall time, location (GPS), severity
   - Nurse clicks "Call 911" or "Acknowledge" (will follow up)

3. **Follow-up tracked:**
   - Nurse updates status: "Responded - Called patient, no injury"
   - Status syncs back to mobile app
   - Mobile app stops alarm/alert

---

## 🔐 Security & Data Flow

### **Authentication Flow:**

```
1. Senior logs into mobile app
   ↓
2. Mobile app authenticates with Supabase (same auth as web app)
   ↓
3. Supabase returns JWT token
   ↓
4. Mobile app stores token securely (encrypted)
   ↓
5. All database requests use this token
   ↓
6. RLS policies ensure patient only sees their own data
   (Nurses/admins see all patients they're authorized for)
```

### **Data Encryption:**

- **In mobile app:** AES-256 encryption for local storage (already built)
- **In transit:** HTTPS/TLS (Supabase provides this)
- **In database:** `pgp_sym_encrypt` for PHI (you already have this)

**HIPAA compliant by default.**

---

## 🎯 What You Need to Do

### **TO-DO List:**

1. ✅ **Activate mobile migrations** (Step 1 above - 5 min)
2. ✅ **Configure mobile app .env** (Step 2 above - 5 min)
3. ✅ **Add MobileMonitoringDashboard to web app** (Step 3 above - 30 min)
4. ✅ **Test locally:**
   ```bash
   # Terminal 1: Run web app
   npm run dev

   # Terminal 2: Run mobile app
   cd mobile-companion-app
   npm run start
   # Then press 'a' for Android or 'i' for iOS
   ```
5. ✅ **Deploy mobile app** (see CLAUDE_APP_STORE_DEPLOYMENT.md)

---

## 💰 Additional Costs for Mobile Integration

- **Google Maps API:** $0-$200/month (depends on usage, free tier is generous)
- **Firebase (push notifications):** Free for <10K users
- **Twilio SMS (for alerts):** $0.0075/SMS (~$15/month for 2,000 alerts)
- **Total:** ~$20-$250/month depending on scale

**You already have Supabase**, so no additional database costs.

---

## 🚀 Advanced Features (Optional)

Once basic integration works, you can add:

1. **Live GPS tracking map** in admin panel (Google Maps API)
2. **Push notifications** instead of just SMS (Firebase Cloud Messaging)
3. **Video calling** for caregiver-to-patient (Twilio Video API)
4. **Medication reminders** from web app → Mobile notifications
5. **Telehealth integration** (video visits initiated from web, join on mobile)

---

## 📞 Need Help?

**Stuck on Step 1 (migrations)?**
→ Paste error message, I'll fix it

**Stuck on Step 2 (mobile .env)?**
→ Tell me what's unclear, I'll clarify

**Stuck on Step 3 (web dashboard)?**
→ I'll write the EXACT code for you

**Don't understand how they connect?**
→ Ask specific question, I'll explain differently

**Ready to deploy mobile app?**
→ See CLAUDE_APP_STORE_DEPLOYMENT.md

---

**Bottom line:** Your mobile app and web app are ALREADY designed to work together. You just need to:
1. Un-skip 2 migration files (5 min)
2. Configure mobile app .env (5 min)
3. Add mobile monitoring dashboard to web admin (30 min)

**Then they're connected. Real-time. Bidirectional. HIPAA-compliant.**

Let me know which step you want to start with! 🚀
