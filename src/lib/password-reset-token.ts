import { randomBytes } from 'node:crypto';

export type DecodedPasswordResetToken = {
  email: string;
  timestamp: number;
  randomStr: string;
  payload: string;
};

export function generatePasswordResetToken(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const timestamp = Date.now();
  const randomStr = randomBytes(12).toString('hex');
  const payload = `${normalizedEmail}:${timestamp}:${randomStr}`;
  return encodeURIComponent(Buffer.from(payload, 'utf-8').toString('base64'));
}

function decodeTokenPayload(token: string): string | null {
  try {
    return Buffer.from(decodeURIComponent(token), 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export function decodePasswordResetToken(token: string): DecodedPasswordResetToken | null {
  const payload = decodeTokenPayload(token);
  if (!payload) {
    return null;
  }

  const parts = payload.split(':');
  if (parts.length < 3) {
    return null;
  }

  const timestamp = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return {
    email: parts[0].trim().toLowerCase(),
    timestamp,
    randomStr: parts.slice(2).join(':'),
    payload,
  };
}

export function passwordResetTokensMatch(providedToken: string, storedToken: string): boolean {
  if (providedToken === storedToken) {
    return true;
  }

  const providedPayload = decodeTokenPayload(providedToken);
  const storedPayload = decodeTokenPayload(storedToken);
  return !!providedPayload && providedPayload === storedPayload;
}