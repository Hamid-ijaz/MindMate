import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, userName, action } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    const templateData = {
      userName,
      userEmail,
      companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
      companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
      supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
    };

    let success = false;

    switch (action) {
      case 'welcome':
        success = await emailService.sendWelcomeEmail(userEmail, templateData);
        break;
      case 'verification':
        const verificationLink = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/verify-email?token=${generateVerificationToken(userEmail)}`;
        success = await emailService.sendVerificationEmail(userEmail, {
          ...templateData,
          verificationLink,
        });
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: welcome, verification' },
          { status: 400 }
        );
    }

    if (success) {
      return NextResponse.json({ success: true, message: 'Email sent successfully' });
    } else {
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in send-welcome-email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate verification token (you might want to use JWT or a proper token service)
function generateVerificationToken(email: string): string {
  // Simple implementation - in production, use proper JWT or secure token generation
  const timestamp = Date.now();
  const token = Buffer.from(`${email}:${timestamp}`).toString('base64');
  return encodeURIComponent(token);
}
