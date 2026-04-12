import type { Task } from '@/lib/types';
import { requestJson } from '@/lib/client-api';

const request = requestJson;

const toPatchPayload = (updates: Partial<Omit<Task, 'id' | 'userEmail' | 'createdAt'>>) => {
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

export const taskApiService = {
  async getTasks(userEmail: string): Promise<Task[]> {
    const result = await request<{ tasks: Task[] }>(
      `/api/tasks?userEmail=${encodeURIComponent(userEmail)}`
    );

    return result.tasks;
  },

  async getTask(taskId: string): Promise<Task | null> {
    const result = await request<{ task: Task }>(`/api/tasks/${encodeURIComponent(taskId)}`);
    return result.task;
  },

  async addTaskWithSubtasks(
    userEmail: string,
    parentTaskData: Omit<Task, 'id' | 'createdAt' | 'userEmail'>,
    subtasks: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'userEmail'>[]
  ): Promise<{ parentId: string; childIds: string[] }> {
    return request<{ parentId: string; childIds: string[] }>(`/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        userEmail,
        parentTask: parentTaskData,
        subtasks,
      }),
    });
  },

  async updateTask(
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'userEmail' | 'createdAt'>>
  ): Promise<void> {
    await request<{ success: true }>(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      body: JSON.stringify(toPatchPayload(updates)),
    });
  },

  async deleteTask(taskId: string): Promise<void> {
    await request<{ success: true }>(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
    });
  },

  async deleteTasksWithParentId(parentId: string): Promise<void> {
    await request<{ success: true }>(`/api/tasks/${encodeURIComponent(parentId)}/subtasks`, {
      method: 'DELETE',
    });
  },

  async completeAndReschedule(
    oldTaskId: string,
    _userEmail: string,
    newTaskData: Omit<Task, 'id' | 'createdAt' | 'userEmail'>
  ): Promise<string> {
    const result = await request<{ success: true; newTaskId: string }>(
      `/api/tasks/${encodeURIComponent(oldTaskId)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ newTaskData }),
      }
    );

    return result.newTaskId;
  },
};
