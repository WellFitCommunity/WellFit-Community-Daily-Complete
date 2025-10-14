# Cross-Browser Testing Guide

## Overview
This guide outlines the cross-browser testing strategy for WellFit Community Daily across Chrome, Safari, Firefox, and Edge.

## Browser Support Matrix

| Browser | Version | Desktop | Mobile | Priority | Market Share |
|---------|---------|---------|--------|----------|--------------|
| Chrome | Latest 2 | ✓ | ✓ | Critical | ~65% |
| Safari | Latest 2 | ✓ | ✓ | Critical | ~20% |
| Firefox | Latest 2 | ✓ | ✓ | High | ~3% |
| Edge | Latest 2 | ✓ | ✓ | High | ~5% |
| Samsung Internet | Latest | - | ✓ | Medium | ~2% |

## Testing Environment Setup

### Local Testing
```bash
# Install browsers
# macOS
brew install --cask google-chrome firefox microsoft-edge

# Windows
winget install Google.Chrome
winget install Mozilla.Firefox
winget install Microsoft.Edge

# Linux
sudo apt install google-chrome-stable firefox
```

### Browser DevTools

#### Chrome DevTools
- F12 or Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows)
- Device toolbar: Cmd+Shift+M / Ctrl+Shift+M

#### Firefox Developer Tools
- F12 or Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows)
- Responsive Design Mode: Cmd+Option+M / Ctrl+Shift+M

#### Safari Web Inspector
- Cmd+Option+I (requires enabling in Preferences → Advanced)
- Responsive Design Mode: Cmd+Option+R

#### Edge DevTools
- F12 or Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows)
- Device emulation: Cmd+Shift+M / Ctrl+Shift+M

## Feature Compatibility Checklist

### CSS Features
- [ ] Flexbox layouts work in all browsers
- [ ] Grid layouts work in all browsers
- [ ] CSS Variables (custom properties) work
- [ ] Transforms and transitions work
- [ ] Media queries respond correctly
- [ ] Backdrop filters (if used) have fallbacks
- [ ] Clip-path (if used) has fallbacks

### JavaScript Features
- [ ] ES6+ features work (or are transpiled)
- [ ] Async/await works correctly
- [ ] Fetch API works (or polyfilled)
- [ ] Promise handling works
- [ ] Arrow functions work
- [ ] Spread operator works
- [ ] Object destructuring works

### Web APIs
- [ ] localStorage works consistently
- [ ] sessionStorage works consistently
- [ ] IndexedDB works (if used)
- [ ] Service Workers (if used)
- [ ] Notifications API (if used)
- [ ] Clipboard API (if used)
- [ ] File API works consistently

### React/UI Libraries
- [ ] React hooks work correctly
- [ ] Context API works
- [ ] Portals work (modals, tooltips)
- [ ] Third-party components render correctly
- [ ] Event handling works consistently

## Known Browser Differences

### Safari-Specific Issues
```css
/* Date input styling */
input[type="date"] {
  /* Safari doesn't support some pseudo-elements */
  -webkit-appearance: none;
}

/* Flexbox bugs */
.flex-container {
  /* Safari needs flex-shrink: 0 in some cases */
}

/* Transform flickering */
.animated {
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}
```

### Firefox-Specific Issues
```css
/* Scrollbar styling */
.scrollable {
  /* Firefox uses different scrollbar properties */
  scrollbar-width: thin;
  scrollbar-color: #888 #f1f1f1;
}

/* Number input buttons */
input[type="number"] {
  -moz-appearance: textfield;
}
```

### Edge-Specific Issues
```javascript
// Edge Chromium is similar to Chrome
// Legacy Edge (pre-Chromium) had more issues
// Focus on Edge Chromium (Latest 2 versions)
```

## Testing Checklist by Browser

### Chrome Testing
- [ ] All features work as expected
- [ ] Performance is acceptable (Lighthouse score)
- [ ] Console has no errors
- [ ] Network requests succeed
- [ ] Responsive design works
- [ ] PWA features work (if applicable)
- [ ] Extension compatibility tested

### Safari Testing
- [ ] Date/time inputs work correctly
- [ ] Flexbox layouts render correctly
- [ ] Touch events work on iOS
- [ ] Back/forward navigation works
- [ ] localStorage persists correctly
- [ ] Form validation displays correctly
- [ ] CSS animations are smooth
- [ ] Private browsing mode works

### Firefox Testing
- [ ] All interactive elements work
- [ ] Scrollbar styling is acceptable
- [ ] Form controls render correctly
- [ ] Flexbox/Grid layouts work
- [ ] Console has no errors
- [ ] Privacy features don't break functionality
- [ ] Extensions don't interfere

### Edge Testing
- [ ] Chromium-based Edge works like Chrome
- [ ] Windows-specific features work
- [ ] Touch input works on Surface devices
- [ ] High contrast mode is supported
- [ ] Reading view is accessible
- [ ] Collections feature doesn't break UI

## Component-Specific Tests

### Patient Engagement Dashboard
| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Table rendering | [ ] | [ ] | [ ] | [ ] |
| Pagination | [ ] | [ ] | [ ] | [ ] |
| Filters | [ ] | [ ] | [ ] | [ ] |
| Sorting | [ ] | [ ] | [ ] | [ ] |
| Export (if any) | [ ] | [ ] | [ ] | [ ] |

### Forms
| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Input validation | [ ] | [ ] | [ ] | [ ] |
| Date picker | [ ] | [ ] | [ ] | [ ] |
| File upload | [ ] | [ ] | [ ] | [ ] |
| Draft recovery | [ ] | [ ] | [ ] | [ ] |
| Error display | [ ] | [ ] | [ ] | [ ] |

### Navigation
| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Routing | [ ] | [ ] | [ ] | [ ] |
| Back/forward | [ ] | [ ] | [ ] | [ ] |
| Skip links | [ ] | [ ] | [ ] | [ ] |
| Breadcrumbs | [ ] | [ ] | [ ] | [ ] |

## Automated Cross-Browser Testing

### BrowserStack / Sauce Labs
```javascript
// Example configuration
const browsers = {
  chrome: { version: 'latest' },
  safari: { version: 'latest' },
  firefox: { version: 'latest' },
  edge: { version: 'latest' },
};
```

### Playwright
```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install

# Run tests
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

```javascript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'] } },
  ],
});
```

## Manual Testing Workflow

### 1. Visual Regression Testing
1. Take screenshots in Chrome (baseline)
2. Take screenshots in other browsers
3. Compare for differences
4. Document any visual bugs

### 2. Functional Testing
1. Test critical user flows in each browser
2. Verify forms work correctly
3. Test navigation
4. Verify data displays correctly

### 3. Performance Testing
1. Run Lighthouse in each browser
2. Check load times
3. Verify smooth animations
4. Test with slow network (throttling)

### 4. Responsive Testing
1. Test breakpoints in each browser
2. Verify touch targets on mobile
3. Test orientation changes
4. Verify zoom works

## Common Issues & Fixes

### Issue: Date Input Looks Different
```tsx
// Solution: Use a cross-browser date picker library
import DatePicker from 'react-datepicker';

<DatePicker
  selected={date}
  onChange={setDate}
  dateFormat="MM/dd/yyyy"
/>
```

### Issue: Flexbox Gap Not Working (Safari < 14.1)
```css
/* Fallback for older Safari */
.flex-container {
  gap: 1rem;
}

/* Or use margin as fallback */
@supports not (gap: 1rem) {
  .flex-item {
    margin: 0.5rem;
  }
}
```

### Issue: Smooth Scrolling Not Working
```css
/* Feature detection */
@supports (scroll-behavior: smooth) {
  html {
    scroll-behavior: smooth;
  }
}

/* JavaScript fallback */
if (!('scrollBehavior' in document.documentElement.style)) {
  // Use polyfill or smooth scroll library
}
```

### Issue: LocalStorage Quota Exceeded
```javascript
// Wrap in try-catch
try {
  localStorage.setItem('key', 'value');
} catch (e) {
  if (e.name === 'QuotaExceededError') {
    // Handle quota exceeded
    console.error('Storage quota exceeded');
  }
}
```

## Browser-Specific Testing Scripts

### Check for Browser
```javascript
const getBrowser = () => {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edge')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edge')) return 'Edge';
  return 'Unknown';
};
```

### Feature Detection
```javascript
const features = {
  flexGap: CSS.supports('gap', '1rem'),
  grid: CSS.supports('display', 'grid'),
  customProperties: CSS.supports('--custom', '0'),
  backdropFilter: CSS.supports('backdrop-filter', 'blur(10px)'),
};

console.table(features);
```

## Testing Tools & Resources

### Browser Testing Tools
- BrowserStack: https://www.browserstack.com/
- Sauce Labs: https://saucelabs.com/
- LambdaTest: https://www.lambdatest.com/
- Playwright: https://playwright.dev/

### Compatibility Checkers
- Can I Use: https://caniuse.com/
- MDN Browser Compatibility: https://developer.mozilla.org/
- Browserslist: https://browsersl.ist/

### Visual Regression Tools
- Percy: https://percy.io/
- Chromatic: https://www.chromatic.com/
- BackstopJS: https://github.com/garris/BackstopJS

## Sign-off Checklist

- [ ] All critical flows tested in Chrome
- [ ] All critical flows tested in Safari
- [ ] All critical flows tested in Firefox
- [ ] All critical flows tested in Edge
- [ ] No console errors in any browser
- [ ] Visual consistency across browsers
- [ ] Forms work in all browsers
- [ ] Navigation works in all browsers
- [ ] Performance is acceptable in all browsers
- [ ] Mobile views tested on iOS Safari
- [ ] Mobile views tested on Android Chrome
- [ ] Known issues documented
- [ ] Polyfills added where needed
- [ ] Graceful degradation for unsupported features

## Documentation

### Bug Report Template
```markdown
**Browser:** [Chrome/Safari/Firefox/Edge]
**Version:** [Version number]
**OS:** [Windows/macOS/Linux/iOS/Android]
**Device:** [Desktop/Mobile - specific device if mobile]
**URL:** [Page where issue occurs]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Steps to Reproduce:**
1.
2.
3.

**Screenshot:**
[Attach screenshot]

**Console Errors:**
[Copy any console errors]
```

## Priority Matrix

| Issue Severity | All Browsers | One Browser | Fix Priority |
|----------------|--------------|-------------|--------------|
| Critical (blocking) | ✓ | - | Immediate |
| Critical | - | ✓ | High |
| Major | ✓ | - | High |
| Major | - | ✓ | Medium |
| Minor | ✓ | - | Medium |
| Minor | - | ✓ | Low |

## Notes
- Focus on latest 2 versions of each browser
- Test on real devices when possible
- Use automated tools for regression testing
- Document all browser-specific workarounds
- Keep browserslist config updated
