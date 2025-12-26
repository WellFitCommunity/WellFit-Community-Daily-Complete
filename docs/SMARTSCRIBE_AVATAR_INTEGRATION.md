# SmartScribe → Patient Avatar Integration

This document describes how voice transcriptions from SmartScribe automatically create clinical markers on the Patient Avatar.

## Overview

When a provider records a clinical encounter using SmartScribe, the system:

1. Transcribes speech to text via Deepgram (nova-2-medical model)
2. Analyzes transcript for billing codes via Claude Sonnet
3. **Extracts clinical entities and creates pending avatar markers**

Markers created from SmartScribe require manual confirmation before becoming permanent.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SMARTSCRIBE → AVATAR PIPELINE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │  Voice Recording │                                                   │
│  │  (Provider)      │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐     ┌──────────────────┐                          │
│  │ Deepgram STT     │────▶│ Claude Sonnet    │                          │
│  │ nova-2-medical   │     │ (Billing Codes)  │                          │
│  └────────┬─────────┘     └──────────────────┘                          │
│           │                                                             │
│           │ transcriptText                                              │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              onSmartScribeComplete()                             │   │
│  │              src/services/smartscribe-avatar-integration.ts:286  │   │
│  └────────┬─────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              extractAvatarEntities()                             │   │
│  │              Regex pattern matching for:                         │   │
│  │              • Device insertions (PICC, central line, etc.)      │   │
│  │              • Device removals                                   │   │
│  │              • Condition mentions (CHF, diabetes, stroke)        │   │
│  │              • Laterality detection (left/right/bilateral)       │   │
│  └────────┬─────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              findMarkerTypeByKeywords()                          │   │
│  │              markerTypeLibrary.ts - 122 marker types             │   │
│  │              Exact match first, then substring match             │   │
│  └────────┬─────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           │ confidence ≥ 0.7 required                                   │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              processSmartScribeForAvatar()                       │   │
│  │              • Insertions → Create pending marker                │   │
│  │              • Removals → Deactivate existing markers            │   │
│  │              • Conditions → Create pending marker (if chronic)   │   │
│  └────────┬─────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              PatientAvatarService.createMarker()                 │   │
│  │              status: 'pending_confirmation'                      │   │
│  │              source: 'smartscribe'                               │   │
│  │              requires_attention: true                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Entity Detection Patterns

### Device Insertions

Detected phrases:
- "placed a PICC line in the right arm"
- "inserted central line at the jugular"
- "established IV access via left AC"
- "put in a Foley catheter"

Pattern examples (`INSERTION_PATTERNS`):
```javascript
/placed?\s+(?:a\s+)?(.+?)\s+(?:in|into|at|on)\s+(?:the\s+)?(.+)/i
/inserted?\s+(?:a\s+)?(.+?)\s+(?:in|into|at|on)\s+(?:the\s+)?(.+)/i
/establish(?:ed)?\s+(.+?)\s+(?:in|at)\s+(?:the\s+)?(.+)/i
```

### Device Removals

Detected phrases:
- "removed the central line"
- "discontinued the Foley"
- "pulled the chest tube"
- "NG tube was removed"

Pattern examples (`REMOVAL_PATTERNS`):
```javascript
/remov(?:ed|ing)?\s+(?:the\s+)?(.+)/i
/discontinu(?:ed|ing)?\s+(?:the\s+)?(.+)/i
/(.+?)\s+was\s+removed/i
```

### Condition Mentions

Detected phrases:
- "patient has history of CHF"
- "diagnosed with Type 2 diabetes"
- "known Parkinson's disease"
- "presents with stroke symptoms"

Pattern examples (`CONDITION_PATTERNS`):
```javascript
/(?:patient\s+)?has\s+(?:a\s+)?(?:history\s+of\s+)?(.+)/i
/diagnos(?:ed|is)\s+(?:with\s+)?(.+)/i
/known\s+(.+)/i
```

### Laterality Detection

```javascript
/\bleft\b/i   → laterality: 'left'
/\bright\b/i  → laterality: 'right'
/\bbilateral\b/i → laterality: 'bilateral'
```

## Marker Type Library

The system matches detected entities against 122 predefined marker types organized in 13 categories:

| Category | Types | Examples |
|----------|-------|----------|
| Vascular Access | 11 | PICC, central line, dialysis catheter |
| Drainage & Tubes | 11 | Foley, chest tube, NG tube, JP drain |
| Wounds & Surgical | 11 | Pressure injuries, surgical sites, ostomies |
| Orthopedic | 6 | Fractures, joint replacements, casts |
| Monitoring Devices | 4 | CGM, cardiac monitor, pulse ox |
| Implants | 8 | Pacemaker, insulin pump, VP shunt |
| Chronic Conditions | 11 | CHF, diabetes, COPD, CKD |
| Neurological | 15 | Stroke, Parkinson's, MS, TBI |
| Precautions | 7 | Fall risk, seizure, aspiration |
| Isolation | 4 | Contact, droplet, airborne, protective |
| Code Status | 5 | Full code, DNR, DNI, comfort care |
| Alerts | 5 | Allergies, difficult airway, limb alert |
| Vein Access | 13 | Blown vein, scarred vein, avoid arm |

Each marker type includes:
- `keywords`: Array of phrases that trigger detection
- `default_body_region`: Where to place the marker
- `default_position`: X,Y coordinates (0-100 scale)
- `laterality_adjustments`: Left/right position variants
- `icd10`: Suggested ICD-10 code (optional)

## Confidence Scoring

| Entity Type | Base Confidence |
|-------------|-----------------|
| Device insertion | 0.85 |
| Device removal | 0.85 |
| Condition mention | 0.80 |

Minimum threshold for marker creation: **0.70**

## Created Marker Structure

```typescript
CreateMarkerRequest {
  patient_id: string;
  category: MarkerCategory;
  marker_type: string;
  display_name: string;
  body_region: string;
  position_x: number;          // 0-100
  position_y: number;          // 0-100
  body_view: 'front' | 'back';
  source: 'smartscribe';       // Identifies origin
  source_transcription_id: string;
  status: 'pending_confirmation';
  confidence_score: number;
  requires_attention: true;
  details: {
    insertion_date: string;
    raw_smartscribe_text: string;  // Original transcript snippet
    icd10_code?: string;
    severity_stage?: string;
  };
}
```

## Provider Workflow

1. **Recording**: Provider records encounter with SmartScribe
2. **Detection**: System extracts entities from transcript
3. **Pending Markers**: Markers appear on avatar with yellow "pending" status
4. **Review**: Provider sees markers requiring attention
5. **Confirm/Dismiss**: Provider validates or rejects each suggestion
6. **Active**: Confirmed markers become permanent patient data

## Audit Logging

All marker operations are logged:

```typescript
// Successful creation
auditLogger.info('SMARTSCRIBE_MARKER_CREATED', {
  patient_id,
  marker_id,
  marker_type,
  confidence,
});

// Successful removal
auditLogger.info('SMARTSCRIBE_MARKER_REMOVED', {
  patient_id,
  marker_type,
  count,
});

// Errors
auditLogger.error('SMARTSCRIBE_AVATAR_PROCESSING_ERROR', error, {
  patient_id,
  entity,
});
```

## Integration Points

### Voice Learning Service

The `voiceLearningService.ts` learns provider-specific corrections:
- Corrections are applied to transcript before entity extraction
- Improves accuracy over time for specialty terminology

### Marker Priority Scoring

Markers from SmartScribe receive priority bonuses:
- `pending_confirmation`: +25 priority
- `requires_attention`: +50 priority

This ensures new detections appear prominently in the avatar thumbnail.

### Billing Code Suggestions

ICD-10 codes from markers can inform SmartScribe's billing suggestions:
- Chronic condition markers suggest corresponding diagnosis codes
- Device markers may suggest procedure codes

## Files

| File | Purpose |
|------|---------|
| `src/services/smartscribe-avatar-integration.ts` | Main integration service |
| `src/components/patient-avatar/constants/markerTypeLibrary.ts` | 122 marker definitions |
| `src/services/voiceLearningService.ts` | Correction learning |
| `src/components/smart/hooks/useSmartScribe.ts` | SmartScribe hook |
| `src/types/patientAvatar.ts` | Type definitions |

## Future Enhancements

1. **NLP/AI Entity Extraction**: Replace regex patterns with Claude-based entity extraction for better accuracy
2. **Severity Detection**: Detect severity levels from context ("stage 4 pressure ulcer")
3. **Temporal Awareness**: Detect "removed yesterday" vs "will remove tomorrow"
4. **Multi-language Support**: Spanish medical terminology detection
