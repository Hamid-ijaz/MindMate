import type { Milestone } from '@/lib/types';
import { MilestoneUtils } from '@/lib/milestone-utils';
import { prisma } from '@/lib/prisma';

type PrismaMilestone = NonNullable<
  Awaited<ReturnType<typeof prisma.milestone.findFirst>>
>;

type MilestoneCreateInput = Omit<
  Milestone,
  'id' | 'userEmail' | 'createdAt' | 'updatedAt'
>;
type MilestoneUpdateInput = Partial<
  Omit<Milestone, 'id' | 'userEmail' | 'createdAt' | 'updatedAt'>
>;

const DEFAULT_MILESTONE_NOTIFICATIONS: Milestone['notificationSettings'] = {
  oneMonthBefore: true,
  oneWeekBefore: true,
  threeDaysBefore: true,
  oneDayBefore: true,
  onTheDay: true,
};

const toDate = (value: number | null | undefined): Date | null | undefined => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }

  return undefined;
};

const toMilestone = (milestone: PrismaMilestone): Milestone => {
  const notificationSettings =
    (milestone.notificationSettings as Milestone['notificationSettings'] | null) ??
    DEFAULT_MILESTONE_NOTIFICATIONS;

  return {
    id: milestone.id,
    userEmail: milestone.userEmail,
    title: milestone.title,
    description: milestone.description ?? undefined,
    type: milestone.type as Milestone['type'],
    originalDate: milestone.originalDate.getTime(),
    isRecurring: milestone.isRecurring,
    recurringFrequency: milestone.recurringFrequency ?? undefined,
    icon: milestone.icon ?? undefined,
    color: milestone.color ?? undefined,
    isActive: milestone.isActive,
    notificationSettings,
    createdAt: milestone.createdAt.getTime(),
    updatedAt: milestone.updatedAt.getTime(),
    lastNotifiedAt: milestone.lastNotifiedAt?.getTime(),
    nextAnniversaryDate: milestone.nextAnniversaryDate?.getTime(),
  };
};

const toCreateData = (
  userEmail: string,
  milestoneData: MilestoneCreateInput
) => {
  const now = Date.now();
  const notificationSettings =
    milestoneData.notificationSettings ?? DEFAULT_MILESTONE_NOTIFICATIONS;

  const baseMilestone: Milestone = {
    id: '',
    userEmail,
    title: milestoneData.title,
    description: milestoneData.description,
    type: milestoneData.type,
    originalDate: milestoneData.originalDate,
    isRecurring: milestoneData.isRecurring,
    recurringFrequency: milestoneData.recurringFrequency,
    icon: milestoneData.icon,
    color: milestoneData.color,
    isActive: milestoneData.isActive,
    notificationSettings,
    createdAt: now,
    updatedAt: now,
    lastNotifiedAt: milestoneData.lastNotifiedAt,
    nextAnniversaryDate: milestoneData.nextAnniversaryDate,
  };

  const nextAnniversaryDate =
    milestoneData.isRecurring
      ? milestoneData.nextAnniversaryDate ??
        MilestoneUtils.getNextAnniversaryDate(baseMilestone)?.getTime()
      : undefined;

  return {
    userEmail,
    title: milestoneData.title,
    description: milestoneData.description ?? null,
    type: milestoneData.type,
    originalDate: new Date(milestoneData.originalDate),
    isRecurring: milestoneData.isRecurring,
    recurringFrequency: milestoneData.recurringFrequency ?? null,
    icon: milestoneData.icon ?? null,
    color: milestoneData.color ?? null,
    isActive: milestoneData.isActive,
    notificationSettings: notificationSettings as any,
    lastNotifiedAt: toDate(milestoneData.lastNotifiedAt) ?? null,
    nextAnniversaryDate: toDate(nextAnniversaryDate) ?? null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
};

const toUpdateData = (
  updates: MilestoneUpdateInput
) => {
  const data: any = {};

  if (updates.title !== undefined) {
    data.title = updates.title;
  }
  if (updates.description !== undefined) {
    data.description = updates.description ?? null;
  }
  if (updates.type !== undefined) {
    data.type = updates.type;
  }
  if (updates.originalDate !== undefined) {
    data.originalDate = new Date(updates.originalDate);
  }
  if (updates.isRecurring !== undefined) {
    data.isRecurring = updates.isRecurring;
  }
  if (updates.recurringFrequency !== undefined) {
    data.recurringFrequency = updates.recurringFrequency ?? null;
  }
  if (updates.icon !== undefined) {
    data.icon = updates.icon ?? null;
  }
  if (updates.color !== undefined) {
    data.color = updates.color ?? null;
  }
  if (updates.isActive !== undefined) {
    data.isActive = updates.isActive;
  }
  if (updates.notificationSettings !== undefined) {
    data.notificationSettings = updates.notificationSettings as any;
  }
  if (updates.lastNotifiedAt !== undefined) {
    data.lastNotifiedAt = toDate(updates.lastNotifiedAt) ?? null;
  }
  if (updates.nextAnniversaryDate !== undefined) {
    data.nextAnniversaryDate = toDate(updates.nextAnniversaryDate) ?? null;
  }

  return data;
};

export const milestonePrismaService = {
  async listMilestones(userEmail: string): Promise<Milestone[]> {
    const milestones = await prisma.milestone.findMany({
      where: { userEmail },
      orderBy: { originalDate: 'desc' },
    });

    return milestones.map(toMilestone);
  },

  async getUserMilestones(userEmail: string): Promise<Milestone[]> {
    return this.listMilestones(userEmail);
  },

  async getActiveMilestones(userEmail: string): Promise<Milestone[]> {
    const milestones = await prisma.milestone.findMany({
      where: {
        userEmail,
        isActive: true,
      },
      orderBy: { originalDate: 'desc' },
    });

    return milestones.map(toMilestone);
  },

  async createMilestone(
    userEmail: string,
    milestoneData: MilestoneCreateInput
  ): Promise<string> {
    const createdMilestone = await prisma.milestone.create({
      data: toCreateData(userEmail, milestoneData),
      select: { id: true },
    });

    return createdMilestone.id;
  },

  async getMilestone(userEmail: string, milestoneId: string): Promise<Milestone | null> {
    const milestone = await prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        userEmail,
      },
    });

    return milestone ? toMilestone(milestone) : null;
  },

  async updateMilestone(
    userEmail: string,
    milestoneId: string,
    updates: MilestoneUpdateInput
  ): Promise<Milestone | null> {
    const existingMilestone = await this.getMilestone(userEmail, milestoneId);
    if (!existingMilestone) {
      return null;
    }

    const updateData = toUpdateData(updates);
    const shouldRecalculateNextAnniversaryDate =
      updates.originalDate !== undefined ||
      updates.isRecurring !== undefined ||
      updates.recurringFrequency !== undefined;

    if (shouldRecalculateNextAnniversaryDate) {
      const mergedMilestone: Milestone = {
        ...existingMilestone,
        ...updates,
        id: existingMilestone.id,
        userEmail: existingMilestone.userEmail,
      };

      updateData.nextAnniversaryDate = mergedMilestone.isRecurring
        ? MilestoneUtils.getNextAnniversaryDate(mergedMilestone)
        : null;
    }

    if (Object.keys(updateData).length === 0) {
      return existingMilestone;
    }

    const updated = await prisma.milestone.updateMany({
      where: {
        id: milestoneId,
        userEmail,
      },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    return milestone ? toMilestone(milestone) : null;
  },

  async deleteMilestone(userEmail: string, milestoneId: string): Promise<boolean> {
    const deleted = await prisma.milestone.deleteMany({
      where: {
        id: milestoneId,
        userEmail,
      },
    });

    return deleted.count > 0;
  },

  async getUpcomingMilestones(userEmail: string, limit: number = 5): Promise<Milestone[]> {
    const milestones = await this.getActiveMilestones(userEmail);
    return MilestoneUtils.getUpcomingMilestones(milestones, limit);
  },
};
