import { NextRequest, NextResponse } from 'next/server';
import type { SharePermission } from '@/lib/types';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ token: string }>;
};

type AddCollaboratorBody = {
  collaboratorEmail?: string;
  permission?: SharePermission;
};

type RemoveCollaboratorBody = {
  collaboratorEmail?: string;
};

const isSharePermission = (value: unknown): value is SharePermission => {
  return value === 'view' || value === 'edit';
};

const getTokenFromParams = async (context: RouteContext): Promise<string> => {
  const { token } = await context.params;
  return token;
};

const toDisplayName = (
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string => {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  if (fullName) {
    return fullName;
  }

  if (email) {
    return email.split('@')[0] || email;
  }

  return 'Unknown user';
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const token = await getTokenFromParams(context);
    const body = (await request.json()) as AddCollaboratorBody;
    const { collaboratorEmail, permission } = body;

    if (!collaboratorEmail || !isSharePermission(permission)) {
      return NextResponse.json(
        { error: 'collaboratorEmail and permission are required' },
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
      },
    });

    if (!share) {
      return NextResponse.json({ success: true });
    }

    const collaboratorUser = await prisma.user.findUnique({
      where: { email: collaboratorEmail },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!collaboratorUser) {
      return NextResponse.json(
        { error: 'Collaborator user not found' },
        { status: 404 }
      );
    }

    const collaboratorName = toDisplayName(
      collaboratorUser.firstName,
      collaboratorUser.lastName,
      collaboratorUser.email
    );

    await prisma.$transaction([
      prisma.shareCollaborator.upsert({
        where: {
          sharedItemId_userEmail: {
            sharedItemId: share.id,
            userEmail: collaboratorEmail,
          },
        },
        update: {
          permission,
          isActive: true,
        },
        create: {
          sharedItemId: share.id,
          userEmail: collaboratorEmail,
          permission,
          isActive: true,
        },
      }),
      prisma.shareHistoryEntry.create({
        data: {
          sharedItemId: share.id,
          userEmail: authenticatedEmail,
          action: 'collaborator_added',
          details: `Added ${collaboratorName} with ${permission} permission`,
        },
      }),
      prisma.sharedItem.update({
        where: { id: share.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding collaborator:', error);
    return NextResponse.json(
      { error: 'Failed to add collaborator' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const token = await getTokenFromParams(context);
    const body = (await request.json()) as RemoveCollaboratorBody;
    const { collaboratorEmail } = body;

    if (!collaboratorEmail) {
      return NextResponse.json(
        { error: 'collaboratorEmail is required' },
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
      },
    });

    if (!share) {
      return NextResponse.json({ success: true });
    }

    const collaborator = await prisma.shareCollaborator.findUnique({
      where: {
        sharedItemId_userEmail: {
          sharedItemId: share.id,
          userEmail: collaboratorEmail,
        },
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const collaboratorName = collaborator
      ? toDisplayName(
          collaborator.user?.firstName,
          collaborator.user?.lastName,
          collaborator.userEmail
        )
      : collaboratorEmail;

    await prisma.$transaction([
      prisma.shareCollaborator.deleteMany({
        where: {
          sharedItemId: share.id,
          userEmail: collaboratorEmail,
        },
      }),
      prisma.shareHistoryEntry.create({
        data: {
          sharedItemId: share.id,
          userEmail: authenticatedEmail,
          action: 'collaborator_removed',
          details: `Removed ${collaboratorName} from collaborators`,
        },
      }),
      prisma.sharedItem.update({
        where: { id: share.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing collaborator:', error);
    return NextResponse.json(
      { error: 'Failed to remove collaborator' },
      { status: 500 }
    );
  }
}
