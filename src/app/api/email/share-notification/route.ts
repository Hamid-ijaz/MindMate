import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { userPrismaService } from '@/services/server/user-prisma-service';
import { sharePrismaService } from '@/services/server/share-prisma-service';

const isShareItemType = (value: unknown): value is 'task' | 'note' => {
  return value === 'task' || value === 'note';
};

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

    if (!isShareItemType(sharedItemType)) {
      return NextResponse.json(
        { error: 'sharedItemType must be either task or note' },
        { status: 400 }
      );
    }

    // Get the sender's information
    const sharedByUser = await userPrismaService.getUser(sharedByEmail);
    if (!sharedByUser) {
      return NextResponse.json(
        { error: 'Sender user not found' },
        { status: 404 }
      );
    }

    // Generate share link (include token & permission if an active share exists)
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    let shareLink = `${baseUrl}/share/${sharedItemType}/${sharedItemId}`;
    let shareTokenForHistory: string | null = null;

    try {
      const matching = await prisma.sharedItem.findFirst({
        where: {
          itemId: sharedItemId,
          itemType: sharedItemType,
          ownerEmail: sharedByEmail,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          shareToken: true,
          permission: true,
        },
      });

      if (matching?.shareToken) {
        shareTokenForHistory = matching.shareToken;
        const tokenParam = `?token=${matching.shareToken}${matching.permission ? `&permission=${matching.permission}` : ''}`;
        shareLink = `${baseUrl}/share/${sharedItemType}/${sharedItemId}${tokenParam}`;
      }
    } catch (err) {
      // Non-fatal — fall back to basic link without token
      console.error('Error resolving share token for email link:', err);
    }

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
      if (shareTokenForHistory) {
        await sharePrismaService
          .addHistoryEntry(
            shareTokenForHistory,
            sharedItemType,
            sharedItemId,
            {
              userId: sharedByEmail,
              userName: sharedByUser.firstName || sharedByEmail,
              action: 'share_email_sent',
              details: `Share notification sent to ${recipientEmail}`,
            },
            false
          )
          .catch((error) => {
            console.error('Error logging share history entry:', error);
          });
      }

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
