# Tuesday Branding Alignment - WellFit Community

## Quick 15-Minute Task

### Update Mobile App to Match Main WellFit Branding

**Current WellFit Colors (from main app):**
- Primary: `#003865` (WellFit Blue)
- Secondary: `#8cc63f` (WellFit Green)
- Logo: `/android-chrome-512x512.png`
- App Name: "WellFit Community"

**Files to Update:**
1. `.env.wellfit` - Update color values
2. Copy logo from main project to `assets/logos/`
3. Regenerate assets: `npm run generate-assets`

**Current Mobile App Branding (needs update):**
- Primary: `#2196F3` (generic blue) → Change to `#003865`
- Secondary: `#4CAF50` (generic green) → Change to `#8cc63f`
- Generic logo → WellFit Community logo

**Commands to Run:**
```bash
# 1. Update colors in .env.wellfit
# 2. Copy logo from main project
# 3. Regenerate branded assets
npm run generate-assets
# 4. Test build
npm run build:android:dev
```

**Result:** Perfect visual alignment between web app and mobile companion app

---
*Reminder created: [Current Date]*
*Estimated time: 15 minutes*