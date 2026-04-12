import { NextRequest, NextResponse } from 'next/server';
import { milestonePrismaService } from '@/services/server/milestone-prisma-service';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import type { Milestone } from '@/lib/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MilestoneUpdateInput = Partial<
  Omit<Milestone, 'id' | 'userEmail' | 'createdAt' | 'updatedAt'>
>;

type UpdateMilestoneBody = {
  milestone?: MilestoneUpdateInput;
} & MilestoneUpdateInput;

const MILESTONE_TYPES: Milestone['type'][] = [
  'birthday',
  'anniversary',
  'work_anniversary',
  'graduation',
  'exam_passed',
  'achievement',
  'milestone',
  'purchase',
  'relationship',
  'travel',
  'custom',
];

const isMilestoneType = (value: unknown): value is Milestone['type'] => {
  return typeof value === 'string' && MILESTONE_TYPES.includes(value as Milestone['type']);
};

const isTimestamp = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const normalizeNotificationSettings = (
  value: unknown
): Milestone['notificationSettings'] | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<Milestone['notificationSettings']>;
  if (
    typeof candidate.oneMonthBefore !== 'boolean' ||
    typeof candidate.oneWeekBefore !== 'boolean' ||
    typeof candidate.threeDaysBefore !== 'boolean' ||
    typeof candidate.oneDayBefore !== 'boolean' ||
    typeof candidate.onTheDay !== 'boolean'
  ) {
    return null;
  }

  return {
    oneMonthBefore: candidate.oneMonthBefore,
    oneWeekBefore: candidate.oneWeekBefore,
    threeDaysBefore: candidate.threeDaysBefore,
    oneDayBefore: candidate.oneDayBefore,
    onTheDay: candidate.onTheDay,
  };
};

const normalizeUpdates = (payload: MilestoneUpdateInput): MilestoneUpdateInput | null => {
  const updates: MilestoneUpdateInput = {};

  if (payload.title !== undefined) {
    if (typeof payload.title !== 'string' || !payload.title.trim()) {
      return null;
    }

    updates.title = payload.title.trim();
  }

  if (payload.description !== undefined) {
    if (typeof payload.description !== 'string') {
      return null;
    }

    updates.description = payload.description;
  }

  if (payload.type !== undefined) {
    if (!isMilestoneType(payload.type)) {
      return null;
    }

    updates.type = payload.type;
  }

  if (payload.originalDate !== undefined) {
    if (!isTimestamp(payload.originalDate)) {
      return null;
    }

    updates.originalDate = payload.originalDate;
  }

  if (payload.isRecurring !== undefined) {
    if (typeof payload.isRecurring !== 'boolean') {
      return null;
    }

    updates.isRecurring = payload.isRecurring;
  }

  if (payload.recurringFrequency !== undefined) {
    if (payload.recurringFrequency !== 'yearly' && payload.recurringFrequency !== 'monthly') {
      return null;
    }

    updates.recurringFrequency = payload.recurringFrequency;
  }

  if (payload.icon !== undefined) {
    if (typeof payload.icon !== 'string') {
      return null;
    }

    updates.icon = payload.icon;
  }

  if (payload.color !== undefined) {
    if (typeof payload.color !== 'string') {
      return null;
    }

    updates.color = payload.color;
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== 'boolean') {
      return null;
    }

    updates.isActive = payload.isActive;
  }

  if (payload.notificationSettings !== undefined) {
    const notificationSettings = normalizeNotificationSettings(payload.notificationSettings);
    if (!notificationSettings) {
      return null;
    }

    updates.notificationSettings = notificationSettings;
  }

  if (payload.lastNotifiedAt !== undefined) {
    if (!isTimestamp(payload.lastNotifiedAt)) {
      return null;
    }

    updates.lastNotifiedAt = payload.lastNotifiedAt;
  }

  if (payload.nextAnniversaryDate !== undefined) {
    if (!isTimestamp(payload.nextAnniversaryDate)) {
      return null;
    }

    updates.nextAnniversaryDate = payload.nextAnniversaryDate;
  }

  return updates;
};

const getIdFromParams = async (context: RouteContext): Promise<string> => {
  const { id } = await context.params;
  return id;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const milestoneId = await getIdFromParams(context);
    const milestone = await milestonePrismaService.getMilestone(authenticatedUserEmail, milestoneId);

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      milestone,
    });
  } catch (error) {
    console.error('Error fetching milestone:', error);
    return NextResponse.json({ error: 'Failed to fetch milestone' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const milestoneId = await getIdFromParams(context);
    const body = (await request.json()) as UpdateMilestoneBody;
    const payload = body.milestone ?? body;
    const updates = normalizeUpdates(payload);

    if (!updates) {
      return NextResponse.json(
        { error: 'Invalid milestone update payload' },
        { status: 400 }
      );
    }

    const milestone = await milestonePrismaService.updateMilestone(
      authenticatedUserEmail,
      milestoneId,
      updates
    );

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      milestone,
      message: 'Milestone updated successfully',
    });
  } catch (error) {
    console.error('Error updating milestone:', error);
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const milestoneId = await getIdFromParams(context);
    const deleted = await milestonePrismaService.deleteMilestone(
      authenticatedUserEmail,
      milestoneId
    );

    if (!deleted) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Milestone deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 });
  }
}
