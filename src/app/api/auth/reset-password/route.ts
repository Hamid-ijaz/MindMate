import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userPrismaService } from '@/services/server/user-prisma-service';
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
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Decode token to get email
    const decodedToken = decodePasswordResetToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    // Validate token one more time
    const tokenRecord = await findTokenRecord(token, decodedToken.email);
    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    if (!passwordResetTokensMatch(token, tokenRecord.token)) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      );
    }

    if (new Date() > tokenRecord.expiresAt) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 400 }
      );
    }

    if (tokenRecord.used) {
      return NextResponse.json(
        { error: 'Token has already been used' },
        { status: 400 }
      );
    }

    // Update user password
    try {
      const updatedUser = await userPrismaService.updateUser(decodedToken.email, {
        password: newPassword,
      });

      if (!updatedUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Mark token as used
      await prisma.passwordResetToken.update({
        where: {
          id: tokenRecord.id,
        },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully',
      });

    } catch (error) {
      console.error('Error updating password:', error);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in reset password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
