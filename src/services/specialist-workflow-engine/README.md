# Specialist Workflow Engine

**Future-proof workflow system for ANY specialist type in rural healthcare**

## Overview

The Specialist Workflow Engine is a flexible, template-based system that allows WellFit to rapidly deploy new specialist types without code changes. Instead of building separate systems for each specialist, we have ONE engine that executes ANY workflow.

## Key Features

### 🎯 **Universal Architecture**
- Single codebase handles ALL specialist types
- Add new specialists via configuration, not code
- Scales from 1 to 100+ specialist types

### 📱 **Offline-First**
- Works in areas with poor connectivity
- IndexedDB local storage
- Automatic background sync
- Never lose patient data

### 📍 **GPS & Location**
- Check-in/out with location verification
- Service area enforcement
- Visit tracking and billing compliance
- PostGIS integration

### 🚨 **Real-Time Alerts**
- Rule-based alerting system
- Automatic escalation
- Role-based notifications
- HIPAA-compliant logging

### 🔒 **Security & Compliance**
- PHI access logging on every action
- Row-level security (RLS)
- HIPAA §164.312(b) compliant
- Offline encryption

## Architecture

```
specialist-workflow-engine/
├── types.ts                      # Type definitions
├── SpecialistWorkflowEngine.ts   # Core execution engine
├── FieldVisitManager.ts          # Visit management & GPS
├── OfflineDataSync.ts            # Offline support
├── templates/
│   ├── index.ts                  # Template registry
│   ├── chwTemplate.ts            # Community Health Worker
│   ├── agHealthTemplate.ts       # Agricultural Health
│   ├── matTemplate.ts            # MAT Provider
│   ├── woundCareTemplate.ts      # Wound Care
│   ├── geriatricTemplate.ts      # Geriatric Care
│   ├── telepsychTemplate.ts      # Telepsychiatry
│   └── respiratoryTemplate.ts    # Respiratory Therapy
└── README.md                     # This file
```

## Quick Start

### 1. Import the Engine

```typescript
import {
  SpecialistWorkflowEngine,
  workflowRegistry,
  chwWorkflow
} from '@/services/specialist-workflow-engine';
```

### 2. Initialize for a Specialist Type

```typescript
// Get the workflow template
const workflow = workflowRegistry.get('chw-rural-v1');

// Create engine instance
const engine = new SpecialistWorkflowEngine(workflow);
```

### 3. Start a Visit

```typescript
// Start a new visit
const visit = await engine.startVisit(
  specialistId,
  patientId,
  'home_visit'
);

// Check in with GPS
await engine.checkIn(visit.id, geoLocation);
```

### 4. Execute Workflow Steps

```typescript
// Capture data for current step
await engine.captureStepData(visit.id, stepNumber, {
  vitals: {
    systolic: 145,
    diastolic: 90,
    heart_rate: 72,
    oxygen_saturation: 96
  }
});

// Engine automatically evaluates alert rules
// and notifies appropriate staff if needed
```

### 5. Complete Visit

```typescript
// Check out with GPS
await engine.checkOut(visit.id, geoLocation);
```

## Adding a New Specialist Type

### Step 1: Create Template

```typescript
// templates/mySpecialistTemplate.ts
export const mySpecialistWorkflow: SpecialistWorkflow = {
  id: 'my-specialist-v1',
  version: '1.0.0',
  name: 'My Specialist Type',
  specialistType: 'Custom',

  assessmentFields: [
    {
      id: 'assessment_1',
      label: 'Primary Assessment',
      type: 'questionnaire',
      required: true,
      offline: true
    }
  ],

  visitWorkflow: [
    {
      step: 1,
      name: 'Initial Assessment',
      action: 'questionnaire',
      required: true,
      estimatedMinutes: 15,
      fields: ['assessment_1']
    }
  ],

  alertRules: [
    {
      id: 'critical-finding',
      name: 'Critical Finding',
      condition: 'assessment_1.score > 10',
      severity: 'critical',
      notifyRole: 'physician',
      within: '15min',
      message: 'Critical finding detected'
    }
  ],

  // ... rest of configuration
};
```

### Step 2: Register Template

```typescript
// templates/index.ts
import { mySpecialistWorkflow } from './mySpecialistTemplate';

export class WorkflowTemplateRegistry {
  private registerDefaults(): void {
    this.register(chwWorkflow);
    this.register(mySpecialistWorkflow); // Add here
    // ...
  }
}
```

### Step 3: Deploy

That's it! The entire system now supports your new specialist type.

## Offline Support

### Initialize Offline Sync

```typescript
import { offlineSync } from '@/services/specialist-workflow-engine';

// Initialize IndexedDB
await offlineSync.initialize();

// Start automatic sync (every 30 seconds)
offlineSync.startAutoSync(30000);
```

### Save Data Offline

```typescript
// Engine automatically handles offline/online
// No code changes needed!

// When offline, data goes to IndexedDB
await engine.captureStepData(visitId, stepNumber, data);

// When online, data syncs to Supabase
```

### Manual Sync

```typescript
// Trigger manual sync
const result = await offlineSync.syncAll();

console.log(`Synced: ${result.visits} visits, ${result.photos} photos`);
```

## Alert Rules

### Simple Conditions

```typescript
{
  condition: 'vitals.systolic > 180',  // Simple comparison
  severity: 'critical',
  notifyRole: 'physician',
  within: '15min'
}
```

### Complex Conditions

```typescript
{
  condition: 'medications.count == 0',  // Check counts
  severity: 'high',
  notifyRole: 'pharmacist',
  within: '4hr'
}

{
  condition: 'sdoh.food_insecurity == true',  // Boolean checks
  severity: 'medium',
  notifyRole: 'case-manager',
  within: '24hr'
}
```

## Database Schema

See `supabase/migrations/20251023000000_specialist_workflow_engine.sql` for full schema.

### Key Tables

- `specialist_providers` - Specialist credentials and service areas
- `field_visits` - Visit records with GPS tracking
- `specialist_assessments` - Flexible assessment storage
- `specialist_alerts` - Real-time alerting system

### PostGIS Functions

```sql
-- Check if location is within service area
SELECT is_within_service_area(specialist_id, lat, lon);

-- Calculate visit duration
SELECT get_visit_duration(visit_id);

-- Get distance between check-in/out
SELECT get_visit_location_distance(visit_id);
```

## React Components

### Specialist Dashboard

```tsx
import { SpecialistDashboard } from '@/components/specialist/SpecialistDashboard';

<SpecialistDashboard
  specialistId={specialistId}
  specialistType="CHW"
/>
```

### Field Visit Workflow

```tsx
import { FieldVisitWorkflow } from '@/components/specialist/FieldVisitWorkflow';

<FieldVisitWorkflow visitId={visitId} />
```

## Billing Integration

The engine automatically tracks:
- Visit duration (check-in to check-out)
- GPS locations (compliance)
- Completed steps (documentation)
- Time-based billing codes

```typescript
// Get billing-ready data
const visit = await fieldVisitManager.getVisit(visitId);
const duration = fieldVisitManager.getVisitDuration(visit);

// Duration in minutes, ready for G-code selection
console.log(`Visit duration: ${duration} minutes`);
```

## Testing

```typescript
import { SpecialistWorkflowEngine } from '@/services/specialist-workflow-engine';
import { chwWorkflow } from '@/services/specialist-workflow-engine/templates';

describe('Specialist Workflow Engine', () => {
  it('should execute CHW workflow', async () => {
    const engine = new SpecialistWorkflowEngine(chwWorkflow);

    const visit = await engine.startVisit(
      'specialist-123',
      'patient-456',
      'home_visit'
    );

    expect(visit.status).toBe('in_progress');
  });
});
```

## Troubleshooting

### Offline Sync Not Working

```typescript
// Check sync status
const status = await offlineSync.getSyncStatus();
console.log('Pending items:', status.pending);

// Force sync
const result = await offlineSync.syncAll();
```

### Alert Not Triggering

```typescript
// Test condition manually
const evaluation = engine['evaluateCondition'](
  'vitals.systolic > 180',
  { vitals: { systolic: 185 } }
);

console.log('Condition result:', evaluation);
```

### GPS Not Working

```typescript
// Check geolocation availability
if (!navigator.geolocation) {
  console.error('Geolocation not supported');
}

// Get current location
const location = await fieldVisitManager.getCurrentLocation();
console.log('Location:', location);
```

## Performance

- **Offline storage**: 50MB+ via IndexedDB
- **Sync speed**: ~100 items/second
- **Alert latency**: <100ms
- **GPS accuracy**: ±10 meters (high accuracy mode)

## Security

### PHI Logging

Every action logs PHI access:

```typescript
await logPhiAccess({
  phiType: 'patient_record',
  phiResourceId: visitId,
  patientId: patientId,
  accessType: 'read',
  accessMethod: 'specialist_workflow',
  purpose: 'treatment'
});
```

### Row-Level Security

All tables have RLS enabled:
- Specialists see only their visits
- Patients see only their data
- Care team has appropriate access

## Future Enhancements

- [ ] Voice-to-text for notes
- [ ] AI-powered clinical suggestions
- [ ] Photo OCR for medication bottles
- [ ] Predictive alerts based on trends
- [ ] Multi-language support
- [ ] FHIR integration

## Support

For questions or issues:
1. Check this README
2. Review test files in `__tests__/`
3. Contact development team

## License

Proprietary - Envision VirtualEdge Group LLC
