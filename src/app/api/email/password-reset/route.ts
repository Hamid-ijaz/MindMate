import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { userPrismaService } from '@/services/server/user-prisma-service';
import { generatePasswordResetToken } from '@/lib/password-reset-token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await userPrismaService.getUser(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({ 
        success: true, 
        message: 'If an account with this email exists, a password reset link has been sent.' 
      });
    }

    // Generate password reset token
    const resetToken = generatePasswordResetToken(email);
    const resetLink = `${process.env.NEXT_PUBLIC_URL || process.env.EMAIL_COMPANY_URL || 'http://localhost:9002'}/reset-password?token=${resetToken}`;

    // Store the reset token in the database with expiration
    await storePasswordResetToken(email, resetToken);

    const templateData = {
      userName: user.firstName || 'User',
      userEmail: email,
      resetLink,
      companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
      companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
      supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
    };

    const success = await emailService.sendPasswordResetEmail(email, templateData);

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Password reset email sent successfully' 
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in password-reset:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function storePasswordResetToken(email: string, token: string): Promise<void> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const now = new Date();

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: {
          email: normalizedEmail,
          used: false,
        },
        data: {
          used: true,
          usedAt: now,
        },
      }),
      prisma.passwordResetToken.create({
        data: {
          email: normalizedEmail,
          token,
          expiresAt,
        },
      }),
    ]);
  } catch (error) {
    console.error('Error storing password reset token:', error);
    throw error;
  }
}
