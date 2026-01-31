# Integration Tests

This directory contains integration tests that verify component interactions and API integrations.

## Running Integration Tests

```bash
npm run test:integration
```

## Test Categories

- **API Integration**: Tests that verify Supabase and external API interactions
- **Component Integration**: Tests that verify multi-component workflows
- **Auth Flow**: Tests that verify authentication and authorization flows

## Adding New Tests

Create files with the pattern `*.integration.test.ts` or `*.integration.test.tsx`.

Example:
```typescript
// auth.integration.test.ts
import { describe, it, expect } from 'vitest';

describe('Auth Integration', () => {
  it('should verify auth flow', async () => {
    // Integration test logic
  });
});
```
