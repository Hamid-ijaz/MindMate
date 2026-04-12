import type { NotificationData, NotificationDocument, NotificationStats } from '@/lib/types';

type ApiErrorPayload = {
  error?: string;
};

type RequestOptions = RequestInit & {
  skipJsonContentType?: boolean;
};

const request = async <T>(input: string, init?: RequestOptions): Promise<T> => {
  const { skipJsonContentType, ...requestInit } = init ?? {};

  const response = await fetch(input, {
    ...requestInit,
    headers: {
      ...(skipJsonContentType ? {} : { 'Content-Type': 'application/json' }),
      ...(requestInit.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload;
};

export const notificationApiService = {
  async listNotifications(userEmail: string, maxCount?: number): Promise<NotificationDocument[]> {
    const query = new URLSearchParams({ userEmail });

    if (typeof maxCount === 'number') {
      query.set('limit', String(maxCount));
    }

    const result = await request<{ notifications: NotificationDocument[] }>(
      `/api/notifications?${query.toString()}`
    );

    return result.notifications;
  },

  async getNotificationStats(userEmail: string): Promise<NotificationStats> {
    const query = new URLSearchParams({ userEmail, stats: '1' });
    const result = await request<{ stats: NotificationStats }>(
      `/api/notifications?${query.toString()}`
    );

    return result.stats;
  },

  async markAsRead(userEmail: string, notificationId: string): Promise<void> {
    await request<{ success: true }>(`/api/notifications`, {
      method: 'PATCH',
      body: JSON.stringify({ userEmail, action: 'markRead', notificationId }),
    });
  },

  async markAllAsRead(userEmail: string): Promise<void> {
    await request<{ success: true }>(`/api/notifications`, {
      method: 'PATCH',
      body: JSON.stringify({ userEmail, action: 'markAllRead' }),
    });
  },

  async deleteNotification(userEmail: string, notificationId: string): Promise<void> {
    await request<{ success: true }>(`/api/notifications`, {
      method: 'DELETE',
      body: JSON.stringify({ userEmail, action: 'deleteOne', notificationId }),
    });
  },

  async clearAllNotifications(userEmail: string): Promise<void> {
    await request<{ success: true }>(`/api/notifications`, {
      method: 'DELETE',
      body: JSON.stringify({ userEmail, action: 'clearAll' }),
    });
  },

  async deleteNotificationsByTaskId(userEmail: string, taskId: string): Promise<void> {
    await request<{ success: true }>(`/api/notifications`, {
      method: 'DELETE',
      body: JSON.stringify({ userEmail, action: 'deleteByTaskId', taskId }),
    });
  },

  async sendInAppNotification(
    userEmail: string,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<string | null> {
    const result = await request<{ success: boolean; notificationId?: string }>(`/api/notifications`, {
      method: 'POST',
      body: JSON.stringify({
        userEmail,
        title,
        body,
        data,
        type: 'in_app',
      }),
    });

    return result.success ? result.notificationId ?? null : null;
  },
};
