import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decodePasswordResetToken, passwordResetTokensMatch } from '@/lib/password-reset-token';

async function findTokenRecord(token: string, email: string) {
  const direct = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (direct) {
    return direct;
  }

  const candidates = await prisma.passwordResetToken.findMany({
    where: { email },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    candidates.find((candidate: { token: string }) =>
      passwordResetTokensMatch(token, candidate.token)
    ) ?? null
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, message: 'Token is required' },
        { status: 400 }
      );
    }

    // Decode and validate token
    const decodedToken = decodePasswordResetToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { valid: false, message: 'Invalid token format' },
        { status: 400 }
      );
    }

    // Check if token exists in database and is not expired
    const tokenRecord = await findTokenRecord(token, decodedToken.email);
    if (!tokenRecord) {
      return NextResponse.json(
        { valid: false, message: 'Token not found' },
        { status: 404 }
      );
    }

    if (!passwordResetTokensMatch(token, tokenRecord.token)) {
      return NextResponse.json(
        { valid: false, message: 'This reset link is no longer valid. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Check if token is expired
    const expiresAt = tokenRecord.expiresAt;
    const now = new Date();
    
    if (now > expiresAt) {
      return NextResponse.json(
        { valid: false, message: 'Token has expired' },
        { status: 400 }
      );
    }

    // Check if token has already been used
    if (tokenRecord.used) {
      return NextResponse.json(
        { valid: false, message: 'Token has already been used' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: decodedToken.email,
    });

  } catch (error) {
    console.error('Error validating reset token:', error);
    return NextResponse.json(
      { valid: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
