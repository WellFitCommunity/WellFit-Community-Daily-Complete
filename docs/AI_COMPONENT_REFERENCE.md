# AI Component Reference — Envision Atlus Design System

> **Source of truth for all AI tools (Claude, ChatGPT, Gemini, Cursor, Copilot).**
> Read this file before writing any UI code that uses EA components.
>
> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

---

## EABadge — Status Indicator

**File:** `src/components/envision-atlus/EABadge.tsx`

| Prop | Valid Values | Default |
|------|-------------|---------|
| `variant` | `'critical'` \| `'high'` \| `'elevated'` \| `'normal'` \| `'info'` \| `'neutral'` | `'neutral'` |
| `size` | `'sm'` \| `'md'` \| `'lg'` | `'md'` |
| `pulse` | `boolean` | `false` |

### Correct Usage
```tsx
<EABadge variant="critical" pulse>High Risk</EABadge>
<EABadge variant="high">Elevated</EABadge>
<EABadge variant="normal" size="sm">Active</EABadge>
<EABadge variant="info">Pending</EABadge>
<EABadge variant="neutral">Inactive</EABadge>
```

### Common Mistakes — DO NOT USE THESE
| Wrong Variant | Correct Variant |
|--------------|-----------------|
| `'danger'` | `'critical'` |
| `'warning'` | `'high'` or `'elevated'` |
| `'success'` | `'normal'` |
| `'default'` | `'neutral'` |
| `'primary'` | `'info'` |
| `'error'` | `'critical'` |
| `'secondary'` | `'neutral'` |

---

## EAAlert — Clinical Alert

**File:** `src/components/envision-atlus/EAAlert.tsx`

| Prop | Valid Values | Required |
|------|-------------|----------|
| `variant` | `'critical'` \| `'warning'` \| `'success'` \| `'info'` | **Yes** |
| `title` | `string` | No |
| `children` | `React.ReactNode` | **Yes** |
| `dismissible` | `boolean` | No |
| `onDismiss` | `() => void` | No (required if dismissible) |

### Correct Usage
```tsx
<EAAlert variant="critical" title="Urgent">Patient at risk</EAAlert>
<EAAlert variant="warning">Check medication interaction</EAAlert>
<EAAlert variant="success" title="Complete">Assessment saved</EAAlert>
<EAAlert variant="info">New guidelines available</EAAlert>
<EAAlert variant="warning" dismissible onDismiss={() => setDismissed(true)}>
  Review pending orders
</EAAlert>
```

### Common Mistakes — DO NOT USE THESE
| Wrong Variant | Correct Variant |
|--------------|-----------------|
| `'danger'` | `'critical'` |
| `'error'` | `'critical'` |
| `'high'` | `'warning'` |
| `'normal'` | `'success'` |
| `'elevated'` | `'warning'` |

---

## General Rules

1. **Always check this file** before using any EA component — do not guess variant names
2. EABadge and EAAlert use **different** variant sets — `'warning'` is valid for EAAlert but NOT for EABadge
3. When in doubt, read the source `.tsx` file to verify the interface
4. These components follow **medical severity standards**, not generic UI conventions
