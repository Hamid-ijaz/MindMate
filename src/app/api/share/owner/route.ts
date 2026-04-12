import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import type {
  ShareCollaborator,
  ShareHistoryEntry,
  SharePermission,
  SharedItem,
} from '@/lib/types';

type OwnerShareBody = {
  itemId?: string;
  itemType?: 'task' | 'note';
  permission?: SharePermission;
};

type SharedItemWithRelations = Prisma.SharedItemGetPayload<{
  include: {
    history: {
      include: {
        user: {
          select: {
            email: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
    collaborators: {
      include: {
        user: {
          select: {
            email: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;

type HistoryWithUser = SharedItemWithRelations['history'][number];
type CollaboratorWithUser = SharedItemWithRelations['collaborators'][number];

const isSharePermission = (value: unknown): value is SharePermission => {
  return value === 'view' || value === 'edit';
};

const isShareItemType = (value: unknown): value is 'task' | 'note' => {
  return value === 'task' || value === 'note';
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

  return 'Anonymous User';
};

const mapHistoryEntry = (entry: HistoryWithUser): ShareHistoryEntry => {
  const userEmail = entry.userEmail ?? entry.user?.email ?? undefined;

  return {
    id: entry.id,
    userId: userEmail,
    userName: toDisplayName(entry.user?.firstName, entry.user?.lastName, userEmail),
    action: entry.action,
    timestamp: entry.timestamp.getTime(),
    details: entry.details ?? undefined,
  };
};

const mapCollaborator = (
  collaborator: CollaboratorWithUser,
  ownerEmail: string
): ShareCollaborator => {
  const collaboratorEmail = collaborator.userEmail;

  return {
    email: collaboratorEmail,
    name: toDisplayName(
      collaborator.user?.firstName,
      collaborator.user?.lastName,
      collaboratorEmail
    ),
    permission: collaborator.permission,
    addedAt: collaborator.addedAt.getTime(),
    addedBy: ownerEmail,
  };
};

const mapSharedItem = (item: SharedItemWithRelations): SharedItem => {
  return {
    id: item.id,
    itemId: item.itemId,
    itemType: item.itemType,
    ownerEmail: item.ownerEmail,
    ownerName: item.ownerName ?? undefined,
    permission: item.permission,
    shareToken: item.shareToken,
    createdAt: item.createdAt.getTime(),
    updatedAt: item.updatedAt.getTime(),
    expiresAt: item.expiresAt?.getTime(),
    isActive: item.isActive,
    viewCount: item.viewCount,
    lastViewedAt: item.lastViewedAt?.getTime(),
    lastEditedAt: item.lastEditedAt?.getTime(),
    lastEditedBy: item.lastEditedBy ?? undefined,
    allowComments: item.allowComments,
    allowDownload: item.allowDownload,
    history: item.history.map(mapHistoryEntry),
    collaborators: item.collaborators
      .filter((collaborator) => collaborator.isActive)
      .map((collaborator) => mapCollaborator(collaborator, item.ownerEmail)),
  };
};

const buildShareUrl = (
  origin: string,
  itemType: 'task' | 'note',
  itemId: string,
  shareToken: string,
  permission: SharePermission
): string => {
  return `${origin}/share/${itemType}/${itemId}?token=${shareToken}&permission=${permission}`;
};

const generateShareToken = (): string => {
  return `${randomBytes(12).toString('hex')}${Date.now().toString(36)}`;
};

const createUniqueShareToken = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateShareToken();
    const existing = await prisma.sharedItem.findUnique({
      where: { shareToken: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Failed to generate a unique share token');
};

export async function GET(request: NextRequest) {
  try {
    const ownerEmail = await getAuthenticatedUserEmail(request);

    if (!ownerEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const items = await prisma.sharedItem.findMany({
      where: {
        ownerEmail,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        history: {
          orderBy: {
            timestamp: 'asc',
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
        },
        collaborators: {
          where: {
            isActive: true,
          },
          orderBy: {
            addedAt: 'asc',
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
        },
      },
    });

    return NextResponse.json({
      items: items.map(mapSharedItem),
    });
  } catch (error) {
    console.error('Error loading owner shares:', error);
    return NextResponse.json(
      { error: 'Failed to load sharing information' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as OwnerShareBody;
    const { itemId, itemType, permission } = body;
    const ownerEmail = authenticatedEmail;

    if (!itemId || !isShareItemType(itemType) || !isSharePermission(permission)) {
      return NextResponse.json(
        { error: 'itemId, itemType, and permission are required' },
        { status: 400 }
      );
    }

    const origin = request.nextUrl.origin;

    const existingShare = await prisma.sharedItem.findFirst({
      where: {
        itemId,
        itemType,
        ownerEmail,
        permission,
        isActive: true,
      },
      select: {
        shareToken: true,
      },
    });

    if (existingShare) {
      return NextResponse.json({
        shareToken: existingShare.shareToken,
        url: buildShareUrl(origin, itemType, itemId, existingShare.shareToken, permission),
        isNew: false,
      });
    }

    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const ownerName = toDisplayName(owner?.firstName, owner?.lastName, ownerEmail);
    const shareToken = await createUniqueShareToken();

    const createdShare = await prisma.sharedItem.create({
      data: {
        itemId,
        itemType,
        ownerEmail,
        ownerName,
        permission,
        shareToken,
        isActive: true,
        viewCount: 0,
        allowComments: true,
        allowDownload: true,
      },
      select: {
        id: true,
      },
    });

    await prisma.shareHistoryEntry.create({
      data: {
        sharedItemId: createdShare.id,
        userEmail: ownerEmail,
        action: 'link_created',
        details: `Share link created with ${permission} permission`,
      },
    });

    return NextResponse.json({
      shareToken,
      url: buildShareUrl(origin, itemType, itemId, shareToken, permission),
      isNew: true,
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    );
  }
}
