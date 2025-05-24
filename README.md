# Wellfit Community Daily

This application is designed for seniors to log their daily health data and for doctors to view this information.

**This application is deployed exclusively on Vercel.**

## Project Structure

(You can add a brief overview of the project structure here if needed.)

## Key Features

*   Self-Reporting View for seniors to log:
    *   Blood Pressure (Systolic + Diastolic)
    *   Blood Sugar (mg/dL)
    *   Emotional State (Happy, Calm, Sad, Angry, Anxious, Confused, Tired, Lonely, Grateful, Hopeful)
    *   Heart Rate (bpm) (optional)
    *   Pulse Oximeter (SpO2 %) (optional)
    *   Notes or Symptoms (optional)
*   Doctor's View (Admin Panel) to:
    *   Display each user's latest self-report.
    *   Group by user and filter by tenant.
    *   View a 45-day reporting history with charts/tables for key metrics.
    *   Export data as CSV.
    *   Print data for offline review.
*   Secure data handling with Supabase RLS for tenant separation.

## Getting Started

### Prerequisites

*   Node.js (specify version if known, e.g., v18 or later)
*   npm or yarn
*   Supabase account and project setup

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or
    # yarn install
    ```
3.  Set up environment variables:
    Create a `.env` file in the project root and add the necessary Supabase URL and anon key:
    ```env
    REACT_APP_SUPABASE_URL=your_supabase_url
    REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
    # Add any other required environment variables
    ```
4.  (Add any Supabase migration/setup steps if applicable, e.g., `npx supabase db push`)

### Running Locally

```bash
npm start
# or
# yarn start
```
This will typically start the development server at `http://localhost:3000`.

## Deployment Notes

This application is configured for deployment on Vercel.

### Vercel Build Process

1.  **Connect Git Repository:** Connect your GitHub/GitLab/Bitbucket repository to a new Vercel project.
2.  **Build Command:** Vercel typically auto-detects Create React App projects. The standard build command is `npm run build` or `yarn build`. This should be configured in the "Build & Development Settings" in Vercel.
3.  **Output Directory:** The output directory for Create React App is `build`. This should also be correctly configured in Vercel.
4.  **Environment Variables:** Ensure all necessary environment variables (like `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, etc.) are set in the Vercel project settings.

The `api/` directory contains serverless functions that will be deployed by Vercel.
The `public/` directory contains static assets.

## Self-Reporting View Fields

*   `user_id`: Identifier of the user submitting the report.
*   `timestamp`: Date and time of the report submission.
*   `tenant_id`: Identifier for the tenant (if using a multi-tenant model).
*   `blood_pressure_systolic`: Integer value.
*   `blood_pressure_diastolic`: Integer value.
*   `blood_sugar_mg_dl`: Integer value.
*   `emotional_state`: String, one of: Happy, Calm, Sad, Angry, Anxious, Confused, Tired, Lonely, Grateful, Hopeful. (Optional)
*   `heart_rate_bpm`: Integer value. (Optional)
*   `pulse_oximeter_spo2_percent`: Integer value. (Optional)
*   `notes_symptoms`: Text. (Optional)

### Emotional State Options

*   Happy
*   Calm
*   Sad
*   Angry
*   Anxious
*   Confused
*   Tired
*   Lonely
*   Grateful
*   Hopeful

## 45-Day Chart Behavior (Doctor's View)

The Doctor's View includes a section displaying a 45-day history for each user's self-reported data.
*   **Metrics Displayed:** Blood Pressure, Blood Sugar, Heart Rate, Pulse Oximeter, and Emotional State.
*   **Visualization:**
    *   Numerical data (Blood Pressure, Blood Sugar, Heart Rate, Pulse Oximeter) are typically shown as line graphs or in tabular format.
    *   Emotional State may be represented as a bar chart (distribution over time) or as daily label tags.
*   **No Data:** If a user has no self-reported data within the past 45 days, a message indicating this will be displayed.

## Testing

### User Form (Self-Reporting View)

1.  Navigate to the self-reporting page in the application.
2.  Fill in the health data fields.
3.  Submit the form.
4.  Verify that a confirmation message is shown.
5.  Check the `self_reports` table in your Supabase database to ensure the data was saved correctly with the correct `user_id` and `timestamp`.

### Doctor’s View Connection & 45-Day History

1.  Access the Admin Panel/Doctor's View.
2.  Verify that the latest self-report for users is displayed, including the Emotional State.
3.  Check that users are grouped and can be filtered by tenant (if applicable).
4.  Navigate to the 45-day reporting history section for a user with recent data.
5.  Confirm that line graphs or tables correctly display data for Blood Pressure, Blood Sugar, Heart Rate, and Pulse Oximeter.
6.  Verify that Emotional State is appropriately visualized (e.g., bar chart or tags).
7.  Test with a user who has no data in the past 45 days to ensure the "no data" message appears.

### CSV Export and Print Functionality

1.  In the Doctor's View, locate the export/print options for the 45-day history.
2.  **CSV Export:**
    *   Trigger the CSV export.
    *   Open the downloaded CSV file.
    *   Verify that all relevant data for the 45-day period is present and correctly formatted.
3.  **Print Functionality:**
    *   Trigger the print function.
    *   Review the print preview to ensure the data is well-formatted for printing.
    *   (If possible, print a test page.)

This README now includes the information from the original issue description regarding features, fields, and testing, which seems more appropriate than the Supabase CLI documentation.
