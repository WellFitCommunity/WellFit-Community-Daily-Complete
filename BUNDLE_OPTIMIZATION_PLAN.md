# Bundle Optimization Plan - Methodist Enterprise Readiness

**Current Size:** 3.5 MB gzipped
**Target Size:** 1.5-2 MB gzipped
**Reduction Needed:** 40-50% (1.5-2 MB)
**Timeline:** 3-5 days

---

## Phase 1: Lucide-React Tree Shaking (Day 1) - Expected 500KB-1MB savings

### Problem
Currently importing from 'lucide-react' default export pulls in ALL ~1,400 icons (~17KB+ waste per file)

**Current (BAD):**
```typescript
import { Search, User, Settings } from 'lucide-react';
```

**Optimized (GOOD):**
```typescript
import Search from 'lucide-react/dist/esm/icons/search';
import User from 'lucide-react/dist/esm/icons/user';
import Settings from 'lucide-react/dist/esm/icons/settings';
```

### Files to Fix (30 files):
1. src/components/physician/WorkflowModeSwitcher.tsx
2. src/components/nurse/NurseWorkflowModeSwitcher.tsx
3. src/components/admin/AdminWorkflowModeSwitcher.tsx
4. src/components/security/SecurityWorkflowModeSwitcher.tsx
5. src/components/telehealth/TelehealthScheduler.tsx
6. src/components/physician/PhysicianPanel.tsx
7. src/components/physician/CommandPalette.tsx ← START HERE
8. src/components/physician/components/PatientSummaryCard.tsx
9. src/components/admin/MCPCostDashboard.tsx
10. src/components/physician/components/PatientSelector.tsx
11. src/pages/DoctorsViewPage.tsx
12. src/components/patient/MedicineCabinet.tsx
13. src/components/admin/HospitalAdapterManagementPanel.tsx
14. src/components/admin/FHIRConflictResolution.tsx
15. src/components/shared/PasswordGenerator.tsx
16. src/components/billing/BillingReviewDashboard.tsx
17. src/components/layout/GlobalHeader.tsx
18. src/components/admin/AdminPanel.tsx
19. src/components/chw/CHWAlertsWidget.tsx
20. src/pages/EnhancedQuestionsPage.tsx
21. src/pages/AuditLogsPage.tsx
22. src/pages/SystemAdministrationPage.tsx
23. src/components/system/UserRoleManager.tsx
24. src/components/system/DatabaseAdminPanel.tsx
25. src/components/system/ActiveSessionManager.tsx
26. src/components/patient/PillIdentifier.tsx
27. src/components/admin/NurseQuestionManager.tsx
28. src/pages/SelfReportingPage.tsx
29. src/pages/MemoryLaneTriviaPage.tsx
30. + more (need full scan)

### Implementation:
```bash
# Script to auto-fix lucide-react imports
npm run optimize:icons
```

---

## Phase 2: Code Splitting for Large Chunks (Day 2) - Expected 400-600KB savings

### Target: 2508.chunk.js (276KB)
This appears to be wearables/admin features bundled together.

**Strategy:**
1. Split admin panel into sub-chunks
2. Split wearables adapters into separate chunk
3. Use dynamic imports for heavy features

### Files Likely in This Chunk:
- src/adapters/wearables/*.ts
- src/components/admin/* (heavy components)
- src/components/physician/* (complex dashboards)

**Implementation:**
```typescript
// In App.tsx or route config
const WearablesManager = React.lazy(() =>
  import(/* webpackChunkName: "wearables" */ './components/admin/WearablesManager')
);

const AdminDashboard = React.lazy(() =>
  import(/* webpackChunkName: "admin-dashboard" */ './components/admin/AdminDashboard')
);
```

---

## Phase 3: Remove Unused Dependencies (Day 3) - Expected 200-400KB savings

### Audit package.json for unused packages:
```bash
npm install -g depcheck
depcheck
```

### Likely Candidates for Removal:
- Unused chart libraries?
- Duplicate UI libraries?
- Old/deprecated packages

### Check for duplicate packages:
```bash
npm ls react
npm ls react-dom
npm dedupe
```

---

## Phase 4: Optimize Large Libraries (Day 3-4) - Expected 300-500KB savings

### 1. Lodash (if used)
**Bad:** `import _ from 'lodash'`
**Good:** `import debounce from 'lodash/debounce'`

### 2. Moment.js (if used)
Replace with date-fns (90% smaller)

### 3. Firebase (already using - verify tree shaking)
```typescript
// Only import what you need
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// Don't import entire firebase package
```

---

## Phase 5: Build Configuration (Day 4-5)

### 1. Enable Production Optimizations
```json
// package.json
{
  "scripts": {
    "build": "GENERATE_SOURCEMAP=false NODE_ENV=production react-scripts build",
    "build:analyze": "npm run build && npx source-map-explorer 'build/static/js/*.js'"
  }
}
```

### 2. Add Bundle Analyzer
```bash
npm install --save-dev webpack-bundle-analyzer
```

### 3. Configure webpack (if ejected or using craco):
```javascript
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10
      },
      admin: {
        test: /[\\/]src[\\/]components[\\/]admin[\\/]/,
        name: 'admin',
        priority: 5
      },
      wearables: {
        test: /[\\/]src[\\/]adapters[\\/]wearables[\\/]/,
        name: 'wearables',
        priority: 5
      }
    }
  }
}
```

---

## Phase 6: Image & Asset Optimization (Day 5)

### 1. Compress images
```bash
npm install -g imagemin-cli
imagemin public/images/* --out-dir=public/images
```

### 2. Use WebP format
```bash
# Convert PNGs/JPGs to WebP
for file in public/images/*.png; do
  cwebp "$file" -o "${file%.png}.webp"
done
```

### 3. Lazy load images
```typescript
import { LazyLoadImage } from 'react-lazy-load-image-component';

<LazyLoadImage
  src={imageSrc}
  alt="Description"
  effect="blur"
/>
```

---

## Expected Results by Phase

| Phase | Action | Expected Savings | Cumulative |
|-------|--------|-----------------|------------|
| 1 | Lucide-react tree shaking | 500KB-1MB | 3.0-2.5 MB |
| 2 | Code splitting (admin/wearables) | 400-600KB | 2.6-1.9 MB |
| 3 | Remove unused deps | 200-400KB | 2.4-1.5 MB |
| 4 | Optimize libraries | 300-500KB | 2.1-1.0 MB |
| 5 | Build config optimization | 100-200KB | 2.0-0.8 MB |
| 6 | Asset optimization | 100-300KB | 1.9-0.5 MB |

**Target:** 1.5-2 MB ✅ Achievable

---

## Testing After Each Phase

```bash
# Build and measure
npm run build

# Check sizes
du -sh build/static/js/*

# Total gzipped size
find build/static/js -name "*.js" | xargs gzip -c | wc -c | awk '{print $1/1024/1024 " MB"}'

# Lighthouse audit
npx lighthouse https://your-app-url --only-categories=performance
```

---

## Quick Start (Immediate Action)

### Step 1: Install helper script
```bash
cat > scripts/optimize-lucide.sh << 'EOF'
#!/bin/bash
# Auto-fix lucide-react imports for tree shaking

echo "Optimizing lucide-react imports..."

# Find all files importing from lucide-react
grep -r "from 'lucide-react'" src/ | cut -d: -f1 | sort -u | while read file; do
  echo "Processing: $file"

  # This is a placeholder - actual implementation needs AST parsing
  # Consider using jscodeshift or similar tool
  echo "  -> Manual fix required for now"
done

echo "Done! Now build and test."
EOF

chmod +x scripts/optimize-lucide.sh
```

### Step 2: Manual fix template
For each file with lucide-react imports:

**Before:**
```typescript
import { User, Settings, Bell, Search } from 'lucide-react';
```

**After:**
```typescript
import User from 'lucide-react/dist/esm/icons/user';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Bell from 'lucide-react/dist/esm/icons/bell';
import Search from 'lucide-react/dist/esm/icons/search';
```

---

## Success Criteria

- [ ] Bundle size < 2 MB gzipped
- [ ] Page load time < 2 seconds on 4G
- [ ] Lighthouse performance score > 90
- [ ] No regression in functionality
- [ ] Methodist demo-ready

---

## Next Steps

**Ready to start? Let's begin with Phase 1 (lucide-react optimization).**

I can help you:
1. Create an automated script to fix lucide imports
2. Manually fix the 30 identified files
3. Build and measure improvements
4. Move to Phase 2

**Which would you prefer?**
