# Mobile Responsiveness Testing Guide

## Overview
This guide outlines the mobile responsiveness testing checklist for WellFit Community Daily.

## Test Devices and Breakpoints

### Breakpoints
- Mobile Small: 320px - 375px
- Mobile Medium: 375px - 425px
- Mobile Large: 425px - 768px
- Tablet: 768px - 1024px
- Desktop: 1024px+

### Test Devices
- iPhone SE (375x667)
- iPhone 12/13 (390x844)
- iPhone 14 Pro Max (430x932)
- Samsung Galaxy S21 (360x800)
- iPad (768x1024)
- iPad Pro (1024x1366)

## Testing Checklist

### Layout & Structure
- [ ] All content is visible without horizontal scrolling
- [ ] Touch targets are at least 44x44px (Apple) or 48x48px (Material Design)
- [ ] Text is readable without zooming (minimum 16px base)
- [ ] Navigation is accessible and usable
- [ ] Forms are usable on mobile keyboards
- [ ] Modals and dialogs fit within viewport
- [ ] Tables are scrollable or stack properly

### Patient Engagement Dashboard
- [ ] Stats cards stack vertically on mobile
- [ ] Table scrolls horizontally on small screens
- [ ] Pagination controls are accessible with touch
- [ ] Filter dropdowns work on mobile
- [ ] Refresh button is easily tappable

### Forms
- [ ] Input fields have appropriate spacing
- [ ] Labels are visible and associated with inputs
- [ ] Form validation messages are visible
- [ ] Submit buttons are easily tappable
- [ ] Draft recovery notification is visible

### Navigation
- [ ] Hamburger menu (if present) works smoothly
- [ ] Links and buttons have adequate spacing
- [ ] Breadcrumbs (if present) adapt to mobile
- [ ] Skip links are accessible

### Images & Media
- [ ] Images scale appropriately
- [ ] Alt text is present for all images
- [ ] Icons are clear and recognizable
- [ ] Loading states are visible

### Performance
- [ ] Pages load quickly on 3G/4G
- [ ] Animations are smooth (60fps)
- [ ] No layout shifts during load
- [ ] Images are optimized for mobile

## Testing Tools

### Browser DevTools
```bash
# Open Chrome DevTools
# Press F12 or Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows)
# Click device toolbar icon or press Cmd+Shift+M
```

### Responsive Design Mode
1. Open DevTools
2. Toggle device toolbar
3. Select device or enter custom dimensions
4. Test in both portrait and landscape

### Touch Simulation
1. In DevTools, enable touch simulation
2. Test touch interactions
3. Verify touch target sizes

## Common Issues & Fixes

### Horizontal Scrolling
- Check for fixed-width elements
- Use `max-width: 100%` on images
- Use `overflow-x: hidden` carefully

### Text Too Small
- Ensure base font-size is at least 16px
- Use responsive font sizes (rem/em)
- Test readability at arm's length

### Touch Targets Too Small
- Minimum 44x44px (iOS) or 48x48px (Android)
- Add padding to increase hit area
- Use `touch-action` CSS property

### Viewport Issues
- Ensure viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Avoid fixed widths in pixels
- Use flexible layouts (flexbox/grid)

## Test Scenarios

### Scenario 1: Admin Views Dashboard
1. Navigate to Patient Engagement Dashboard
2. Verify stats cards are readable
3. Test table scrolling
4. Change filters and verify results
5. Test pagination on touch

### Scenario 2: Form Submission
1. Open a form (e.g., Risk Assessment)
2. Fill in fields using mobile keyboard
3. Trigger validation errors
4. Submit form
5. Verify draft recovery works

### Scenario 3: Navigation Flow
1. Start from homepage
2. Navigate through main sections
3. Use back button
4. Test skip links
5. Verify breadcrumbs (if present)

## Automated Testing

### Lighthouse Mobile Audit
```bash
# Run Lighthouse in CI or locally
npm run build
npx lighthouse http://localhost:3000 --preset=mobile --view
```

### Responsive Screenshots
```bash
# Using Playwright or similar
npx playwright test --project=mobile
```

## Browser Testing Matrix

| Browser | Mobile | Tablet | Desktop | Priority |
|---------|--------|--------|---------|----------|
| Chrome | ✓ | ✓ | ✓ | High |
| Safari (iOS) | ✓ | ✓ | ✓ | High |
| Firefox | ✓ | ✓ | ✓ | Medium |
| Edge | ✓ | ✓ | ✓ | Medium |
| Samsung Internet | ✓ | - | - | Low |

## Sign-off Checklist

- [ ] All critical user flows tested on mobile
- [ ] Touch targets meet minimum size requirements
- [ ] Text is readable without zooming
- [ ] No horizontal scrolling on any page
- [ ] Forms work with mobile keyboards
- [ ] Navigation is accessible
- [ ] Performance meets targets (LCP < 2.5s)
- [ ] Tested on real devices (at least 2 different models)
- [ ] Screenshots captured for documentation

## Notes
- Test with real devices when possible
- Consider network conditions (3G/4G)
- Test in both portrait and landscape orientations
- Verify touch gestures (swipe, pinch, tap)
