/**
 * CSRF Protection
 *
 * Implements Double Submit Cookie pattern for CSRF protection
 * Compatible with SPA architecture and stateless API
 *
 * OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'wf_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('base64url');
}

/**
 * Hash a CSRF token for cookie storage (prevents token fixation attacks)
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/**
 * Set CSRF token as an HTTP-only cookie
 */
export function setCsrfCookie(res: VercelResponse, token: string): void {
  const hashedToken = hashToken(token);

  // Set cookie with secure flags
  res.setHeader('Set-Cookie', [
    `${CSRF_COOKIE_NAME}=${hashedToken}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    'Max-Age=3600' // 1 hour
  ].filter(Boolean).join('; '));
}

/**
 * Validate CSRF token from request
 *
 * Implements Double Submit Cookie pattern:
 * 1. Token in cookie (hashed, HTTP-only)
 * 2. Token in header (raw, sent by client JavaScript)
 *
 * @returns true if valid, false otherwise
 */
export function validateCsrfToken(req: VercelRequest): boolean {
  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  if (!headerToken) {
    return false;
  }

  // Get hashed token from cookie
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return false;
  }

  const csrfCookie = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!csrfCookie) {
    return false;
  }

  const cookieToken = csrfCookie.substring(CSRF_COOKIE_NAME.length + 1);

  // Compare hashed header token with cookie value
  const hashedHeaderToken = hashToken(headerToken);
  return hashedHeaderToken === cookieToken;
}

/**
 * CSRF protection middleware
 *
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   const csrfValid = await csrfProtection(req, res);
 *   if (!csrfValid) return; // Response already sent
 *
 *   // Continue with request handling
 * }
 * ```
 */
export async function csrfProtection(
  req: VercelRequest,
  res: VercelResponse
): Promise<boolean> {
  // Skip CSRF validation for safe methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }

  // Validate CSRF token
  const isValid = validateCsrfToken(req);

  if (!isValid) {
    res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid or missing CSRF token. Include X-CSRF-Token header.'
    });
    return false;
  }

  return true;
}

/**
 * Edge Runtime CSRF validation
 */
export function validateCsrfTokenEdge(req: Request): boolean {
  // Get token from header
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) {
    return false;
  }

  // Get hashed token from cookie
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) {
    return false;
  }

  const csrfCookie = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!csrfCookie) {
    return false;
  }

  const cookieToken = csrfCookie.substring(CSRF_COOKIE_NAME.length + 1);

  // Compare hashed header token with cookie value
  const hashedHeaderToken = hashToken(headerToken);
  return hashedHeaderToken === cookieToken;
}

/**
 * Edge Runtime CSRF protection
 */
export async function csrfProtectionEdge(req: Request): Promise<Response | null> {
  // Skip CSRF validation for safe methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return null;
  }

  // Validate CSRF token
  const isValid = validateCsrfTokenEdge(req);

  if (!isValid) {
    return new Response(
      JSON.stringify({
        error: 'CSRF validation failed',
        message: 'Invalid or missing CSRF token. Include X-CSRF-Token header.'
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return null;
}
