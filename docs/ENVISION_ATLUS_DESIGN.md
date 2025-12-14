# Envision Atlus Design System

The codebase is being migrated to the **Envision Atlus** design system - a clinical-grade UI component library.

## Component Location

- `src/components/envision-atlus/` - All EA components
- `src/styles/envision-atlus-theme.ts` - Theme utilities and color palette

## Available Components

| Component | Purpose |
|-----------|---------|
| `EACard` | Card containers with header/content/footer |
| `EAButton` | Clinical-grade buttons |
| `EABadge` | Status badges |
| `EAMetricCard` | Dashboard metric displays |
| `EAAlert` | Alert/notification displays |
| `EASlider` | Input sliders |
| `EASelect` | Dropdown selections |
| `EAPageLayout` | Page layout wrapper |
| `EARiskIndicator` | Risk level indicators |
| `EASwitch` | Toggle switches for settings |
| `EATabs` | Tab navigation with accessibility |
| `EAPatientBanner` | Displays selected patient globally |
| `EAKeyboardShortcutsProvider` | Global shortcuts provider |
| `EAAffirmationToast` | Reusable toast component |

## Theme Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary (Teal)** | `#00857a` | Main actions, headers |
| **Primary Light** | `#33bfb7` | Hover states, accents |
| **Background** | `slate-900` | Page background |
| **Surface** | `slate-800` | Cards, panels |
| **Text** | High contrast | Accessibility compliant |

## Usage Pattern

```typescript
import { EACard, EAButton, EASwitch } from '../envision-atlus';

// Use components with consistent styling
<EACard>
  <EACardHeader>Title</EACardHeader>
  <EACardContent>...</EACardContent>
</EACard>
```

## Component Guidelines

### EACard
- Use for all container/panel needs
- Always include a header for context
- Footer optional for actions

### EAButton
- Primary variant for main actions
- Secondary for alternative actions
- Destructive for delete/remove

### EABadge
- Status indicators (success, warning, error, info)
- Keep text concise (1-2 words)

### EAMetricCard
- Dashboard KPIs and metrics
- Include trend indicators when relevant

## Accessibility

- All components meet WCAG 2.1 AA standards
- High contrast text on dark backgrounds
- Keyboard navigation supported
- Screen reader compatible
