import { Prisma, Task as PrismaTask } from '@prisma/client';
import type { Task } from '@/lib/types';
import { prisma } from '@/lib/prisma';

type TaskCreateBase = Omit<Task, 'id' | 'userEmail' | 'createdAt'>;
export type TaskCreateInput = Pick<TaskCreateBase, 'title' | 'category' | 'priority' | 'duration'> &
  Partial<Omit<TaskCreateBase, 'title' | 'category' | 'priority' | 'duration'>>;

type TaskUpdateBase = Omit<Task, 'id' | 'userEmail' | 'createdAt'>;
type TaskUpdateInput = {
  [K in keyof TaskUpdateBase]?: TaskUpdateBase[K] | null;
};

const hasOwn = <T extends object>(obj: T, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const toDate = (value: unknown): Date | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }

  if (value instanceof Date) {
    return value;
  }

  return undefined;
};

const toNullableDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return toDate(value) ?? null;
};

const toCreateJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
};

const toMillis = (value: Date | null | undefined): number | undefined => {
  return value ? value.getTime() : undefined;
};

const toTask = (task: PrismaTask): Task => {
  const recurrence = task.recurrence as Task['recurrence'] | null;
  const attendees = Array.isArray(task.attendees)
    ? (task.attendees as string[])
    : undefined;

  return {
    id: task.id,
    userEmail: task.userEmail,
    title: task.title,
    description: task.description ?? undefined,
    category: task.category,
    priority: task.priority as Task['priority'],
    duration: task.duration,
    createdAt: task.createdAt.getTime(),
    updatedAt: toMillis(task.updatedAt),
    rejectionCount: task.rejectionCount,
    lastRejectedAt: toMillis(task.lastRejectedAt),
    isMuted: task.isMuted,
    isArchived: task.isArchived,
    completedAt: toMillis(task.completedAt),
    parentId: task.parentId ?? undefined,
    reminderAt: toMillis(task.reminderAt),
    onlyNotifyAtReminder: task.onlyNotifyAtReminder,
    notifiedAt: toMillis(task.notifiedAt),
    recurrence: recurrence ?? undefined,
    scheduledAt: toMillis(task.scheduledAt),
    scheduledEndAt: toMillis(task.scheduledEndAt),
    isTimeBlocked: task.isTimeBlocked ?? undefined,
    calendarEventId: task.calendarEventId ?? undefined,
    pomodoroSessions: task.pomodoroSessions ?? undefined,
    estimatedPomodoros: task.estimatedPomodoros ?? undefined,
    timeSpent: task.timeSpent ?? undefined,
    isAllDay: task.isAllDay ?? undefined,
    calendarColor: task.calendarColor ?? undefined,
    location: task.location ?? undefined,
    attendees,
    isRecurring: task.isRecurring ?? undefined,
    originalTaskId: task.originalTaskId ?? undefined,
  };
};

const toCreateData = (
  userEmail: string,
  task: TaskCreateInput
): Prisma.TaskUncheckedCreateInput => {
  return {
    userEmail,
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    duration: task.duration,
    createdAt: new Date(),
    updatedAt: toDate(task.updatedAt),
    rejectionCount: task.rejectionCount ?? 0,
    lastRejectedAt: toDate(task.lastRejectedAt),
    isMuted: task.isMuted ?? false,
    isArchived: task.isArchived ?? false,
    completedAt: toDate(task.completedAt),
    parentId: task.parentId,
    reminderAt: toDate(task.reminderAt),
    onlyNotifyAtReminder: task.onlyNotifyAtReminder ?? false,
    notifiedAt: toDate(task.notifiedAt),
    recurrence: toCreateJsonValue(task.recurrence),
    scheduledAt: toDate(task.scheduledAt),
    scheduledEndAt: toDate(task.scheduledEndAt),
    isTimeBlocked: task.isTimeBlocked,
    calendarEventId: task.calendarEventId,
    pomodoroSessions: task.pomodoroSessions,
    estimatedPomodoros: task.estimatedPomodoros,
    timeSpent: task.timeSpent,
    isAllDay: task.isAllDay,
    calendarColor: task.calendarColor,
    location: task.location,
    attendees: toCreateJsonValue(task.attendees),
    isRecurring: task.isRecurring,
    originalTaskId: task.originalTaskId,
  };
};

const toUpdateData = (updates: TaskUpdateInput): Prisma.TaskUpdateManyMutationInput => {
  const data: any = {};

  if (hasOwn(updates, 'title') && typeof updates.title === 'string') {
    data.title = updates.title;
  }
  if (hasOwn(updates, 'description')) {
    data.description = updates.description ?? null;
  }
  if (hasOwn(updates, 'category') && typeof updates.category === 'string') {
    data.category = updates.category;
  }
  if (hasOwn(updates, 'priority') && typeof updates.priority === 'string') {
    data.priority = updates.priority;
  }
  if (hasOwn(updates, 'duration') && typeof updates.duration === 'number') {
    data.duration = updates.duration;
  }
  if (hasOwn(updates, 'updatedAt')) {
    data.updatedAt = toNullableDate(updates.updatedAt);
  }
  if (hasOwn(updates, 'rejectionCount') && typeof updates.rejectionCount === 'number') {
    data.rejectionCount = updates.rejectionCount;
  }
  if (hasOwn(updates, 'lastRejectedAt')) {
    data.lastRejectedAt = toNullableDate(updates.lastRejectedAt);
  }
  if (hasOwn(updates, 'isMuted') && typeof updates.isMuted === 'boolean') {
    data.isMuted = updates.isMuted;
  }
  if (hasOwn(updates, 'isArchived') && typeof updates.isArchived === 'boolean') {
    data.isArchived = updates.isArchived;
  }
  if (hasOwn(updates, 'completedAt')) {
    data.completedAt = toNullableDate(updates.completedAt);
  }
  if (hasOwn(updates, 'parentId')) {
    data.parentId = updates.parentId ?? null;
  }
  if (hasOwn(updates, 'reminderAt')) {
    data.reminderAt = toNullableDate(updates.reminderAt);
  }
  if (
    hasOwn(updates, 'onlyNotifyAtReminder') &&
    typeof updates.onlyNotifyAtReminder === 'boolean'
  ) {
    data.onlyNotifyAtReminder = updates.onlyNotifyAtReminder;
  }
  if (hasOwn(updates, 'notifiedAt')) {
    data.notifiedAt = toNullableDate(updates.notifiedAt);
  }
  if (hasOwn(updates, 'recurrence')) {
    data.recurrence =
      updates.recurrence === null || updates.recurrence === undefined
        ? Prisma.JsonNull
        : (updates.recurrence as Prisma.InputJsonValue);
  }
  if (hasOwn(updates, 'scheduledAt')) {
    data.scheduledAt = toNullableDate(updates.scheduledAt);
  }
  if (hasOwn(updates, 'scheduledEndAt')) {
    data.scheduledEndAt = toNullableDate(updates.scheduledEndAt);
  }
  if (hasOwn(updates, 'isTimeBlocked')) {
    data.isTimeBlocked =
      typeof updates.isTimeBlocked === 'boolean' ? updates.isTimeBlocked : null;
  }
  if (hasOwn(updates, 'calendarEventId')) {
    data.calendarEventId = updates.calendarEventId ?? null;
  }
  if (hasOwn(updates, 'pomodoroSessions')) {
    data.pomodoroSessions =
      typeof updates.pomodoroSessions === 'number' ? updates.pomodoroSessions : null;
  }
  if (hasOwn(updates, 'estimatedPomodoros')) {
    data.estimatedPomodoros =
      typeof updates.estimatedPomodoros === 'number' ? updates.estimatedPomodoros : null;
  }
  if (hasOwn(updates, 'timeSpent')) {
    data.timeSpent = typeof updates.timeSpent === 'number' ? updates.timeSpent : null;
  }
  if (hasOwn(updates, 'isAllDay')) {
    data.isAllDay = typeof updates.isAllDay === 'boolean' ? updates.isAllDay : null;
  }
  if (hasOwn(updates, 'calendarColor')) {
    data.calendarColor = updates.calendarColor ?? null;
  }
  if (hasOwn(updates, 'location')) {
    data.location = updates.location ?? null;
  }
  if (hasOwn(updates, 'attendees')) {
    data.attendees =
      updates.attendees === null || updates.attendees === undefined
        ? Prisma.JsonNull
        : (updates.attendees as Prisma.InputJsonValue);
  }
  if (hasOwn(updates, 'isRecurring')) {
    data.isRecurring = typeof updates.isRecurring === 'boolean' ? updates.isRecurring : null;
  }
  if (hasOwn(updates, 'originalTaskId')) {
    data.originalTaskId = updates.originalTaskId ?? null;
  }

  return data as Prisma.TaskUpdateManyMutationInput;
};

export const taskPrismaService = {
  async getTasks(userEmail: string): Promise<Task[]> {
    const tasks = await prisma.task.findMany({
      where: { userEmail },
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map(toTask);
  },

  async getTask(taskId: string, userEmail: string): Promise<Task | null> {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userEmail,
      },
    });

    return task ? toTask(task) : null;
  },

  async addTask(userEmail: string, task: TaskCreateInput): Promise<string> {
    const createdTask = await prisma.task.create({
      data: toCreateData(userEmail, task),
      select: { id: true },
    });

    return createdTask.id;
  },

  async addTaskWithSubtasks(
    userEmail: string,
    parentTaskData: TaskCreateInput,
    subtasks: TaskCreateInput[] = []
  ): Promise<{ parentId: string; childIds: string[] }> {
    return prisma.$transaction(async (tx) => {
      const parentTask = await tx.task.create({
        data: toCreateData(userEmail, parentTaskData),
        select: { id: true },
      });

      const childIds: string[] = [];
      for (const subtask of subtasks) {
        const createdSubtask = await tx.task.create({
          data: toCreateData(userEmail, {
            ...subtask,
            parentId: parentTask.id,
            rejectionCount: subtask.rejectionCount ?? 0,
            isMuted: subtask.isMuted ?? false,
          }),
          select: { id: true },
        });
        childIds.push(createdSubtask.id);
      }

      return {
        parentId: parentTask.id,
        childIds,
      };
    });
  },

  async updateTask(taskId: string, userEmail: string, updates: TaskUpdateInput): Promise<Task | null> {
    const updateData = toUpdateData(updates);

    if (Object.keys(updateData).length === 0) {
      return this.getTask(taskId, userEmail);
    }

    const result = await prisma.task.updateMany({
      where: {
        id: taskId,
        userEmail,
      },
      data: updateData,
    });

    if (result.count === 0) {
      return null;
    }

    return this.getTask(taskId, userEmail);
  },

  async deleteTask(taskId: string, userEmail: string): Promise<boolean> {
    const deleted = await prisma.task.deleteMany({
      where: {
        id: taskId,
        userEmail,
      },
    });

    return deleted.count > 0;
  },

  async deleteTasksWithParentId(parentId: string, userEmail: string): Promise<number> {
    const deleted = await prisma.task.deleteMany({
      where: {
        parentId,
        userEmail,
      },
    });

    return deleted.count;
  },

  async completeAndReschedule(
    oldTaskId: string,
    userEmail: string,
    newTaskData: TaskCreateInput
  ): Promise<string | null> {
    return prisma.$transaction(async (tx) => {
      const completed = await tx.task.updateMany({
        where: {
          id: oldTaskId,
          userEmail,
        },
        data: {
          completedAt: new Date(),
        },
      });

      if (completed.count === 0) {
        return null;
      }

      const createdTask = await tx.task.create({
        data: toCreateData(userEmail, newTaskData),
        select: { id: true },
      });

      return createdTask.id;
    });
  },
};
