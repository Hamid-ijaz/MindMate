import type { Note, ShareHistoryEntry, SharePermission, SharedItem, Task } from '@/lib/types';

type ApiErrorPayload = {
  error?: string;
};

type ShareAccessValidation = {
  isValid: boolean;
  sharedItem?: SharedItem;
  userPermission?: SharePermission;
  error?: string;
};

type SharedContentResponse = {
  sharedItem: SharedItem;
  content: Task | Note;
  subtasks: Task[];
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

const toPatchPayload = (updates: Record<string, unknown>) => {
  const nextUpdates: Record<string, unknown> = {};
  const clearFields: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      clearFields.push(key);
      continue;
    }

    nextUpdates[key] = value;
  }

  return {
    updates: nextUpdates,
    clearFields,
  };
};

const buildSharePath = (itemType: 'task' | 'note', itemId: string): string => {
  return `/api/share/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`;
};

export const shareApiService = {
  async validateShareAccess(
    itemType: 'task' | 'note',
    itemId: string,
    token: string,
    requiredPermission: SharePermission = 'view',
    userEmail?: string
  ): Promise<ShareAccessValidation> {
    void userEmail;
    return request<ShareAccessValidation>(`${buildSharePath(itemType, itemId)}/access`, {
      method: 'POST',
      body: JSON.stringify({
        token,
        requiredPermission,
      }),
    });
  },

  async recordView(
    itemType: 'task' | 'note',
    itemId: string,
    token: string,
    userEmail?: string,
    userName?: string
  ): Promise<ShareAccessValidation> {
    void userEmail;
    void userName;
    const result = await request<ShareAccessValidation>(
      `${buildSharePath(itemType, itemId)}/access`,
      {
        method: 'POST',
        body: JSON.stringify({
          token,
          requiredPermission: 'view',
          recordView: true,
        }),
      }
    );

    if (!result.isValid) {
      throw new Error(result.error ?? 'Unable to record view');
    }

    return result;
  },

  async getSharedContent(
    itemType: 'task' | 'note',
    itemId: string,
    token: string,
    userEmail?: string
  ): Promise<SharedContentResponse> {
    void userEmail;
    const queryParams = new URLSearchParams({ token });

    return request<SharedContentResponse>(
      `${buildSharePath(itemType, itemId)}?${queryParams.toString()}`
    );
  },

  async updateSharedContent(
    itemType: 'task' | 'note',
    itemId: string,
    token: string,
    updates: Record<string, unknown>,
    userEmail?: string
  ): Promise<Task | Note> {
    void userEmail;
    const patchPayload = toPatchPayload(updates);

    const result = await request<{ success: true; content: Task | Note }>(
      buildSharePath(itemType, itemId),
      {
        method: 'PATCH',
        body: JSON.stringify({
          token,
          updates: patchPayload.updates,
          clearFields: patchPayload.clearFields,
        }),
      }
    );

    return result.content;
  },

  async addHistoryEntry(
    itemType: 'task' | 'note',
    itemId: string,
    token: string,
    entry: Omit<ShareHistoryEntry, 'id' | 'timestamp'>,
    userEmail?: string,
    updateItemTimestamp: boolean = true
  ): Promise<void> {
    void userEmail;
    await request<{ success: true }>(`${buildSharePath(itemType, itemId)}/history`, {
      method: 'POST',
      body: JSON.stringify({
        token,
        entry,
        updateItemTimestamp,
      }),
    });
  },

  async getHistory(
    itemType: 'task' | 'note',
    itemId: string,
    token: string,
    userEmail?: string,
    limit: number = 100
  ): Promise<ShareHistoryEntry[]> {
    void userEmail;
    const queryParams = new URLSearchParams({
      token,
      limit: String(limit),
    });

    const result = await request<{ history: ShareHistoryEntry[] }>(
      `${buildSharePath(itemType, itemId)}/history?${queryParams.toString()}`
    );

    return result.history;
  },

  async getSubtasks(
    itemType: 'task' | 'note',
    itemId: string,
    token: string,
    userEmail?: string
  ): Promise<Task[]> {
    void userEmail;
    const queryParams = new URLSearchParams({ token });

    const result = await request<{ subtasks: Task[] }>(
      `${buildSharePath(itemType, itemId)}/subtasks?${queryParams.toString()}`
    );

    return result.subtasks;
  },

  async addSubtask(
    itemType: 'task' | 'note',
    itemId: string,
    token: string,
    subtask: Record<string, unknown>,
    userEmail?: string
  ): Promise<Task> {
    void userEmail;
    const result = await request<{ success: true; subtask: Task }>(
      `${buildSharePath(itemType, itemId)}/subtasks`,
      {
        method: 'POST',
        body: JSON.stringify({
          token,
          subtask,
        }),
      }
    );

    return result.subtask;
  },

  async updateSubtask(
    itemType: 'task' | 'note',
    itemId: string,
    subtaskId: string,
    token: string,
    updates: Record<string, unknown>,
    userEmail?: string
  ): Promise<Task> {
    void userEmail;
    const patchPayload = toPatchPayload(updates);

    const result = await request<{ success: true; subtask: Task }>(
      `${buildSharePath(itemType, itemId)}/subtasks/${encodeURIComponent(subtaskId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          token,
          updates: patchPayload.updates,
          clearFields: patchPayload.clearFields,
        }),
      }
    );

    return result.subtask;
  },

  async deleteSubtask(
    itemType: 'task' | 'note',
    itemId: string,
    subtaskId: string,
    token: string,
    userEmail?: string
  ): Promise<void> {
    void userEmail;
    await request<{ success: true }>(
      `${buildSharePath(itemType, itemId)}/subtasks/${encodeURIComponent(subtaskId)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          token,
        }),
      }
    );
  },
};
