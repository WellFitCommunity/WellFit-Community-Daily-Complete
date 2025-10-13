# WellFit Offline Mode - Complete Guide

Built with faith for rural American seniors

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Features Overview](#features-overview)
3. [User Guide](#user-guide)
4. [Technical Implementation](#technical-implementation)
5. [Deployment Instructions](#deployment-instructions)
6. [Testing & Verification](#testing--verification)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### What You Get

This implementation allows WellFit to work COMPLETELY OFFLINE - perfect for rural areas, hospitals, and doctor's offices with unreliable internet.

- PULSE OXIMETER - Measure heart rate & blood oxygen with phone camera
- OFFLINE HEALTH CHECK-INS - Track mood, vitals, symptoms without internet
- AUTO-SYNC - Data uploads automatically when connection returns
- HIPAA-COMPLIANT - Secure local storage with encryption
- NO DATA LOSS - Everything saved even without internet

### Quick Deployment

```bash
# 1. Build the app
npm run build

# 2. Deploy (must use HTTPS!)
# Option A - Vercel:
vercel --prod

# Option B - Netlify:
netlify deploy --prod

# Option C - Self-hosted: See deployment section below

# 3. Test
# - Open https://your-domain.com
# - Check console: "✅ WellFit is now available offline!"
# - Go offline (DevTools → Network → Offline)
# - Refresh page - should still work!
```

### Key Requirements

- MUST HAVE HTTPS - Service Workers require secure connection
- Users must visit once online - To cache the app
- Device encryption recommended - For HIPAA compliance
- Modern browser required - Chrome, Safari, Edge, or Firefox

---

## Features Overview

### 1. Pulse Oximeter

Uses phone camera + flashlight to measure vitals:

- 15-second measurement
- Shows heart rate (BPM)
- Shows blood oxygen (SpO2)
- Works 100% offline
- Values auto-fill in form
- Large, senior-friendly interface

**File**: `src/components/PulseOximeter.tsx`

### 2. Offline Storage System

IndexedDB-based local storage:

- Stores health reports locally
- Tracks sync status
- Auto-retry on failure
- Encrypted by browser
- Stores pulse measurements

**File**: `src/utils/offlineStorage.ts`

### 3. Service Worker

Enables offline functionality:

- Caches app for offline use
- Serves cached files when offline
- Updates cache when online
- Background sync support
- HTTPS-enforced security

**File**: `public/service-worker.js`

### 4. Offline Indicator

Visual status indicator:

- Orange = Offline mode
- Green = Online
- Shows pending count
- Manual sync button
- Click for details

**File**: `src/components/OfflineIndicator.tsx`

### 5. Auto-Sync

Automatic data synchronization:

- Detects online/offline status
- Queues reports when offline
- Auto-uploads when online
- Shows sync progress
- Manual sync option available

---

## User Guide

### For Seniors

#### First Time Setup (Needs Internet)

1. Open WellFit in your browser or phone
2. Log in to your account
3. Visit the Self-Reporting page once
4. You're ready! The app is now cached for offline use

#### Using Offline

1. Open the app (even without internet)
2. Fill out your daily health check-in
3. Click "Measure Now" for pulse & oxygen
4. Place finger on back camera
5. Wait 15 seconds for measurement
6. Submit - saves locally if offline
7. When internet returns - automatically uploads!

#### Understanding the Status Indicator

Look at the bottom-left corner of the screen:

- **Orange indicator** = Offline mode, data saved locally
- **Green indicator** = Online, data syncing
- **Number badge** = Reports waiting to upload
- **Click it** = View details and manually sync

### For Healthcare Staff

#### Setting Up Devices for Patients

1. Help patient log in once while online
2. Show them the Self-Reporting page
3. Bookmark the app on their home screen
4. Explain the orange/green indicator
5. Test offline mode together

#### Checking Sync Status

1. Click offline indicator (bottom left)
2. View pending reports count
3. Press "Sync Now" to force upload
4. Monitor sync progress
5. Verify data in Supabase dashboard

### For Rural Hospitals & Clinics

#### Benefits

- Works during internet outages
- No data loss - everything saved locally
- Automatic sync when connection restored
- No special equipment needed - just a phone/tablet
- HIPAA considerations - data encrypted locally

#### Setup Process

1. Deploy WellFit to your domain
2. Ensure HTTPS is enabled (required for offline)
3. Have patients/staff visit once while online
4. App automatically caches for offline use
5. Train staff on offline functionality

---

## Technical Implementation

### Technologies Used

- **Service Workers** - Enable offline functionality
- **IndexedDB** - Local database for health reports
- **Cache API** - Store app files for offline access
- **Background Sync API** - Auto-sync when online
- **MediaDevices API** - Camera for pulse oximeter
- **Canvas API** - Process camera frames
- **TypeScript** - Type-safe development
- **React** - UI framework

### Data Storage Architecture

```
Browser Storage
├── IndexedDB (Health Reports)
│   ├── Pending reports queue
│   ├── Pulse measurements
│   └── Sync status tracking
│
└── Cache Storage (App Files)
    ├── HTML, CSS, JavaScript
    ├── Images and icons
    └── Fonts and styles
```

### Storage Limits

- **Chrome/Edge**: ~60% of disk space
- **Firefox**: ~50% of disk space
- **Safari**: ~1GB on mobile, unlimited on desktop
- **Typical Usage**: 5-10MB for months of health data

### Sync Logic Flow

```
1. Check if online
2. If online → Try save to Supabase
3. If offline OR save fails → Save locally
4. When online returns → Auto-sync all pending
5. On success → Delete from local storage
6. On failure → Retry (max 3 attempts)
```

### Security Features

- HTTPS required (enforced by Service Worker)
- TLS 1.2+ for transmission
- Browser/OS-level encryption (AES-256)
- Browser sandboxing
- Same-origin policy
- User authentication required
- Session timeout
- Audit logging

### Files Created/Modified

**New Files:**
```
✅ src/components/PulseOximeter.tsx          - Camera-based vitals
✅ src/components/OfflineIndicator.tsx       - Status indicator
✅ src/utils/offlineStorage.ts               - IndexedDB storage
```

**Modified Files:**
```
✅ public/service-worker.js                  - Offline caching
✅ src/serviceWorkerRegistration.ts          - SW registration
✅ src/pages/SelfReportingPage.tsx           - Offline support
✅ src/App.tsx                               - Added OfflineIndicator
✅ src/index.tsx                             - Enabled SW
```

### Browser Support

- Chrome 45+ (Recommended)
- Safari 11.1+ (iOS and macOS)
- Firefox 44+ (Desktop and mobile)
- Edge 17+ (Windows)
- Internet Explorer NOT SUPPORTED (no Service Worker)

---

## Deployment Instructions

### Pre-Deployment Checklist

**Required:**
- [ ] HTTPS enabled (required for Service Workers)
- [ ] Domain name configured
- [ ] SSL/TLS certificate installed
- [ ] Supabase project set up
- [ ] Environment variables configured

**Recommended:**
- [ ] HIPAA compliance review completed
- [ ] Security assessment performed
- [ ] User training materials prepared
- [ ] Device security policy established
- [ ] Backup procedures documented

### Step 1: Build the Application

```bash
# Navigate to project directory
cd /path/to/WellFit-Community-Daily-Complete

# Install dependencies
npm install

# Build for production
npm run build

# Verify build succeeded
ls -la build/

# Check critical offline files
ls -la build/service-worker.js
ls -la build/index.html
ls -la build/manifest.json
```

### Step 2: Configure HTTPS

**CRITICAL**: Service Workers ONLY work over HTTPS (or localhost)

#### Option A: Using Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Vercel automatically provides HTTPS
```

#### Option B: Using Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod

# Netlify automatically provides HTTPS
```

#### Option C: Self-Hosted with Apache

Create `.htaccess`:

```apache
# Force HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Cache control for Service Worker
<FilesMatch "service-worker\.js$">
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires 0
</FilesMatch>

# Cache static assets
<FilesMatch "\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$">
  Header set Cache-Control "public, max-age=31536000"
</FilesMatch>
```

#### Option D: Self-Hosted with Nginx

Create/update `nginx.conf`:

```nginx
server {
    listen 80;
    server_name wellfit.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wellfit.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /path/to/wellfit/build;
    index index.html;

    # Service Worker - no cache
    location = /service-worker.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires 0;
        try_files $uri =404;
    }

    # Static assets - long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Step 3: Environment Configuration

Create `.env.production`:

```bash
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here

# App Configuration
REACT_APP_APP_URL=https://wellfit.yourdomain.com
PUBLIC_URL=https://wellfit.yourdomain.com

# Offline Mode (already enabled)
REACT_APP_OFFLINE_ENABLED=true

# Optional: Demo Mode
REACT_APP_DEMO_ENABLED=false
```

### Step 4: Deploy & Verify

```bash
# Build with production env
npm run build

# Deploy your build folder
# (Method depends on your hosting choice)

# Test HTTPS
curl -I https://wellfit.yourdomain.com

# Verify Service Worker registration
# Open browser console and look for:
# "[ServiceWorker] Registered successfully!"
```

### Mobile Device Setup

#### iPhone/iPad Installation

1. Open WellFit in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"
5. App now works like a native app, even offline!

#### Android Installation

1. Open WellFit in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home screen"
4. Tap "Add"
5. App now works like a native app, even offline!

### Hospital/Clinic Deployment

#### Network Configuration

```
Hospital Network Topology:

Internet ←→ Firewall ←→ Load Balancer ←→ Web Servers
                                              ↓
                                        WellFit App
                                              ↓
                                    [HTTPS Required]
                                              ↓
                                        Offline Cache
                                              ↓
                                    Staff/Patient Devices
```

#### Firewall Rules

**Allow Outbound:**
- Port 443 (HTTPS) → your-project.supabase.co
- Port 443 (HTTPS) → wellfit.yourdomain.com

**Allow Inbound (if self-hosted):**
- Port 443 (HTTPS) → WellFit web server

#### Internal Deployment (Recommended)

For maximum security, deploy on internal network:

```bash
# Use internal domain
https://wellfit.internal.hospital.org

# Ensure SSL certificate for internal domain
# Can use organization's internal CA
```

### Security Hardening

#### Content Security Policy (CSP)

Add to your HTML or server headers:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.hcaptcha.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https: blob:;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  frame-src https://hcaptcha.com https://*.hcaptcha.com;
  worker-src 'self' blob:;
">
```

#### Additional Security Headers

```nginx
# nginx.conf
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), geolocation=(), microphone=()";
```

#### Device Security Requirements

Enforce via policy:
- Device encryption enabled
- Screen lock (PIN/password/biometric)
- Auto-lock after 5 minutes max
- Antivirus software installed
- OS updates current
- WellFit bookmarked/installed

---

## Testing & Verification

### Test 1: Service Worker Installation

1. Open app in browser: `https://wellfit.yourdomain.com`
2. Open DevTools (F12) → Console
3. Look for: `✅ WellFit is now available offline!`
4. Check Application tab → Service Workers
5. Verify service worker is "activated and running"

**Expected Result**: Service worker registered successfully

### Test 2: Offline Mode

1. **While online**: Log in and visit Self-Reporting page
2. Open DevTools → Network tab
3. Change dropdown to "Offline"
4. **Refresh the page** - app should still load!
5. Fill out health check-in
6. Submit - should see "💾 Saved offline!"

**Expected Result**: App continues to function without internet

### Test 3: Sync Functionality

1. With form data saved offline
2. Change Network to "Online"
3. Click offline indicator (bottom left)
4. Press "Sync Now"
5. Verify data appears in Supabase dashboard

**Expected Result**: Offline data successfully uploaded to database

### Test 4: Pulse Oximeter Offline

1. Go offline (DevTools → Network → Offline)
2. Click "Measure Now" on pulse oximeter
3. Place finger on camera
4. Measurement should complete offline
5. Values auto-fill in form
6. Submit saves locally

**Expected Result**: Vitals measured and saved without internet

### Testing Checklist

**Service Worker:**
- [ ] Console shows "✅ WellFit is now available offline!"
- [ ] DevTools → Application → Service Workers shows "activated and running"
- [ ] Cache Storage contains app files

**Offline Mode:**
- [ ] App loads while offline
- [ ] Navigation works offline
- [ ] Forms can be filled offline
- [ ] Data saves locally

**Pulse Oximeter:**
- [ ] Camera permission granted
- [ ] Measurement completes (15 seconds)
- [ ] Heart rate displays correctly
- [ ] SpO2 displays correctly
- [ ] Values auto-fill in form
- [ ] Works offline

**Sync:**
- [ ] Offline indicator shows pending count
- [ ] Manual "Sync Now" works
- [ ] Auto-sync triggers when online
- [ ] Data appears in Supabase
- [ ] Pending count decreases

### Monitoring & Maintenance

#### Service Worker Updates

When deploying a new version:

1. Users get notification: "New version available!"
2. They can refresh to update
3. Or it auto-updates on next app open
4. Old cache cleared automatically

#### Force Update (if needed)

```javascript
// In browser console
navigator.serviceWorker.getRegistrations()
  .then(registrations => {
    registrations.forEach(reg => reg.unregister());
  })
  .then(() => location.reload());
```

#### Monitor Sync Success

Check Supabase logs:

```sql
-- Count offline syncs
SELECT
  DATE(created_at) as date,
  COUNT(*) as offline_reports
FROM self_reports
WHERE metadata->>'source' = 'offline_sync'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### Storage Usage Monitoring

```javascript
// Check storage usage (run in console)
if ('storage' in navigator && 'estimate' in navigator.storage) {
  navigator.storage.estimate().then(estimate => {
    const used = (estimate.usage / 1024 / 1024).toFixed(2);
    const quota = (estimate.quota / 1024 / 1024).toFixed(2);
    console.log(`Storage: ${used}MB / ${quota}MB`);
  });
}
```

---

## Troubleshooting

### Service Worker Not Registering

**Symptoms**: No offline functionality, no "✅ Available offline" message

**Solutions**:
1. Verify HTTPS is enabled (Service Workers require HTTPS)
2. Check that `service-worker.js` is accessible at root
3. Clear browser cache and reload
4. Check browser console for errors
5. Ensure browser supports Service Workers

**Testing**:
```bash
# Verify HTTPS
curl -I https://wellfit.yourdomain.com | grep -i "200\|301\|302"

# Verify service-worker.js accessible
curl https://wellfit.yourdomain.com/service-worker.js
```

### App Not Working Offline

**Symptoms**: "No internet" error when offline

**Solutions**:
1. Visit app once while online to cache it
2. Navigate to Self-Reporting page while online
3. Wait for cache to populate
4. Check DevTools → Application → Cache Storage
5. Verify Service Worker is registered

**How to Fix**:
- Open app while connected to internet
- Visit all pages you want available offline
- Check console for "✅ Available offline" message
- Try going offline again

### Data Not Syncing

**Symptoms**: Offline indicator shows pending reports, but they don't upload

**Solutions**:
1. Check internet connection
2. Click offline indicator → Press "Sync Now"
3. Verify Supabase credentials in environment variables
4. Check browser console for network errors
5. Review Supabase API status

**Manual Sync**:
```javascript
// In browser console
import { offlineStorage } from './utils/offlineStorage';
const count = await offlineStorage.getPendingCount(userId);
console.log(`Pending: ${count}`);
```

### Can't Measure Pulse

**Symptoms**: Pulse oximeter button doesn't work or measurement fails

**Solutions**:
1. Allow camera permission when prompted
2. Ensure good lighting (not too dark)
3. Place finger flat on back camera
4. Cover camera lens completely
5. Hold still for full 15 seconds
6. Clean camera lens if dirty

### Offline Mode Stuck

**Symptoms**: Indicator shows "Offline Mode" even when online

**Solutions**:
1. Check actual internet connection
2. Click indicator → Press "Sync Now"
3. Refresh the page
4. Clear browser cache
5. Check firewall/proxy settings

### Storage Quota Exceeded

**Symptoms**: "QuotaExceededError" in console

**Solutions**:
```javascript
// Request persistent storage
navigator.storage.persist();

// Clear old data after successful sync
// Data automatically clears after upload

// Check storage usage
navigator.storage.estimate().then(console.log);
```

### Clear Offline Data (For Testing)

If you need to reset offline storage:

1. Open browser DevTools (F12)
2. Go to "Application" tab
3. Clear "IndexedDB" → WellFitOfflineDB
4. Clear "Cache Storage"
5. Unregister Service Worker
6. Refresh the page while online

---

## HIPAA Compliance

### Implemented Safeguards

- User authentication required before accessing data
- Browser/OS-level encryption (AES-256) for IndexedDB
- Audit logging of all actions
- Secure transmission (HTTPS/TLS 1.2+)
- Automatic session timeout after inactivity
- User-specific data isolation
- No remote access to offline data

### User Responsibilities

Users must:
- Enable device encryption
- Use device lock (PIN/biometric)
- Keep device physically secure
- Report lost/stolen devices immediately
- Update software regularly
- Log out when finished
- Not share login credentials

### Device Security Policy

Recommended policy for healthcare settings:

```
✅ Device encryption enabled (required)
✅ Screen lock with PIN/password/biometric (required)
✅ Auto-lock after 5 minutes maximum (required)
✅ Antivirus software installed (recommended)
✅ OS and browser updates current (required)
✅ WellFit bookmarked or installed (recommended)
✅ Physical device security training (required)
```

### Data Persistence

- **Health reports**: Stored until successfully synced
- **Measurements**: Cleared after sync (90 days max)
- **Cache**: Updates with new app versions
- **On logout**: Option to clear offline data

### Breach Procedures

If device is lost or stolen:

1. Report to IT/Security immediately
2. Remote wipe device if possible
3. Revoke user access in Supabase
4. Document incident for HIPAA compliance
5. Monitor for unauthorized access
6. Follow organization's breach notification procedures

---

## Staff Training

### For Healthcare Workers (15-minute training)

1. **How offline mode works**
   - Service Workers cache the app
   - IndexedDB stores data locally
   - Auto-sync when connection returns

2. **Device security requirements**
   - Device encryption must be enabled
   - Use strong screen lock
   - Never leave device unattended

3. **Initial setup procedure**
   - Log in while connected to Wi-Fi
   - Visit Self-Reporting page
   - Wait for "Available offline" message

4. **Using the pulse oximeter**
   - Click "Measure Now"
   - Place finger on back camera
   - Wait 15 seconds
   - Values auto-fill

5. **Checking sync status**
   - Look at bottom-left indicator
   - Orange = offline, Green = online
   - Number shows pending uploads

6. **Troubleshooting common issues**
   - Refer to troubleshooting section above
   - Check internet connection first
   - Try manual sync

7. **When to call IT support**
   - Service Worker won't register
   - Data consistently fails to sync
   - Camera permission denied
   - Storage quota errors

### For Seniors (5-minute training)

Simple instructions for patients:

1. "This app works even without internet!"
2. "Open it just like any other app"
3. "Fill out your health check-in normally"
4. "Click the heart button to check your pulse"
5. "Your data saves automatically"
6. "When internet comes back, it uploads"
7. "Look for the little light in the corner - green is good!"

### Training Checklist

**Before Go-Live:**
- [ ] Train all staff on offline functionality
- [ ] Create quick reference cards
- [ ] Record video tutorial (optional)
- [ ] Establish help desk procedures
- [ ] Test with real devices
- [ ] Practice troubleshooting scenarios

---

## Success Metrics

Monitor these KPIs after deployment:

### Offline Adoption
- % of users with service worker registered
- Average offline sessions per user
- Total offline health reports saved

### Sync Performance
- Average sync delay (time offline → sync)
- Sync success rate (%)
- Failed sync attempts
- Retry success rate

### User Experience
- App load time (online vs offline)
- Pulse oximeter success rate
- User satisfaction (surveys)
- Support ticket volume

### Technical Health
- Service Worker registration rate
- Cache hit rate
- Storage usage per user
- Error rate

---

## A Note of Faith

This offline functionality was created with prayer and dedication to serve rural American seniors, hospitals, and doctor's offices that may have unreliable or limited internet connectivity. Every senior deserves access to quality healthcare tools, regardless of their location.

**"Do not neglect to do good and to share what you have, for such sacrifices are pleasing to God."** - Hebrews 13:16

**"And do not forget to do good and to share with others, for with such sacrifices God is pleased."** - Hebrews 13:16

This feature was built with prayer and dedication to serve those in rural communities who often face barriers to healthcare technology. May it serve you well and bring better health outcomes for all!

---

## Support & Questions

### For Technical Issues
- Review this documentation thoroughly
- Check troubleshooting section
- Review browser console for errors
- Contact your IT department

### For HIPAA Questions
- Consult your compliance officer
- Review HIPAA Compliance section above
- Document all procedures
- Conduct regular security assessments

### For User Support
- Provide training materials
- Create quick reference cards
- Establish help desk contact
- Monitor user feedback

---

## Version History

### v1.0.0 - Offline Mode Launch (January 2025)
- Service Worker implementation
- IndexedDB storage system
- Offline indicator UI
- Auto-sync functionality
- Pulse oximeter offline support
- Health check-ins offline support
- Complete documentation
- HIPAA compliance guidance

---

## Appendix: Technical Reference

### Key Files Reference

```
src/
├── components/
│   ├── PulseOximeter.tsx          - Camera-based pulse oximeter
│   └── OfflineIndicator.tsx       - Status indicator widget
│
├── utils/
│   └── offlineStorage.ts          - IndexedDB operations
│
├── pages/
│   └── SelfReportingPage.tsx      - Offline-enabled form
│
├── serviceWorkerRegistration.ts   - SW registration logic
├── App.tsx                        - Offline indicator integration
└── index.tsx                      - Service worker activation

public/
└── service-worker.js              - Service Worker implementation
```

### Adding New Offline Features

Example code for developers:

```typescript
import { offlineStorage, isOnline } from '../utils/offlineStorage';

// Save data with offline support
const saveData = async (data) => {
  if (isOnline()) {
    try {
      // Try to save online first
      await api.save(data);
    } catch (error) {
      // Fall back to offline storage
      await offlineStorage.savePendingReport(userId, data);
    }
  } else {
    // Save offline immediately
    await offlineStorage.savePendingReport(userId, data);
  }
};
```

### Debugging Tools

**Chrome DevTools:**
1. F12 → Application tab → Service Workers
2. Network tab → Throttle to "Offline"
3. Application tab → IndexedDB → WellFitOfflineDB
4. Application tab → Cache Storage

**Firefox DevTools:**
1. F12 → Storage tab → Service Workers
2. Network tab → Offline mode
3. Storage tab → Indexed DB

**Service Worker Internals:**
- Chrome: `chrome://serviceworker-internals`
- Edge: `edge://serviceworker-internals`

---

**Status**: Production Ready
**Version**: 1.0.0
**Last Updated**: January 2025
**Built with love and faith for rural healthcare**

---

End of Guide
