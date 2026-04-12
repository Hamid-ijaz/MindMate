import type { TaskCategory, TaskDuration } from '@/lib/types';
import { requestJson } from '@/lib/client-api';

type UserTaskSettings = {
  taskCategories: TaskCategory[];
  taskDurations: TaskDuration[];
};

const request = requestJson;

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
