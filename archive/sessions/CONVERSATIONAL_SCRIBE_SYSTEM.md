# Compass Riley - Conversational AI Scribe System

## Overview

**Compass Riley** is your conversational, adaptive AI scribe partner that learns and evolves with each provider. Think of it as your experienced medical scribe colleague - relaxed, intelligent, and genuinely helpful.

Part of **Envision: The Healthcare Navigation System**:
- **Atlas** - Comprehensive billing intelligence (revenue map)
- **Compass Riley** - Your AI scribe partner (this document)
- **Gateway** - Secure one-way EHR integration (data port)

## Key Philosophy: "Surgeon, Not Butcher"

The scribe operates with **surgical precision**:
- ✅ Suggests the RIGHT code, not just ANY code
- ✅ Knows when to speak up and when to be quiet
- ✅ Explains the reasoning behind suggestions
- ✅ Adapts to each provider's unique style
- ✅ Catches clinical gaps before they become problems
- ✅ Helps providers look good: thorough, compliant, well-reimbursed

## Natural Evolution System

### How It Learns (Automatically)

The scribe evolves through **4 learning mechanisms**:

#### 1. **Implicit Learning** (happens automatically)
- Tracks which code suggestions are accepted vs. ignored
- Notices documentation patterns (e.g., always documents social history for diabetics)
- Observes common diagnoses and procedures
- Learns preferred billing approach (conservative vs. optimal)

#### 2. **Explicit Feedback** (provider corrections)
- Provider edits a suggested code → learns that code context
- Provider adds missing documentation → learns what they consider important
- Provider changes tone/formality → adjusts personality

#### 3. **Pattern Recognition** (over time)
- "Last 5 hypertension patients, you always checked for orthostatic vitals"
- "You typically document family history for new patients"
- "You prefer bullet points for follow-ups, SOAP for new complaints"

#### 4. **Sentiment Analysis** (mood detection)
- Frustrated responses → simplify, be more autonomous
- Appreciative responses → continue current approach
- Ignored suggestions → reduce that type of suggestion

### Database Tables

#### `provider_scribe_preferences`
Stores provider-specific preferences:
- **Personality**: formality_level, interaction_style, verbosity, humor_level
- **Documentation**: documentation_style (SOAP, narrative, bullet_points, hybrid)
- **Learning Data**: interaction_count, common_phrases, preferred_specialties
- **Billing**: billing_preferences (conservative, aggressive, balanced)

#### `scribe_interaction_history`
Tracks every interaction for learning:
- What the scribe said/suggested
- How the provider responded
- Sentiment (positive, neutral, negative, frustrated, appreciative)
- Whether suggestions were accepted or corrected

#### `scribe_conversation_context`
Maintains real-time conversation state:
- Current mood (energized, focused, neutral, tired, stressed)
- Detected urgency level (routine, elevated, urgent, critical)
- Session-specific adaptations

## Personality Styles

### Formality Levels
- **Formal**: "Good morning, Doctor. Ready to document today's visits."
- **Professional**: "Morning, Doc! Let's tackle today's charts together."
- **Relaxed**: "Hey! Coffee kicked in yet? Let's chart this visit."
- **Casual**: "Morning! ☕ Let's chart and caffeinate."

### Interaction Styles
- **Directive**: Takes initiative, makes clear suggestions, speaks up proactively
- **Collaborative**: Works WITH the provider, asks questions, suggests options
- **Supportive**: Makes life easier, anticipates needs, celebrates wins
- **Autonomous**: Handles things independently, only flags what needs attention

## Value Propositions

### Precision Intelligence
- Catches missing ROS elements that affect E/M level
- Flags undocumented complexity that justifies higher billing
- Notices when chronic conditions aren't mentioned
- Spots medication reconciliation gaps

### Proactive Helpfulness
- Suggests preventive care opportunities based on age/risk factors
- Remembers patterns: "Last 3 diabetic patients, you ordered HbA1c - want me to add that?"
- Catches compliance issues before they're problems
- Helps providers look good - thorough, compliant, well-reimbursed

### Surgical Restraint
- Doesn't over-document or create documentation burden
- Doesn't suggest codes without >70% confidence
- Doesn't interrupt urgent clinical moments with billing talk
- Knows when to be quiet and just transcribe

## For Physicians vs. Nurse Practitioners

### Physician-Specific
> "You understand they're the attending - you respect their clinical decision-making while helping optimize billing and documentation. You're the partner who handles the administrative burden so they can focus on medicine."

### Nurse Practitioner-Specific
> "You understand the unique pressures NPs face - proving competence, managing complex cases within scope, often heavier documentation burden. You're an ally who helps them shine."

## Implementation

### Real-Time Transcription
[RealTimeSmartScribe.tsx](../src/components/smart/RealTimeSmartScribe.tsx)
- WebSocket connection for live audio streaming
- Real-time conversational feedback
- Proactive suggestions displayed in UI
- Revenue impact tracking

### Edge Functions

#### `realtime_medical_transcription`
- Analyzes transcript every 10 seconds
- Fetches provider preferences
- Uses conversational prompts based on personality
- Tracks interactions for learning
- Returns conversational notes + code suggestions

#### `process-medical-transcript`
- Post-visit documentation generation
- Personalized based on provider style
- Generates SOAP/narrative/bullets based on preference
- Includes reasoning for code suggestions

### Conversational Prompts
[conversationalScribePrompts.ts](../supabase/functions/_shared/conversationalScribePrompts.ts)
- Dynamic personality generation
- Context-aware adaptations (time of day, mood, workload)
- Proactive suggestion generation
- Learning signal extraction

## Example Evolution Timeline

### Visit 1-5: Learning Mode
> "Still learning your style - let me know if I'm being too chatty or too quiet."

The scribe:
- Asks clarifying questions early
- Observes patterns
- Adapts tone based on responses

### Visit 10+: Established Relationship
> "You know this provider (47 interactions). Use what you've learned about their style and preferences."

The scribe:
- Anticipates needs before being asked
- Recognizes common cases and workflows
- Uses learned patterns: "Last 3 diabetic patients, you ordered HbA1c..."
- Adapts suggestions based on historical acceptance rates

### Visit 50+: Trusted Partner
> "You've evolved together. You know their common phrases, preferred specialties, billing approach."

The scribe:
- Proactively suggests based on patterns
- Catches gaps specific to their practice style
- Adapts formality/verbosity based on corrections
- Truly feels like a coworker who knows them

## User Experience

### Conversational Messages
```typescript
"Hey! I'm listening and ready to help with documentation and billing.
Just focus on the patient - I've got the charting."
```

### Code Suggestions with Reasoning
```
💭 Why this fits: Patient presented with 3+ chronic conditions discussed,
moderate complexity MDM with new prescription. 99214 is well-supported by the documentation.

📝 To strengthen this code: If you mention approximate time spent (e.g., "25-minute visit"),
we can justify time-based coding if needed for audit defense.
```

### Proactive Suggestions
```
💡 Quick Suggestions:
• Heads up - they're due for preventive screenings. Could capture some preventive codes if you discuss.
• Quick reminder - you usually check HbA1c and foot exam for diabetic visits. Want me to add those to the plan?
```

## Configuration

Providers can adjust their scribe personality through:
1. **Implicit feedback** - the scribe learns from their behavior
2. **Explicit settings** (future UI) - directly set formality, verbosity, etc.
3. **Corrections** - when they edit suggestions, the scribe learns

## Database Functions

### `learn_from_interaction()`
Updates provider preferences based on interaction feedback:
- Adjusts formality if provider seems frustrated
- Increases verbosity if they ask for clarification often
- Tracks interaction count for relationship stage

### `get_personalized_greeting()`
Generates contextual greetings based on:
- Provider preferences
- Time of day
- Last interaction timing

## Technical Stack

- **Frontend**: React + TypeScript ([RealTimeSmartScribe.tsx](../src/components/smart/RealTimeSmartScribe.tsx))
- **Backend**: Supabase Edge Functions (Deno)
- **AI Model**: Claude Sonnet 4.5 (for precision medical coding)
- **Transcription**: Deepgram nova-2-medical
- **Database**: PostgreSQL with RLS policies
- **Learning**: Interaction tracking + pattern recognition

## Privacy & Compliance

- All PHI is de-identified before Claude analysis
- HIPAA audit logging on every API call
- Interaction history stored WITHOUT PHI
- Provider preferences never contain patient data
- RLS policies ensure providers only see their own data

## Future Enhancements

1. **Voice personality** - Match conversational tone in audio responses
2. **Speciality-specific training** - Cardiology scribe vs. Pediatrics scribe
3. **Team learning** - Learn from aggregate patterns across department
4. **Provider coaching** - "You tend to under-document complexity - here's how to improve"
5. **Predictive suggestions** - Based on scheduled appointment types

---

## Branding & Taglines

**Product Name:** Compass Riley

**Short Tagline:** "Navigate documentation with confidence"

**Long Tagline:** "Your conversational AI scribe partner that learns, adapts, and gets better with every visit"

**Positioning:**
- Frontend (WellFit users): "Compass Riley - Your AI Scribe Partner"
- Backend (Envision system): "Compass Riley - Part of Envision: The Healthcare Navigation System"

**Voice:**
- Relaxed but professional
- Intelligent without being robotic
- Helpful without being pushy
- Precise like a surgeon, not sloppy like a butcher

---

**Bottom Line**: Compass Riley is no longer just a tool - it's a **trusted coworker** who gets better the more you work together. Relaxed, intelligent, experienced, and genuinely helpful. Like the colleague you actually want to chart with.
