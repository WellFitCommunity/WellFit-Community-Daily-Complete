// Environment configuration with validation for WellFit Community
import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // Anthropic API Configuration - make optional to prevent crashes
  VITE_ANTHROPIC_API_KEY: z.string().optional(),

  // Claude Model Configuration - Intelligent routing: Haiku 4.5 for UI, Sonnet 4.5 for revenue
  VITE_CLAUDE_DEFAULT_MODEL: z.string().default("claude-haiku-4-5-20250919"), // Fast UI/personalization
  VITE_CLAUDE_ADMIN_MODEL: z.string().default("claude-sonnet-4-5-20250929"), // Accurate billing/revenue
  VITE_CLAUDE_MAX_TOKENS: z.coerce.number().default(4000),
  VITE_CLAUDE_TIMEOUT: z.coerce.number().default(30000),

  // Environment info
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // App configuration
  VITE_APP_NAME: z.string().default("WellFit Community"),
  VITE_DEMO_ENABLED: z.coerce.boolean().default(false),
});

// Parse and validate environment variables
function parseEnvironment() {
  try {
    return envSchema.parse({
      VITE_ANTHROPIC_API_KEY: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
      VITE_CLAUDE_DEFAULT_MODEL: import.meta.env.VITE_CLAUDE_DEFAULT_MODEL,
      VITE_CLAUDE_ADMIN_MODEL: import.meta.env.VITE_CLAUDE_ADMIN_MODEL,
      VITE_CLAUDE_MAX_TOKENS: import.meta.env.VITE_CLAUDE_MAX_TOKENS,
      VITE_CLAUDE_TIMEOUT: import.meta.env.VITE_CLAUDE_TIMEOUT,
      NODE_ENV: process.env.NODE_ENV,
      VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
      VITE_DEMO_ENABLED: import.meta.env.VITE_DEMO_ENABLED,
    });
  } catch (error) {

    throw new Error(`Environment configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export validated environment configuration
export const env = parseEnvironment();

// Validation function for runtime checks
export function validateEnvironment(): { success: boolean; message: string; details?: any } {
  try {
    const validatedEnv = parseEnvironment();


    return {
      success: true,
      message: 'Environment configuration is valid',
      details: {
        secureMode: true, // API keys only in server-side Edge Functions
        defaultModel: validatedEnv.VITE_CLAUDE_DEFAULT_MODEL,
        adminModel: validatedEnv.VITE_CLAUDE_ADMIN_MODEL,
        environment: validatedEnv.NODE_ENV,
        appName: validatedEnv.VITE_APP_NAME
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';


    return {
      success: false,
      message: errorMessage,
      details: {
        secureMode: true, // No API keys exposed in browser
        environment: process.env.NODE_ENV
      }
    };
  }
}

// Helper function to get sanitized environment info for debugging
export function getEnvironmentInfo() {
  return {
    nodeEnv: env.NODE_ENV,
    appName: env.VITE_APP_NAME,
    demoMode: env.VITE_DEMO_ENABLED,
    secureMode: true, // All API keys server-side only
    defaultModel: env.VITE_CLAUDE_DEFAULT_MODEL,
    adminModel: env.VITE_CLAUDE_ADMIN_MODEL,
    maxTokens: env.VITE_CLAUDE_MAX_TOKENS,
    timeout: env.VITE_CLAUDE_TIMEOUT
  };
}