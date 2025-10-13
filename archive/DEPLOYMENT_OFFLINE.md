# 🚀 WellFit Offline Mode - Deployment Guide

## For Rural Healthcare & Hospital Deployments

This guide will help you deploy WellFit with full offline support for rural seniors, hospitals, and doctor's offices.

---

## ✅ Pre-Deployment Checklist

### Required:
- [ ] **HTTPS enabled** (required for Service Workers)
- [ ] **Domain name** configured
- [ ] **SSL/TLS certificate** installed
- [ ] **Supabase project** set up
- [ ] **Environment variables** configured

### Recommended:
- [ ] **HIPAA compliance review** completed
- [ ] **Security assessment** performed
- [ ] **User training materials** prepared
- [ ] **Device security policy** established
- [ ] **Backup procedures** documented

---

## 🔧 Step-by-Step Deployment

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
```

### Step 2: Verify Offline Files

Ensure these files exist in your build:

```bash
# Check critical offline files
ls -la build/service-worker.js
ls -la build/index.html
ls -la build/manifest.json
```

### Step 3: Configure HTTPS

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

#### Option C: Self-Hosted (Apache/Nginx)

**Apache (.htaccess)**:
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

**Nginx (nginx.conf)**:
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

### Step 4: Environment Configuration

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

### Step 5: Deploy & Verify

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

---

## 🧪 Testing Offline Functionality

### Test 1: Service Worker Installation

1. Open app in browser: `https://wellfit.yourdomain.com`
2. Open DevTools (F12) → Console
3. Look for: `✅ WellFit is now available offline!`
4. Check Application tab → Service Workers
5. Verify service worker is "activated and running"

### Test 2: Offline Mode

1. **While online**: Log in and visit Self-Reporting page
2. Open DevTools → Network tab
3. Change dropdown to "Offline"
4. **Refresh the page** - app should still load!
5. Fill out health check-in
6. Submit - should see "💾 Saved offline!"

### Test 3: Sync Functionality

1. With form data saved offline
2. Change Network to "Online"
3. Click offline indicator (bottom left)
4. Press "Sync Now"
5. Verify data appears in Supabase dashboard

### Test 4: Pulse Oximeter Offline

1. Go offline (DevTools → Network → Offline)
2. Click "Measure Now" on pulse oximeter
3. Place finger on camera
4. Measurement should complete offline
5. Values auto-fill in form
6. Submit saves locally

---

## 📱 Mobile Device Setup

### For Seniors (iOS):

**Step 1: Initial Setup (Needs Wi-Fi)**
1. Open Safari on iPhone/iPad
2. Go to: `https://wellfit.yourdomain.com`
3. Tap Share button (square with arrow)
4. Scroll and tap "Add to Home Screen"
5. Tap "Add"

**Step 2: Create Shortcut**
- Icon appears on home screen
- Tap to open (works like an app!)
- First time: needs internet to load
- After that: works offline!

### For Seniors (Android):

**Step 1: Initial Setup (Needs Wi-Fi)**
1. Open Chrome on Android phone
2. Go to: `https://wellfit.yourdomain.com`
3. Tap three dots (menu)
4. Tap "Add to Home screen"
5. Tap "Add"

**Step 2: Use the App**
- Icon appears on home screen
- Tap to open
- Works offline after first load!

---

## 🏥 Hospital/Clinic Deployment

### Network Setup:

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

### Firewall Rules:

**Allow Outbound**:
```
- Port 443 (HTTPS) → your-project.supabase.co
- Port 443 (HTTPS) → wellfit.yourdomain.com
```

**Allow Inbound** (if self-hosted):
```
- Port 443 (HTTPS) → WellFit web server
```

### Recommended: Internal Deployment

For maximum security, deploy WellFit on internal network:

```bash
# Use internal domain
https://wellfit.internal.hospital.org

# Ensure SSL certificate for internal domain
# Can use organization's internal CA
```

### Staff Device Configuration:

1. **Initial Setup** (one-time, on hospital Wi-Fi):
   - Open WellFit in browser
   - Log in with credentials
   - Visit all main pages once
   - Bookmark or add to home screen

2. **Daily Use**:
   - Open bookmarked app
   - Works even if Wi-Fi drops
   - Data syncs when connection returns

---

## 🔐 Security Hardening

### Content Security Policy (CSP)

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

### Additional Headers:

```nginx
# nginx.conf
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), geolocation=(), microphone=()";
```

### Device Security Requirements:

**Enforce via policy**:
```
✅ Device encryption enabled
✅ Screen lock (PIN/password/biometric)
✅ Auto-lock after 5 minutes max
✅ Antivirus software installed
✅ OS updates current
✅ WellFit bookmarked/installed
```

---

## 📊 Monitoring & Maintenance

### Service Worker Updates:

When you deploy a new version:

1. Users get notification: "New version available!"
2. They can refresh to update
3. Or it auto-updates on next app open
4. Old cache cleared automatically

### Force Update (if needed):

```javascript
// In browser console
navigator.serviceWorker.getRegistrations()
  .then(registrations => {
    registrations.forEach(reg => reg.unregister());
  })
  .then(() => location.reload());
```

### Monitor Sync Success:

Check Supabase logs for:
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

### Storage Usage Monitoring:

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

## 🔄 Update Procedures

### Rolling Out Updates:

1. **Test offline features** in staging
2. **Build new version**: `npm run build`
3. **Deploy to production**
4. **Service Worker auto-updates** within 24hrs
5. **Monitor for issues**

### Emergency Rollback:

```bash
# Revert to previous build
git revert HEAD
npm run build
# Deploy previous version

# Clear service workers if needed
# Users may need to manually refresh
```

---

## 🐛 Troubleshooting

### Issue: Service Worker Not Registering

**Symptoms**: No offline functionality, no "✅ Available offline" message

**Solutions**:
```bash
# Check 1: Verify HTTPS
curl -I https://wellfit.yourdomain.com | grep -i "200\|301\|302"

# Check 2: Verify service-worker.js accessible
curl https://wellfit.yourdomain.com/service-worker.js

# Check 3: Check browser console for errors
# Look for: "Failed to register service worker"

# Fix: Ensure HTTPS, check file path, verify no JS errors
```

### Issue: App Not Working Offline

**Symptoms**: "No internet" error when offline

**Solutions**:
1. Visit app once while online
2. Navigate to Self-Reporting page
3. Wait for cache to populate
4. Check Application tab → Cache Storage

### Issue: Data Not Syncing

**Symptoms**: Offline indicator shows pending reports, but they don't upload

**Solutions**:
```javascript
// Check pending count
import { offlineStorage } from './utils/offlineStorage';
const count = await offlineStorage.getPendingCount(userId);
console.log(`Pending: ${count}`);

// Force sync
// Click offline indicator → "Sync Now"

// Check network tab for failed requests
// Verify Supabase credentials
```

### Issue: Storage Quota Exceeded

**Symptoms**: "QuotaExceededError" in console

**Solutions**:
```javascript
// Request persistent storage
navigator.storage.persist();

// Clear old data
import { offlineStorage } from './utils/offlineStorage';
await offlineStorage.clearAllData();

// Or clear specific reports after sync
```

---

## 📞 Support & Training

### Staff Training Checklist:

- [ ] How to access WellFit offline
- [ ] How to check sync status
- [ ] How to use pulse oximeter
- [ ] How to report issues
- [ ] Device security requirements
- [ ] What to do if device is lost

### Patient/Senior Training:

- [ ] How to open the app
- [ ] What "offline mode" means
- [ ] How to fill out health check-in
- [ ] How to use pulse oximeter
- [ ] How to see if data uploaded
- [ ] Who to contact for help

### Training Resources:

- User Guide: `/OFFLINE_MODE.md`
- Video Tutorial: (create and link)
- Quick Reference Card: (create PDF)
- Help Desk Contact: (your number)

---

## ✅ Go-Live Checklist

### Pre-Launch:
- [ ] HTTPS configured and tested
- [ ] Service Worker registering correctly
- [ ] Offline mode tested thoroughly
- [ ] Pulse oximeter tested on multiple devices
- [ ] Sync functionality verified
- [ ] HIPAA compliance reviewed
- [ ] User training completed
- [ ] Support procedures established

### Launch Day:
- [ ] Monitor error logs
- [ ] Check service worker registration rate
- [ ] Verify sync success rate
- [ ] Be available for user support
- [ ] Document any issues

### Post-Launch (Week 1):
- [ ] Review usage metrics
- [ ] Check for failed syncs
- [ ] Gather user feedback
- [ ] Address any bugs
- [ ] Update documentation

---

## 📈 Success Metrics

Monitor these KPIs:

```
Offline Adoption:
- % of users with service worker registered
- Average offline sessions per user
- Total offline health reports saved

Sync Performance:
- Average sync delay (time offline → sync)
- Sync success rate (%)
- Failed sync attempts

User Experience:
- App load time (online vs offline)
- Pulse oximeter success rate
- User satisfaction (surveys)
```

---

## 🎉 You're Ready!

Your WellFit deployment now supports:
- ✅ Full offline functionality
- ✅ Camera-based pulse oximeter
- ✅ Automatic data sync
- ✅ HIPAA-compliant storage
- ✅ Rural healthcare accessibility

### Questions?
- Review `/OFFLINE_MODE.md` for user documentation
- Review `/HIPAA_COMPLIANCE.md` for compliance info
- Check GitHub issues for known problems
- Contact your technical team

---

**Deployed with ❤️ and 🙏 for rural healthcare**

*Last Updated: January 2025*
