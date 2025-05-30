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
supabase bootstrap
```

Or using npx:

```bash
npx supabase bootstrap
```

The bootstrap command will guide you through the process of setting up a Supabase project using one of the [starter](https://github.com/supabase-community/supabase-samples/blob/main/samples.json) templates.

## Docs

Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).

## Breaking changes

We follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.

However, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in package.json.

## Developing

To run from source:

```sh
# Go >= 1.22
go run . help
```
# Redeploy trigger
