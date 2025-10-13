# Style Guide - WellFit Community App

This document outlines the core visual styles and common UI components used in the WellFit Community application to ensure consistency.

## 1. Branding Colors

Colors are managed via the branding configuration (`src/branding.config.ts`) and applied dynamically. Common roles include:

*   **Primary Color**: Used for main headers, footers, and primary action buttons. (e.g., `branding.primaryColor`)
*   **Secondary Color**: Used for accents, secondary buttons, or hover states. (e.g., `branding.secondaryColor`)
*   **Text Color**: Default text color, often dynamically chosen for contrast with background colors. (e.g., `branding.textColor`)
*   **WellFit Green**: A common specific brand color (e.g., `#8cc63f` or `border-wellfit-green`).
*   **WellFit Blue**: Another common specific brand color (e.g., `#003865` or `text-wellfit-blue`).

## 2. Typography

Font sizes aim for readability, especially for seniors. Responsive sizes are used where appropriate.

*   **Page Titles (h1)**: `text-2xl sm:text-3xl md:text-4xl font-bold` (Example: `SelfReportingPage.tsx`)
*   **Section Titles (h2)**: `text-xl sm:text-2xl font-bold` or `text-lg sm:text-xl font-semibold` (Examples: `CommunityMoments.tsx`, `Dashboard.tsx`)
*   **Card Titles/Subheadings (h3)**: `text-lg font-semibold` (Example: `WeatherWidget.tsx`)
*   **Body Text**: Default paragraph size, often `text-base`.
*   **Labels / Secondary Text**: `text-base` or `text-sm` where appropriate (e.g., form labels `text-base`, footer details `text-sm`). We aim for `text-base` for most interactive element labels.

## 3. Buttons

### Primary Action Button
*   **Description**: Used for the main call to action on a page or form.
*   **Styling**: Typically full-width, prominent background color (often `branding.primaryColor`), white or contrasting text.
*   **Tailwind Classes (Example from `LoginPage.tsx`)**: `w-full py-3 font-semibold rounded hover:opacity-90 transition-opacity ${primaryButtonTextColor} focus:outline-none focus:ring-2 focus:ring-offset-2` (background color set via style attribute).
*   **Example (Submit Report on `SelfReportingPage.tsx`)**: `w-full text-white font-semibold py-3 px-6 rounded-lg text-xl shadow-md transition-opacity duration-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white` (background via style).

### Secondary/Utility Buttons
*   **Description**: Used for less prominent actions, navigation, or alternative choices.
*   **Styling**: Can vary. Often uses `branding.secondaryColor` or lighter background with brand-colored text.
*   **Tailwind Classes (Example - Quick Check-In on `CheckInTracker.tsx`)**: `w-full py-3 px-4 bg-[#8cc63f] border-2 border-[#003865] text-white font-semibold rounded-lg shadow-md hover:bg-[#77aa36] transition disabled:bg-gray-400 ...`

### Disabled State
*   **Styling**: Typically reduced opacity (`disabled:opacity-50` or `disabled:opacity-60`), sometimes a gray background (`disabled:bg-gray-300` or `disabled:bg-gray-400`), and `cursor-not-allowed`.

## 4. Forms

### Labels
*   **Styling**: Visible, clear text.
*   **Tailwind Classes (Example from `LoginPage.tsx`)**: `block text-base font-medium text-gray-700 mb-1 text-left`

### Input Fields (text, tel, password, number)
*   **Styling**: Full-width, clear border, adequate padding.
*   **Tailwind Classes (Example from `LoginPage.tsx`)**: `w-full p-3 border border-gray-300 rounded focus:ring-2 focus:outline-none` (specific border/ring colors often from branding).
*   **Example (from `SelfReportingPage.tsx`)**: `mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50` (Note: `sm:text-sm` here might be an area for future review if `text-base` is preferred globally for inputs).

### Select Dropdowns
*   **Styling**: Similar to input fields.
*   **Tailwind Classes (Example from `SelfReportingPage.tsx`)**: `mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50`

### Textareas
*   **Styling**: Similar to input fields, with multiple rows.
*   **Tailwind Classes (Example from `SelfReportingPage.tsx`)**: `mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50`

## 5. Cards
*   **Description**: Common container for content blocks.
*   **Styling**: White background, rounded corners, shadow, padding, and a distinctive left border.
*   **Tailwind Classes (from `Card.tsx`)**: `bg-white rounded-2xl shadow-md p-4 sm:p-6 mb-6 border-l-8 border-wellfit-green ${className}` (accepts additional classes).

## 6. Alerts / Feedback Messages
*   **Description**: Used to convey success, error, or informational messages.
*   **Styling**: Background color indicates type, typically with contrasting text.
*   **Tailwind Classes (Example for error on `LoginPage.tsx`)**: `text-red-500 text-sm font-semibold` (Note: this is inline text, full block alerts have different styling).
*   **Example (Block message on `SelfReportingPage.tsx` - Success)**: `text-green-600 bg-green-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium`
*   **Example (Block message on `SelfReportingPage.tsx` - Error)**: `text-red-600 bg-red-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium`

---
*This style guide is a living document and should be updated as the application evolves.*
