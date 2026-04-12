import { Prisma, SharePermission as PrismaSharePermission, ShareItemType } from '@prisma/client';
import type { Note, ShareCollaborator, ShareHistoryEntry, SharePermission, SharedItem, Task } from '@/lib/types';
import { prisma } from '@/lib/prisma';
import { notePrismaService } from '@/services/server/note-prisma-service';
import { taskPrismaService } from '@/services/server/task-prisma-service';

const sharedItemInclude = {
  owner: {
    select: {
      email: true,
      firstName: true,
      lastName: true,
    },
  },
  history: {
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      timestamp: 'asc' as const,
    },
  },
  collaborators: {
    where: {
      isActive: true,
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
    orderBy: {
      addedAt: 'asc' as const,
    },
  },
} satisfies Prisma.SharedItemInclude;

type SharedItemRecord = Prisma.SharedItemGetPayload<{
  include: typeof sharedItemInclude;
}>;

type ShareHistoryRecord = SharedItemRecord['history'][number];
type ShareCollaboratorRecord = SharedItemRecord['collaborators'][number];

type RequiredPermission = SharePermission;

type HistoryEntryInput = Omit<ShareHistoryEntry, 'id' | 'timestamp'>;

type SharedContentPayload = {
  content: Task | Note | null;
  subtasks: Task[];
};

type AccessValidation = {
  isValid: boolean;
  sharedItem?: SharedItem;
  userPermission?: SharePermission;
  error?: string;
};

const toMillis = (value: Date | null | undefined): number | undefined => {
  return value ? value.getTime() : undefined;
};

const getDisplayName = (
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string => {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  if (email) {
    return email.split('@')[0] || email;
  }

  return 'Unknown User';
};

const toSharePermission = (permission: PrismaSharePermission): SharePermission => {
  return permission === 'edit' ? 'edit' : 'view';
};

const toHistoryEntry = (entry: ShareHistoryRecord): ShareHistoryEntry => {
  const fallbackName = entry.userEmail ? entry.userEmail.split('@')[0] : 'Anonymous User';

  return {
    id: entry.id,
    userId: entry.userEmail ?? 'anonymous',
    userName: entry.user
      ? getDisplayName(entry.user.firstName, entry.user.lastName, entry.user.email)
      : fallbackName,
    action: entry.action,
    timestamp: entry.timestamp.getTime(),
    details: entry.details ?? undefined,
  };
};

const toCollaborator = (
  collaborator: ShareCollaboratorRecord,
  ownerEmail: string
): ShareCollaborator => {
  return {
    email: collaborator.userEmail,
    name: collaborator.user
      ? getDisplayName(
          collaborator.user.firstName,
          collaborator.user.lastName,
          collaborator.user.email
        )
      : collaborator.userEmail.split('@')[0],
    permission: toSharePermission(collaborator.permission),
    addedAt: collaborator.addedAt.getTime(),
    addedBy: ownerEmail,
  };
};

const toSharedItem = (record: SharedItemRecord): SharedItem => {
  return {
    id: record.id,
    itemId: record.itemId,
    itemType: record.itemType,
    ownerEmail: record.ownerEmail,
    ownerName:
      record.ownerName ??
      getDisplayName(record.owner?.firstName, record.owner?.lastName, record.owner?.email),
    permission: toSharePermission(record.permission),
    shareToken: record.shareToken,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
    expiresAt: toMillis(record.expiresAt),
    isActive: record.isActive,
    viewCount: record.viewCount,
    lastViewedAt: toMillis(record.lastViewedAt),
    lastEditedAt: toMillis(record.lastEditedAt),
    lastEditedBy: record.lastEditedBy ?? undefined,
    allowComments: record.allowComments,
    allowDownload: record.allowDownload,
    history: record.history.map(toHistoryEntry),
    collaborators: record.collaborators.map((collaborator) =>
      toCollaborator(collaborator, record.ownerEmail)
    ),
  };
};

const parseItemType = (itemType: string): ShareItemType | null => {
  if (itemType === 'task' || itemType === 'note') {
    return itemType;
  }

  return null;
};

const isExpired = (sharedItem: { expiresAt: Date | null }): boolean => {
  if (!sharedItem.expiresAt) {
    return false;
  }

  return Date.now() > sharedItem.expiresAt.getTime();
};

const isEditAction = (action: string): boolean => {
  return /edit|update|change/i.test(action);
};

const resolveHistoryUserEmail = async (userId?: string): Promise<string | null> => {
  if (!userId || userId === 'anonymous') {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: userId },
    select: { email: true },
  });

  return user?.email ?? null;
};

const getSharedItemRecordForPath = async (
  token: string,
  itemType: 'task' | 'note',
  itemId: string
): Promise<SharedItemRecord | null> => {
  const parsedItemType = parseItemType(itemType);
  if (!parsedItemType) {
    return null;
  }

  const record = await prisma.sharedItem.findUnique({
    where: {
      shareToken: token,
    },
    include: sharedItemInclude,
  });

  if (!record) {
    return null;
  }

  if (record.itemType !== parsedItemType || record.itemId !== itemId) {
    return null;
  }

  return record;
};

const getContentForSharedItem = async (sharedItem: SharedItem): Promise<SharedContentPayload> => {
  if (sharedItem.itemType === 'task') {
    const task = await taskPrismaService.getTask(sharedItem.itemId, sharedItem.ownerEmail);

    if (!task) {
      return {
        content: null,
        subtasks: [],
      };
    }

    const allTasks = await taskPrismaService.getTasks(sharedItem.ownerEmail);
    const subtasks = allTasks
      .filter((taskItem) => taskItem.parentId === sharedItem.itemId)
      .sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));

    return {
      content: task,
      subtasks,
    };
  }

  const note = await notePrismaService.getNote(sharedItem.itemId, sharedItem.ownerEmail);

  return {
    content: note,
    subtasks: [],
  };
};

export const sharePrismaService = {
  async getSharedItemByToken(
    token: string,
    itemType: 'task' | 'note',
    itemId: string
  ): Promise<SharedItem | null> {
    const record = await getSharedItemRecordForPath(token, itemType, itemId);
    if (!record) {
      return null;
    }

    return toSharedItem(record);
  },

  async validateShareAccess(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    requiredPermission: RequiredPermission = 'view',
    userEmail?: string
  ): Promise<AccessValidation> {
    const record = await getSharedItemRecordForPath(token, itemType, itemId);

    if (!record) {
      return { isValid: false, error: 'Share link not found or has been revoked' };
    }

    if (!record.isActive) {
      return { isValid: false, error: 'Share link has been deactivated' };
    }

    if (isExpired(record)) {
      return { isValid: false, error: 'Share link has expired' };
    }

    const sharedItem = toSharedItem(record);

    if (userEmail && userEmail === sharedItem.ownerEmail) {
      return {
        isValid: true,
        sharedItem,
        userPermission: 'edit',
      };
    }

    const collaborator = userEmail
      ? sharedItem.collaborators.find((value) => value.email === userEmail)
      : undefined;

    if (collaborator) {
      const userPermission = collaborator.permission;

      if (requiredPermission === 'edit' && userPermission === 'view') {
        return {
          isValid: false,
          error: 'You only have view access to this item',
          userPermission,
        };
      }

      return {
        isValid: true,
        sharedItem,
        userPermission,
      };
    }

    const userPermission = sharedItem.permission;

    if (requiredPermission === 'edit' && userPermission === 'view') {
      return {
        isValid: false,
        error: 'This share link only allows viewing',
        userPermission,
      };
    }

    return {
      isValid: true,
      sharedItem,
      userPermission,
    };
  },

  async recordView(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    userEmail?: string,
    userName?: string
  ): Promise<SharedItem | null> {
    const validation = await this.validateShareAccess(token, itemType, itemId, 'view', userEmail);
    if (!validation.isValid) {
      return null;
    }

    const record = await getSharedItemRecordForPath(token, itemType, itemId);
    if (!record) {
      return null;
    }

    const historyUserEmail = await resolveHistoryUserEmail(userEmail);

    await prisma.$transaction(async (tx) => {
      await tx.shareHistoryEntry.create({
        data: {
          sharedItemId: record.id,
          userEmail: historyUserEmail,
          action: 'viewed',
          details: `Viewed the shared ${itemType}`,
          timestamp: new Date(),
        },
      });

      await tx.sharedItem.update({
        where: {
          id: record.id,
        },
        data: {
          viewCount: {
            increment: 1,
          },
          lastViewedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    return this.getSharedItemByToken(token, itemType, itemId);
  },

  async addHistoryEntry(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    entry: HistoryEntryInput,
    updateItemTimestamp: boolean = true
  ): Promise<void> {
    const record = await getSharedItemRecordForPath(token, itemType, itemId);
    if (!record || !record.isActive || isExpired(record)) {
      return;
    }

    const historyUserEmail = await resolveHistoryUserEmail(entry.userId);

    await prisma.$transaction(async (tx) => {
      await tx.shareHistoryEntry.create({
        data: {
          sharedItemId: record.id,
          userEmail: historyUserEmail,
          action: entry.action,
          details: entry.details ?? null,
          timestamp: new Date(),
        },
      });

      const shouldTrackEdit = isEditAction(entry.action);
      const updateData: Prisma.SharedItemUpdateInput = {};

      if (updateItemTimestamp) {
        updateData.updatedAt = new Date();
      }

      if (shouldTrackEdit) {
        updateData.lastEditedAt = new Date();
        updateData.lastEditedBy = entry.userId ?? null;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.sharedItem.update({
          where: {
            id: record.id,
          },
          data: updateData,
        });
      }
    });
  },

  async getHistory(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    limit: number = 100
  ): Promise<ShareHistoryEntry[]> {
    const record = await getSharedItemRecordForPath(token, itemType, itemId);
    if (!record) {
      return [];
    }

    const boundedLimit = Math.max(1, Math.min(limit, 500));

    const entries = await prisma.shareHistoryEntry.findMany({
      where: {
        sharedItemId: record.id,
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
      orderBy: {
        timestamp: 'asc',
      },
      take: boundedLimit,
    });

    return entries.map((entry) => {
      const fallbackName = entry.userEmail ? entry.userEmail.split('@')[0] : 'Anonymous User';

      return {
        id: entry.id,
        userId: entry.userEmail ?? 'anonymous',
        userName: entry.user
          ? getDisplayName(entry.user.firstName, entry.user.lastName, entry.user.email)
          : fallbackName,
        action: entry.action,
        timestamp: entry.timestamp.getTime(),
        details: entry.details ?? undefined,
      } as ShareHistoryEntry;
    });
  },

  async getSharedContent(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    userEmail?: string
  ): Promise<{ validation: AccessValidation; payload?: SharedContentPayload }> {
    const validation = await this.validateShareAccess(token, itemType, itemId, 'view', userEmail);

    if (!validation.isValid || !validation.sharedItem) {
      return {
        validation,
      };
    }

    const payload = await getContentForSharedItem(validation.sharedItem);

    return {
      validation,
      payload,
    };
  },

  async updateSharedContent(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    updates: Record<string, unknown>,
    userEmail?: string
  ): Promise<{ validation: AccessValidation; content: Task | Note | null }> {
    const validation = await this.validateShareAccess(token, itemType, itemId, 'edit', userEmail);

    if (!validation.isValid || !validation.sharedItem) {
      return {
        validation,
        content: null,
      };
    }

    const ownerEmail = validation.sharedItem.ownerEmail;

    if (itemType === 'task') {
      const updatedTask = await taskPrismaService.updateTask(itemId, ownerEmail, updates as any);
      return {
        validation,
        content: updatedTask,
      };
    }

    const updatedNote = await notePrismaService.updateNote(itemId, ownerEmail, updates as any);

    return {
      validation,
      content: updatedNote,
    };
  },

  async listSubtasks(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    userEmail?: string
  ): Promise<{ validation: AccessValidation; subtasks: Task[] }> {
    const validation = await this.validateShareAccess(token, itemType, itemId, 'view', userEmail);

    if (!validation.isValid || !validation.sharedItem || itemType !== 'task') {
      return {
        validation,
        subtasks: [],
      };
    }

    const allTasks = await taskPrismaService.getTasks(validation.sharedItem.ownerEmail);
    const subtasks = allTasks
      .filter((taskItem) => taskItem.parentId === itemId)
      .sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));

    return {
      validation,
      subtasks,
    };
  },

  async addSubtask(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    subtask: Record<string, unknown>,
    userEmail?: string
  ): Promise<{ validation: AccessValidation; subtask: Task | null }> {
    const validation = await this.validateShareAccess(token, itemType, itemId, 'edit', userEmail);

    if (!validation.isValid || !validation.sharedItem || itemType !== 'task') {
      return {
        validation,
        subtask: null,
      };
    }

    const ownerEmail = validation.sharedItem.ownerEmail;

    const subtaskId = await taskPrismaService.addTask(ownerEmail, {
      ...(subtask as any),
      parentId: itemId,
      rejectionCount: 0,
      isMuted: false,
    });

    const createdSubtask = await taskPrismaService.getTask(subtaskId, ownerEmail);

    return {
      validation,
      subtask: createdSubtask,
    };
  },

  async updateSubtask(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    subtaskId: string,
    updates: Record<string, unknown>,
    userEmail?: string
  ): Promise<{ validation: AccessValidation; subtask: Task | null }> {
    const validation = await this.validateShareAccess(token, itemType, itemId, 'edit', userEmail);

    if (!validation.isValid || !validation.sharedItem || itemType !== 'task') {
      return {
        validation,
        subtask: null,
      };
    }

    const ownerEmail = validation.sharedItem.ownerEmail;

    const targetSubtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        userEmail: ownerEmail,
        parentId: itemId,
      },
      select: {
        id: true,
      },
    });

    if (!targetSubtask) {
      return {
        validation,
        subtask: null,
      };
    }

    const updatedSubtask = await taskPrismaService.updateTask(subtaskId, ownerEmail, updates as any);

    return {
      validation,
      subtask: updatedSubtask,
    };
  },

  async deleteSubtask(
    token: string,
    itemType: 'task' | 'note',
    itemId: string,
    subtaskId: string,
    userEmail?: string
  ): Promise<{ validation: AccessValidation; deleted: boolean }> {
    const validation = await this.validateShareAccess(token, itemType, itemId, 'edit', userEmail);

    if (!validation.isValid || !validation.sharedItem || itemType !== 'task') {
      return {
        validation,
        deleted: false,
      };
    }

    const ownerEmail = validation.sharedItem.ownerEmail;

    const targetSubtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        userEmail: ownerEmail,
        parentId: itemId,
      },
      select: {
        id: true,
      },
    });

    if (!targetSubtask) {
      return {
        validation,
        deleted: false,
      };
    }

    const deleted = await taskPrismaService.deleteTask(subtaskId, ownerEmail);

    return {
      validation,
      deleted,
    };
  },
};
