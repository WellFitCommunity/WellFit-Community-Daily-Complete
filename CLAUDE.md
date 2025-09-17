# Claude Instructions for WellFit-Community-Daily-Complete

## Project Overview
This is a WellFit community application with daily features. The project uses TypeScript/React and includes user registration with hCaptcha integration.

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm run lint` - Run linting
- `npm run typecheck` - Run TypeScript type checking
- `npm test` - Run tests

## Key Files and Directories
- `src/components/` - React components
- `src/services/` - Service layer for API calls and business logic
- Registration flow includes hCaptcha widget integration

## Testing and Quality Assurance
Always run the following before considering work complete:
1. `npm run lint` - Ensure code style compliance
2. `npm run typecheck` - Verify TypeScript types
3. `npm test` - Run test suite if available

## Git Workflow
- Main branch: `main`
- Only commit when explicitly requested by the user
- Follow existing commit message patterns from git log

## Current Status
- Modified file: `src/components/HCaptchaWidget.tsx`
- Recent work includes registration flow improvements and hCaptcha integration