# Accessibility (a11y) Standards - REQUIRED

**Target users include seniors with vision/motor impairments. Accessibility is not optional.**

## WCAG Compliance Requirements

| Requirement | Standard | Reason |
|-------------|----------|--------|
| Font size | Minimum 16px, prefer 18px+ | Senior vision |
| Touch targets | Minimum 44x44px | Motor impairments |
| Color contrast | WCAG AA (4.5:1 minimum) | Low vision |
| Focus indicators | Visible on all interactive elements | Keyboard navigation |
| Alt text | All images must have descriptive alt text | Screen readers |

## Senior-Friendly UI Rules
- **Large, clear buttons** - Easy to tap/click
- **High contrast text** - Dark text on light backgrounds
- **Simple navigation** - Minimal nesting, clear labels
- **Readable fonts** - Sans-serif, adequate line height
- **Voice command support** - Where possible
- **Error messages** - Clear, non-technical language

## Testing Accessibility
```bash
# Run accessibility audit
npx lighthouse --only-categories=accessibility <url>
```

## Common Patterns
```tsx
// ✅ GOOD - Large touch target, clear label
<button className="min-h-[44px] min-w-[44px] text-lg font-medium">
  Check In
</button>

// ❌ BAD - Too small, unclear
<button className="text-xs p-1">
  <Icon />
</button>
```
