import type { TaskCategory, TaskDuration } from '@/lib/types';

type ApiErrorPayload = {
  error?: string;
};

type UserTaskSettings = {
  taskCategories: TaskCategory[];
  taskDurations: TaskDuration[];
};

const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload;
};

export const userSettingsApiService = {
  async getUserSettings(userEmail: string): Promise<UserTaskSettings | null> {
    const result = await request<{ settings: UserTaskSettings | null }>(
      `/api/users/settings?userEmail=${encodeURIComponent(userEmail)}`
    );

    return result.settings;
  },

  async updateUserSettings(
    userEmail: string,
    settings: { taskCategories?: TaskCategory[]; taskDurations?: TaskDuration[] }
  ): Promise<UserTaskSettings> {
    const result = await request<{ settings: UserTaskSettings }>(`/api/users/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ userEmail, settings }),
    });

    return result.settings;
  },
};
