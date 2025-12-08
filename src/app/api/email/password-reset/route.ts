import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { userService } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await userService.getUser(email);
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

// Helper functions
function generatePasswordResetToken(email: string): string {
  // Simple implementation - in production, use proper JWT or secure token generation
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const token = Buffer.from(`${email}:${timestamp}:${randomStr}`).toString('base64');
  return encodeURIComponent(token);
}

async function storePasswordResetToken(email: string, token: string): Promise<void> {
  try {
    // Store in Firestore with 1 hour expiration
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    
    // You can implement this in your firestore service
    // For now, we'll add it to a password_reset_tokens collection
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const db = getFirestore();
    await db.collection('passwordResetTokens').doc(email).set({
      token,
      email,
      expiresAt,
      createdAt: new Date(),
      used: false,
    });
  } catch (error) {
    console.error('Error storing password reset token:', error);
    throw error;
  }
}
