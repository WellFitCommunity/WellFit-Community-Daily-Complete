# Accessibility Audit Guide

## Overview
This guide provides a comprehensive checklist for testing accessibility compliance with WCAG 2.1 Level AA standards.

## Quick Start

### Required Tools
1. **Screen Readers**
   - NVDA (Windows) - Free
   - JAWS (Windows) - Commercial
   - VoiceOver (macOS/iOS) - Built-in
   - TalkBack (Android) - Built-in

2. **Browser Extensions**
   - axe DevTools
   - WAVE Evaluation Tool
   - Lighthouse (Chrome DevTools)
   - Accessibility Insights

3. **Keyboard Testing**
   - No tools required - use keyboard only

## WCAG 2.1 Level AA Checklist

### 1. Perceivable

#### 1.1 Text Alternatives
- [ ] All images have meaningful alt text
- [ ] Decorative images use empty alt or aria-hidden
- [ ] Form inputs have associated labels
- [ ] Icon buttons have accessible names

#### 1.2 Time-based Media
- [ ] Audio content has transcripts
- [ ] Video content has captions
- [ ] Audio descriptions for video (if applicable)

#### 1.3 Adaptable
- [ ] Semantic HTML elements used correctly
- [ ] Heading hierarchy is logical (h1 → h2 → h3)
- [ ] Lists use proper markup (ul, ol, li)
- [ ] Tables have proper headers
- [ ] Form fields have labels and instructions

#### 1.4 Distinguishable
- [ ] Color contrast ratio ≥ 4.5:1 for normal text
- [ ] Color contrast ratio ≥ 3:1 for large text (18pt+)
- [ ] Color is not the only visual means of conveying information
- [ ] Text can be resized to 200% without loss of functionality
- [ ] No images of text (except logos)

### 2. Operable

#### 2.1 Keyboard Accessible
- [ ] All functionality available via keyboard
- [ ] No keyboard traps
- [ ] Keyboard focus is visible
- [ ] Tab order is logical
- [ ] Skip links provided for main content

#### 2.2 Enough Time
- [ ] No time limits on reading/interactions (or adjustable)
- [ ] Moving, blinking, scrolling content can be paused
- [ ] Auto-updating content can be paused/controlled

#### 2.3 Seizures and Physical Reactions
- [ ] No content flashes more than 3 times per second
- [ ] Animation can be disabled (prefers-reduced-motion)

#### 2.4 Navigable
- [ ] Page title is descriptive and unique
- [ ] Focus order is meaningful
- [ ] Link text is descriptive (avoid "click here")
- [ ] Multiple ways to find pages (nav, search, sitemap)
- [ ] Headings and labels are descriptive
- [ ] Keyboard focus is visible

#### 2.5 Input Modalities
- [ ] Touch targets are at least 44x44px
- [ ] Alternative input methods supported
- [ ] Motion actuation has alternative (if used)

### 3. Understandable

#### 3.1 Readable
- [ ] Page language is defined (lang attribute)
- [ ] Language changes are marked
- [ ] Unusual words are defined/explained

#### 3.2 Predictable
- [ ] Focus doesn't cause unexpected context changes
- [ ] Input doesn't cause unexpected context changes
- [ ] Navigation is consistent across pages
- [ ] Components are consistently identified

#### 3.3 Input Assistance
- [ ] Form errors are identified and described
- [ ] Labels and instructions provided for user input
- [ ] Error suggestions provided (when possible)
- [ ] Error prevention for important actions (confirm, undo)

### 4. Robust

#### 4.1 Compatible
- [ ] Valid HTML (no major errors)
- [ ] ARIA used correctly (when needed)
- [ ] Status messages use appropriate ARIA roles
- [ ] Dynamic content updates are announced

## Screen Reader Testing

### VoiceOver (macOS)
```bash
# Enable VoiceOver
Cmd + F5

# Basic commands
VO + A = Read all
VO + Right Arrow = Next item
VO + Left Arrow = Previous item
VO + Space = Activate
```

#### Test Scenarios
1. Navigate entire page using VO + Right Arrow
2. Navigate by headings (VO + Cmd + H)
3. Navigate by landmarks (VO + U, then use arrows)
4. Fill out forms
5. Activate buttons and links

### NVDA (Windows)
```bash
# Start NVDA
Ctrl + Alt + N

# Basic commands
Insert + Down Arrow = Read all
Down Arrow = Next item
Up Arrow = Previous item
Enter/Space = Activate
```

#### Test Scenarios
1. Navigate with arrows
2. Use heading navigation (H key)
3. Navigate forms (F key)
4. Test tables (Ctrl + Alt + arrows)
5. Test dynamic content updates

### Testing Checklist

#### Forms
- [ ] All form fields are labeled
- [ ] Required fields are announced
- [ ] Error messages are announced
- [ ] Field instructions are read
- [ ] Form can be completed using keyboard only
- [ ] Success messages are announced

#### Navigation
- [ ] Main navigation is announced
- [ ] Current page/section is indicated
- [ ] Skip link works and is announced
- [ ] Breadcrumbs are navigable
- [ ] Search functionality is accessible

#### Tables
- [ ] Table headers are announced
- [ ] Table purpose is described
- [ ] Cell relationships are clear
- [ ] Sortable columns are announced
- [ ] Pagination is accessible

#### Dynamic Content
- [ ] Loading states are announced
- [ ] Error messages are announced
- [ ] Success messages are announced
- [ ] Content updates are announced (aria-live)
- [ ] Modal dialogs trap focus

## Automated Testing

### axe DevTools
```bash
# Install extension from Chrome Web Store
# Open DevTools → axe tab → Scan All

# Fix violations in order:
# 1. Critical
# 2. Serious
# 3. Moderate
# 4. Minor
```

### Lighthouse
```bash
# Run in Chrome DevTools
# Open DevTools → Lighthouse tab → Generate report

# Aim for score ≥ 90
```

### Pa11y
```bash
# Install
npm install -g pa11y

# Run
pa11y http://localhost:3000

# Run with screen capture
pa11y --screen-capture ./screenshots http://localhost:3000
```

## Manual Testing

### Keyboard Navigation Test
1. **Tab Order**
   - Press Tab repeatedly
   - Verify logical order
   - Ensure all interactive elements are reachable
   - No keyboard traps

2. **Skip Links**
   - Press Tab on page load
   - Verify skip link appears
   - Activate skip link
   - Verify focus moves to main content

3. **Focus Indicators**
   - Tab through all interactive elements
   - Verify visible focus indicator
   - Check contrast ratio of focus indicator

4. **Keyboard Shortcuts**
   - Arrow keys for navigation (where applicable)
   - Enter/Space to activate
   - Escape to close modals/dropdowns
   - Home/End for lists

### Color Contrast Test
```bash
# Use browser extension or online tool
# Check text contrast: https://webaim.org/resources/contrastchecker/

# Test all text on page:
# - Body text
# - Headings
# - Links
# - Buttons
# - Form fields
# - Error messages
```

### Zoom Test
1. Zoom to 200% (Cmd/Ctrl + Plus)
2. Verify all content is visible
3. No horizontal scrolling
4. Text doesn't overlap
5. Functionality remains

## Component-Specific Tests

### Patient Engagement Dashboard
- [ ] Table is keyboard navigable
- [ ] Sort controls are announced
- [ ] Filters are accessible
- [ ] Pagination is keyboard accessible
- [ ] Screen reader announces counts
- [ ] Color isn't only indicator of risk level

### Forms with Draft Recovery
- [ ] Draft recovery notification is announced
- [ ] Restore/dismiss buttons are keyboard accessible
- [ ] Draft status is conveyed to screen readers
- [ ] All form validation is accessible

### Error Display Component
- [ ] Error icon has text alternative
- [ ] Error title is announced
- [ ] Actions list is navigable
- [ ] Technical details toggle is accessible
- [ ] Severity is conveyed without color alone

## Common Issues & Fixes

### Missing Alt Text
```tsx
// ❌ Bad
<img src="patient.jpg" />

// ✅ Good
<img src="patient.jpg" alt="Patient engagement chart showing 30-day activity" />

// ✅ Good (decorative)
<img src="decoration.png" alt="" aria-hidden="true" />
```

### Missing Form Labels
```tsx
// ❌ Bad
<input type="text" placeholder="Enter name" />

// ✅ Good
<label htmlFor="name">Name</label>
<input type="text" id="name" placeholder="Enter name" />
```

### Poor Color Contrast
```css
/* ❌ Bad (2.5:1 ratio) */
.text { color: #777; background: #fff; }

/* ✅ Good (4.6:1 ratio) */
.text { color: #595959; background: #fff; }
```

### Keyboard Trap
```tsx
// ❌ Bad
<div onKeyDown={(e) => e.preventDefault()}>...</div>

// ✅ Good - Allow keyboard navigation
<div onKeyDown={(e) => {
  if (e.key === 'Escape') closeModal();
}}>...</div>
```

### Missing ARIA Labels
```tsx
// ❌ Bad
<button><IconX /></button>

// ✅ Good
<button aria-label="Close dialog"><IconX aria-hidden="true" /></button>
```

## Testing Workflow

1. **Automated Scan** (5 min)
   - Run axe DevTools
   - Run Lighthouse
   - Fix critical issues

2. **Keyboard Test** (10 min)
   - Navigate entire page with Tab
   - Test all interactions
   - Verify skip links

3. **Screen Reader Test** (20 min)
   - Navigate with VoiceOver/NVDA
   - Test forms
   - Test dynamic content

4. **Manual Checks** (15 min)
   - Color contrast
   - Zoom to 200%
   - Semantic HTML
   - Heading order

## Sign-off Checklist

- [ ] Automated tests pass (axe, Lighthouse ≥90)
- [ ] Keyboard navigation works completely
- [ ] Screen reader testing completed
- [ ] Color contrast meets WCAG AA
- [ ] Zoom to 200% works
- [ ] Semantic HTML validated
- [ ] ARIA used correctly
- [ ] Focus indicators visible
- [ ] No keyboard traps
- [ ] Forms are accessible
- [ ] Error messages are accessible
- [ ] Dynamic content is announced
- [ ] Documentation updated

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Inclusive Components](https://inclusive-components.design/)
