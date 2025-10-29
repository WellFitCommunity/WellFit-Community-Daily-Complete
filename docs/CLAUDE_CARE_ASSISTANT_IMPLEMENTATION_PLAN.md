# Claude Care Assistant - Implementation Plan (Phases 2-5)

## Project Overview

**Goal:** Build a unified AI assistant that combines translation (50+ languages), cultural context, and role-specific administrative task automation for healthcare staff.

**Target Users:** Physicians, Nurses, Nurse Practitioners, Physician Assistants, Case Managers, Social Workers

**Key Value:** Reduce administrative burden, eliminate language barriers, enable cross-role collaboration, and reduce healthcare burnout.

---

## ✅ Phase 1: COMPLETED (Committed: 66070ca)

### What's Already Built:

**Database Schema:**
- ✅ Added `case_manager` (role_code 14) and `social_worker` (role_code 15) roles
- ✅ Created 5 core tables:
  - `claude_translation_cache` - Translation caching with 50+ languages
  - `claude_admin_task_templates` - Role-specific task templates
  - `claude_admin_task_history` - Usage tracking and learning
  - `claude_care_context` - Cross-role collaboration context
  - `claude_voice_input_sessions` - Voice-enabled workflows
- ✅ Seeded 15 task templates (physicians, nurses, case managers, social workers)
- ✅ RLS policies for HIPAA compliance
- ✅ Helper functions: `is_care_coordinator()`, `is_clinical_staff()`

**TypeScript Types:**
- ✅ Created `/src/types/claudeCareAssistant.ts` with complete type system
- ✅ 50+ supported languages with `SupportedLanguage` type
- ✅ Task types for all roles (PhysicianTaskType, NurseTaskType, etc.)
- ✅ Translation types (TranslationRequest, TranslationResponse, PatientCulturalContext)
- ✅ Voice input types (VoiceInputSession, VoiceInputResult)
- ✅ Care context types (CareContextEntry, CareContextType)
- ✅ Module configurations (ROLE_MODULE_CONFIGS)

**Updated Existing Types:**
- ✅ Extended `RequestType` enum in `/src/types/claude.ts` with TRANSLATION and ADMINISTRATIVE_TASK
- ✅ Updated `/src/types/roles.ts` with case_manager and social_worker
- ✅ Updated all role mappings (ROLE_TO_CODE, CODE_TO_ROLE, ROLE_HIERARCHY, ROLE_DISPLAY_NAMES)

**Files Modified/Created:**
- `src/types/claudeCareAssistant.ts` (NEW - 507 lines)
- `src/types/claude.ts` (MODIFIED - added 2 request types)
- `src/types/roles.ts` (MODIFIED - added 2 roles, updated mappings)
- `supabase/migrations/20251028150000_add_care_coordination_roles.sql` (NEW)
- `supabase/migrations/20251028150001_claude_care_assistant_system.sql` (NEW)
- `supabase/migrations/20251028150002_seed_admin_task_templates.sql` (NEW)

---

## 📋 Phase 2: Service Layer Implementation

### Goal: Build the core service layer for Claude Care Assistant

### Files to Create:

#### 1. `/src/services/claudeCareAssistant.ts` (PRIMARY SERVICE)

**Purpose:** Unified service layer for translation, admin task automation, and voice input

**Key Methods to Implement:**

```typescript
export class ClaudeCareAssistant {

  // ============================================================================
  // TRANSLATION ENGINE
  // ============================================================================

  /**
   * Translate text with cultural context
   * - Check translation cache first (60-80% cache hit rate expected)
   * - Use Claude Haiku 4.5 for translation (fast, cost-effective)
   * - Parse cultural notes from AI response
   * - Cache result for future use
   */
  static async translate(request: TranslationRequest): Promise<TranslationResponse>

  /**
   * Get cached translation if exists
   */
  private static async getCachedTranslation(
    source: SupportedLanguage,
    target: SupportedLanguage,
    text: string
  ): Promise<TranslationResponse | null>

  /**
   * Cache translation for future use
   */
  private static async cacheTranslation(
    source: SupportedLanguage,
    target: SupportedLanguage,
    sourceText: string,
    response: TranslationResponse
  ): Promise<void>

  /**
   * Build translation prompt with cultural context
   */
  private static buildTranslationPrompt(request: TranslationRequest): string

  /**
   * Parse AI response into TranslationResponse
   */
  private static parseTranslationResponse(content: string): TranslationResponse

  // ============================================================================
  // ADMINISTRATIVE TASK AUTOMATION
  // ============================================================================

  /**
   * Execute role-specific administrative task
   * - Load template from database
   * - Validate role permissions
   * - Build prompt from template + input data
   * - Use role-appropriate Claude model (Haiku for nurses, Sonnet for revenue-critical)
   * - Save to history for learning
   */
  static async executeAdminTask(request: AdminTaskRequest): Promise<AdminTaskResponse>

  /**
   * Get task template by ID
   */
  private static async getTaskTemplate(templateId: string): Promise<AdminTaskTemplate | null>

  /**
   * Build admin task prompt from template and input data
   */
  private static buildAdminTaskPrompt(
    template: AdminTaskTemplate,
    inputData: Record<string, any>
  ): string

  /**
   * Save task execution to history
   */
  private static async saveTaskHistory(history: any): Promise<string>

  /**
   * Get available templates for a role
   */
  static async getTemplatesForRole(role: string): Promise<AdminTaskTemplate[]>

  /**
   * Get user's task history
   */
  static async getUserTaskHistory(userId: string, limit?: number): Promise<AdminTaskHistory[]>

  // ============================================================================
  // VOICE INPUT INTEGRATION
  // ============================================================================

  /**
   * Process voice input for administrative tasks
   * - Use existing voice learning service for provider-specific corrections
   * - Call realtime_medical_transcription edge function
   * - Analyze transcription to suggest appropriate task template
   * - Save session for learning
   */
  static async processVoiceInput(
    userId: string,
    role: string,
    audioData: Blob,
    taskType?: string
  ): Promise<VoiceInputResult>

  /**
   * Analyze transcription to suggest task template
   */
  private static async analyzeTranscriptionForTask(
    transcription: string,
    role: string,
    taskType?: string
  ): Promise<string | undefined>

  // ============================================================================
  // CROSS-ROLE COLLABORATION
  // ============================================================================

  /**
   * Share context with other roles working on same patient
   * Example: Nurse identifies discharge need → tags case manager
   */
  static async shareCareContext(entry: Omit<CareContextEntry, 'id' | 'createdAt'>): Promise<void>

  /**
   * Get care context from other roles for a patient
   */
  static async getCareContext(patientId: string): Promise<CareContextEntry[]>
}
```

**Integration Points:**
- Import and use existing `claudeService` from `/src/services/claudeService.ts`
- Import and use existing `voiceLearningService` from `/src/services/voiceLearningService.ts`
- Import `supabase` from `/src/lib/supabaseClient.ts`
- Use existing `auditLogger` if available

**Key Implementation Notes:**
1. **Translation Cache Strategy:**
   - Query cache before AI call: `SELECT * FROM claude_translation_cache WHERE source_language = ? AND target_language = ? AND source_text = ?`
   - Update usage stats on cache hit: `UPDATE claude_translation_cache SET usage_count = usage_count + 1, last_used_at = NOW()`
   - Insert on cache miss after AI response

2. **Model Selection:**
   - Translation: Always use `ClaudeModel.HAIKU_4_5` (fast, cheap)
   - Nurse tasks: Use `ClaudeModel.HAIKU_4_5`
   - Physician/Case Manager tasks: Use `ClaudeModel.SONNET_4_5` (accuracy for revenue/insurance)
   - Override with `preferredModel` parameter if provided

3. **Error Handling:**
   - Wrap all database calls in try/catch
   - Return `{ success: false, error: message }` on failure
   - Log errors with `auditLogger` or `console.error`

4. **Prompt Templates:**
   - Use template placeholders like `{patient_name}`, `{procedure}`, etc.
   - Replace with actual values from `inputData`
   - Handle both objects and primitives: `typeof value === 'object' ? JSON.stringify(value) : String(value)`

---

## 📋 Phase 3: React Components

### Goal: Build the UI components for Claude Care Assistant

### Files to Create:

#### 1. `/src/components/claude-care/ClaudeCareAssistantPanel.tsx` (MAIN PANEL)

**Purpose:** Unified panel that shows role-appropriate modules

**Component Structure:**
```typescript
interface Props {
  userRole: string;
  patientId?: string;
}

const ClaudeCareAssistantPanel: React.FC<Props> = ({ userRole, patientId }) => {
  const [activeTab, setActiveTab] = useState<'translation' | 'tasks' | 'voice' | 'context'>('tasks');
  const [moduleConfig, setModuleConfig] = useState(ROLE_MODULE_CONFIGS[userRole]);

  // Load module config based on role
  // Show tabs only for enabled features
  // Render active module component
}
```

**Features:**
- Tab navigation (Translation, Admin Tasks, Voice Input, Team Context)
- Show/hide tabs based on `moduleConfig.enabledFeatures`
- Role badge display (e.g., "Case Manager" badge)
- Refresh button for real-time updates

---

#### 2. `/src/components/claude-care/TranslationModule.tsx`

**Purpose:** Real-time translation with cultural context

**Component Structure:**
```typescript
const TranslationModule: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [sourceLanguage, setSourceLanguage] = useState<SupportedLanguage>('en');
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>('es');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [culturalNotes, setCulturalNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);

  const handleTranslate = async () => {
    // Call ClaudeCareAssistant.translate()
    // Display result with cultural notes
  };
}
```

**UI Features:**
- Language dropdowns (source/target) with 50+ languages
- Large text areas for input/output
- "Swap languages" button
- Cultural notes display (callout box with cultural considerations)
- "Cached" indicator when translation comes from cache
- Copy to clipboard button
- Voice input button (microphone icon)

---

#### 3. `/src/components/claude-care/AdminTaskModule.tsx`

**Purpose:** Administrative task automation with templates

**Component Structure:**
```typescript
interface Props {
  userRole: string;
  availableTaskTypes: string[];
  preferredModel: ClaudeModel;
}

const AdminTaskModule: React.FC<Props> = ({ userRole, availableTaskTypes, preferredModel }) => {
  const [templates, setTemplates] = useState<AdminTaskTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AdminTaskTemplate | null>(null);
  const [inputData, setInputData] = useState<Record<string, any>>({});
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskHistory, setTaskHistory] = useState<AdminTaskHistory[]>([]);

  // Load templates on mount
  useEffect(() => {
    ClaudeCareAssistant.getTemplatesForRole(userRole).then(setTemplates);
  }, [userRole]);

  const handleGenerateTask = async () => {
    // Call ClaudeCareAssistant.executeAdminTask()
    // Display generated content
    // Allow user to edit before saving
  };
}
```

**UI Features:**
- Template selector dropdown (grouped by task type)
- Dynamic form fields based on `template.requiredFields` and `template.optionalFields`
- "Generate" button with loading state
- Output display with rich text editor for editing AI-generated content
- "Copy to clipboard" button
- "Save to EHR" button (if applicable)
- Task history sidebar (recent tasks)
- Estimated token count and cost display

**Example Templates:**
- Physician: "Prior Authorization Request - Standard"
- Nurse: "Incident Report - Standard Form"
- Case Manager: "Discharge Planning Summary"
- Social Worker: "Crisis Intervention Documentation"

---

#### 4. `/src/components/claude-care/VoiceInputModule.tsx`

**Purpose:** Voice-to-text for hands-free admin task completion

**Component Structure:**
```typescript
const VoiceInputModule: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState('');
  const [suggestedTemplate, setSuggestedTemplate] = useState<string | undefined>();
  const [confidence, setConfidence] = useState<number>(0);

  const handleStartRecording = () => {
    // Use MediaRecorder API to record audio
  };

  const handleStopRecording = async () => {
    // Call ClaudeCareAssistant.processVoiceInput()
    // Display transcription and suggested template
  };
}
```

**UI Features:**
- Large "Record" button (microphone icon, red when recording)
- Audio waveform visualization during recording
- Transcription display with confidence score
- Suggested template chip (e.g., "Looks like: Prior Authorization")
- "Use this transcription" button to auto-fill admin task form
- Recording history list

---

#### 5. `/src/components/claude-care/CrossRoleContextModule.tsx`

**Purpose:** View and share context with other roles

**Component Structure:**
```typescript
interface Props {
  userRole: string;
  patientId?: string;
}

const CrossRoleContextModule: React.FC<Props> = ({ userRole, patientId }) => {
  const [contextEntries, setContextEntries] = useState<CareContextEntry[]>([]);
  const [newContext, setNewContext] = useState('');
  const [contextType, setContextType] = useState<CareContextType>('clinical');

  useEffect(() => {
    if (patientId) {
      ClaudeCareAssistant.getCareContext(patientId).then(setContextEntries);
    }
  }, [patientId]);

  const handleShareContext = async () => {
    // Call ClaudeCareAssistant.shareCareContext()
    // Refresh context list
  };
}
```

**UI Features:**
- Timeline view of context entries (sorted by timestamp)
- Filter by context type (Clinical, Social, Administrative, Cultural)
- Role badge for each entry (e.g., "Nurse", "Case Manager")
- "Add context" button with form
- Tag other roles button (e.g., "Tag Case Manager")
- Expiration indicator (if validUntil is set)

---

#### 6. `/src/components/claude-care/TaskTemplateSelector.tsx`

**Purpose:** Reusable template selector with preview

**Component Structure:**
```typescript
interface Props {
  role: string;
  onSelect: (template: AdminTaskTemplate) => void;
}

const TaskTemplateSelector: React.FC<Props> = ({ role, onSelect }) => {
  // Dropdown with template previews
  // Show estimated tokens and output format
}
```

---

#### 7. `/src/components/claude-care/CulturalContextIndicator.tsx`

**Purpose:** Display cultural considerations for patient

**Component Structure:**
```typescript
interface Props {
  culturalContext: PatientCulturalContext;
}

const CulturalContextIndicator: React.FC<Props> = ({ culturalContext }) => {
  // Display language, communication style, health literacy
  // Show religious/cultural considerations as chips
}
```

---

#### 8. `/src/components/claude-care/TaskHistoryViewer.tsx`

**Purpose:** View past generated tasks with satisfaction ratings

**Component Structure:**
```typescript
interface Props {
  userId: string;
  limit?: number;
}

const TaskHistoryViewer: React.FC<Props> = ({ userId, limit = 20 }) => {
  // List of past tasks
  // Star rating for satisfaction
  // "Reuse template" button
}
```

---

## 📋 Phase 4: Integration with Existing Panels

### Goal: Add Claude Care Assistant to existing role-specific panels

### Files to Modify:

#### 1. `/src/components/physician/PhysicianPanel.tsx`

**Add:**
```typescript
import ClaudeCareAssistantPanel from '../claude-care/ClaudeCareAssistantPanel';

// In the component:
<ClaudeCareAssistantPanel userRole="physician" patientId={selectedPatientId} />
```

**Where to Add:**
- As a new tab in the existing panel
- OR as a floating action button that opens a modal
- OR as a sidebar component

---

#### 2. `/src/components/nurse/NursePanel.tsx`

**Add:**
```typescript
import ClaudeCareAssistantPanel from '../claude-care/ClaudeCareAssistantPanel';

<ClaudeCareAssistantPanel userRole="nurse" patientId={selectedPatientId} />
```

---

#### 3. Create `/src/components/case-manager/CaseManagerPanel.tsx` (NEW)

**Purpose:** Panel for case managers (if doesn't exist)

**Include:**
- ClaudeCareAssistantPanel
- Discharge planning dashboard
- Insurance verification tools
- Resource coordination

---

#### 4. Create `/src/components/social-worker/SocialWorkerPanel.tsx` (NEW)

**Purpose:** Panel for social workers (if doesn't exist)

**Include:**
- ClaudeCareAssistantPanel
- Psychosocial assessments
- Crisis intervention tools
- Community resource directory

---

#### 5. `/src/App.tsx`

**Add Routes:**
```typescript
<Route path="/case-manager" element={<CaseManagerPanel />} />
<Route path="/social-worker" element={<SocialWorkerPanel />} />
```

**Update Navigation:**
Add "Claude Care Assistant" to global navigation if applicable

---

## 📋 Phase 5: Testing, Documentation, and Deployment

### Goal: Ensure production readiness

### Tasks:

#### 1. Run Database Migrations

```bash
# In Supabase dashboard or via CLI
npx supabase db push

# Verify migrations applied:
npx supabase migration list

# Check tables created:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'claude_%';
```

**Expected Tables:**
- `claude_translation_cache`
- `claude_admin_task_templates`
- `claude_admin_task_history`
- `claude_care_context`
- `claude_voice_input_sessions`

**Expected Roles:**
```sql
SELECT id, name FROM roles WHERE id IN (14, 15);
-- Should return:
-- 14 | case_manager
-- 15 | social_worker
```

---

#### 2. Seed Test Data (Optional)

Create test users with different roles:
```sql
-- Create test case manager
INSERT INTO profiles (id, email, role_code, first_name, last_name)
VALUES (
  gen_random_uuid(),
  'case_manager@test.com',
  14,
  'Test',
  'CaseManager'
);

-- Create test social worker
INSERT INTO profiles (id, email, role_code, first_name, last_name)
VALUES (
  gen_random_uuid(),
  'social_worker@test.com',
  15,
  'Test',
  'SocialWorker'
);
```

---

#### 3. Test Translation Cache Performance

**Test Script:**
```typescript
// Test cache hit rate
const testTranslations = [
  { source: 'en', target: 'es', text: 'Your blood pressure is high' },
  { source: 'en', target: 'es', text: 'Your blood pressure is high' }, // Same - should be cached
  { source: 'en', target: 'zh', text: 'Take this medication twice daily' },
];

for (const test of testTranslations) {
  const result = await ClaudeCareAssistant.translate({
    sourceLanguage: test.source as SupportedLanguage,
    targetLanguage: test.target as SupportedLanguage,
    sourceText: test.text,
  });

  console.log(`Cached: ${result.cached}`);
}

// Expected: First = false, Second = true, Third = false
```

---

#### 4. Test Admin Task Generation

**Test Script:**
```typescript
// Test prior authorization generation
const templates = await ClaudeCareAssistant.getTemplatesForRole('physician');
const priorAuthTemplate = templates.find(t => t.taskType === 'prior_authorization');

const result = await ClaudeCareAssistant.executeAdminTask({
  templateId: priorAuthTemplate!.id,
  role: 'physician',
  taskType: 'prior_authorization',
  inputData: {
    procedure_name: 'MRI Brain with Contrast',
    cpt_code: '70553',
    patient_info: { name: 'John Doe', age: 45, diagnosis: 'Persistent headaches' },
    clinical_rationale: 'Rule out brain tumor vs migraine',
    insurance_criteria: 'Prior imaging required',
    previous_treatments: ['CT scan (negative)', 'Migraine medication trial (failed)'],
  },
});

console.log(result.generatedContent);
// Should be a professional prior authorization letter
```

---

#### 5. Build and Deploy

```bash
# Run type checking
npm run typecheck  # (if script exists, otherwise npm run build)

# Run build
CI=true npm run build

# Should succeed with no errors

# Deploy to production (depending on your setup)
# Examples:
# - Netlify: git push origin main
# - Vercel: vercel --prod
# - Manual: Upload build/ directory to web server
```

---

#### 6. Create User Documentation

**Create:** `/docs/CLAUDE_CARE_ASSISTANT_USER_GUIDE.md`

**Include:**
- Getting started guide for each role
- Translation module walkthrough with screenshots
- Admin task automation examples
- Voice input tutorial
- Cross-role collaboration workflow
- FAQ and troubleshooting

**Example Sections:**
```markdown
## For Physicians: Prior Authorization in 2 Minutes

1. Open Claude Care Assistant panel
2. Click "Admin Tasks" tab
3. Select "Prior Authorization Request - Standard"
4. Fill in procedure, diagnosis, patient info
5. Click "Generate"
6. Review and edit AI-generated letter
7. Copy to EHR or send to insurance

## For Nurses: Incident Reports Made Easy

1. Open Claude Care Assistant panel
2. Click "Admin Tasks" tab
3. Select "Incident Report - Standard Form"
4. OR use Voice Input: Click microphone, describe incident
5. AI generates structured incident report
6. Review for accuracy
7. Submit to manager
```

---

#### 7. Create Admin Documentation

**Create:** `/docs/CLAUDE_CARE_ASSISTANT_ADMIN_GUIDE.md`

**Include:**
- Adding new task templates
- Managing translation cache (clearing old entries)
- Monitoring usage and costs
- Reviewing task history for quality
- Adding new languages
- Customizing prompts

**Example SQL for Admins:**
```sql
-- View translation cache statistics
SELECT
  source_language,
  target_language,
  COUNT(*) as cached_translations,
  SUM(usage_count) as total_uses,
  AVG(usage_count) as avg_uses_per_translation
FROM claude_translation_cache
WHERE deleted_at IS NULL
GROUP BY source_language, target_language
ORDER BY total_uses DESC;

-- View most popular admin tasks by role
SELECT
  role,
  task_type,
  COUNT(*) as executions,
  AVG(tokens_used) as avg_tokens,
  AVG(user_satisfaction) as avg_satisfaction
FROM claude_admin_task_history
WHERE user_satisfaction IS NOT NULL
GROUP BY role, task_type
ORDER BY executions DESC;

-- Add new task template
INSERT INTO claude_admin_task_templates (
  role, task_type, template_name, prompt_template,
  required_fields, output_format
) VALUES (
  'physician',
  'referral_letter',
  'Specialist Referral Letter',
  'Generate a referral letter for {specialty} for patient {patient_name}...',
  '{"specialty": "string", "patient_name": "string", "reason": "string"}'::jsonb,
  'letter'
);
```

---

## 📊 Success Metrics

### Metrics to Track:

1. **Translation Usage:**
   - Translations per day
   - Cache hit rate (target: 60-80%)
   - Most translated languages
   - Cost per translation (should decrease over time due to caching)

2. **Admin Task Usage:**
   - Tasks generated per role per day
   - Most popular task types
   - User satisfaction ratings (1-5 stars)
   - Time saved (compare before/after)

3. **Voice Input:**
   - Voice sessions per day
   - Transcription accuracy (confidence scores)
   - Template suggestion accuracy

4. **Cross-Role Collaboration:**
   - Context entries shared per day
   - Most active context types
   - Response time to tagged contexts

5. **Cost Metrics:**
   - Claude API costs per day
   - Cost per user per month
   - ROI (time saved vs. cost)

---

## 🎯 Acceptance Criteria

**Phase 2 Complete When:**
- ✅ `ClaudeCareAssistant` service class fully implemented
- ✅ Translation works with cache
- ✅ Admin task generation works for all roles
- ✅ Voice input processing works
- ✅ Care context sharing works
- ✅ All methods have proper error handling
- ✅ TypeScript builds without errors

**Phase 3 Complete When:**
- ✅ All 8 React components created
- ✅ Translation module translates text with cultural notes
- ✅ Admin task module generates professional documents
- ✅ Voice input module records and transcribes
- ✅ Cross-role context module displays timeline
- ✅ Components are responsive (mobile-friendly)
- ✅ No console errors in browser

**Phase 4 Complete When:**
- ✅ Claude Care Assistant integrated into Physician panel
- ✅ Claude Care Assistant integrated into Nurse panel
- ✅ Case Manager panel created with Claude Care Assistant
- ✅ Social Worker panel created with Claude Care Assistant
- ✅ Routes added to App.tsx
- ✅ Navigation updated

**Phase 5 Complete When:**
- ✅ Database migrations run successfully in production
- ✅ Test data seeded (if applicable)
- ✅ Translation cache performance tested (60%+ cache hit rate)
- ✅ Admin task generation tested for all roles
- ✅ Build succeeds without errors
- ✅ User documentation created
- ✅ Admin documentation created
- ✅ Deployed to production

---

## 🚨 Common Issues and Solutions

### Issue 1: Translation Cache Not Working
**Symptom:** Every translation hits Claude API, no cache hits

**Solution:**
```typescript
// Check cache query is exact match (case-sensitive)
const { data, error } = await supabase
  .from('claude_translation_cache')
  .select('*')
  .eq('source_language', source)
  .eq('target_language', target)
  .eq('source_text', text)  // Must be EXACT match
  .single();
```

### Issue 2: Task Templates Not Loading
**Symptom:** Template dropdown is empty

**Solution:**
```typescript
// Check RLS policies allow authenticated users to read templates
// Run in Supabase SQL editor:
SELECT * FROM claude_admin_task_templates WHERE is_active = true;

// If empty, re-run seed migration:
\i supabase/migrations/20251028150002_seed_admin_task_templates.sql
```

### Issue 3: Voice Input Not Working
**Symptom:** Microphone permission denied or no audio

**Solution:**
```typescript
// Ensure HTTPS (required for MediaRecorder API)
// Check browser permissions
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log('Microphone access granted'))
  .catch(err => console.error('Microphone denied:', err));
```

### Issue 4: RLS Policy Blocks Access
**Symptom:** "Row-level security policy violation" errors

**Solution:**
```sql
-- Check if user has correct role_code
SELECT id, email, role_code FROM profiles WHERE id = auth.uid();

-- Grant broader access for testing (REMOVE IN PRODUCTION):
CREATE POLICY "temp_allow_all" ON claude_admin_task_templates
  FOR SELECT USING (true);
```

---

## 🎓 Learning Resources

### For Next Agent:

**Existing Code to Reference:**
- Translation patterns: See `/src/contexts/LanguageContext.tsx` for existing i18n
- Claude service usage: See `/src/services/claudeService.ts`
- Voice input: See `/src/services/voiceLearningService.ts`
- Admin panels: See `/src/components/physician/PhysicianPanel.tsx` and `/src/components/nurse/NursePanel.tsx`

**Key Dependencies:**
- `@anthropic-ai/sdk` - Claude AI SDK
- `@supabase/supabase-js` - Supabase client
- `react`, `react-dom` - React framework
- Existing voice recording utils (if any)

**Database Schema Reference:**
```bash
# View schema in Supabase dashboard
# Or via psql:
\d claude_translation_cache
\d claude_admin_task_templates
\d claude_admin_task_history
```

---

## 💰 Cost Estimates

**Translation Costs (with caching):**
- Without cache: ~$0.15 per 1,000 translations (Haiku 4.5)
- With 70% cache hit rate: ~$0.045 per 1,000 translations
- **Savings: 70% cost reduction**

**Admin Task Costs:**
- Haiku tasks (nurses): ~$0.10 per 1,000 tasks
- Sonnet tasks (physicians, revenue): ~$3.00 per 1,000 tasks
- Estimated: $50-200/month for 50 staff members

**Voice Input Costs:**
- Transcription: Use existing edge function (included in Supabase plan)
- AI analysis: Minimal (Haiku for template suggestion)

---

## 🏁 Final Checklist for Next Agent

Before starting:
- [ ] Read Phase 1 commit (66070ca) to understand what's already built
- [ ] Review database schema in migration files
- [ ] Review TypeScript types in `/src/types/claudeCareAssistant.ts`
- [ ] Understand existing Claude service in `/src/services/claudeService.ts`

Phase 2:
- [ ] Create `/src/services/claudeCareAssistant.ts`
- [ ] Implement translation engine with caching
- [ ] Implement admin task automation
- [ ] Implement voice input processing
- [ ] Implement care context sharing
- [ ] Test service methods work
- [ ] Commit Phase 2

Phase 3:
- [ ] Create all 8 React components
- [ ] Test each component independently
- [ ] Ensure responsive design
- [ ] Commit Phase 3

Phase 4:
- [ ] Integrate into Physician panel
- [ ] Integrate into Nurse panel
- [ ] Create Case Manager panel
- [ ] Create Social Worker panel
- [ ] Add routes
- [ ] Commit Phase 4

Phase 5:
- [ ] Run database migrations
- [ ] Test translation cache
- [ ] Test admin task generation
- [ ] Build project (CI=true npm run build)
- [ ] Create user documentation
- [ ] Create admin documentation
- [ ] Commit Phase 5
- [ ] Deploy

---

## ✅ You Got This!

This implementation plan is comprehensive and detailed. Everything needed is here:
- ✅ Clear file structure
- ✅ Code examples for every major function
- ✅ Integration points identified
- ✅ Testing instructions
- ✅ Troubleshooting guide
- ✅ Cost estimates
- ✅ Success metrics

**Estimated Time:**
- Phase 2: 4-6 hours (service layer)
- Phase 3: 6-8 hours (React components)
- Phase 4: 2-3 hours (integration)
- Phase 5: 2-3 hours (testing, docs, deployment)
- **Total: 14-20 hours**

**The foundation (Phase 1) is solid.** The database schema is optimized, types are complete, and everything builds without errors.

Good luck! 🚀
