# AI Integrations Documentation Index

## Files Generated

This comprehensive AI integration documentation set includes:

### 1. AI_INTEGRATIONS_SUMMARY.md (Quick Reference)
- High-level overview of all AI systems
- Model selection and pricing
- Key statistics and performance metrics
- Database tables used
- Configuration and environment setup
- Testing checklist

**Best for**: Quick lookup, getting oriented, checking stats

### 2. AI_INTEGRATIONS_COMPREHENSIVE.md (Detailed Documentation)
- Executive summary (overall architecture)
- Claude API integrations & purposes
- SMART Scribe real-time transcription system
- Guardian Agent implementation (autonomous healing)
- AI-powered billing code suggestions
- Natural language processing for clinical notes
- Rate limiting & cost controls
- Model selection logic
- AI personalization & dashboards
- Integration flow examples
- Security & compliance details
- Configuration details
- Performance characteristics

**Best for**: Deep technical understanding, implementation details, integration examples

### 3. AI_INTEGRATIONS_INDEX.md (This File)
- Navigation guide to all documentation
- File descriptions and use cases

---

## Quick Navigation by Topic

### If You Want to Understand...

#### The AI System Architecture
Start with: **AI_INTEGRATIONS_SUMMARY.md** → Overview section
Then read: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 1 (Claude API Integrations)

#### Real-Time Medical Transcription
Start with: **AI_INTEGRATIONS_SUMMARY.md** → "Real-Time Systems" section
Then read: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 2 (SMART Scribe)
Code: `supabase/functions/realtime_medical_transcription/index.ts` (461 lines)

#### Guardian Agent (Self-Healing)
Start with: **AI_INTEGRATIONS_SUMMARY.md** → "Autonomous Healing" section
Then read: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 3 (Guardian Agent)
Code: `src/services/guardian-agent/GuardianAgent.ts` + Edge Functions

#### Medical Billing Code Optimization
Start with: **AI_INTEGRATIONS_SUMMARY.md** → "Billing Intelligence" section
Then read: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 4 (AI-Powered Billing)
Code: 
- `supabase/functions/coding-suggest/index.ts` (293 lines)
- `supabase/functions/sdoh-coding-suggest/index.ts` (457 lines)

#### Cost Controls & Rate Limiting
Start with: **AI_INTEGRATIONS_SUMMARY.md** → "Key Statistics" section
Then read: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 6 (Rate Limiting & Cost Controls)
Code: `src/services/claudeService.ts` (lines 38-165)

#### Dashboard Personalization
Start with: **AI_INTEGRATIONS_SUMMARY.md** → "Personalization" section
Then read: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 8 (AI Personalization & Dashboards)
Code: `src/services/dashboardPersonalizationAI.ts` (422 lines)

#### Model Selection Logic
Start with: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 7 (Model Selection Logic)
Code: `src/services/intelligentModelRouter.ts` (139 lines)

#### HIPAA Compliance Details
Read: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 10 (Security & Compliance)

---

## File Mapping to Source Code

### Core AI Services
| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| Claude Service | `src/services/claudeService.ts` | 1,044 | Main AI service with rate limiting + cost tracking |
| Edge Service | `src/services/claudeEdgeService.ts` | 134 | Secure server-side wrapper |
| Care Assistant | `src/services/claudeCareAssistant.ts` | 832 | Translation + admin automation |
| Loader | `src/services/anthropicLoader.ts` | 17 | Lazy SDK loading |
| Router | `src/services/intelligentModelRouter.ts` | 139 | Model selection logic |

### AI Systems
| System | File | Lines | Purpose |
|--------|------|-------|---------|
| Dashboard AI | `src/services/dashboardPersonalizationAI.ts` | 422 | Dashboard personalization |
| Guardian Agent | `src/services/guardian-agent/GuardianAgent.ts` | 150+ | Autonomous healing system |
| Guardian Types | `src/services/guardian-agent/types.ts` | 180 | Type definitions |
| Guardian Index | `src/services/guardian-agent/index.ts` | 69 | Public API |

### Edge Functions
| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| Real-Time Transcription | `supabase/functions/realtime_medical_transcription/index.ts` | 461 | SMART Scribe with WebSocket |
| Claude Chat | `supabase/functions/claude-chat/index.ts` | 157 | Edge Function chat endpoint |
| Medical Coding | `supabase/functions/coding-suggest/index.ts` | 293 | CPT/ICD-10 code suggestions |
| SDOH Coding | `supabase/functions/sdoh-coding-suggest/index.ts` | 457 | SDOH + CCM billing |
| Personalization | `supabase/functions/claude-personalization/index.ts` | 206 | Dashboard personalization |
| Guardian Agent | `supabase/functions/guardian-agent/index.ts` | 303 | System monitoring + healing |
| Guardian PR | `supabase/functions/guardian-pr-service/index.ts` | 547 | Automated PR creation |
| Guardian API | `supabase/functions/guardian-agent-api/index.ts` | 232 | Guardian API endpoint |

---

## Document Statistics

### Comprehensive Documentation
- **Total lines**: 1,064
- **Sections**: 13
- **Code examples**: 15+
- **Tables**: 10+
- **Diagrams**: 3 (ASCII flow diagrams)

### Summary Documentation
- **Total lines**: 270
- **Quick reference tables**: 8
- **File listings**: 4
- **Configuration examples**: 1

---

## Key Metrics at a Glance

### Models Supported
- **Haiku 4.5**: $0.0001 input / $0.0005 output per 1K tokens
- **Sonnet 4.5**: $0.003 input / $0.015 output per 1K tokens
- **Opus 4.1**: $0.015 input / $0.075 output per 1K tokens (reserved)

### Rate Limits
- **Per user**: 60 requests/minute
- **Daily budget**: $50/user/day
- **Monthly budget**: $500/user/month

### Monitoring Intervals
- **General monitoring**: Every 5 seconds
- **Security scans**: Every 60 seconds
- **Transcription analysis**: Every 10 seconds
- **Dashboard refresh**: Every 5 minutes

### Error Detection
- **Error categories**: 20+
- **Healing strategies**: 13
- **Severity levels**: 5 (critical, high, medium, low, info)

### Compliance
- **HIPAA**: Full compliance with de-identification
- **Audit logging**: Every AI call logged with request ID
- **PHI scrubbed**: Flag on every audit record

---

## How to Use This Documentation

### Step 1: Get Oriented
Read: **AI_INTEGRATIONS_SUMMARY.md**
- Time: 10-15 minutes
- Outcome: Understand what systems exist and what they do

### Step 2: Find Your Topic
Use the "Quick Navigation by Topic" section above
- Cross-reference with the source code files

### Step 3: Deep Dive
Read the relevant section in **AI_INTEGRATIONS_COMPREHENSIVE.md**
- Time: 20-45 minutes depending on topic
- Reference the source code alongside

### Step 4: Review Code
Open the relevant source code files
- Use line numbers from documentation to navigate
- See actual implementation details

### Step 5: Implement/Debug
Use both documents as reference during implementation
- Summary for quick facts
- Comprehensive for technical details
- Code for actual implementation

---

## Common Questions Answered

### "How much will AI cost me?"
See: **AI_INTEGRATIONS_SUMMARY.md** → "Daily Cost Estimates"
Answer: ~$0.92/day for 100 active users, ~$0.27/user/month

### "How do I limit costs?"
See: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 6 (Rate Limiting & Cost Controls)
Answer: Built-in budget limits ($50/day, $500/month per user) + rate limiting (60 req/min)

### "Is this HIPAA compliant?"
See: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 10 (Security & Compliance)
Answer: Yes - all PHI de-identified before Claude, comprehensive audit logging

### "What if Claude API is down?"
See: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 10.2 (Error Safety)
Answer: Circuit breaker + graceful degradation (returns sensible defaults)

### "How long does it take to generate a SOAP note?"
See: **AI_INTEGRATIONS_SUMMARY.md** → "Response Times"
Answer: 2-4 seconds on average

### "What model should I use for my feature?"
See: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 7 (Model Selection Logic)
Answer: Haiku for speed/cost, Sonnet for accuracy, Opus reserved

### "Can the system heal itself?"
See: **AI_INTEGRATIONS_COMPREHENSIVE.md** → Section 3 (Guardian Agent)
Answer: Yes - fully autonomous, no human approval needed, up to 13 healing strategies

---

## Related Files in Codebase

If you need to implement AI features:
- `src/types/claude.ts` - Type definitions
- `src/utils/claudeModelSelection.ts` - Model selection utilities
- `src/config/environment.ts` - Environment configuration
- `.env.example` - Environment variable template
- Database migrations - AI audit table schemas

---

## Maintenance & Updates

When updating this documentation:
1. Update both COMPREHENSIVE and SUMMARY docs
2. Keep line counts accurate
3. Test all code examples
4. Verify all file paths
5. Update this INDEX if structure changes

---

## Contact & Support

For questions about:
- **Architecture**: See COMPREHENSIVE.md Section 9 (Integration Summary)
- **Implementation**: See relevant source code files
- **Compliance**: See COMPREHENSIVE.md Section 10 (Security & Compliance)
- **Costs**: See SUMMARY.md (Key Statistics) or COMPREHENSIVE.md Section 6

---

**Documentation Generated**: 2025-11-04
**Claude Version Used**: Haiku 4.5
**Total Source Lines Analyzed**: 6,000+
