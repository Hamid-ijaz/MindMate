import { NextRequest, NextResponse } from 'next/server';
import { milestonePrismaService } from '@/services/server/milestone-prisma-service';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import type { Milestone } from '@/lib/types';

type MilestonePayload = Partial<
  Omit<Milestone, 'id' | 'userEmail' | 'createdAt' | 'updatedAt'>
>;

type CreateMilestoneBody = {
  userEmail?: string;
  milestone?: MilestonePayload;
} & MilestonePayload;

const DEFAULT_NOTIFICATION_SETTINGS: Milestone['notificationSettings'] = {
  oneMonthBefore: true,
  oneWeekBefore: true,
  threeDaysBefore: true,
  oneDayBefore: true,
  onTheDay: true,
};

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
): Milestone['notificationSettings'] | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<Milestone['notificationSettings']>;
  if (
    typeof candidate.oneMonthBefore !== 'boolean' ||
    typeof candidate.oneWeekBefore !== 'boolean' ||
    typeof candidate.threeDaysBefore !== 'boolean' ||
    typeof candidate.oneDayBefore !== 'boolean' ||
    typeof candidate.onTheDay !== 'boolean'
  ) {
    return undefined;
  }

  return {
    oneMonthBefore: candidate.oneMonthBefore,
    oneWeekBefore: candidate.oneWeekBefore,
    threeDaysBefore: candidate.threeDaysBefore,
    oneDayBefore: candidate.oneDayBefore,
    onTheDay: candidate.onTheDay,
  };
};

const normalizeCreatePayload = (
  payload: MilestonePayload
): Omit<Milestone, 'id' | 'userEmail' | 'createdAt' | 'updatedAt'> | null => {
  if (typeof payload.title !== 'string' || !payload.title.trim()) {
    return null;
  }

  if (!isMilestoneType(payload.type)) {
    return null;
  }

  if (!isTimestamp(payload.originalDate)) {
    return null;
  }

  if (typeof payload.isRecurring !== 'boolean') {
    return null;
  }

  const notificationSettings =
    normalizeNotificationSettings(payload.notificationSettings) ?? DEFAULT_NOTIFICATION_SETTINGS;
  const recurringFrequency = payload.isRecurring
    ? payload.recurringFrequency === 'monthly'
      ? 'monthly'
      : 'yearly'
    : undefined;

  return {
    title: payload.title.trim(),
    description: typeof payload.description === 'string' ? payload.description : undefined,
    type: payload.type,
    originalDate: payload.originalDate,
    isRecurring: payload.isRecurring,
    recurringFrequency,
    icon: typeof payload.icon === 'string' ? payload.icon : undefined,
    color: typeof payload.color === 'string' ? payload.color : undefined,
    isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
    notificationSettings,
    lastNotifiedAt: isTimestamp(payload.lastNotifiedAt) ? payload.lastNotifiedAt : undefined,
    nextAnniversaryDate: isTimestamp(payload.nextAnniversaryDate)
      ? payload.nextAnniversaryDate
      : undefined,
  };
};

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail parameter is required' },
        { status: 400 }
      );
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const view = searchParams.get('view');
    const rawLimit = searchParams.get('upcomingLimit') ?? searchParams.get('limit');
    const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 5;
    const wantsUpcoming = view === 'upcoming' || rawLimit !== null;

    if (wantsUpcoming && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      return NextResponse.json(
        { error: 'limit must be a positive integer' },
        { status: 400 }
      );
    }

    const milestones = wantsUpcoming
      ? await milestonePrismaService.getUpcomingMilestones(userEmail, parsedLimit)
      : await milestonePrismaService.getUserMilestones(userEmail);

    return NextResponse.json({
      success: true,
      milestones,
      count: milestones.length,
    });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as CreateMilestoneBody;
    const userEmail = body.userEmail;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail is required' },
        { status: 400 }
      );
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const milestonePayload = body.milestone ?? body;
    const milestoneData = normalizeCreatePayload(milestonePayload);

    if (!milestoneData) {
      return NextResponse.json(
        { error: 'Invalid milestone payload' },
        { status: 400 }
      );
    }

    const milestoneId = await milestonePrismaService.createMilestone(userEmail, milestoneData);
    
    return NextResponse.json({
      success: true,
      milestoneId,
      message: 'Milestone created successfully',
    });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to create milestone' },
      { status: 500 }
    );
  }
}
