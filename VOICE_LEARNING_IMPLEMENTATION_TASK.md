# Voice Learning System - Implementation Task

**Priority:** High (Phase 2 Feature)
**Estimated Time:** 4-6 hours
**Complexity:** Medium
**Impact:** Critical for production accuracy and user satisfaction

---

## Task Overview

Implement a voice learning system that allows the SMART Scribe to adapt to each provider's voice, accent, speech patterns, and medical terminology preferences. The system should improve transcription accuracy over time and store learned corrections for instant recall.

---

## Business Requirements

### Problem Statement
Currently, every scribe session starts from zero with no learning or adaptation:
- ❌ Dr. Martinez (Spanish accent) - lower accuracy, AI mishears "hiperglucemia" as "hyper blue semen"
- ❌ Dr. Chen (fast talker) - missed words due to rapid speech
- ❌ Dr. Okonkwo (Nigerian accent + British English) - struggles with accent variations
- ❌ Every provider re-teaches the same corrections every single session
- ❌ No improvement over time despite repeated usage

### Success Criteria
- ✅ Each provider has a persistent voice profile that learns from their sessions
- ✅ Common mispronunciations are automatically corrected in real-time
- ✅ Accuracy improves by at least 20% after 10 training sessions
- ✅ Voice profiles stored locally (IndexedDB) for instant access
- ✅ Synced to database for cross-device support
- ✅ Privacy-compliant: automatic cleanup after 90 days
- ✅ Optional first-time training wizard to bootstrap learning

---

## Technical Requirements

### Phase 1: Basic Voice Corrections (Quick Win - 2 hours)

**Implement local storage-based correction system:**

1. **Data Structure:**
```typescript
interface VoiceCorrection {
  heard: string;           // What Deepgram transcribed
  correct: string;         // What it should be
  frequency: number;       // How many times corrected
  lastUsed: string;        // ISO timestamp
  confidence: number;      // 0-1, how confident this correction is
}

interface ProviderVoiceProfile {
  providerId: string;
  corrections: VoiceCorrection[];
  totalSessions: number;
  accuracyBaseline: number;
  accuracyCurrent: number;
  createdAt: string;
  updatedAt: string;
}
```

2. **Storage Layer:**
- Use browser's `IndexedDB` for persistent local storage
- Use `idb` library (already in project dependencies or install with `npm install idb`)
- Store under key: `voice-profile-{providerId}`
- Auto-sync to `provider_voice_profiles` table in database

3. **Real-Time Correction:**
- In `RealTimeSmartScribe.tsx`, load provider's voice profile on mount
- In `ws.onmessage` handler, apply learned corrections BEFORE displaying transcript
- Use regex replacement for fuzzy matching
- Track which corrections were applied for analytics

4. **Correction UI:**
- Add "Teach Correction" button next to transcript
- Modal popup: "What did you say?" (input) vs "What did AI hear?" (pre-filled)
- Save correction to IndexedDB and database
- Show toast: "✓ Learned! Will correct automatically next time"

---

### Phase 2: Database Integration (2 hours)

**Create database schema and sync layer:**

1. **Database Schema:**
```sql
-- File: supabase/migrations/YYYYMMDD_create_voice_profiles.sql

CREATE TABLE provider_voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,

  -- Voice fingerprint (JSONB for flexibility)
  voice_fingerprint JSONB DEFAULT '{
    "corrections": [],
    "speechPatterns": {},
    "medicalVocabulary": []
  }'::jsonb,

  -- Learning stats
  total_sessions INTEGER DEFAULT 0,
  total_training_minutes INTEGER DEFAULT 0,
  accuracy_baseline DECIMAL(5,2),
  accuracy_current DECIMAL(5,2),
  accuracy_improvement DECIMAL(5,2) GENERATED ALWAYS AS (accuracy_current - accuracy_baseline) STORED,

  -- Privacy & retention
  is_training_mode BOOLEAN DEFAULT true,
  training_complete_at TIMESTAMP,
  data_retention_days INTEGER DEFAULT 90,
  last_cleanup_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_training_session TIMESTAMP,

  CHECK (total_sessions >= 0),
  CHECK (accuracy_baseline >= 0 AND accuracy_baseline <= 100),
  CHECK (accuracy_current >= 0 AND accuracy_current <= 100)
);

CREATE INDEX idx_provider_voice_profiles_provider ON provider_voice_profiles(provider_id);
CREATE INDEX idx_provider_voice_profiles_last_session ON provider_voice_profiles(last_training_session);

-- Auto-update timestamp
CREATE TRIGGER update_provider_voice_profiles_timestamp
  BEFORE UPDATE ON provider_voice_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE provider_voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_voice_profiles_own_select ON provider_voice_profiles
  FOR SELECT USING (provider_id = auth.uid());

CREATE POLICY provider_voice_profiles_own_update ON provider_voice_profiles
  FOR UPDATE USING (provider_id = auth.uid());

CREATE POLICY provider_voice_profiles_own_insert ON provider_voice_profiles
  FOR INSERT WITH CHECK (provider_id = auth.uid());

CREATE POLICY provider_voice_profiles_admin_all ON provider_voice_profiles
  FOR ALL USING (is_admin_or_super_admin());
```

2. **Sync Service:**
```typescript
// File: src/services/voiceLearningService.ts

import { supabase } from '../lib/supabaseClient';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { auditLogger } from './auditLogger';

interface VoiceLearningDB extends DBSchema {
  'voice-profiles': {
    key: string;
    value: ProviderVoiceProfile;
  };
}

export class VoiceLearningService {
  private static db: IDBPDatabase<VoiceLearningDB> | null = null;

  // Initialize IndexedDB
  static async initDB() {
    if (this.db) return this.db;

    this.db = await openDB<VoiceLearningDB>('wellfit-voice-learning', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('voice-profiles')) {
          db.createObjectStore('voice-profiles', { keyPath: 'providerId' });
        }
      }
    });

    return this.db;
  }

  // Load voice profile (from IndexedDB first, fallback to database)
  static async loadVoiceProfile(providerId: string): Promise<ProviderVoiceProfile | null> {
    const db = await this.initDB();

    // Try local first (instant)
    const local = await db.get('voice-profiles', providerId);
    if (local) {
      auditLogger.info('VOICE_PROFILE_LOADED_LOCAL', { providerId });
      return local;
    }

    // Fallback to database (slower, but cross-device)
    const { data, error } = await supabase
      .from('provider_voice_profiles')
      .select('*')
      .eq('provider_id', providerId)
      .single();

    if (error || !data) {
      auditLogger.info('VOICE_PROFILE_NOT_FOUND', { providerId });
      return null;
    }

    // Cache locally for next time
    const profile: ProviderVoiceProfile = {
      providerId: data.provider_id,
      corrections: data.voice_fingerprint.corrections || [],
      totalSessions: data.total_sessions,
      accuracyBaseline: data.accuracy_baseline,
      accuracyCurrent: data.accuracy_current,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    await db.put('voice-profiles', profile);
    auditLogger.info('VOICE_PROFILE_LOADED_DB', { providerId });

    return profile;
  }

  // Save voice profile (to both IndexedDB and database)
  static async saveVoiceProfile(profile: ProviderVoiceProfile): Promise<void> {
    const db = await this.initDB();

    // Save locally (instant)
    await db.put('voice-profiles', profile);

    // Save to database (async, don't block UI)
    supabase
      .from('provider_voice_profiles')
      .upsert({
        provider_id: profile.providerId,
        voice_fingerprint: {
          corrections: profile.corrections
        },
        total_sessions: profile.totalSessions,
        accuracy_current: profile.accuracyCurrent,
        last_training_session: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .then(({ error }) => {
        if (error) {
          auditLogger.error('VOICE_PROFILE_SAVE_FAILED', error);
        } else {
          auditLogger.info('VOICE_PROFILE_SAVED', { providerId: profile.providerId });
        }
      });
  }

  // Add a correction
  static async addCorrection(
    providerId: string,
    heard: string,
    correct: string
  ): Promise<void> {
    const profile = await this.loadVoiceProfile(providerId) || {
      providerId,
      corrections: [],
      totalSessions: 0,
      accuracyBaseline: 0,
      accuracyCurrent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Check if correction already exists
    const existing = profile.corrections.find(c => c.heard === heard);
    if (existing) {
      existing.frequency++;
      existing.lastUsed = new Date().toISOString();
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    } else {
      profile.corrections.push({
        heard,
        correct,
        frequency: 1,
        lastUsed: new Date().toISOString(),
        confidence: 0.8
      });
    }

    profile.updatedAt = new Date().toISOString();
    await this.saveVoiceProfile(profile);

    auditLogger.clinical('VOICE_CORRECTION_LEARNED', true, {
      providerId,
      heard,
      correct,
      totalCorrections: profile.corrections.length
    });
  }

  // Apply corrections to transcript
  static applyCorrections(transcript: string, profile: ProviderVoiceProfile | null): string {
    if (!profile || !profile.corrections.length) return transcript;

    let corrected = transcript;
    const appliedCorrections: string[] = [];

    // Sort by confidence and frequency (apply most confident first)
    const sorted = [...profile.corrections].sort((a, b) =>
      (b.confidence * b.frequency) - (a.confidence * a.frequency)
    );

    sorted.forEach(correction => {
      const regex = new RegExp(correction.heard, 'gi');
      if (regex.test(corrected)) {
        corrected = corrected.replace(regex, correction.correct);
        appliedCorrections.push(correction.correct);
      }
    });

    if (appliedCorrections.length > 0) {
      auditLogger.info('VOICE_CORRECTIONS_APPLIED', {
        count: appliedCorrections.length,
        corrections: appliedCorrections
      });
    }

    return corrected;
  }

  // Calculate accuracy improvement
  static async updateAccuracy(providerId: string, sessionAccuracy: number): Promise<void> {
    const profile = await this.loadVoiceProfile(providerId);
    if (!profile) return;

    if (profile.accuracyBaseline === 0) {
      profile.accuracyBaseline = sessionAccuracy;
    }

    // Running average
    profile.accuracyCurrent =
      (profile.accuracyCurrent * profile.totalSessions + sessionAccuracy) /
      (profile.totalSessions + 1);

    profile.totalSessions++;
    profile.updatedAt = new Date().toISOString();

    await this.saveVoiceProfile(profile);
  }
}
```

3. **Integration into RealTimeSmartScribe:**
```typescript
// File: src/components/smart/RealTimeSmartScribe.tsx

// Add to component state
const [voiceProfile, setVoiceProfile] = useState<ProviderVoiceProfile | null>(null);
const [showCorrectionModal, setShowCorrectionModal] = useState(false);
const [selectedText, setSelectedText] = useState('');

// Load voice profile on mount
useEffect(() => {
  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const profile = await VoiceLearningService.loadVoiceProfile(user.id);
    setVoiceProfile(profile);
  };

  loadProfile();
}, []);

// Apply corrections in ws.onmessage
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === "transcript" && data.isFinal) {
      let text = data.text;

      // Apply learned corrections
      if (voiceProfile) {
        text = VoiceLearningService.applyCorrections(text, voiceProfile);
      }

      setTranscript((prev) => (prev ? `${prev} ${text}` : text));
    }
    // ... rest of message handling
  } catch {
    // ignore non-JSON frames
  }
};

// Add correction button to UI
{transcript && (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xl font-bold text-gray-900">Live Transcript</h3>
      <button
        onClick={() => {
          setSelectedText(transcript);
          setShowCorrectionModal(true);
        }}
        className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
      >
        Teach Correction
      </button>
    </div>
    {/* ... transcript display */}
  </div>
)}

// Correction Modal Component
{showCorrectionModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Teach Voice Correction</h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What did the AI hear?
        </label>
        <input
          type="text"
          defaultValue={selectedText}
          onChange={(e) => setHeard(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What did you actually say?
        </label>
        <input
          type="text"
          onChange={(e) => setCorrect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="e.g., hyperglycemia"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && heard && correct) {
              await VoiceLearningService.addCorrection(user.id, heard, correct);
              const updated = await VoiceLearningService.loadVoiceProfile(user.id);
              setVoiceProfile(updated);
              setShowCorrectionModal(false);
              setStatus('✓ Correction learned! Will apply automatically next time.');
            }
          }}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          Save Correction
        </button>
        <button
          onClick={() => setShowCorrectionModal(false)}
          className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

---

### Phase 3: Training Wizard (Optional - 2 hours)

**First-time user experience:**

1. **Training Wizard Component:**
```typescript
// File: src/components/smart/VoiceTrainingWizard.tsx

export const VoiceTrainingWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);

  const trainingScripts = [
    {
      step: 1,
      title: "Basic Voice Recognition",
      script: "The patient presents with chest pain radiating to the left arm. Vital signs show blood pressure 145 over 90, heart rate 88, respiratory rate 18."
    },
    {
      step: 2,
      title: "Medical Terminology",
      script: "Assessment reveals hyperglycemia with blood glucose 185. Patient has type 2 diabetes mellitus, uncontrolled. Plan to increase metformin to 1000 milligrams twice daily."
    },
    {
      step: 3,
      title: "Accent Adaptation",
      script: "Patient reports dyspnea on exertion. Physical examination shows bilateral crackles in lung bases. EKG shows ST elevation in leads V1 through V4 consistent with anterior STEMI."
    }
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Train Your Personal Medical Scribe
        </h2>
        <p className="text-gray-600">
          Step {step} of 3 • {trainingScripts[step - 1].title}
        </p>
        <div className="mt-4 h-2 bg-gray-200 rounded-full">
          <div
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="font-bold text-blue-900 mb-3">
          Please read this script clearly:
        </h3>
        <p className="text-lg leading-relaxed text-blue-800">
          "{trainingScripts[step - 1].script}"
        </p>
      </div>

      <div className="text-center">
        <button
          onClick={isRecording ? stopTrainingRecording : startTrainingRecording}
          className={`px-8 py-4 rounded-lg font-bold text-lg ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
    </div>
  );
};
```

2. **Show wizard on first use:**
```typescript
// In RealTimeSmartScribe.tsx
{!voiceProfile && (
  <VoiceTrainingWizard
    onComplete={async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await VoiceLearningService.loadVoiceProfile(user.id);
        setVoiceProfile(profile);
      }
    }}
  />
)}
```

---

## Acceptance Criteria

### Must Have:
- [ ] Voice corrections stored in IndexedDB for instant access
- [ ] Voice corrections synced to `provider_voice_profiles` database table
- [ ] Real-time correction application in transcript
- [ ] UI to manually teach corrections (modal or inline)
- [ ] Audit logging for all voice learning events
- [ ] Accuracy tracking (baseline vs current)
- [ ] Works for both Physician Panel and Nurse OS

### Should Have:
- [ ] First-time training wizard (3-step onboarding)
- [ ] Voice profile dashboard showing:
  - Total sessions recorded
  - Current accuracy %
  - Accuracy improvement %
  - Number of learned corrections
- [ ] Privacy: Auto-cleanup of data after 90 days
- [ ] Export/import voice profile (for backup/restore)

### Nice to Have:
- [ ] Integration with Deepgram custom models (future Phase 3)
- [ ] Voice characteristic detection (accent, speed, volume)
- [ ] Suggested corrections based on common medical terms
- [ ] Bulk import of medical vocabulary

---

## Testing Requirements

### Unit Tests:
```typescript
// tests/voiceLearningService.test.ts
describe('VoiceLearningService', () => {
  it('should load voice profile from IndexedDB', async () => {
    const profile = await VoiceLearningService.loadVoiceProfile('test-user-id');
    expect(profile).toBeDefined();
  });

  it('should apply corrections to transcript', () => {
    const profile = {
      providerId: 'test',
      corrections: [
        { heard: 'hyper blue semen', correct: 'hyperglycemia', frequency: 1, lastUsed: '', confidence: 0.9 }
      ],
      totalSessions: 5,
      accuracyBaseline: 80,
      accuracyCurrent: 85,
      createdAt: '',
      updatedAt: ''
    };

    const input = "Patient has hyper blue semen with blood sugar 185";
    const output = VoiceLearningService.applyCorrections(input, profile);

    expect(output).toBe("Patient has hyperglycemia with blood sugar 185");
  });

  it('should track accuracy improvement', async () => {
    await VoiceLearningService.updateAccuracy('test-user-id', 85);
    const profile = await VoiceLearningService.loadVoiceProfile('test-user-id');

    expect(profile.totalSessions).toBeGreaterThan(0);
    expect(profile.accuracyCurrent).toBeGreaterThanOrEqual(profile.accuracyBaseline);
  });
});
```

### Manual Testing:
1. Login as physician
2. Record first scribe session (no voice profile yet)
3. Notice a transcription error
4. Click "Teach Correction"
5. Enter: Heard "hyper blue semen" → Correct "hyperglycemia"
6. Record second scribe session
7. Say "hyperglycemia" clearly
8. Verify: If AI mishears, correction applies automatically
9. Check IndexedDB: Should see voice profile stored
10. Check database: Should see `provider_voice_profiles` row

---

## Migration Plan

### Database Migration:
```bash
# Create migration file
npx supabase migration new create_voice_profiles

# Apply migration
npx supabase db push
```

### Rollout Plan:
1. **Week 1:** Deploy Phase 1 (local corrections only)
2. **Week 2:** Deploy Phase 2 (database sync)
3. **Week 3:** Deploy Phase 3 (training wizard)
4. **Week 4:** Collect feedback, iterate on accuracy

### Rollback Plan:
```sql
-- If needed, drop table and disable feature
DROP TABLE IF EXISTS provider_voice_profiles CASCADE;
```

Frontend: Remove VoiceLearningService imports, voice profile will gracefully return null.

---

## Documentation

### User Documentation:
Create `docs/VOICE_LEARNING_USER_GUIDE.md` with:
- How to train your voice profile
- How to teach corrections
- How to view accuracy improvements
- Privacy information (90-day retention)

### Developer Documentation:
Update `docs/ARCHITECTURE.md` with:
- Voice learning system architecture
- IndexedDB schema
- Database schema
- Service layer API

---

## Security & Privacy

### HIPAA Compliance:
- ✅ All voice data encrypted at rest (Supabase AES-256)
- ✅ All voice data encrypted in transit (TLS 1.3)
- ✅ Audit logging for all voice profile access
- ✅ Auto-cleanup after 90 days (configurable)
- ✅ RLS policies: Providers can only access own voice profiles
- ✅ No PHI stored in voice corrections (only medical terminology)

### Data Minimization:
- Store ONLY corrections and patterns, not raw audio
- Delete training audio after processing
- Retention limited to 90 days by default
- User can export/delete voice profile anytime

---

## Performance Considerations

### IndexedDB Performance:
- Average read time: <5ms (local)
- Average write time: <10ms (local)
- Fallback to database: ~50-100ms
- Max profile size: ~100KB (thousands of corrections)

### UI Impact:
- Correction application: <1ms per correction
- No blocking operations (async saves)
- Optimistic UI updates

---

## Dependencies

### New NPM Packages:
```json
{
  "idb": "^7.1.1"  // IndexedDB wrapper (may already be installed)
}
```

### Install:
```bash
npm install idb
```

---

## Success Metrics

### Track These KPIs:
1. **Accuracy Improvement:** Baseline vs Current accuracy %
2. **Correction Usage:** How many times corrections are applied per session
3. **User Engagement:** % of providers who complete voice training
4. **Session Count:** Total sessions recorded with voice learning enabled
5. **Retention:** % of providers still using voice learning after 30 days

### Dashboard Queries:
```sql
-- Average accuracy improvement
SELECT
  AVG(accuracy_current - accuracy_baseline) as avg_improvement,
  COUNT(*) as total_providers
FROM provider_voice_profiles
WHERE total_sessions >= 5;

-- Most common corrections
SELECT
  correction->>'heard' as heard,
  correction->>'correct' as correct,
  COUNT(*) as provider_count
FROM provider_voice_profiles,
     jsonb_array_elements(voice_fingerprint->'corrections') as correction
GROUP BY correction->>'heard', correction->>'correct'
ORDER BY provider_count DESC
LIMIT 20;
```

---

## Implementation Checklist

**Phase 1: Local Corrections (2 hours)**
- [ ] Create `VoiceLearningService.ts`
- [ ] Implement IndexedDB storage
- [ ] Add correction application to `RealTimeSmartScribe.tsx`
- [ ] Add "Teach Correction" UI
- [ ] Add correction modal
- [ ] Test locally

**Phase 2: Database Sync (2 hours)**
- [ ] Create database migration
- [ ] Add RLS policies
- [ ] Implement database sync in service
- [ ] Add audit logging
- [ ] Test cross-device sync

**Phase 3: Training Wizard (2 hours)**
- [ ] Create `VoiceTrainingWizard.tsx` component
- [ ] Add training scripts
- [ ] Add progress tracking
- [ ] Show wizard on first use
- [ ] Test onboarding flow

**Testing & Documentation (1 hour)**
- [ ] Write unit tests
- [ ] Perform manual testing
- [ ] Write user documentation
- [ ] Update developer docs
- [ ] Create demo video

---

## Questions for Implementation

1. **Accuracy Calculation:** How should we measure session accuracy? (Manual review? AI confidence scores?)
2. **Training Duration:** 3 sessions enough? Or should we require more?
3. **Correction UI:** Inline editing or modal? (Recommendation: Modal for first version)
4. **Privacy Default:** 90 days retention OK? Or make it configurable per provider?
5. **Export Format:** JSON? CSV? (Recommendation: JSON for import/export)

---

## References

- Deepgram Custom Models: https://developers.deepgram.com/docs/models-languages-overview
- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- IDB Library: https://github.com/jakearchibald/idb
- HIPAA §164.312(b): Audit Controls

---

## Estimated Impact

**Before Voice Learning:**
- Average transcription accuracy: 85%
- Providers with accents: 70-75% accuracy
- User satisfaction: 7/10
- Time spent correcting: 5 min/session

**After Voice Learning (10+ sessions):**
- Average transcription accuracy: 95%+
- Providers with accents: 90%+ accuracy
- User satisfaction: 9/10
- Time spent correcting: 1 min/session

**ROI:**
- 4 minutes saved per session × 10 sessions/day × 250 days/year = **10,000 minutes saved/year per provider**
- = **167 hours/year**
- = **$16,700/year** at $100/hour physician time

**For 50 providers: $835,000/year in saved time** ⏱️💰

---

**Priority:** Implement after demo succeeds, before production launch.

**Owner:** Assign to Claude Code agent with this task card.

**Status:** Ready for implementation 🚀
