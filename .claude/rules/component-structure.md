# Component File Structure & Naming

## Standard Component Layout
```
src/components/feature-name/
├── FeatureName.tsx           # Main component
├── FeatureName.types.ts      # TypeScript interfaces (if complex)
├── __tests__/
│   └── FeatureName.test.tsx  # Tests (REQUIRED)
└── index.ts                  # Barrel export (optional)
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PatientDashboard.tsx` |
| Hooks | camelCase with `use` prefix | `usePatientData.ts` |
| Services | camelCase with `Service` suffix | `patientService.ts` |
| Types | PascalCase | `PatientTypes.ts` |
| Tests | Same name + `.test` | `PatientDashboard.test.tsx` |
| Constants | SCREAMING_SNAKE_CASE | `const MAX_RETRIES = 3` |

## Component Template
```tsx
/**
 * ComponentName - Brief description
 *
 * Purpose: What this component does
 * Used by: Where it's used
 */

import React from 'react';
import { ComponentNameProps } from './ComponentName.types';

export const ComponentName: React.FC<ComponentNameProps> = ({
  prop1,
  prop2
}) => {
  return (
    <div>
      {/* Implementation */}
    </div>
  );
};

export default ComponentName;
```
