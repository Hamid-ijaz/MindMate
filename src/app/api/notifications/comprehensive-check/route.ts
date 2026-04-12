import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { isAuthorizedCronRequest } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import type { EmailPreference, Prisma, PushSubscription } from '@prisma/client';

type JsonObject = Record<string, unknown>;

type PushResults = {
  type: 'push_notifications';
  startTime: string;
  usersProcessed: number;
  usersSkipped: number;
  overdueNotifications: number;
  reminderNotifications: number;
  totalNotificationsSent: number;
  totalSubscriptionsProcessed: number;
  invalidSubscriptionsRemoved: number;
  errors: string[];
  successLogs: string[];
  userDetails: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
};

type EmailResults = {
  type: 'email_digests';
  startTime: string;
  usersProcessed: number;
  usersSkipped: number;
  dailyDigestsSent: number;
  weeklyDigestsSent: number;
  emailErrors: number;
  errors: string[];
  successLogs: string[];
  userDetails: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
};

type PushSendResult = {
  success: boolean;
  error?: string;
  invalid?: boolean;
};

const isJsonObject = (value: unknown): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const sanitizeJsonValue = (value: unknown): unknown => {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry));
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, sanitizeJsonValue(nested)])
    );
  }

  return value;
};

const parseTimeToMinutes = (value: string): number | null => {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hour, minute] = value.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
};

function isInQuietHours(quietHours: unknown): boolean {
  if (!isJsonObject(quietHours)) {
    return false;
  }

  if (quietHours.enabled !== true) {
    return false;
  }

  const start = typeof quietHours.start === 'string' ? quietHours.start : '';
  const end = typeof quietHours.end === 'string' ? quietHours.end : '';

  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function getCurrentDateInTimezone(timeZone: string = 'Asia/Karachi'): Date {
  const now = new Date();
  const dateString = now.toLocaleString('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function getNotificationDataType(data: Prisma.JsonValue | null): string | null {
  if (!isJsonObject(data)) {
    return null;
  }

  return typeof data.type === 'string' ? data.type : null;
}

function getNotificationDataString(data: Prisma.JsonValue | null, key: string): string | null {
  if (!isJsonObject(data)) {
    return null;
  }

  const value = data[key];
  return typeof value === 'string' ? value : null;
}

const getCanonicalSubscription = (
  pushSubscription: PushSubscription
): { endpoint: string; keys: { p256dh: string; auth: string } } | null => {
  const embeddedSubscription = pushSubscription.subscription;
  if (isJsonObject(embeddedSubscription)) {
    const keys = embeddedSubscription.keys;
    if (
      typeof embeddedSubscription.endpoint === 'string' &&
      isJsonObject(keys) &&
      typeof keys.p256dh === 'string' &&
      typeof keys.auth === 'string'
    ) {
      return {
        endpoint: embeddedSubscription.endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
      };
    }
  }

  const keys = pushSubscription.keys;
  if (
    typeof pushSubscription.endpoint === 'string' &&
    isJsonObject(keys) &&
    typeof keys.p256dh === 'string' &&
    typeof keys.auth === 'string'
  ) {
    return {
      endpoint: pushSubscription.endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    };
  }

  return null;
};

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'hamid.ijaz91@gmail.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey);
  } catch (error) {
    console.error('VAPID configuration error:', error);
  }
}

async function deactivateSubscription(id: string, reason: string): Promise<void> {
  try {
    await prisma.pushSubscription.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: reason,
      },
    });
  } catch (error) {
    console.error(`Failed to deactivate push subscription ${id}:`, error);
  }
}

async function sendPushNotification(
  subscriptionRow: PushSubscription,
  payload: Record<string, unknown>
): Promise<PushSendResult> {
  const canonical = getCanonicalSubscription(subscriptionRow);
  if (!canonical) {
    return {
      success: false,
      error: 'Invalid subscription payload',
      invalid: true,
    };
  }

  try {
    await webpush.sendNotification(canonical, JSON.stringify(payload));
    await prisma.pushSubscription.update({
      where: { id: subscriptionRow.id },
      data: { lastUsedAt: new Date() },
    });
    return { success: true };
  } catch (error: unknown) {
    const webPushError = error as { statusCode?: number; message?: string };
    return {
      success: false,
      error: webPushError.message || 'Unknown error',
      invalid: webPushError.statusCode === 410 || webPushError.statusCode === 404,
    };
  }
}

let loopIsRunning = false;
let loopStartTime: Date | null = null;
let loopUpdatedAt = '';

async function setLoopRunningState(isRunning: boolean): Promise<void> {
  loopIsRunning = isRunning;
  loopUpdatedAt = new Date().toISOString();
}

async function getLoopRunningState(): Promise<boolean> {
  loopUpdatedAt = new Date().toISOString();
  return loopIsRunning;
}

async function sendDailyDigestForUser(userEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://mindmate.hamidijaz.dev';
    const apiUrl = `${baseUrl}/api/email/daily-digest`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail }),
    });

    if (response.ok) {
      return { success: true };
    }

    const responseText = await response.text();
    try {
      const parsed = JSON.parse(responseText) as { error?: string };
      return { success: false, error: parsed.error || `HTTP ${response.status}` };
    } catch {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendWeeklyDigestForUser(userEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://mindmate.hamidijaz.dev';
    const apiUrl = `${baseUrl}/api/email/weekly-digest-enhanced`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail }),
    });

    if (response.ok) {
      return { success: true };
    }

    const responseText = await response.text();
    try {
      const parsed = JSON.parse(responseText) as { error?: string };
      return { success: false, error: parsed.error || `HTTP ${response.status}` };
    } catch {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function shouldSendDailyDigest(
  preferences: EmailPreference,
  now: Date
): { shouldSend: boolean; reason: string } {
  if (!preferences.dailyDigest) {
    return { shouldSend: false, reason: 'Daily digest disabled' };
  }

  const dailyDigestTime = preferences.dailyDigestTime || '09:00';
  const scheduledMinutes = parseTimeToMinutes(dailyDigestTime);
  if (scheduledMinutes === null) {
    return { shouldSend: false, reason: 'Invalid daily digest time configured' };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (currentMinutes < scheduledMinutes) {
    return { shouldSend: false, reason: `Scheduled time (${dailyDigestTime}) not yet reached today` };
  }

  if (preferences.lastDailySent) {
    const lastSentDate = new Date(preferences.lastDailySent);
    const lastSentDay = new Date(lastSentDate);
    lastSentDay.setHours(0, 0, 0, 0);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    if (lastSentDay.getTime() === today.getTime()) {
      return {
        shouldSend: false,
        reason: `Daily digest already sent today at ${lastSentDate.toLocaleTimeString()}`,
      };
    }
  }

  return { shouldSend: true, reason: 'Scheduled time passed and not yet sent today' };
}

function shouldSendWeeklyDigest(
  preferences: EmailPreference,
  now: Date
): { shouldSend: boolean; reason: string } {
  if (!preferences.weeklyDigest) {
    return { shouldSend: false, reason: 'Weekly digest disabled' };
  }

  const digestDay = (preferences.digestDay || 'monday').toLowerCase();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = dayNames.indexOf(digestDay);

  if (targetDay === -1) {
    return { shouldSend: false, reason: 'Invalid digest day configured' };
  }

  const currentDay = now.getDay();
  if (currentDay !== targetDay) {
    return { shouldSend: false, reason: `Today is ${dayNames[currentDay]}, weekly digest scheduled for ${digestDay}` };
  }

  if (now.getHours() < 9) {
    return { shouldSend: false, reason: 'Scheduled time (9:00 AM) not yet reached today' };
  }

  if (preferences.lastWeeklySent) {
    const lastSentDate = new Date(preferences.lastWeeklySent);

    const startOfWeek = new Date(now);
    const daysFromSunday = now.getDay();
    startOfWeek.setDate(now.getDate() - daysFromSunday);
    startOfWeek.setHours(0, 0, 0, 0);

    if (lastSentDate >= startOfWeek) {
      return {
        shouldSend: false,
        reason: `Weekly digest already sent this week on ${lastSentDate.toLocaleDateString()} at ${lastSentDate.toLocaleTimeString()}`,
      };
    }
  }

  return { shouldSend: true, reason: 'Scheduled day and time passed, not yet sent this week' };
}

function milestoneNotificationEnabled(
  notificationSettings: Prisma.JsonValue | null,
  key: string
): boolean {
  if (!isJsonObject(notificationSettings)) {
    return false;
  }

  return notificationSettings[key] === true;
}

function hasTaskNotification(
  notifications: Array<{ relatedTaskId: string | null; data: Prisma.JsonValue | null; createdAt: Date }>,
  taskId: string,
  type: string,
  createdAfter?: Date
): boolean {
  return notifications.some((notification) => {
    if (notification.relatedTaskId !== taskId) {
      return false;
    }

    if (createdAfter && notification.createdAt < createdAfter) {
      return false;
    }

    return getNotificationDataType(notification.data) === type;
  });
}

async function processPushNotifications(now: Date): Promise<PushResults> {
  const results: PushResults = {
    type: 'push_notifications',
    startTime: now.toISOString(),
    usersProcessed: 0,
    usersSkipped: 0,
    overdueNotifications: 0,
    reminderNotifications: 0,
    totalNotificationsSent: 0,
    totalSubscriptionsProcessed: 0,
    invalidSubscriptionsRemoved: 0,
    errors: [],
    successLogs: [],
    userDetails: [],
    summary: {},
  };

  const preferences = await prisma.notificationPreference.findMany();

  for (const preference of preferences) {
    const userEmail = preference.userEmail;
    const userDetail: Record<string, unknown> = {
      userEmail,
      preferences: {
        enabled: preference.enabled,
        overdueAlerts: preference.overdueAlerts,
        taskReminders: preference.taskReminders,
        quietHours: preference.quietHours,
      },
      status: '',
      notifications: {
        overdue: 0,
        reminders: 0,
        total: 0,
      },
      subscriptions: {
        total: 0,
        active: 0,
        removed: 0,
      },
      tasks: {
        total: 0,
        overdue: 0,
        reminders: 0,
      },
      errors: [] as string[],
      logs: [] as string[],
    };

    try {
      if (!preference.enabled) {
        userDetail.status = 'skipped_disabled';
        (userDetail.logs as string[]).push('Notifications disabled for user');
        results.usersSkipped += 1;
        results.userDetails.push(userDetail);
        continue;
      }

      if (isInQuietHours(preference.quietHours)) {
        userDetail.status = 'skipped_quiet_hours';
        (userDetail.logs as string[]).push('User in quiet hours');
        results.usersSkipped += 1;
        results.userDetails.push(userDetail);
        continue;
      }

      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          userEmail,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (subscriptions.length === 0) {
        userDetail.status = 'skipped_no_subscriptions';
        (userDetail.logs as string[]).push('No push subscriptions found');
        results.usersSkipped += 1;
        results.userDetails.push(userDetail);
        continue;
      }

      (userDetail.subscriptions as Record<string, unknown>).total = subscriptions.length;
      (userDetail.subscriptions as Record<string, unknown>).active = subscriptions.length;
      results.totalSubscriptionsProcessed += subscriptions.length;

      const [totalTaskCount, tasksWithReminder, unreadNotifications, recentNotifications, milestones] =
        await Promise.all([
          prisma.task.count({ where: { userEmail } }),
          prisma.task.findMany({
            where: {
              userEmail,
              reminderAt: { not: null },
            },
            select: {
              id: true,
              title: true,
              reminderAt: true,
              completedAt: true,
              notifiedAt: true,
              onlyNotifyAtReminder: true,
            },
          }),
          prisma.notification.findMany({
            where: {
              userEmail,
              isRead: false,
            },
            select: {
              relatedTaskId: true,
              data: true,
              createdAt: true,
            },
          }),
          prisma.notification.findMany({
            where: {
              userEmail,
              createdAt: {
                gte: new Date(now.getTime() - 30 * 60 * 1000),
              },
            },
            select: {
              relatedTaskId: true,
              data: true,
              createdAt: true,
            },
          }),
          prisma.milestone.findMany({
            where: {
              userEmail,
              isActive: true,
            },
          }),
        ]);

      (userDetail.tasks as Record<string, unknown>).total = totalTaskCount;

      if (preference.overdueAlerts) {
        const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
        const overdueTasks = tasksWithReminder.filter((task) => {
          if (!task.reminderAt) {
            return false;
          }

          if (task.completedAt) {
            return false;
          }

          if (task.notifiedAt && task.notifiedAt.getTime() >= twentyFourHoursAgo) {
            return false;
          }

          return task.reminderAt.getTime() < now.getTime();
        });

        (userDetail.tasks as Record<string, unknown>).overdue = overdueTasks.length;

        for (const task of overdueTasks) {
          if (hasTaskNotification(unreadNotifications, task.id, 'overdue-task')) {
            continue;
          }

          const createdNotification = await prisma.notification.create({
            data: {
              userEmail,
              title: 'Task Overdue',
              body: `"${task.title}" is overdue!`,
              type: 'push',
              relatedTaskId: task.id,
              isRead: false,
              data: sanitizeJsonValue({
                type: 'overdue-task',
                taskId: task.id,
                title: task.title,
                timestamp: now.toISOString(),
              }) as Prisma.InputJsonValue,
            },
            select: { id: true },
          });

          const payload = {
            title: 'Task Overdue',
            body: `"${task.title}" is overdue!`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `overdue-task-${task.id}`,
            data: {
              type: 'overdue-task',
              taskId: task.id,
              title: task.title,
              notificationId: createdNotification.id,
              userEmail,
              url: `/task/${task.id}`,
              timestamp: now.toISOString(),
            },
          };

          let successCount = 0;
          for (const subscription of subscriptions) {
            const sendResult = await sendPushNotification(subscription, payload);
            if (sendResult.success) {
              successCount += 1;
              results.totalNotificationsSent += 1;
            } else if (sendResult.invalid) {
              results.invalidSubscriptionsRemoved += 1;
              await deactivateSubscription(subscription.id, sendResult.error || 'invalid_subscription');
            }
          }

          if (successCount > 0) {
            await prisma.notification.update({
              where: { id: createdNotification.id },
              data: { sentAt: new Date() },
            });
          }

          await prisma.task.updateMany({
            where: {
              id: task.id,
              userEmail,
            },
            data: {
              notifiedAt: now,
            },
          });

          unreadNotifications.push({
            relatedTaskId: task.id,
            data: { type: 'overdue-task' } as Prisma.JsonValue,
            createdAt: now,
          });

          results.overdueNotifications += 1;
          (userDetail.notifications as Record<string, number>).overdue += 1;
        }
      }

      if (preference.taskReminders) {
        const reminderDeadline = now.getTime() + 2 * 60 * 60 * 1000;
        const recentCutoff = new Date(now.getTime() - 30 * 60 * 1000);

        const tasksToRemind = tasksWithReminder.filter((task) => {
          if (!task.reminderAt) {
            return false;
          }

          if (task.completedAt) {
            return false;
          }

          if (task.onlyNotifyAtReminder) {
            return false;
          }

          const reminderAtMillis = task.reminderAt.getTime();
          return reminderAtMillis > now.getTime() && reminderAtMillis <= reminderDeadline;
        });

        (userDetail.tasks as Record<string, unknown>).reminders = tasksToRemind.length;

        for (const task of tasksToRemind) {
          const hasUnreadReminder = hasTaskNotification(unreadNotifications, task.id, 'task-reminder');
          const hasRecentReminder = hasTaskNotification(
            recentNotifications,
            task.id,
            'task-reminder',
            recentCutoff
          );

          if (hasUnreadReminder || hasRecentReminder) {
            continue;
          }

          const timeUntilDue = Math.max(0, Math.round((task.reminderAt!.getTime() - now.getTime()) / (60 * 1000)));

          const createdNotification = await prisma.notification.create({
            data: {
              userEmail,
              title: 'Task Reminder',
              body: `"${task.title}" is due in ${timeUntilDue} minutes`,
              type: 'push',
              relatedTaskId: task.id,
              isRead: false,
              data: sanitizeJsonValue({
                type: 'task-reminder',
                taskId: task.id,
                title: task.title,
                timestamp: now.toISOString(),
              }) as Prisma.InputJsonValue,
            },
            select: { id: true },
          });

          const payload = {
            title: 'Task Reminder',
            body: `"${task.title}" is due in ${timeUntilDue} minutes`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `task-reminder-${task.id}`,
            data: {
              type: 'task-reminder',
              taskId: task.id,
              title: task.title,
              notificationId: createdNotification.id,
              userEmail,
              url: `/task/${task.id}`,
              timestamp: now.toISOString(),
            },
          };

          let successCount = 0;
          for (const subscription of subscriptions) {
            const sendResult = await sendPushNotification(subscription, payload);
            if (sendResult.success) {
              successCount += 1;
              results.totalNotificationsSent += 1;
            } else if (sendResult.invalid) {
              results.invalidSubscriptionsRemoved += 1;
              await deactivateSubscription(subscription.id, sendResult.error || 'invalid_subscription');
            }
          }

          if (successCount > 0) {
            await prisma.notification.update({
              where: { id: createdNotification.id },
              data: { sentAt: new Date() },
            });
          }

          unreadNotifications.push({
            relatedTaskId: task.id,
            data: { type: 'task-reminder' } as Prisma.JsonValue,
            createdAt: now,
          });
          recentNotifications.push({
            relatedTaskId: task.id,
            data: { type: 'task-reminder' } as Prisma.JsonValue,
            createdAt: now,
          });

          results.reminderNotifications += 1;
          (userDetail.notifications as Record<string, number>).reminders += 1;
        }
      }

      try {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todaysNotifications = await prisma.notification.findMany({
          where: {
            userEmail,
            createdAt: { gte: todayStart },
          },
          select: {
            data: true,
          },
        });

        for (const milestone of milestones) {
          if (!milestone.isRecurring) {
            continue;
          }

          const originalDate = new Date(milestone.originalDate);
          const nowInUserTimezone = getCurrentDateInTimezone('Asia/Karachi');
          const currentYear = nowInUserTimezone.getFullYear();

          let thisYearAnniversary = new Date(
            currentYear,
            originalDate.getMonth(),
            originalDate.getDate(),
            0,
            0,
            0,
            0
          );

          if (thisYearAnniversary < nowInUserTimezone) {
            thisYearAnniversary = new Date(
              currentYear + 1,
              originalDate.getMonth(),
              originalDate.getDate(),
              0,
              0,
              0,
              0
            );
          }

          const diffMs = thisYearAnniversary.getTime() - nowInUserTimezone.getTime();
          const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          let shouldNotify = false;
          let notificationType = '';

          if (daysUntil === 0 && milestoneNotificationEnabled(milestone.notificationSettings, 'onTheDay')) {
            shouldNotify = true;
            notificationType = 'on-the-day';
          } else if (
            daysUntil === 1 &&
            milestoneNotificationEnabled(milestone.notificationSettings, 'oneDayBefore')
          ) {
            shouldNotify = true;
            notificationType = 'one-day-before';
          } else if (
            daysUntil === 3 &&
            milestoneNotificationEnabled(milestone.notificationSettings, 'threeDaysBefore')
          ) {
            shouldNotify = true;
            notificationType = 'three-days-before';
          } else if (
            daysUntil === 7 &&
            milestoneNotificationEnabled(milestone.notificationSettings, 'oneWeekBefore')
          ) {
            shouldNotify = true;
            notificationType = 'one-week-before';
          } else if (
            daysUntil === 30 &&
            milestoneNotificationEnabled(milestone.notificationSettings, 'oneMonthBefore')
          ) {
            shouldNotify = true;
            notificationType = 'one-month-before';
          }

          if (!shouldNotify) {
            continue;
          }

          const alreadySentToday = todaysNotifications.some((notification) => {
            const dataType = getNotificationDataType(notification.data);
            const dataMilestoneId = getNotificationDataString(notification.data, 'milestoneId');
            const dataNotificationType = getNotificationDataString(notification.data, 'notificationType');

            return (
              dataType === 'milestone-reminder' &&
              dataMilestoneId === milestone.id &&
              dataNotificationType === notificationType
            );
          });

          if (alreadySentToday) {
            continue;
          }

          const yearsSince = Math.floor(
            (now.getTime() - milestone.originalDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
          );

          const prefix = typeof milestone.icon === 'string' && milestone.icon.trim() ? `${milestone.icon} ` : '';
          const title =
            daysUntil === 0
              ? `${prefix}${milestone.title}`
              : `${prefix}Upcoming Milestone`;
          const body =
            daysUntil === 0
              ? milestone.isRecurring
                ? `Today marks ${yearsSince + 1} years since ${milestone.title}!`
                : `Anniversary of ${milestone.title}`
              : `${milestone.title} is in ${daysUntil} days`;

          const createdNotification = await prisma.notification.create({
            data: {
              userEmail,
              title,
              body,
              type: 'push',
              isRead: false,
              data: sanitizeJsonValue({
                type: 'milestone-reminder',
                milestoneId: milestone.id,
                milestoneTitle: milestone.title,
                milestoneType: milestone.type,
                notificationType,
                daysUntil,
                yearsSince: yearsSince + (daysUntil === 0 ? 1 : 0),
                timestamp: now.toISOString(),
              }) as Prisma.InputJsonValue,
            },
            select: { id: true },
          });

          const payload = {
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `milestone-${milestone.id}-${notificationType}`,
            data: {
              type: 'milestone-reminder',
              milestoneId: milestone.id,
              notificationId: createdNotification.id,
              userEmail,
              url: '/milestones',
              timestamp: now.toISOString(),
            },
          };

          let successCount = 0;
          for (const subscription of subscriptions) {
            const sendResult = await sendPushNotification(subscription, payload);
            if (sendResult.success) {
              successCount += 1;
              results.totalNotificationsSent += 1;
            } else if (sendResult.invalid) {
              results.invalidSubscriptionsRemoved += 1;
              await deactivateSubscription(subscription.id, sendResult.error || 'invalid_subscription');
            }
          }

          if (successCount > 0) {
            await prisma.notification.update({
              where: { id: createdNotification.id },
              data: { sentAt: new Date() },
            });
          }

          await prisma.milestone.updateMany({
            where: {
              id: milestone.id,
              userEmail,
            },
            data: {
              lastNotifiedAt: now,
            },
          });

          todaysNotifications.push({
            data: {
              type: 'milestone-reminder',
              milestoneId: milestone.id,
              notificationType,
            } as Prisma.JsonValue,
          });
        }
      } catch (milestoneError) {
        const message = milestoneError instanceof Error ? milestoneError.message : 'Unknown milestone error';
        (userDetail.errors as string[]).push(`Milestone processing error: ${message}`);
      }

      const notifications = userDetail.notifications as Record<string, number>;
      notifications.total = notifications.overdue + notifications.reminders;
      userDetail.status = 'processed';

      results.usersProcessed += 1;
      results.userDetails.push(userDetail);
      results.successLogs.push(`User ${userEmail}: ${notifications.total} notifications sent`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      (userDetail.errors as string[]).push(message);
      userDetail.status = 'error';
      results.userDetails.push(userDetail);
      results.errors.push(`User ${userEmail}: ${message}`);
    }
  }

  const endTime = new Date();
  results.summary = {
    totalUsers: preferences.length,
    usersProcessed: results.usersProcessed,
    usersSkipped: results.usersSkipped,
    successRate:
      results.usersProcessed > 0
        ? `${((results.usersProcessed / Math.max(1, results.usersProcessed + results.usersSkipped)) * 100).toFixed(2)}%`
        : '0%',
    notificationTypes: {
      overdue: results.overdueNotifications,
      reminders: results.reminderNotifications,
      total: results.totalNotificationsSent,
    },
    subscriptions: {
      total: results.totalSubscriptionsProcessed,
      invalidRemoved: results.invalidSubscriptionsRemoved,
    },
    executionTime: endTime.getTime() - now.getTime(),
    endTime: endTime.toISOString(),
  };

  return results;
}

async function processEmailDigests(now: Date): Promise<EmailResults> {
  const results: EmailResults = {
    type: 'email_digests',
    startTime: now.toISOString(),
    usersProcessed: 0,
    usersSkipped: 0,
    dailyDigestsSent: 0,
    weeklyDigestsSent: 0,
    emailErrors: 0,
    errors: [],
    successLogs: [],
    userDetails: [],
    summary: {},
  };

  const emailPreferences = await prisma.emailPreference.findMany();

  for (const preferences of emailPreferences) {
    const userEmail = preferences.userEmail;
    const userDetail: Record<string, unknown> = {
      userEmail,
      preferences: {
        dailyDigest: preferences.dailyDigest,
        weeklyDigest: preferences.weeklyDigest,
        dailyDigestTime: preferences.dailyDigestTime,
        digestDay: preferences.digestDay,
        quietHours: preferences.quietHours,
        lastDailySent: preferences.lastDailySent,
        lastWeeklySent: preferences.lastWeeklySent,
      },
      status: '',
      digests: {
        daily: { shouldSend: false, sent: false, error: null as string | null },
        weekly: { shouldSend: false, sent: false, error: null as string | null },
      },
      logs: [] as string[],
      errors: [] as string[],
    };

    try {
      let digestsSent = 0;

      const dailyCheck = shouldSendDailyDigest(preferences, now);
      (userDetail.digests as Record<string, Record<string, unknown>>).daily.shouldSend = dailyCheck.shouldSend;
      (userDetail.logs as string[]).push(`Daily digest check: ${dailyCheck.reason}`);

      if (dailyCheck.shouldSend) {
        if (!isInQuietHours(preferences.quietHours)) {
          const dailyResult = await sendDailyDigestForUser(userEmail);
          (userDetail.digests as Record<string, Record<string, unknown>>).daily.sent = dailyResult.success;

          if (dailyResult.success) {
            await prisma.emailPreference.update({
              where: { userEmail },
              data: { lastDailySent: new Date() },
            });

            results.dailyDigestsSent += 1;
            digestsSent += 1;
          } else {
            const errorMessage = dailyResult.error || 'Unknown error';
            (userDetail.digests as Record<string, Record<string, unknown>>).daily.error = errorMessage;
            (userDetail.errors as string[]).push(`Daily digest failed: ${errorMessage}`);
            results.emailErrors += 1;
            results.errors.push(`Daily digest failed for ${userEmail}: ${errorMessage}`);
          }
        } else {
          (userDetail.logs as string[]).push('Daily digest skipped - in quiet hours');
        }
      }

      const weeklyCheck = shouldSendWeeklyDigest(preferences, now);
      (userDetail.digests as Record<string, Record<string, unknown>>).weekly.shouldSend = weeklyCheck.shouldSend;
      (userDetail.logs as string[]).push(`Weekly digest check: ${weeklyCheck.reason}`);

      if (weeklyCheck.shouldSend) {
        if (!isInQuietHours(preferences.quietHours)) {
          const weeklyResult = await sendWeeklyDigestForUser(userEmail);
          (userDetail.digests as Record<string, Record<string, unknown>>).weekly.sent = weeklyResult.success;

          if (weeklyResult.success) {
            await prisma.emailPreference.update({
              where: { userEmail },
              data: { lastWeeklySent: new Date() },
            });

            results.weeklyDigestsSent += 1;
            digestsSent += 1;
          } else {
            const errorMessage = weeklyResult.error || 'Unknown error';
            (userDetail.digests as Record<string, Record<string, unknown>>).weekly.error = errorMessage;
            (userDetail.errors as string[]).push(`Weekly digest failed: ${errorMessage}`);
            results.emailErrors += 1;
            results.errors.push(`Weekly digest failed for ${userEmail}: ${errorMessage}`);
          }
        } else {
          (userDetail.logs as string[]).push('Weekly digest skipped - in quiet hours');
        }
      }

      userDetail.status = digestsSent > 0 ? 'digests_sent' : 'no_digests_due';
      results.usersProcessed += 1;
      results.userDetails.push(userDetail);

      if (digestsSent > 0) {
        results.successLogs.push(`User ${userEmail}: ${digestsSent} digest(s) sent`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      (userDetail.errors as string[]).push(message);
      userDetail.status = 'error';
      results.userDetails.push(userDetail);
      results.emailErrors += 1;
      results.errors.push(`Email digest check failed for ${userEmail}: ${message}`);
    }
  }

  const endTime = new Date();
  results.summary = {
    totalUsers: emailPreferences.length,
    usersProcessed: results.usersProcessed,
    digestsSent: {
      daily: results.dailyDigestsSent,
      weekly: results.weeklyDigestsSent,
      total: results.dailyDigestsSent + results.weeklyDigestsSent,
    },
    errors: {
      count: results.emailErrors,
      rate: results.usersProcessed > 0 ? `${((results.emailErrors / results.usersProcessed) * 100).toFixed(2)}%` : '0%',
    },
    successRate:
      results.usersProcessed > 0
        ? `${(((results.usersProcessed - results.emailErrors) / results.usersProcessed) * 100).toFixed(2)}%`
        : '0%',
    executionTime: endTime.getTime() - now.getTime(),
    endTime: endTime.toISOString(),
  };

  return results;
}

async function executeNotificationCheck(): Promise<Record<string, unknown>> {
  const now = new Date();
  const startTime = now.getTime();

  const [pushResults, emailResults] = await Promise.all([
    processPushNotifications(now),
    processEmailDigests(now),
  ]);

  const endTime = new Date();
  const totalExecutionTime = endTime.getTime() - startTime;

  return {
    success: true,
    timestamp: now.toISOString(),
    executionTime: totalExecutionTime,

    overall: {
      totalUsersChecked:
        Number(pushResults.summary.totalUsers || 0) + Number(emailResults.summary.totalUsers || 0),
      totalUsersProcessed: pushResults.usersProcessed + emailResults.usersProcessed,
      totalErrors: pushResults.errors.length + emailResults.errors.length,
      executionTime: totalExecutionTime,
    },

    pushNotifications: {
      ...pushResults,
      description: 'Push notification processing results with detailed user information',
    },

    emailDigests: {
      ...emailResults,
      description: 'Email digest processing results with detailed user information',
    },

    usersProcessed: pushResults.usersProcessed + emailResults.usersProcessed,
    overdueNotifications: pushResults.overdueNotifications,
    reminderNotifications: pushResults.reminderNotifications,
    totalNotificationsSent: pushResults.totalNotificationsSent,
    dailyDigestsSent: emailResults.dailyDigestsSent,
    weeklyDigestsSent: emailResults.weeklyDigestsSent,
    emailErrors: emailResults.emailErrors,
    syncErrors: [],
    errors: [...pushResults.errors, ...emailResults.errors],

    logs: {
      success: [...pushResults.successLogs, ...emailResults.successLogs],
      errors: [...pushResults.errors, ...emailResults.errors],
      combined: [
        ...pushResults.successLogs.map((log) => `[PUSH] ${log}`),
        ...emailResults.successLogs.map((log) => `[EMAIL] ${log}`),
        ...pushResults.errors.map((error) => `[PUSH ERROR] ${error}`),
        ...emailResults.errors.map((error) => `[EMAIL ERROR] ${error}`),
      ],
    },
  };
}

async function startNotificationLoop(): Promise<Record<string, unknown>> {
  if (await getLoopRunningState()) {
    return { success: true, message: 'Loop already running' };
  }

  await setLoopRunningState(true);
  loopStartTime = new Date();

  const totalResults = {
    cycles: 0,
    totalUsersProcessed: 0,
    totalOverdueNotifications: 0,
    totalReminderNotifications: 0,
    totalNotificationsSent: 0,
    totalDailyDigestsSent: 0,
    totalWeeklyDigestsSent: 0,
    totalEmailErrors: 0,
    totalSyncErrors: 0,
    allErrors: [] as string[],
    startTime: loopStartTime.toISOString(),
    endTime: '',
  };

  try {
    const maxRunTime = 24 * 60 * 60 * 1000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxRunTime && (await getLoopRunningState())) {
      try {
        await setLoopRunningState(true);

        const cycleResults = await executeNotificationCheck();
        totalResults.cycles += 1;
        totalResults.totalUsersProcessed += Number(cycleResults.usersProcessed || 0);
        totalResults.totalOverdueNotifications += Number(cycleResults.overdueNotifications || 0);
        totalResults.totalReminderNotifications += Number(cycleResults.reminderNotifications || 0);
        totalResults.totalNotificationsSent += Number(cycleResults.totalNotificationsSent || 0);
        totalResults.totalDailyDigestsSent += Number(cycleResults.dailyDigestsSent || 0);
        totalResults.totalWeeklyDigestsSent += Number(cycleResults.weeklyDigestsSent || 0);
        totalResults.totalEmailErrors += Number(cycleResults.emailErrors || 0);

        const cycleErrors = Array.isArray(cycleResults.errors)
          ? cycleResults.errors.filter((item): item is string => typeof item === 'string')
          : [];
        totalResults.allErrors.push(...cycleErrors);

        const timeRemaining = maxRunTime - (Date.now() - startedAt);
        if (timeRemaining < 60 * 1000) {
          break;
        }

        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 30 * 1000);
        });
      } catch (cycleError) {
        const message = cycleError instanceof Error ? cycleError.message : 'Unknown cycle error';
        totalResults.allErrors.push(`Cycle ${totalResults.cycles + 1} error: ${message}`);

        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 30 * 1000);
        });
      }
    }
  } finally {
    const endTime = new Date();
    totalResults.endTime = endTime.toISOString();
    await setLoopRunningState(false);
    loopStartTime = null;
  }

  return {
    success: true,
    message: 'Notification loop completed',
    results: totalResults,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'single';

    if (mode === 'single') {
      const results = await executeNotificationCheck();
      return NextResponse.json({
        success: true,
        message: 'Single notification check completed',
        results,
      });
    }

    const results = await startNotificationLoop();
    return NextResponse.json({
      success: true,
      message: 'Notification loop process completed',
      results,
    });
  } catch (error) {
    console.error('Error in comprehensive notification check:', error);
    await setLoopRunningState(false);
    loopStartTime = null;

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await prisma.notificationPreference.findMany();
    let totalSent = 0;
    const errors: string[] = [];

    for (const preference of preferences) {
      const userEmail = preference.userEmail;
      if (!preference.enabled) {
        continue;
      }

      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          userEmail,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (subscriptions.length === 0) {
        continue;
      }

      const createdNotification = await prisma.notification.create({
        data: {
          userEmail,
          title: 'Test Notification',
          body: 'This is a test notification from MindMate.',
          type: 'push',
          isRead: false,
          data: sanitizeJsonValue({
            type: 'test',
            timestamp: new Date().toISOString(),
          }) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification from MindMate.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'test-notification',
        data: {
          type: 'test',
          notificationId: createdNotification.id,
          timestamp: new Date().toISOString(),
        },
      };

      let successCount = 0;
      for (const subscription of subscriptions) {
        const sendResult = await sendPushNotification(subscription, payload);
        if (sendResult.success) {
          totalSent += 1;
          successCount += 1;
        } else {
          errors.push(`User ${userEmail} sub ${subscription.id}: ${sendResult.error || 'Unknown error'}`);
          if (sendResult.invalid) {
            await deactivateSubscription(subscription.id, sendResult.error || 'invalid_subscription');
          }
        }
      }

      if (successCount > 0) {
        await prisma.notification.update({
          where: { id: createdNotification.id },
          data: { sentAt: new Date() },
        });
      }
    }

    return NextResponse.json({
      isLoopRunning: await getLoopRunningState(),
      loopStartTime: loopStartTime?.toISOString() || null,
      testNotification: {
        totalSent,
        errors,
      },
      message: `Test notification sent to all users. Total sent: ${totalSent}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        isLoopRunning: await getLoopRunningState(),
        loopStartTime: loopStartTime?.toISOString() || null,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to send test notification',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await setLoopRunningState(false);
  loopStartTime = null;

  return NextResponse.json({
    success: true,
    message: 'Notification loop stopped.',
  });
}

