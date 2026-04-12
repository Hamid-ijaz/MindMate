import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ token: string }>;
};

type UpdateSettingsBody = {
  allowComments?: boolean;
  allowDownload?: boolean;
  expiresAt?: number | null;
};

const getTokenFromParams = async (context: RouteContext): Promise<string> => {
  const { token } = await context.params;
  return token;
};

const isValidExpiresAt = (value: unknown): value is number | null | undefined => {
  if (value === undefined || value === null) {
    return true;
  }

  return typeof value === 'number' && Number.isFinite(value);
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const token = await getTokenFromParams(context);
    const body = (await request.json()) as UpdateSettingsBody;

    const hasAllowComments = typeof body.allowComments === 'boolean';
    const hasAllowDownload = typeof body.allowDownload === 'boolean';
    const hasExpiresAt = Object.prototype.hasOwnProperty.call(body, 'expiresAt');

    if (
      (!hasAllowComments && !hasAllowDownload && !hasExpiresAt) ||
      (hasExpiresAt && !isValidExpiresAt(body.expiresAt))
    ) {
      return NextResponse.json(
        { error: 'Invalid settings payload' },
        { status: 400 }
      );
    }

    const share = await prisma.sharedItem.findFirst({
      where: {
        shareToken: token,
        ownerEmail: authenticatedEmail,
      },
      select: {
        id: true,
        ownerEmail: true,
      },
    });

    if (!share) {
      return NextResponse.json({ success: true });
    }

    const updateData: {
      allowComments?: boolean;
      allowDownload?: boolean;
      expiresAt?: Date | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    const updatedFields: string[] = [];

    if (hasAllowComments) {
      updateData.allowComments = body.allowComments;
      updatedFields.push('allowComments');
    }

    if (hasAllowDownload) {
      updateData.allowDownload = body.allowDownload;
      updatedFields.push('allowDownload');
    }

    if (hasExpiresAt) {
      updateData.expiresAt = body.expiresAt === null ? null : new Date(body.expiresAt as number);
      updatedFields.push('expiresAt');
    }

    await prisma.$transaction([
      prisma.sharedItem.update({
        where: { id: share.id },
        data: updateData,
      }),
      prisma.shareHistoryEntry.create({
        data: {
          sharedItemId: share.id,
          userEmail: share.ownerEmail,
          action: 'settings_updated',
          details: `Share settings updated: ${updatedFields.join(', ')}`,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating share settings:', error);
    return NextResponse.json(
      { error: 'Failed to update share settings' },
      { status: 500 }
    );
  }
}
