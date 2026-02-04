# Memory Lane Trivia - Technical Documentation

## Overview
Memory Lane Trivia is an enterprise-grade cognitive engagement system designed specifically for seniors. It provides daily era-based trivia questions from the 1950s-1990s with sophisticated cognitive function tracking, trophy rewards, and social sharing capabilities.

## Features

### Core Game Mechanics
- **Daily 5-Question Format**: 3 easy, 1 medium, 1 hard per day
- **Era Coverage**: 1950s through 1990s
- **170 Total Questions**: 70 easy, 50 medium, 50 hard
- **Deterministic Daily Selection**: Same questions for same user on same day
- **Progress Tracking**: Automatic save/resume functionality
- **One Play Per Day**: Encourages daily engagement

### Cognitive Benefits
Each question targets specific cognitive functions:
- **Episodic Memory** (Hippocampus): Personal experiences and events
- **Semantic Memory** (Temporal Lobe): Facts and general knowledge
- **Visual Memory** (Occipital Lobe): Recalling images and visual patterns
- **Working Memory** (Prefrontal Cortex): Complex associations
- **Recognition & Recall**: Pattern identification

### Reward System
- **Perfect Score Trophy**: Awarded for 5/5 correct answers
- **Confetti Animation**: 8-second celebration on perfect scores
- **Trophy Gallery**: Visual collection of past achievements
- **Trophy Display**: Shows up to 30 recent trophies with dates
- **Positive Reinforcement**: Encouraging messages regardless of score

### Social Features
- **Community Moments Integration**: Share scores with community
- **Achievement Sharing**: Post perfect scores and daily results
- **Encouragement Culture**: Always positive, never negative feedback

## Database Schema

### `memory_lane_trivia` Table
Stores all trivia questions with metadata.

```sql
CREATE TABLE memory_lane_trivia (
  id UUID PRIMARY KEY,
  question TEXT NOT NULL,
  era VARCHAR(10) NOT NULL,  -- '1950s', '1960s', etc.
  difficulty VARCHAR(10) NOT NULL,  -- 'easy', 'medium', 'hard'
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer VARCHAR(1) NOT NULL,  -- 'A', 'B', 'C', or 'D'
  cognitive_function VARCHAR(50) NOT NULL,
  brain_region VARCHAR(50) NOT NULL,
  explanation TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
```

### `user_trivia_progress` Table
Tracks daily user progress and performance.

```sql
CREATE TABLE user_trivia_progress (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  play_date DATE NOT NULL,
  questions_attempted JSONB NOT NULL DEFAULT '[]',
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 5,
  perfect_score BOOLEAN DEFAULT FALSE,
  cognitive_functions_trained JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, play_date)
);
```

### `user_trivia_trophies` Table
Stores trophy awards for perfect scores.

```sql
CREATE TABLE user_trivia_trophies (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  earned_date DATE NOT NULL,
  trophy_type VARCHAR(20) DEFAULT 'perfect_score',
  UNIQUE(user_id, earned_date)
);
```

## Database Function

### `get_daily_trivia_questions(p_user_id UUID)`
Deterministic function that returns 5 questions per day:
- Uses seeded randomization based on user_id + date
- Ensures same user gets same questions on same day
- Returns 3 easy, 1 medium, 1 hard
- Excludes inactive questions

## Component Architecture

### Main Component: `MemoryLaneTriviaPage.tsx`

**Location**: `/src/pages/MemoryLaneTriviaPage.tsx`

**Key Features**:
1. **State Management**: React hooks for game state
2. **Progress Persistence**: Auto-save to Supabase
3. **Confetti Integration**: react-confetti library
4. **Responsive Design**: Mobile-first approach
5. **Error Handling**: Graceful degradation

**Component States**:
- `loading`: Initial data fetch
- `questions`: Array of 5 daily questions
- `currentQuestionIndex`: Active question (0-4)
- `selectedAnswer`: User's choice
- `answeredCorrectly`: Boolean feedback
- `progress`: Score tracking
- `gameCompleted`: End state
- `showConfetti`: Trophy celebration
- `trophies`: User's trophy collection

## User Flow

1. **Entry**: Click "Memory Lane" button on dashboard
2. **Load**: Fetch today's 5 questions + existing progress
3. **Display**: Show first question with 4 options
4. **Answer**: User selects A, B, C, or D
5. **Feedback**: Immediate visual confirmation (2.5s)
6. **Progress**: Auto-advance to next question
7. **Complete**: Final score with trophy (if 5/5)
8. **Share**: Option to post to Community Moments
9. **Return**: "Come back tomorrow" message

## Positive Messaging System

15 rotating positive messages ensure encouragement:
- "Wonderful memory!"
- "You're amazing!"
- "Fantastic recall!"
- "Brilliant!"
- "You're a star!"
- "Incredible!"
- "Outstanding!"
- "Remarkable!"
- "Superb thinking!"
- "You're doing great!"
- "Keep it up!"
- "Excellent work!"
- "You've got this!"
- "Beautiful job!"
- "Way to go!"

**Philosophy**: No negative feedback, only encouragement.

## Integration Points

### Dashboard Integration
**File**: `/src/components/dashboard/SeniorCommunityDashboard.tsx`

Button location:
```typescript
<button onClick={() => navigate('/memory-lane-trivia')}>
  {t.dashboard.visitMemoryLane}
</button>
```

### Routing
**File**: `/src/App.tsx`

Route definition:
```typescript
<Route path="/memory-lane-trivia" element={
  <RequireAuth><MemoryLaneTriviaPage /></RequireAuth>
} />
```

## Dependencies

### New Libraries Added
```json
{
  "react-confetti": "^6.1.0",
  "react-use": "^17.4.0"
}
```

## Migration Files

### Required Migrations (in order):
1. `20251016_memory_lane_trivia.sql` - Schema creation
2. `20251016_trivia_seed_easy.sql` - 70 easy questions
3. `20251016_trivia_seed_medium.sql` - 50 medium questions
4. `20251016_trivia_seed_hard.sql` - 50 hard questions

### Running Migrations
```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase Dashboard
# Run each SQL file in order in the SQL Editor
```

## Security & Privacy

### Row Level Security (RLS)
- **Trivia Questions**: Read-only for authenticated users
- **User Progress**: Users can only view/edit their own data
- **Trophies**: Users can only view/insert their own trophies

### Data Privacy
- No PII stored in trivia tables
- User IDs linked via Supabase auth
- HIPAA-compliant data handling

## Performance Optimizations

1. **Lazy Loading**: Component loaded on-demand
2. **Indexes**: Efficient queries on user_id, play_date, difficulty
3. **Caching**: Deterministic function reduces computation
4. **Progress Saving**: Upsert pattern prevents duplicates
5. **Confetti Cleanup**: Auto-stop after 8 seconds

## Accessibility Features

1. **Large Text**: 2xl headings, lg body text
2. **High Contrast**: Clear color differentiation
3. **Button States**: Visual feedback on all interactions
4. **Error Messages**: Clear, non-technical language
5. **Loading States**: Progress indicators
6. **Keyboard Navigation**: Full keyboard support

## Future Enhancements

### Potential Additions:
1. **Difficulty Adaptation**: Adjust based on performance
2. **Category Selection**: Let users choose era focus
3. **Streaks**: Track consecutive days played
4. **Leaderboards**: Community rankings
5. **Audio Questions**: Voice-based trivia
6. **Team Mode**: Play with family/friends
7. **Bonus Questions**: Weekend challenges
8. **Historical Context**: Learn more about answers
9. **Photo Integration**: Visual trivia questions
10. **Multilingual Support**: Spanish, etc.

## Monitoring & Analytics

### Key Metrics to Track:
- Daily Active Users (DAU)
- Questions Answered
- Perfect Score Rate
- Average Score
- Trophy Distribution
- Cognitive Function Coverage
- Drop-off Rates
- Share-to-Community Rate

### Admin Dashboard Queries:
```sql
-- Daily engagement
SELECT play_date, COUNT(DISTINCT user_id) as players
FROM user_trivia_progress
GROUP BY play_date
ORDER BY play_date DESC;

-- Perfect score rate
SELECT
  play_date,
  COUNT(*) FILTER (WHERE perfect_score = true) * 100.0 / COUNT(*) as perfect_rate
FROM user_trivia_progress
WHERE completed_at IS NOT NULL
GROUP BY play_date;

-- Cognitive functions trained
SELECT
  jsonb_array_elements_text(cognitive_functions_trained) as function,
  COUNT(*) as times_trained
FROM user_trivia_progress
GROUP BY function
ORDER BY times_trained DESC;
```

## Support & Troubleshooting

### Common Issues:

**"No questions loading"**
- Check database migrations ran successfully
- Verify RLS policies are active
- Confirm user is authenticated

**"Already played today" but user wants to replay**
- This is by design - one play per day
- Check `play_date` in `user_trivia_progress`
- Can reset for testing: `DELETE WHERE play_date = CURRENT_DATE`

**Trophy not appearing**
- Check `user_trivia_trophies` table
- Verify perfect_score = true in progress
- Confirm trophy component is rendering

## Testing Checklist

- [ ] New user can start game
- [ ] Questions display correctly
- [ ] Answer selection works
- [ ] Correct/incorrect feedback shows
- [ ] Progress saves between questions
- [ ] Score calculates correctly
- [ ] Perfect score triggers confetti
- [ ] Trophy awarded on 5/5
- [ ] Trophy gallery displays
- [ ] Share to Community works
- [ ] Can't replay same day
- [ ] New questions next day
- [ ] Mobile responsive
- [ ] Accessibility compliance
- [ ] RLS policies enforced

## Credits

**Design Philosophy**: Positive reinforcement, cognitive engagement, social connection

**Target Audience**: Seniors aged 60+, especially those who lived through 1950s-1990s

**Cognitive Science**: Based on memory recall, pattern recognition, and associative learning principles

**Build Date**: October 16, 2025

---

*This feature was created with love to help seniors stay mentally sharp, socially connected, and joyfully engaged with their memories. Every question is an opportunity to reminisce, learn, and celebrate a life well-lived.* ❤️

