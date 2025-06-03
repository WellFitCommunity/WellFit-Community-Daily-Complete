# Wellfit Community Daily

This application is designed for seniors to log their daily health data and for doctors to view this information.

**This application is deployed exclusively on Vercel.**

## Project Structure

The project follows a standard React application structure. Key directories include:
- `public/`: Contains static assets and the main `index.html` file.
- `src/`: Contains the main application source code.
    - `src/components/`: Reusable UI components.
    - `src/pages/`: Components that represent full pages/routes.
    - `src/contexts/`: React context providers.
    - `src/data/`: Static data, such as trivia questions.
    - `src/firebase/`: Firebase configuration and utility functions.
    - `src/lib/`: Client libraries, like the Supabase client.
    - `src/utils/`: General utility functions.
- `api/`: Potentially for serverless functions (if used with Vercel).
- `functions/`: Firebase Cloud Functions.
- `supabase/`: Supabase specific configurations, migrations, and functions.

## Key Features

*   Self-Reporting View for seniors to log:
    *   Blood Pressure (Systolic + Diastolic)
    *   Blood Sugar (mg/dL)
    *   Emotional State (Happy, Calm, Sad, Angry, Anxious, Confused, Tired, Lonely, Grateful, Hopeful)
    *   Heart Rate (bpm) (optional)
    *   Pulse Oximeter (SpO2 %) (optional)
    *   Notes or Symptoms (optional)
*   Secure data handling with Supabase for user data.

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
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

### Dependencies
All necessary production and development dependencies are listed in the `package.json` file. Install them using `npm install` or `yarn install`.

3.  Set up environment variables:
    Create a `.env` file in the project root and add the necessary Supabase URL and anon key:
    ```env
    REACT_APP_SUPABASE_URL=your_supabase_url
    REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
    # REACT_APP_ADMIN_SECRET=your_admin_secret_key (if still applicable after LockScreen rework)
    # Add any other relevant environment variables below:
    # EXAMPLE_VAR=example_value
    ```
    Refer to the codebase, particularly `src/config.ts` or similar, and component files for a complete list of environment variables used throughout the application. The `REACT_APP_ADMIN_SECRET` is related to an admin lock screen feature that is undergoing changes.
4.  (Add any Supabase migration/setup steps if applicable, e.g., `npx supabase db push`)

### Running Locally

```bash
npm start
# or
# yarn start
```
This will start the development server, typically on `http://localhost:3000`.

## Docs

Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).

## Breaking changes

We follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.

However, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in .
# Redeploy trigger
(This section might be from a template and used for CI/CD purposes)
