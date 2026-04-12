import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import type { TaskCategory, TaskDuration } from '@/lib/types';

type SettingsPayload = {
  taskCategories?: TaskCategory[];
  taskDurations?: TaskDuration[];
};

type UpdateBody = {
  userEmail?: string;
  settings?: SettingsPayload;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
};

const normalizeSettings = (settings: { taskCategories: unknown; taskDurations: unknown } | null) => {
  if (!settings) {
    return null;
  }

  return {
    taskCategories: toStringArray(settings.taskCategories) as TaskCategory[],
    taskDurations: toNumberArray(settings.taskDurations) as TaskDuration[],
  };
};

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserEmail = searchParams.get('userEmail');
    const userEmail = requestedUserEmail ?? authenticatedUserEmail;

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userEmail },
      select: {
        taskCategories: true,
        taskDurations: true,
      },
    });

    return NextResponse.json({
      settings: normalizeSettings(settings),
    });
  } catch (error) {
    console.error('Error fetching user task settings:', error);
    return NextResponse.json({ error: 'Failed to fetch user task settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as UpdateBody;
    const requestedUserEmail = body.userEmail;
    const userEmail = requestedUserEmail ?? authenticatedUserEmail;

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = body.settings;
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Settings are required' }, { status: 400 });
    }

    const updateData: {
      taskCategories?: TaskCategory[];
      taskDurations?: TaskDuration[];
    } = {};

    if (settings.taskCategories !== undefined) {
      if (!Array.isArray(settings.taskCategories) || settings.taskCategories.some((item) => typeof item !== 'string')) {
        return NextResponse.json({ error: 'taskCategories must be an array of strings' }, { status: 400 });
      }
      updateData.taskCategories = settings.taskCategories;
    }

    if (settings.taskDurations !== undefined) {
      if (!Array.isArray(settings.taskDurations) || settings.taskDurations.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
        return NextResponse.json({ error: 'taskDurations must be an array of numbers' }, { status: 400 });
      }
      updateData.taskDurations = settings.taskDurations;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'At least one settings field must be provided' }, { status: 400 });
    }

    const updatedSettings = await prisma.userSettings.upsert({
      where: { userEmail },
      update: updateData,
      create: {
        userEmail,
        ...updateData,
      },
      select: {
        taskCategories: true,
        taskDurations: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: normalizeSettings(updatedSettings),
    });
  } catch (error) {
    console.error('Error updating user task settings:', error);
    return NextResponse.json({ error: 'Failed to update user task settings' }, { status: 500 });
  }
}
