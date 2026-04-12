import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { userPrismaService } from '@/services/server/user-prisma-service';

const AUTH_COOKIE_KEY = 'mindmate-auth';
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function safeCompare(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return result === 0;
}

const getAuthCookieSecret = (): string => {
  return (
    process.env.AUTH_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  );
};

const signCookiePayload = (payload: string, secret: string): string => {
  return createHmac('sha256', secret).update(payload).digest('base64url');
};

const encodePayload = (email: string): string => {
  return Buffer.from(email, 'utf8').toString('base64url');
};

const decodePayload = (payload: string): string | null => {
  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8').trim().toLowerCase();
    return decoded.includes('@') ? decoded : null;
  } catch {
    return null;
  }
};

export function createSignedAuthCookie(email: string): string | null {
  const secret = getAuthCookieSecret();
  const normalizedEmail = email.trim().toLowerCase();

  if (!secret || !normalizedEmail || !normalizedEmail.includes('@')) {
    return null;
  }

  const payload = encodePayload(normalizedEmail);
  const signature = signCookiePayload(payload, secret);
  return `${payload}.${signature}`;
}

export function parseSignedAuthCookie(cookieValue?: string | null): string | null {
  if (!cookieValue) {
    return null;
  }

  const secret = getAuthCookieSecret();
  if (!secret) {
    return null;
  }

  const [payload, providedSignature] = cookieValue.split('.', 2);
  if (!payload || !providedSignature) {
    return null;
  }

  const expectedSignature = signCookiePayload(payload, secret);
  if (!safeCompare(expectedSignature, providedSignature)) {
    return null;
  }

  return decodePayload(payload);
}

export function setAuthCookie(response: NextResponse, email: string): void {
  const signedValue = createSignedAuthCookie(email);
  if (!signedValue) {
    return;
  }

  response.cookies.set(AUTH_COOKIE_KEY, signedValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_KEY, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const configuredToken = process.env.CRON_AUTH_TOKEN;
  if (!configuredToken) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return false;
  }

  const providedToken = authorization.slice('Bearer '.length).trim();
  if (!providedToken) {
    return false;
  }

  return safeCompare(configuredToken, providedToken);
}

export function isInternalServiceRequest(request: NextRequest): boolean {
  const configuredKey = process.env.INTERNAL_API_KEY;
  if (!configuredKey) {
    return false;
  }

  const providedKey = request.headers.get('x-internal-api-key');
  if (!providedKey) {
    return false;
  }

  return safeCompare(configuredKey, providedKey);
}

/**
 * Get authenticated user email from request
 * This function will:
 * 1. Validate signed `mindmate-auth` cookie and ensure user exists
 * 2. Fallback to internal `x-user-email` header for server-to-server calls
 */
export async function getAuthenticatedUserEmail(request: NextRequest): Promise<string | null> {
  try {
    // 1) Signed cookie-based auth.
    const cookieValue = request.cookies.get(AUTH_COOKIE_KEY)?.value;
    const cookieEmail = parseSignedAuthCookie(cookieValue);

    if (cookieEmail) {
      try {
        const user = await userPrismaService.getUser(cookieEmail);
        if (user) {
          return cookieEmail;
        }
      } catch (err) {
        console.warn('User lookup failed while resolving auth cookie:', err);
      }
    }

    // 2) Internal header override for server-to-server calls.
    // This path is only allowed when INTERNAL_API_KEY is configured and valid.
    const headerEmail = request.headers.get('x-user-email');
    if (headerEmail && isInternalServiceRequest(request)) {
      const normalizedHeaderEmail = headerEmail.trim().toLowerCase();
      if (normalizedHeaderEmail.includes('@')) {
        return normalizedHeaderEmail;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Validate user has permission to access resource
 */
export async function validateUserAccess(
  request: NextRequest, 
  resourceUserEmail: string
): Promise<boolean> {
  const currentUserEmail = await getAuthenticatedUserEmail(request);
  return currentUserEmail === resourceUserEmail;
}

/**
 * Get user ID from email (if your system uses separate user IDs)
 */
export async function getUserIdFromEmail(email: string): Promise<string | null> {
  // TODO: Implement based on your user system
  // This might involve a database lookup to get user ID from email
  return email; // Using email as ID for simplicity
}
