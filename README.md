# WellFit Community Platform - Alpha

Welcome to the WellFit Community Platform! This application is designed to support senior wellness through community engagement, self-reporting, and cognitive activities.

## Core Features

### 1. Onboarding Flow

The platform features a streamlined onboarding process for new users:

1.  **Enrollment:** Users begin by completing an enrollment form (`SeniorEnrollmentPage`) to provide their basic information.
2.  **Photo Consent:** After enrollment, users are directed to the Photo Consent page (`/consent-photo`). Here, they provide their full name and a digital signature to consent to the use of their photo and likeness for community wellness purposes within the platform.
3.  **Privacy Policy Agreement:** Next, users proceed to the Privacy Policy Agreement page (`/consent-privacy`). They must agree to the platform's privacy policy by checking a confirmation box. This step finalizes the consent process, and the signature from the photo consent is associated with this agreement.
4.  **Dashboard Access:** Upon successful completion of the consent process, users are navigated to their personalized application dashboard (`/dashboard`), gaining access to all platform features.

### 2. Self-Reporting View (Daily Check-in)

The self-reporting feature allows users to log their daily well-being:

*   **Access:** Users can access this feature from their dashboard via the "📝 My Daily Check-in" link, which navigates to the `/checkin` page (currently `CheckInTracker.tsx`).
*   **Input Fields:** The enhanced view now includes:
    *   **Emotional State:** A mandatory dropdown selection (e.g., Happy, Calm, Anxious).
    *   **Heart Rate:** An optional numeric input for Beats Per Minute (BPM).
    *   **Pulse Oximeter:** An optional numeric input for SpO2 percentage.
*   **Data Storage:** These new fields, along with any quick status updates selected by the user (e.g., "😊 Feeling Great Today", "🚨 Fallen down & injured"), are saved to the user's record in the `checkins` table in the Supabase database. *Refer to "Known Issues & Important Notes" regarding necessary database updates.*

### 3. Trivia Game System

To promote cognitive engagement, a daily trivia game is available:

*   **Access:** Users can play the game via the "🏆 Daily Trivia Challenge" link on their dashboard, which leads to the `/trivia-game` page.
*   **Format:** The game currently presents 5 questions per session. The selection aims for a mix of difficulties:
    *   3 Easy questions
    *   1 Medium question
    *   1 Hard question
*   **Question Pool:** Questions are drawn from a predefined list stored in `src/data/triviaQuestions.ts`.
*   **Cognitive Labels:** Each question is associated with a cognitive label (e.g., Memory Recall, Problem Solving, General Knowledge) to inform users about the skills being exercised.
*   **Scoring & Affirmation:** At the end of the game, users receive their score and a positive affirmation message.
*   **Future Enhancement:** A 30-day rotation system for questions is planned to ensure variety and sustained engagement. *Refer to "Known Issues & Important Notes."*

## Known Issues & Important Notes

This section outlines critical considerations for the current state of the application.

### Database Update for Self-Reporting

*   ❌ **Feature:** Enhanced Self-Reporting Data Storage
*   ⚠️ **Why it fails or what’s missing:** The application has been updated to collect Emotional State, Heart Rate, and Pulse Oximeter readings. However, these fields will not be saved to the database until the `checkins` table in Supabase is updated with new columns.
*   ✅ **Suggestions to fix or continue:** Apply the following SQL changes to your Supabase database:
    ```sql
    ALTER TABLE public.checkins
    ADD COLUMN emotional_state TEXT,
    ADD COLUMN heart_rate INTEGER,
    ADD COLUMN pulse_oximeter INTEGER;

    -- Optional: Add comments for clarity
    COMMENT ON COLUMN public.checkins.emotional_state IS 'User-reported emotional state at the time of check-in.';
    COMMENT ON COLUMN public.checkins.heart_rate IS 'User-reported heart rate in beats per minute (BPM).';
    COMMENT ON COLUMN public.checkins.pulse_oximeter IS 'User-reported pulse oximeter reading as a percentage (SpO2).';
    ```

### Doctor's View & Export Verification

*   ❌ **Feature:** Doctor's View and Data Export for new Self-Report fields.
*   ⚠️ **Why it fails or what’s missing:** The self-reporting form now collects additional data points (Emotional State, Heart Rate, Pulse Oximeter). Verification is needed to ensure these new fields are correctly displayed in any existing Doctor's View interface and are included in data exports.
*   ✅ **Suggestions to fix or continue:** Manually test the Doctor's View and any data export functionality after applying the database schema changes to confirm the new fields are present and accurate. Update those components if necessary.

### Trivia Question Pool & Rotation

*   ❌ **Feature:** Trivia Game 30-Day Rotation
*   ⚠️ **Why it fails or what’s missing:** The current trivia game uses a small sample of questions and selects them randomly per session. A full 30-day rotating question cycle with a larger question bank is not yet implemented.
*   ✅ **Suggestions to fix or continue:** Expand the `triviaQuestions.ts` file with a significantly larger pool of questions (at least 150 questions for a 30-day cycle of 5 unique questions per day). Implement a date-based or more sophisticated rotation logic in `TriviaGame.tsx` to ensure question variety and rotation.

## Developing

To run from source (assuming a Go backend, which might not be relevant for a React/Supabase app):

```sh
# Go >= 1.22 (This section might be from a template and may not apply)
# For React/Vite based projects, typically:
# npm install
# npm run dev
# or
# yarn
# yarn dev
go run . help
```
# Redeploy trigger
(This section might be from a template and used for CI/CD purposes)
