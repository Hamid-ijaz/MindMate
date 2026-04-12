import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const defaultPreferences = {
  welcomeEmails: true,
  taskReminders: true,
  shareNotifications: true,
  teamInvitations: true,
  weeklyDigest: true,
  dailyDigest: true,
  marketingEmails: false,
  reminderFrequency: 'immediate',
  digestDay: 'monday',
  dailyDigestTime: '09:00',
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
};

type EmailPreferenceInput = Partial<typeof defaultPreferences>;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userEmail = url.searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail parameter is required' },
        { status: 400 }
      );
    }

    const preferences = await prisma.emailPreference.findUnique({
      where: {
        userEmail,
      },
    });

    if (preferences) {
      return NextResponse.json({
        success: true,
        preferences: {
          welcomeEmails: preferences.welcomeEmails,
          taskReminders: preferences.taskReminders,
          shareNotifications: preferences.shareNotifications,
          teamInvitations: preferences.teamInvitations,
          weeklyDigest: preferences.weeklyDigest,
          dailyDigest: preferences.dailyDigest,
          marketingEmails: preferences.marketingEmails,
          reminderFrequency: preferences.reminderFrequency,
          digestDay: preferences.digestDay,
          dailyDigestTime: preferences.dailyDigestTime,
          quietHours:
            (preferences.quietHours as { enabled?: boolean; startTime?: string; endTime?: string } | null) ??
            defaultPreferences.quietHours,
        },
      });
    } else {
      // Return default preferences
      return NextResponse.json({
        success: true,
        preferences: defaultPreferences,
      });
    }
  } catch (error) {
    console.error('Error getting email preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
    const preferences = (body.preferences ?? {}) as EmailPreferenceInput;

    if (!userEmail || !preferences) {
      return NextResponse.json(
        { error: 'userEmail and preferences are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.emailPreference.findUnique({
      where: {
        userEmail,
      },
    });

    const upsertData = {
      welcomeEmails: preferences.welcomeEmails ?? existing?.welcomeEmails ?? defaultPreferences.welcomeEmails,
      taskReminders: preferences.taskReminders ?? existing?.taskReminders ?? defaultPreferences.taskReminders,
      shareNotifications:
        preferences.shareNotifications ?? existing?.shareNotifications ?? defaultPreferences.shareNotifications,
      teamInvitations: preferences.teamInvitations ?? existing?.teamInvitations ?? defaultPreferences.teamInvitations,
      weeklyDigest: preferences.weeklyDigest ?? existing?.weeklyDigest ?? defaultPreferences.weeklyDigest,
      dailyDigest: preferences.dailyDigest ?? existing?.dailyDigest ?? defaultPreferences.dailyDigest,
      marketingEmails: preferences.marketingEmails ?? existing?.marketingEmails ?? defaultPreferences.marketingEmails,
      reminderFrequency:
        preferences.reminderFrequency ?? existing?.reminderFrequency ?? defaultPreferences.reminderFrequency,
      digestDay: preferences.digestDay ?? existing?.digestDay ?? defaultPreferences.digestDay,
      dailyDigestTime: preferences.dailyDigestTime ?? existing?.dailyDigestTime ?? defaultPreferences.dailyDigestTime,
      quietHours: preferences.quietHours ?? existing?.quietHours ?? defaultPreferences.quietHours,
    };

    await prisma.emailPreference.upsert({
      where: {
        userEmail,
      },
      create: {
        userEmail,
        ...upsertData,
      },
      update: upsertData,
    });

    return NextResponse.json({
      success: true,
      message: 'Email preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating email preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
