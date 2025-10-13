# WellFit Community Daily

This application is designed for seniors to log their daily health data and for community health workers or doctors to view this information. It facilitates better tracking of well-being and provides timely data for health monitoring.

**This application is deployed exclusively on Vercel.**

> **🫀 Offline Mode Available:** WellFit works completely offline - perfect for rural areas with unreliable internet. See [Offline Guide](docs/OFFLINE_GUIDE.md).

## 📚 Documentation

- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Complete Vercel deployment instructions
- **[Offline Mode Guide](docs/OFFLINE_GUIDE.md)** - Offline functionality for rural healthcare
- **[Feature Documentation](docs/features/)** - Individual feature guides
- **[Security & Compliance](docs/security/)** - HIPAA, SOC2, security documentation
- **[Database Setup](docs/database/)** - Migrations, multi-tenancy, tenant setup
- **[All Documentation](docs/)** - Full documentation index

## Project Structure

The frontend codebase (`src` directory) is organized as follows:

*   `src/App.tsx`: Main application component with routing.
*   `src/index.tsx`: Entry point of the application.
*   `src/components/`: Contains reusable UI components, organized into subdirectories:
    *   `auth/`: Authentication-related components.
    *   `admin/`: Components for the admin panel.
    *   `dashboard/`: Widgets and elements for the user dashboard.
    *   `features/`: Components related to specific application features (e.g., photo uploads, emergency contacts).
    *   `layout/`: Structural components like Header, Footer, DemoBanner.
    *   `ui/`: Generic, highly reusable UI elements (e.g., Card, PageLayout).
*   `src/pages/`: Top-level components that act as views for different routes (e.g., `DashboardPage.tsx`, `WelcomePage.tsx`).
*   `src/contexts/`: React context providers (e.g., `DemoModeContext.tsx`).
*   `src/data/`: Static data like recipes, trivia questions.
*   `src/firebase/`: Firebase configuration and utility functions.
*   `src/lib/`: Core library initializations, like `supabaseClient.ts`.
*   `src/utils/`: General utility functions.
*   `src/scripts/`: Standalone scripts (e.g., data import scripts).
*   `api/`: Serverless functions deployed with Vercel, typically for backend tasks that require secure handling of API keys.
*   `functions/`: Firebase functions (Note: review if these are still actively used or if `api/` is the primary serverless approach for Vercel).

## Key Features

*   Self-Reporting View for seniors to log daily health metrics.
*   Dashboard for users to see an overview of meals, activities, and other information.
*   Admin Panel for staff/doctors to:
    *   View user data and reports.
    *   Manage users and API keys.
    *   Export data.
*   Secure data handling with Supabase.
*   Push notifications for reminders and alerts.

## Getting Started (Local Development)

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (comes with Node.js) or yarn
*   Supabase CLI (if you need to manage local Supabase instance or apply migrations) - [Installation Guide](https://supabase.com/docs/guides/cli)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```
3.  **Set up local environment variables:**
    Create a `.env` file in the project root. This file is for local development ONLY and should not be committed to Git. For Vercel deployment, environment variables must be set in the Vercel project settings.

    Copy the example below and replace the placeholder values with your actual keys:

    ```env
    # React App (Client-Side) Variables
    REACT_APP_SUPABASE_URL=your_supabase_url
    REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
    REACT_APP_WEATHER_API_KEY=your_openweathermap_api_key
    REACT_APP_FIREBASE_API_KEY=your_firebase_web_api_key
    REACT_APP_FIREBASE_VAPID_KEY=your_firebase_vapid_key_for_push_notifications
    REACT_APP_SUPABASE_EMAIL_ENDPOINT=your_mailer_function_url_for_welcome_email # e.g., Vercel serverless function URL

    # Serverless Functions / Scripts Variables (used in `api/` or `functions/` or `src/scripts`)
    # These might also be needed in your local .env if you run these services/scripts locally.
    # For Vercel deployment, these are set in the Vercel dashboard.

    SUPABASE_URL=your_supabase_url # Can be the same as REACT_APP_SUPABASE_URL
    SUPABASE_ANON_KEY=your_supabase_anon_key # Can be the same as REACT_APP_SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key # For admin-level backend operations

    MAILERSEND_API_KEY=your_mailersend_api_key # For sending emails via MailerSend
    MAILERSEND_FROM_EMAIL=your_sender_email_address # e.g., noreply@yourdomain.com, used by Supabase email functions

    # Twilio (for SMS, used by Vercel function api/send-sms.ts)
    TWILIO_ACCOUNT_SID=your_twilio_account_sid
    TWILIO_AUTH_TOKEN=your_twilio_auth_token
    TWILIO_PHONE_NUMBER=your_twilio_phone_number

    # Internal API Key (for securing Vercel serverless functions)
    INTERNAL_API_KEY=your_secure_internal_api_key

    # Admin Panel PIN (for Supabase function verify-admin-pin)
    ADMIN_PANEL_PIN=your_admin_panel_pin

    # Firebase Admin SDK (for Firebase Functions, if used)
    FIREBASE_PROJECT_ID=your_firebase_project_id
    FIREBASE_CLIENT_EMAIL=your_firebase_service_account_client_email
    FIREBASE_PRIVATE_KEY="your_firebase_service_account_private_key_with_newlines_preserved"
    # Note: For FIREBASE_PRIVATE_KEY, ensure newlines are correctly formatted if copying directly into Vercel.
    # Often, it's better to use Base64 encoding for multi-line secrets in Vercel.
    ```

    **Environment Variable Explanations:**

    *   `REACT_APP_SUPABASE_URL`, `SUPABASE_URL`: The URL for your Supabase project.
    *   `REACT_APP_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`: The public "anonymous" key for your Supabase project.
    *   `REACT_APP_WEATHER_API_KEY`: API key for a weather service (e.g., OpenWeatherMap) used by the WeatherWidget.
    *   `REACT_APP_FIREBASE_API_KEY`: Firebase API key for your web app (client-side SDK).
    *   `REACT_APP_FIREBASE_VAPID_KEY`: VAPID key for Firebase Cloud Messaging (push notifications).
    *   `REACT_APP_SUPABASE_EMAIL_ENDPOINT`: URL of the serverless function that handles sending welcome emails.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for backend operations requiring admin privileges (use with extreme caution).
    *   `MAILERSEND_API_KEY`: API key for MailerSend service.
    *   `MAILERSEND_FROM_EMAIL`: The email address used as the sender for emails sent via MailerSend by Supabase functions.
    *   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`: Credentials for Twilio SMS service.
    *   `INTERNAL_API_KEY`: A secret key used to authorize calls to your internal Vercel serverless functions.
    *   `ADMIN_PANEL_PIN`: PIN code for accessing the admin panel via the `verify-admin-pin` Supabase function.
    *   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: Credentials for Firebase Admin SDK, typically used in Firebase Functions for backend tasks.

### Running the Development Server

```bash
npm start
# or
# yarn start
# or
# npm run dev / yarn dev
```
This will start the React development server, usually on `http://localhost:3000`.

### Working with Supabase Locally (Optional)

If you need to run a local Supabase instance for backend development (e.g., testing database changes or edge functions):

1.  **Start Supabase services:**
    ```bash
    supabase start
    ```
2.  **Apply database migrations (if any new ones):**
    ```bash
    supabase db reset # Resets local db and applies all migrations
    # or
    # supabase migration up # Applies pending migrations
    ```
    (Refer to Supabase CLI documentation for more commands.)

## Deployment

This application is configured for deployment on **Vercel**.

**For complete deployment instructions, see [Deployment Guide](docs/DEPLOYMENT_GUIDE.md).**

Quick steps:
1.  Connect your Git repository to Vercel.
2.  Configure the Environment Variables listed above in your Vercel project settings.
3.  Vercel will build and deploy automatically on pushes to the main branch.

## Scripts

*   `npm run import:meals`: Runs a script to import meal data. Requires `ts-node` and relevant environment variables (e.g., `SUPABASE_URL`, `SUPABASE_ANON_KEY`) to be configured.
