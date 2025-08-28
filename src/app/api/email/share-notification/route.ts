import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { userService } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      recipientEmail, 
      sharedItemId, 
      sharedItemTitle, 
      sharedItemType, 
      sharedByEmail,
      shareMessage 
    } = body;

    if (!recipientEmail || !sharedItemId || !sharedItemTitle || !sharedItemType || !sharedByEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientEmail, sharedItemId, sharedItemTitle, sharedItemType, sharedByEmail' },
        { status: 400 }
      );
    }

    // Get the sender's information
    const sharedByUser = await userService.getUser(sharedByEmail);
    if (!sharedByUser) {
      return NextResponse.json(
        { error: 'Sender user not found' },
        { status: 404 }
      );
    }

    // Generate share link
    const shareLink = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/share/${sharedItemType}/${sharedItemId}`;

    const templateData = {
      sharedItemTitle,
      sharedItemType,
      sharedByName: sharedByUser.firstName || 'Someone',
      sharedByEmail,
      shareLink,
      shareMessage,
      companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
      companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
      supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
    };

    const success = await emailService.sendShareNotificationEmail(recipientEmail, templateData);

    if (success) {
      // Log the share activity
      await logShareActivity({
        sharedItemId,
        sharedItemType,
        sharedByEmail,
        recipientEmail,
        shareLink,
        timestamp: new Date(),
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Share notification email sent successfully' 
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send share notification email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in share-notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function logShareActivity(shareData: {
  sharedItemId: string;
  sharedItemType: string;
  sharedByEmail: string;
  recipientEmail: string;
  shareLink: string;
  timestamp: Date;
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
    await db.collection('shareActivityLog').add({
      ...shareData,
      notificationSent: true,
      notificationMethod: 'email',
    });
  } catch (error) {
    console.error('Error logging share activity:', error);
    // Don't throw - this is just logging
  }
}
