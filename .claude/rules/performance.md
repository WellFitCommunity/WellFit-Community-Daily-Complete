# Performance Guidelines

## Code Splitting
- Use `React.lazy()` for all route-level components
- Dynamic imports for heavy libraries

```typescript
// ✅ GOOD - Lazy loaded route
const PatientDashboard = React.lazy(() => import('./pages/PatientDashboard'));

// ❌ BAD - Direct import for routes
import PatientDashboard from './pages/PatientDashboard';
```

## Image Optimization
- Use WebP format when possible
- Always include `loading="lazy"` for below-fold images
- Specify width/height to prevent layout shift

## Database Performance
- Always use indexes on frequently queried columns
- Limit query results: `.limit(100)`
- Use pagination for large datasets
- Avoid `SELECT *` - specify needed columns

## List Virtualization
- Virtualize lists with > 100 items
- Use `react-window` or similar for long lists

## Bundle Monitoring
```bash
# Check bundle size after changes
npm run build
# Review dist/ folder sizes
```
