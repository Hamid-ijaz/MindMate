import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { userService } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      emails, 
      teamId, 
      teamName, 
      inviterEmail, 
      role = 'member',
      customMessage 
    } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'emails array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!teamId || !teamName || !inviterEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: teamId, teamName, inviterEmail' },
        { status: 400 }
      );
    }

    // Get the inviter's information
    const inviterUser = await userService.getUser(inviterEmail);
    if (!inviterUser) {
      return NextResponse.json(
        { error: 'Inviter user not found' },
        { status: 404 }
      );
    }

    const results = [];

    for (const email of emails) {
      try {
        // Generate invitation token
        const inviteToken = generateInviteToken(email, teamId, role);
        const inviteLink = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/team/invite?token=${inviteToken}`;

        // Store the invitation in the database
        await storeTeamInvitation({
          email,
          teamId,
          teamName,
          inviterEmail,
          role,
          inviteToken,
          customMessage,
        });

        const templateData = {
          teamName,
          inviterName: inviterUser.firstName || 'Someone',
          inviteLink,
          customMessage,
          role,
          companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
          companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
          supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
        };

        const success = await emailService.sendTeamInvitationEmail(email, templateData);

        results.push({
          email,
          success,
          message: success ? 'Invitation sent successfully' : 'Failed to send invitation',
        });
      } catch (error) {
        console.error(`Error sending invitation to ${email}:`, error);
        results.push({
          email,
          success: false,
          message: 'Error sending invitation',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount}/${totalCount} invitations sent successfully`,
      results,
    });
  } catch (error) {
    console.error('Error in team-invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateInviteToken(email: string, teamId: string, role: string): string {
  // Simple implementation - in production, use proper JWT or secure token generation
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const token = Buffer.from(`${email}:${teamId}:${role}:${timestamp}:${randomStr}`).toString('base64');
  return encodeURIComponent(token);
}

async function storeTeamInvitation(inviteData: {
  email: string;
  teamId: string;
  teamName: string;
  inviterEmail: string;
  role: string;
  inviteToken: string;
  customMessage?: string;
}): Promise<void> {
  try {
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    await db.collection('teamInvitations').add({
      ...inviteData,
      status: 'pending',
      createdAt: new Date(),
      expiresAt,
      acceptedAt: null,
      rejectedAt: null,
    });
  } catch (error) {
    console.error('Error storing team invitation:', error);
    throw error;
  }
}
