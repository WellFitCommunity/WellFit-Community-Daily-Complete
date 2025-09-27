// Environment configuration with validation for WellFit Community
import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // Anthropic API Configuration
  REACT_APP_ANTHROPIC_API_KEY: z.string()
    .min(1, "Anthropic API key is required")
    .refine(
      (key) => key.startsWith('sk-ant-'),
      "Anthropic API key must start with 'sk-ant-'"
    ),

  // Claude Model Configuration
  REACT_APP_CLAUDE_DEFAULT_MODEL: z.string().default("claude-3-5-sonnet-20241022"),
  REACT_APP_CLAUDE_ADMIN_MODEL: z.string().default("claude-3-5-sonnet-20241022"),
  REACT_APP_CLAUDE_MAX_TOKENS: z.coerce.number().default(4000),
  REACT_APP_CLAUDE_TIMEOUT: z.coerce.number().default(30000),

  // Environment info
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // App configuration
  REACT_APP_APP_NAME: z.string().default("WellFit Community"),
  REACT_APP_DEMO_ENABLED: z.coerce.boolean().default(false),
});

// Parse and validate environment variables
function parseEnvironment() {
  try {
    return envSchema.parse({
      REACT_APP_ANTHROPIC_API_KEY: process.env.REACT_APP_ANTHROPIC_API_KEY,
      REACT_APP_CLAUDE_DEFAULT_MODEL: process.env.REACT_APP_CLAUDE_DEFAULT_MODEL,
      REACT_APP_CLAUDE_ADMIN_MODEL: process.env.REACT_APP_CLAUDE_ADMIN_MODEL,
      REACT_APP_CLAUDE_MAX_TOKENS: process.env.REACT_APP_CLAUDE_MAX_TOKENS,
      REACT_APP_CLAUDE_TIMEOUT: process.env.REACT_APP_CLAUDE_TIMEOUT,
      NODE_ENV: process.env.NODE_ENV,
      REACT_APP_APP_NAME: process.env.REACT_APP_APP_NAME,
      REACT_APP_DEMO_ENABLED: process.env.REACT_APP_DEMO_ENABLED,
    });
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    throw new Error(`Environment configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export validated environment configuration
export const env = parseEnvironment();

// Validation function for runtime checks
export function validateEnvironment(): { success: boolean; message: string; details?: any } {
  try {
    const validatedEnv = parseEnvironment();
    console.log('✅ Environment variables validated successfully');

    return {
      success: true,
      message: 'Environment configuration is valid',
      details: {
        hasAnthropicKey: !!validatedEnv.REACT_APP_ANTHROPIC_API_KEY,
        defaultModel: validatedEnv.REACT_APP_CLAUDE_DEFAULT_MODEL,
        adminModel: validatedEnv.REACT_APP_CLAUDE_ADMIN_MODEL,
        environment: validatedEnv.NODE_ENV,
        appName: validatedEnv.REACT_APP_APP_NAME
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
    console.error('❌ Environment validation failed:', errorMessage);

    return {
      success: false,
      message: errorMessage,
      details: {
        hasAnthropicKey: !!process.env.REACT_APP_ANTHROPIC_API_KEY,
        keyFormat: process.env.REACT_APP_ANTHROPIC_API_KEY?.substring(0, 7) + '...',
        environment: process.env.NODE_ENV
      }
    };
  }
}

// Helper function to get sanitized environment info for debugging
export function getEnvironmentInfo() {
  return {
    nodeEnv: env.NODE_ENV,
    appName: env.REACT_APP_APP_NAME,
    demoMode: env.REACT_APP_DEMO_ENABLED,
    hasApiKey: !!env.REACT_APP_ANTHROPIC_API_KEY,
    keyPrefix: env.REACT_APP_ANTHROPIC_API_KEY?.substring(0, 7) + '...',
    defaultModel: env.REACT_APP_CLAUDE_DEFAULT_MODEL,
    adminModel: env.REACT_APP_CLAUDE_ADMIN_MODEL,
    maxTokens: env.REACT_APP_CLAUDE_MAX_TOKENS,
    timeout: env.REACT_APP_CLAUDE_TIMEOUT
  };
}