import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type PreferencesRecord = Record<string, unknown>;

type QuietHours = {
  enabled: boolean;
  start: string;
  end: string;
};

const EXTENDED_PREFERENCES_KEY = '__extendedPreferences';

const defaultPreferences: PreferencesRecord = {
  enabled: false,
  taskReminders: true,
  overdueAlerts: true,
  dailyDigest: true,
  weeklyReport: false,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
  devices: {
    desktop: true,
    mobile: true,
    tablet: true,
  },
  sound: true,
  vibration: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const toJson = (value: unknown): Prisma.InputJsonValue => {
  if (value === undefined || value === null) {
    return {};
  }

  try {
    const normalized = JSON.parse(JSON.stringify(value));
    return (normalized ?? {}) as Prisma.InputJsonValue;
  } catch {
    return {};
  }
};

const getStoredQuietHours = (value: unknown): { quietHours: QuietHours; extended: PreferencesRecord } => {
  const quietHours: QuietHours = {
    enabled: false,
    start: '22:00',
    end: '08:00',
  };

  let extended: PreferencesRecord = {};

  if (isRecord(value)) {
    const enabled = getBoolean(value.enabled);
    const start = getString(value.start);
    const end = getString(value.end);

    if (enabled !== undefined) {
      quietHours.enabled = enabled;
    }
    if (start) {
      quietHours.start = start;
    }
    if (end) {
      quietHours.end = end;
    }

    const maybeExtended = value[EXTENDED_PREFERENCES_KEY];
    if (isRecord(maybeExtended)) {
      extended = { ...maybeExtended };
    }
  }

  return { quietHours, extended };
};

const normalizeUserEmail = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const sanitizePreferencesResponse = (preferences: PreferencesRecord): PreferencesRecord => {
  const sanitized = { ...preferences };

  const legacyOverdue = getBoolean(sanitized.overdueReminders);
  if (legacyOverdue !== undefined && getBoolean(sanitized.overdueAlerts) === undefined) {
    sanitized.overdueAlerts = legacyOverdue;
  }

  if ('overdueReminders' in sanitized) {
    delete sanitized.overdueReminders;
  }

  if ('reminderTiming' in sanitized) {
    delete sanitized.reminderTiming;
  }

  return sanitized;
};

export async function GET(request: NextRequest) {

  try {
    let userEmail: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userEmail = normalizeUserEmail(authHeader.replace('Bearer ', ''));
    }

    if (!userEmail) {
      const { searchParams } = new URL(request.url);
      userEmail = normalizeUserEmail(searchParams.get('userEmail'));
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
        { status: 400 }
      );
    }

    const preferencesRow = await prisma.notificationPreference.findUnique({
      where: { userEmail },
    });

    const storedQuietHours = getStoredQuietHours(preferencesRow?.quietHours ?? null);

    const preferences: PreferencesRecord = preferencesRow
      ? {
        ...defaultPreferences,
        ...storedQuietHours.extended,
        enabled: preferencesRow.enabled,
        taskReminders: preferencesRow.taskReminders,
        overdueAlerts: preferencesRow.overdueAlerts,
        quietHours: storedQuietHours.quietHours,
      }
      : { ...defaultPreferences };

    const subscriptionsCount = await prisma.pushSubscription.count({
      where: {
        userEmail,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      preferences: sanitizePreferencesResponse(preferences),
      subscriptionsCount,
      hasActiveSubscriptions: subscriptionsCount > 0
    });

  } catch (error) {
    console.error('Error in get-preferences:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  try {
    let userEmail: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userEmail = normalizeUserEmail(authHeader.replace('Bearer ', ''));
    }

    const body = await request.json();
    if (!userEmail) {
      userEmail = normalizeUserEmail(typeof body.userEmail === 'string' ? body.userEmail : null);
    }

    const preferences = isRecord(body.preferences) ? body.preferences : null;

    if (!userEmail || !preferences) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, preferences' },
        { status: 400 }
      );
    }

    const existing = await prisma.notificationPreference.findUnique({
      where: { userEmail },
    });

    const existingStoredQuietHours = getStoredQuietHours(existing?.quietHours ?? null);
    const incomingQuietHours = isRecord(preferences.quietHours) ? preferences.quietHours : {};

    const mergedQuietHours: QuietHours = {
      enabled: getBoolean(incomingQuietHours.enabled) ?? existingStoredQuietHours.quietHours.enabled,
      start: getString(incomingQuietHours.start) ?? existingStoredQuietHours.quietHours.start,
      end: getString(incomingQuietHours.end) ?? existingStoredQuietHours.quietHours.end,
    };

    const incomingExtended: PreferencesRecord = {};
    for (const [key, value] of Object.entries(preferences)) {
      if (
        value === undefined ||
        key === 'enabled' ||
        key === 'taskReminders' ||
        key === 'overdueAlerts' ||
        key === 'overdueReminders' ||
        key === 'quietHours'
      ) {
        continue;
      }
      incomingExtended[key] = value;
    }

    const mergedExtended: PreferencesRecord = {
      ...existingStoredQuietHours.extended,
      ...incomingExtended,
    };

    const enabled = getBoolean(preferences.enabled) ?? existing?.enabled ?? false;
    const taskReminders = getBoolean(preferences.taskReminders) ?? existing?.taskReminders ?? true;
    const overdueAlerts =
      getBoolean(preferences.overdueAlerts) ??
      getBoolean(preferences.overdueReminders) ??
      existing?.overdueAlerts ??
      true;

    await prisma.notificationPreference.upsert({
      where: { userEmail },
      create: {
        userEmail,
        enabled,
        taskReminders,
        overdueAlerts,
        quietHours: toJson({
          ...mergedQuietHours,
          [EXTENDED_PREFERENCES_KEY]: mergedExtended,
        }),
      },
      update: {
        enabled,
        taskReminders,
        overdueAlerts,
        quietHours: toJson({
          ...mergedQuietHours,
          [EXTENDED_PREFERENCES_KEY]: mergedExtended,
        }),
      },
    });

    console.log(`Notification preferences updated for user ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: sanitizePreferencesResponse({
        ...preferences,
        enabled,
        taskReminders,
        overdueAlerts,
        quietHours: mergedQuietHours,
      })
    });

  } catch (error) {
    console.error('Error in update-preferences:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
