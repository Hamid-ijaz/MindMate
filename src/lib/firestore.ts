
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  WriteBatch,
  writeBatch,
  limit,
  startAfter,
  DocumentSnapshot,
  DocumentReference,
  increment,
  deleteField
} from 'firebase/firestore';
import { db } from './firebase';
import type { Task, User, Accomplishment, Note, SharedItem, ShareHistoryEntry, SharePermission, ShareCollaborator, ShareAnalytics, GoogleTasksSettings, ChatMessage, ChatSession, ChatContext, NotificationDocument, NotificationData, NotificationStats } from './types';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  TASKS: 'tasks',
  ACCOMPLISHMENTS: 'accomplishments',
  USER_SETTINGS: 'userSettings',
  NOTES: 'notes',
  SHARED_ITEMS: 'sharedItems',
  CHAT_SESSIONS: 'chatSessions',
  CHAT_MESSAGES: 'chatMessages',
  NOTIFICATIONS: 'notifications',
} as const;

// User operations
export const userService = {
  async createUser(userData: User): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, userData.email);
    // Remove any undefined fields to avoid Firestore "Unsupported field value: undefined" errors
    const sanitized: any = { ...userData };
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    await setDoc(userRef, {
      ...sanitized,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  },

  async getUser(email: string): Promise<User | null> {
    const userRef = doc(db, COLLECTIONS.USERS, email);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dob: data.dob,
        password: data.password,
        // Ensure all fields are included, even if optional
      } as User;
    }
    return null;
  },

  async updateUser(email: string, updates: Partial<User>): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, email);
    // Remove undefined fields from updates to avoid Firestore errors
    const updateData: any = { ...updates };
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await updateDoc(userRef, {
      ...updateData,
      updatedAt: Timestamp.now()
    });
  },

  async userExists(email: string): Promise<boolean> {
    const userRef = doc(db, COLLECTIONS.USERS, email);
    const userSnap = await getDoc(userRef);
    return userSnap.exists();
  }
};

const serializeTaskForFirestore = (task: any, isUpdate: boolean = false) => {
    const data: any = { ...task };
    
    // Helper function to safely convert to Firestore Timestamp
    const safeToTimestamp = (value: any) => {
      if (!value) return undefined;
      if (typeof value === 'number') return Timestamp.fromMillis(value);
      if (value.toMillis && typeof value.toMillis === 'function') return value; // Already a Timestamp
      if (value instanceof Date) return Timestamp.fromDate(value);
      return undefined;
    };
    
    if (data.reminderAt) {
      data.reminderAt = safeToTimestamp(data.reminderAt);
    }
    if (data.completedAt) {
      data.completedAt = safeToTimestamp(data.completedAt);
    }
    if (data.lastRejectedAt) {
      data.lastRejectedAt = safeToTimestamp(data.lastRejectedAt);
    }
    if (data.notifiedAt) {
      data.notifiedAt = safeToTimestamp(data.notifiedAt);
    }
    if (data.recurrence?.endDate) {
      data.recurrence.endDate = safeToTimestamp(data.recurrence.endDate);
    }
    
    // For update operations, keep undefined values so they can be converted to deleteField
    // For create operations, remove undefined values to avoid Firestore errors
    if (!isUpdate) {
      Object.keys(data).forEach(key => {
        if (data[key] === undefined) {
          delete data[key];
        }
        if (key === 'recurrence' && data.recurrence && data.recurrence.endDate === undefined) {
          delete data.recurrence.endDate;
        }
      });
    }
    return data;
}

const deserializeTaskFromFirestore = (docSnap: any) => {
    const data = docSnap.data();
    
    // Helper function to safely convert timestamps
    const safeToMillis = (timestamp: any): number | undefined => {
      if (!timestamp) return undefined;
      if (typeof timestamp === 'number') return timestamp; // Already a timestamp
      if (timestamp.toMillis && typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis(); // Firestore Timestamp
      }
      if (timestamp.seconds) {
        return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000; // Manual Timestamp conversion
      }
      return undefined;
    };
    
    return {
      ...data,
      id: docSnap.id,
      createdAt: safeToMillis(data.createdAt) || Date.now(),
      completedAt: safeToMillis(data.completedAt),
      lastRejectedAt: safeToMillis(data.lastRejectedAt),
      reminderAt: safeToMillis(data.reminderAt),
      notifiedAt: safeToMillis(data.notifiedAt),
      recurrence: data.recurrence ? {
          ...data.recurrence,
          endDate: safeToMillis(data.recurrence.endDate),
      } : undefined,
    } as Task;
}


// Task operations
export const taskService = {
  async getTasks(userEmail: string): Promise<Task[]> {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(tasksRef, where('userEmail', '==', userEmail), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(deserializeTaskFromFirestore);
  },

  async getTask(taskId: string): Promise<Task | null> {
    try {
      const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        return deserializeTaskFromFirestore(taskSnap);
      }
      return null;
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  },

  async addTask(userEmail: string, task: Omit<Task, 'id' | 'userEmail'>): Promise<string> {
    console.log(`💾 addTask: Creating task for user ${userEmail}:`, {
      title: task.title,
      syncToGoogleTasks: task.syncToGoogleTasks,
      hasReminderAt: !!task.reminderAt,
      category: task.category
    });

    const tasksRef = collection(db, COLLECTIONS.TASKS);
    // Build taskData, omitting undefined fields
    const taskData: any = {
      ...task,
      userEmail,
      createdAt: Timestamp.now(), // Use server timestamp
      syncToGoogleTasks: task.syncToGoogleTasks ?? true, // Default to true for Google Tasks sync
    };

    console.log(`💾 addTask: Final task data to save:`, {
      title: taskData.title,
      syncToGoogleTasks: taskData.syncToGoogleTasks,
      userEmail: taskData.userEmail,
      hasCreatedAt: !!taskData.createdAt
    });

    const docRef = doc(tasksRef);
    await setDoc(docRef, serializeTaskForFirestore(taskData));

    console.log(`✅ addTask: Task saved successfully with ID: ${docRef.id}`);

    // Trigger real-time Google Tasks sync if enabled (server-side only)
    if (taskData.syncToGoogleTasks && typeof window === 'undefined') {
      try {
        const fullTask: Task = { ...taskData, id: docRef.id };
        const { getGoogleTasksSyncService } = await import('@/lib/server-google-tasks');
        const googleTasksSyncService = await getGoogleTasksSyncService();
        await googleTasksSyncService.onTaskCreated(userEmail, fullTask);
      } catch (error) {
        console.warn('Real-time Google Tasks sync failed for new task:', error);
        // Don't throw - task creation should succeed even if sync fails
      }
    }

    return docRef.id;
  },

  async addTaskWithSubtasks(
    userEmail: string, 
    parentTaskData: Omit<Task, 'id' | 'createdAt' | 'userEmail'>, 
    subtasks: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'userEmail'>[]
  ): Promise<{ parentId: string, childIds: string[] }> {
    const batch = writeBatch(db);
    const tasksRef = collection(db, COLLECTIONS.TASKS);

    // Create parent task
    const parentRef = doc(tasksRef);
    const parentTask: any = {
      ...parentTaskData,
      userEmail,
      createdAt: Timestamp.now(),
    };
    batch.set(parentRef, serializeTaskForFirestore(parentTask));

    // Create subtasks
    const childIds: string[] = [];
    subtasks.forEach(subtaskData => {
      const childRef = doc(tasksRef);
      const childTask: any = {
        ...subtaskData,
        parentId: parentRef.id,
        userEmail,
        createdAt: Timestamp.now(),
        rejectionCount: 0,
        isMuted: false,
      };
      batch.set(childRef, serializeTaskForFirestore(childTask));
      childIds.push(childRef.id);
    });

    await batch.commit();

    return { parentId: parentRef.id, childIds };
  },

  async updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'userEmail'>>): Promise<void> {
    // Get the current task data for comparison
    const currentTask = await this.getTask(taskId);
    
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    
    // Use the same serialization logic for consistency
    const updateData = serializeTaskForFirestore(updates, true); // true for update operation
    
    // Handle undefined fields by using deleteField to properly clear them in Firestore
    Object.keys(updates).forEach((key) => {
        if ((updates as any)[key] === undefined) {
            updateData[key] = deleteField();
        }
    });

    await updateDoc(taskRef, updateData);

    // Trigger real-time Google Tasks sync if enabled and task exists (server-side only)
    if (currentTask && (currentTask.syncToGoogleTasks || updates.syncToGoogleTasks) && typeof window === 'undefined') {
      try {
        const updatedTask: Task = { ...currentTask, ...updates };
        const { getGoogleTasksSyncService } = await import('@/lib/server-google-tasks');
        const googleTasksSyncService = await getGoogleTasksSyncService();
        
        // Check if it's a completion status change
        const wasCompleted = !!currentTask.completedAt;
        const isCompleted = !!(updates.completedAt !== undefined ? updates.completedAt : currentTask.completedAt);
        
        if (wasCompleted !== isCompleted) {
          // Completion status changed
          await googleTasksSyncService.onTaskCompleted(currentTask.userEmail, updatedTask, isCompleted);
        } else {
          // Regular update
          await googleTasksSyncService.onTaskUpdated(currentTask.userEmail, updatedTask, currentTask);
        }
      } catch (error) {
        console.warn('Real-time Google Tasks sync failed for task update:', error);
        // Don't throw - task update should succeed even if sync fails
      }
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    // Get the task data before deletion for sync purposes
    const task = await this.getTask(taskId);
    
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    await deleteDoc(taskRef);

    // Trigger real-time Google Tasks sync if enabled and task exists (server-side only)
    if (task && task.syncToGoogleTasks && typeof window === 'undefined') {
      try {
        const { getGoogleTasksSyncService } = await import('@/lib/server-google-tasks');
        const googleTasksSyncService = await getGoogleTasksSyncService();
        await googleTasksSyncService.onTaskDeleted(task.userEmail, task);
      } catch (error) {
        console.warn('Real-time Google Tasks sync failed for task deletion:', error);
        // Don't throw - task deletion should succeed even if sync fails
      }
    }
  },

  async deleteTasksWithParentId(parentId: string): Promise<void> {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(tasksRef, where('parentId', '==', parentId));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  },

  async completeAndReschedule(oldTaskId: string, userEmail: string, newTaskData: Omit<Task, 'id' | 'createdAt' | 'userEmail'>): Promise<string> {
    const batch = writeBatch(db);
    const tasksRef = collection(db, COLLECTIONS.TASKS);

    // 1. Mark old task as complete
    const oldTaskRef = doc(tasksRef, oldTaskId);
    batch.update(oldTaskRef, { completedAt: Timestamp.now() });

    // 2. Create new task
    const newTaskRef = doc(tasksRef);
    const taskForDb = {
        ...newTaskData,
        userEmail,
        createdAt: Timestamp.now(),
    };
    batch.set(newTaskRef, serializeTaskForFirestore(taskForDb));
    
    await batch.commit();
    return newTaskRef.id;
  },


  // Real-time subscription for tasks
  subscribeToTasks(userEmail: string, callback: (tasks: Task[]) => void): () => void {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(tasksRef, where('userEmail', '==', userEmail), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
      const tasks = querySnapshot.docs.map(deserializeTaskFromFirestore);
      callback(tasks);
    });
  }
};

// Note operations
export const noteService = {
    async getNotes(userEmail: string): Promise<Note[]> {
        const notesRef = collection(db, COLLECTIONS.NOTES);
        const q = query(notesRef, where('userEmail', '==', userEmail), orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : data.createdAt || Date.now(),
                updatedAt: typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : data.updatedAt || Date.now(),
            } as Note;
        });
    },

    async getNote(noteId: string): Promise<Note | null> {
        try {
            const noteRef = doc(db, COLLECTIONS.NOTES, noteId);
            const noteSnap = await getDoc(noteRef);
            
            if (noteSnap.exists()) {
                const data = noteSnap.data();
                return {
                    ...data,
                    id: noteSnap.id,
                    createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : data.createdAt || Date.now(),
                    updatedAt: typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : data.updatedAt || Date.now(),
                } as Note;
            }
            return null;
        } catch (error) {
            console.error('Error fetching note:', error);
            return null;
        }
    },

    async addNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const notesRef = collection(db, COLLECTIONS.NOTES);
        const now = Timestamp.now();
        const docRef = doc(notesRef);
        await setDoc(docRef, { ...note, createdAt: now, updatedAt: now });
        return docRef.id;
    },

    async updateNote(noteId: string, updates: Partial<Omit<Note, 'id' | 'userEmail'>>): Promise<void> {
        const noteRef = doc(db, COLLECTIONS.NOTES, noteId);
        await updateDoc(noteRef, { ...updates, updatedAt: Timestamp.now() });
    },

    async deleteNote(noteId: string): Promise<void> {
        const noteRef = doc(db, COLLECTIONS.NOTES, noteId);
        await deleteDoc(noteRef);
    },
};

// Accomplishment operations
export const accomplishmentService = {
  async getAccomplishments(userEmail: string): Promise<Accomplishment[]> {
    const accomplishmentsRef = collection(db, COLLECTIONS.ACCOMPLISHMENTS);
    const q = query(accomplishmentsRef, where('userEmail', '==', userEmail), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      date: doc.data().date,
      content: doc.data().content
    } as Accomplishment));
  },

  async addAccomplishment(userEmail: string, accomplishment: Omit<Accomplishment, 'id'>): Promise<string> {
    const accomplishmentsRef = collection(db, COLLECTIONS.ACCOMPLISHMENTS);
    const accomplishmentData = {
      ...accomplishment,
      userEmail,
      createdAt: Timestamp.now()
    };
    
    const docRef = doc(accomplishmentsRef);
    await setDoc(docRef, accomplishmentData);
    return docRef.id;
  },

  async deleteAccomplishment(accomplishmentId: string): Promise<void> {
    const accomplishmentRef = doc(db, COLLECTIONS.ACCOMPLISHMENTS, accomplishmentId);
    await deleteDoc(accomplishmentRef);
  },

  // Real-time subscription for accomplishments
  subscribeToAccomplishments(userEmail: string, callback: (accomplishments: Accomplishment[]) => void): () => void {
    const accomplishmentsRef = collection(db, COLLECTIONS.ACCOMPLISHMENTS);
    const q = query(accomplishmentsRef, where('userEmail', '==', userEmail), orderBy('date', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
      const accomplishments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        date: doc.data().date,
        content: doc.data().content
      } as Accomplishment));
      callback(accomplishments);
    });
  }
};

// User settings operations
export const userSettingsService = {
  async getUserSettings(userEmail: string): Promise<{ taskCategories: string[], taskDurations: number[] } | null> {
    const settingsRef = doc(db, COLLECTIONS.USER_SETTINGS, userEmail);
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      return {
        taskCategories: data.taskCategories || [],
        taskDurations: data.taskDurations || []
      };
    }
    return null;
  },

  async updateUserSettings(userEmail: string, settings: { taskCategories?: string[], taskDurations?: number[] }): Promise<void> {
    const settingsRef = doc(db, COLLECTIONS.USER_SETTINGS, userEmail);
    await setDoc(settingsRef, {
      ...settings,
      userEmail,
      updatedAt: Timestamp.now()
    }, { merge: true });
  }
};

// Google Tasks settings operations
export const googleTasksService = {
  async getGoogleTasksSettings(userEmail: string): Promise<GoogleTasksSettings | null> {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userEmail);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        return userData.googleTasksSettings || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting Google Tasks settings:', error);
      return null;
    }
  },

  async updateGoogleTasksSettings(userEmail: string, settings: Partial<GoogleTasksSettings>): Promise<void> {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userEmail);
      
      // Get existing settings to preserve all existing data
      const existingDoc = await getDoc(userRef);
      const existingSettings = existingDoc.exists() ? existingDoc.data()?.googleTasksSettings : null;
      
      // Merge existing settings with new ones (new ones take precedence)
      const mergedData = {
        ...existingSettings, // Start with existing settings
        ...settings,         // Override with new settings
        lastSyncAt: settings.lastSyncAt || Date.now()
      };
      
      // Only set connectedAt if it doesn't exist and we're connecting
      if (!existingSettings?.connectedAt && settings.isConnected) {
        mergedData.connectedAt = Date.now();
      }
      
      // Filter out undefined values (Firestore doesn't accept them)
      const updateData = Object.fromEntries(
        Object.entries(mergedData).filter(([, value]) => value !== undefined)
      );
      
      console.log('💾 Updating Google Tasks settings:', {
        ...updateData,
        accessToken: (updateData.accessToken && typeof updateData.accessToken === 'string') ? `${updateData.accessToken.substring(0, 10)}...` : 'none',
        refreshToken: (updateData.refreshToken && typeof updateData.refreshToken === 'string') ? `${updateData.refreshToken.substring(0, 10)}...` : 'none'
      });
      
      await updateDoc(userRef, {
        [`googleTasksSettings`]: updateData
      });
    } catch (error) {
      console.error('Error updating Google Tasks settings:', error);
      throw error;
    }
  },

  async disconnectGoogleTasks(userEmail: string): Promise<void> {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userEmail);
      await updateDoc(userRef, {
        [`googleTasksSettings.isConnected`]: false,
        [`googleTasksSettings.syncEnabled`]: false,
        [`googleTasksSettings.accessToken`]: deleteField(),
        [`googleTasksSettings.refreshToken`]: deleteField(),
        [`googleTasksSettings.tokenExpiresAt`]: deleteField(),
        [`googleTasksSettings.userEmail`]: deleteField(),
        [`googleTasksSettings.defaultTaskListId`]: deleteField(),
        [`googleTasksSettings.syncStatus`]: 'idle',
        [`googleTasksSettings.lastError`]: deleteField(),
        [`googleTasksSettings.connectedAt`]: deleteField(),
        [`googleTasksSettings.lastSyncAt`]: deleteField()
      });
    } catch (error) {
      console.error('Error disconnecting Google Tasks:', error);
      throw error;
    }
  },

  async syncTaskToGoogleTasks(userEmail: string, taskId: string, syncData: {
    googleTaskId?: string;
    syncStatus: 'pending' | 'synced' | 'error' | 'deleted';
    lastSync?: number;
    googleTaskUrl?: string;
    error?: string;
    taskListId?: string; // Add task list ID to track which list the task is synced to
  }): Promise<void> {
    try {
      const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
      
      // Build update object, filtering out undefined values
      const updateData: any = {
        googleTaskSyncStatus: syncData.syncStatus,
        googleTaskLastSync: syncData.lastSync || Date.now()
      };
      
      // Only add fields that are not undefined
      if (syncData.googleTaskId !== undefined) {
        updateData.googleTaskId = syncData.googleTaskId;
      }
      
      if (syncData.googleTaskUrl !== undefined) {
        updateData.googleTaskUrl = syncData.googleTaskUrl;
      }
      
      if (syncData.error !== undefined) {
        updateData.googleTaskError = syncData.error;
      }
      
      if (syncData.taskListId !== undefined) {
        updateData.googleTaskListId = syncData.taskListId;
      }
      
      // Remove any undefined values to prevent Firestore errors
      const sanitizedData = Object.fromEntries(
        Object.entries(updateData).filter(([, value]) => value !== undefined)
      );
      
      await updateDoc(taskRef, sanitizedData);
    } catch (error) {
      console.error('Error updating task Google Tasks sync status:', error);
      throw error;
    }
  },

  async getTaskGoogleSyncData(userEmail: string, taskId: string): Promise<{
    googleTaskId?: string;
    taskListId?: string;
    syncStatus?: 'pending' | 'synced' | 'error' | 'deleted';
    lastSync?: number;
  } | null> {
    try {
      const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        const data = taskSnap.data();
        return {
          googleTaskId: data.googleTaskId || undefined,
          taskListId: data.googleTaskListId || undefined,
          syncStatus: data.googleTaskSyncStatus || undefined,
          lastSync: data.googleTaskLastSync || undefined
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting task Google sync data:', error);
      return null;
    }
  }
};

// Sharing and collaboration operations
export const sharingService = {
  // Generate a unique share token
  generateShareToken(): string {
    return Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
  },

  // Create or get existing share link
  async createOrGetShareLink(
    itemId: string, 
    itemType: 'task' | 'note', 
    ownerEmail: string, 
    permission: SharePermission
  ): Promise<{ shareToken: string; url: string; isNew: boolean }> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    
    // Check if a share link already exists for this item with the same permission
    const existingQuery = query(
      sharedItemsRef,
      where('itemId', '==', itemId),
      where('itemType', '==', itemType),
      where('ownerEmail', '==', ownerEmail),
      where('permission', '==', permission),
      where('isActive', '==', true)
    );
    
    const existingDocs = await getDocs(existingQuery);
    
    if (!existingDocs.empty) {
      // Return existing share link
      const existingDoc = existingDocs.docs[0];
      const data = existingDoc.data() as SharedItem;
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const url = `${baseUrl}/share/${itemType}/${itemId}?token=${data.shareToken}&permission=${permission}`;
      
      return {
        shareToken: data.shareToken,
        url,
        isNew: false
      };
    }

    // Create new share link
    const shareToken = this.generateShareToken();
    const sharedItemRef = doc(sharedItemsRef);
    
    // Get owner info for better display
    const ownerInfo = await userService.getUser(ownerEmail);
    const ownerName = ownerInfo ? `${ownerInfo.firstName} ${ownerInfo.lastName}` : ownerEmail.split('@')[0];
    
    const sharedItem: Omit<SharedItem, 'id'> = {
      itemId,
      itemType,
      ownerEmail,
      ownerName,
      permission,
      shareToken,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
      viewCount: 0,
      collaborators: [],
      allowComments: true,
      allowDownload: true,
      history: [{
        id: Date.now().toString(),
        userId: ownerEmail,
        userName: ownerName,
        action: 'link_created',
        timestamp: Date.now(),
        details: `Share link created with ${permission} permission`
      }]
    };

    await setDoc(sharedItemRef, {
      ...sharedItem,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = `${baseUrl}/share/${itemType}/${itemId}?token=${shareToken}&permission=${permission}`;

    return {
      shareToken,
      url,
      isNew: true
    };
  },

  // Get shared item by token
  async getSharedItemByToken(token: string): Promise<SharedItem | null> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', token), where('isActive', '==', true));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toMillis() || Date.now(),
      updatedAt: data.updatedAt?.toMillis() || Date.now(),
      expiresAt: data.expiresAt?.toMillis(),
      viewCount: data.viewCount || 0,
      collaborators: data.collaborators || [],
      allowComments: data.allowComments ?? true,
      allowDownload: data.allowDownload ?? true,
    } as SharedItem;
  },

  // Record a view action
  async recordView(token: string, userEmail?: string, userName?: string): Promise<void> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', token));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;
    
    const docRef = querySnapshot.docs[0].ref;
    const sharedItem = querySnapshot.docs[0].data() as SharedItem;
    
    const historyEntry: ShareHistoryEntry = {
      id: Date.now().toString(),
      userId: userEmail || 'anonymous',
      userName: userName || (userEmail ? userEmail.split('@')[0] : 'Anonymous User'),
      action: 'viewed',
      timestamp: Date.now(),
      details: `Viewed the shared ${sharedItem.itemType}`
    };
    
    const updatedHistory = [...(sharedItem.history || []), historyEntry];
    
    await updateDoc(docRef, {
      viewCount: (sharedItem.viewCount || 0) + 1,
      lastViewedAt: Date.now(),
      history: updatedHistory,
      updatedAt: Timestamp.now(),
    });
  },

  // Add collaborator with specific permission
  async addCollaborator(
    token: string, 
    collaboratorEmail: string, 
    permission: SharePermission,
    addedBy: string
  ): Promise<void> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', token));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;
    
    const docRef = querySnapshot.docs[0].ref;
    const sharedItem = querySnapshot.docs[0].data() as SharedItem;
    
    // Get collaborator info
    const collaboratorInfo = await userService.getUser(collaboratorEmail);
    const collaboratorName = collaboratorInfo ? `${collaboratorInfo.firstName} ${collaboratorInfo.lastName}` : collaboratorEmail.split('@')[0];
    
    const newCollaborator: ShareCollaborator = {
      email: collaboratorEmail,
      name: collaboratorName,
      permission,
      addedAt: Date.now(),
      addedBy
    };
    
    const updatedCollaborators = [...(sharedItem.collaborators || []), newCollaborator];
    
    const historyEntry: ShareHistoryEntry = {
      id: Date.now().toString(),
      userId: addedBy,
      action: 'collaborator_added',
      timestamp: Date.now(),
      details: `Added ${collaboratorName} with ${permission} permission`
    };
    
    const updatedHistory = [...(sharedItem.history || []), historyEntry];
    
    await updateDoc(docRef, {
      collaborators: updatedCollaborators,
      history: updatedHistory,
      updatedAt: Timestamp.now(),
    });
  },

  // Remove collaborator
  async removeCollaborator(token: string, collaboratorEmail: string, removedBy: string): Promise<void> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', token));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;
    
    const docRef = querySnapshot.docs[0].ref;
    const sharedItem = querySnapshot.docs[0].data() as SharedItem;
    
    const collaboratorToRemove = sharedItem.collaborators?.find(c => c.email === collaboratorEmail);
    const updatedCollaborators = (sharedItem.collaborators || []).filter(c => c.email !== collaboratorEmail);
    
    const historyEntry: ShareHistoryEntry = {
      id: Date.now().toString(),
      userId: removedBy,
      action: 'collaborator_removed',
      timestamp: Date.now(),
      details: `Removed ${collaboratorToRemove?.name || collaboratorEmail} from collaborators`
    };
    
    const updatedHistory = [...(sharedItem.history || []), historyEntry];
    
    await updateDoc(docRef, {
      collaborators: updatedCollaborators,
      history: updatedHistory,
      updatedAt: Timestamp.now(),
    });
  },

  // Get all shared items for an owner
  async getSharedItemsByOwner(ownerEmail: string): Promise<SharedItem[]> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(
      sharedItemsRef, 
      where('ownerEmail', '==', ownerEmail),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toMillis() || Date.now(),
        updatedAt: data.updatedAt?.toMillis() || Date.now(),
        expiresAt: data.expiresAt?.toMillis(),
        viewCount: data.viewCount || 0,
        collaborators: data.collaborators || [],
        allowComments: data.allowComments ?? true,
        allowDownload: data.allowDownload ?? true,
      } as SharedItem;
    });
  },

  // Add history entry to shared item with enhanced tracking
  async addHistoryEntry(
    token: string, 
    entry: Omit<ShareHistoryEntry, 'id' | 'timestamp'>,
    updateItemTimestamp: boolean = true
  ): Promise<void> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', token));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;
    
    const docRef = querySnapshot.docs[0].ref;
    const sharedItem = querySnapshot.docs[0].data() as SharedItem;
    
    const historyEntry: ShareHistoryEntry = {
      ...entry,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    
    const updatedHistory = [...(sharedItem.history || []), historyEntry];
    const updateData: any = {
      history: updatedHistory,
      updatedAt: Timestamp.now(),
    };
    
    // Track edit actions
    if (entry.action.includes('edit') || entry.action.includes('update') || entry.action.includes('change')) {
      updateData.lastEditedAt = Date.now();
      updateData.lastEditedBy = entry.userId;
    }
    
    await updateDoc(docRef, updateData);
  },

  // Revoke share access
  async revokeShareAccess(shareToken: string): Promise<void> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', shareToken));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;
    
    const docRef = querySnapshot.docs[0].ref;
    const sharedItem = querySnapshot.docs[0].data() as SharedItem;
    
    const historyEntry: ShareHistoryEntry = {
      id: Date.now().toString(),
      userId: sharedItem.ownerEmail,
      userName: sharedItem.ownerName,
      action: 'access_revoked',
      timestamp: Date.now(),
      details: 'Share access has been revoked'
    };
    
    const updatedHistory = [...(sharedItem.history || []), historyEntry];
    
    await updateDoc(docRef, {
      isActive: false,
      history: updatedHistory,
      updatedAt: Timestamp.now(),
    });
  },

  // Update share permission
  async updateSharePermission(shareToken: string, newPermission: SharePermission): Promise<void> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', shareToken));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;
    
    const docRef = querySnapshot.docs[0].ref;
    const sharedItem = querySnapshot.docs[0].data() as SharedItem;
    
    const historyEntry: ShareHistoryEntry = {
      id: Date.now().toString(),
      userId: sharedItem.ownerEmail,
      userName: sharedItem.ownerName,
      action: 'permission_changed',
      timestamp: Date.now(),
      fieldChanged: 'permission',
      oldValue: sharedItem.permission,
      newValue: newPermission,
      details: `Permission changed from ${sharedItem.permission} to ${newPermission}`
    };
    
    const updatedHistory = [...(sharedItem.history || []), historyEntry];
    
    await updateDoc(docRef, {
      permission: newPermission,
      history: updatedHistory,
      updatedAt: Timestamp.now(),
    });
  },

  // Generate new share token (regenerate link)
  async regenerateShareToken(oldToken: string): Promise<string> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', oldToken));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) throw new Error('Share not found');
    
    const docRef = querySnapshot.docs[0].ref;
    const sharedItem = querySnapshot.docs[0].data() as SharedItem;
    const newToken = this.generateShareToken();
    
    const historyEntry: ShareHistoryEntry = {
      id: Date.now().toString(),
      userId: sharedItem.ownerEmail,
      userName: sharedItem.ownerName,
      action: 'link_regenerated',
      timestamp: Date.now(),
      details: 'Share link was regenerated for security'
    };
    
    const updatedHistory = [...(sharedItem.history || []), historyEntry];
    
    await updateDoc(docRef, {
      shareToken: newToken,
      history: updatedHistory,
      updatedAt: Timestamp.now(),
    });
    
    return newToken;
  },

  // Get sharing analytics
  async getShareAnalytics(token: string): Promise<ShareAnalytics> {
    const sharedItem = await this.getSharedItemByToken(token);
    
    if (!sharedItem) {
      throw new Error('Share not found');
    }
    
    const history = sharedItem.history || [];
    const uniqueViewers = new Set(history.filter(h => h.action === 'viewed').map(h => h.userId)).size;
    const uniqueEditors = new Set(history.filter(h => h.action.includes('edit')).map(h => h.userId)).size;
    
    const actionCounts = history.reduce((acc, entry) => {
      acc[entry.action] = (acc[entry.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalViews: sharedItem.viewCount,
      uniqueViewers,
      totalEdits: history.filter(h => h.action.includes('edit')).length,
      uniqueEditors,
      topActions,
      recentActivity: history.slice(-10).reverse() // Last 10 activities
    };
  },

  // Check if item is expired
  isShareExpired(sharedItem: SharedItem): boolean {
    if (!sharedItem.expiresAt) return false;
    return Date.now() > sharedItem.expiresAt;
  },

  // Validate share access with enhanced permissions
  async validateShareAccess(
    token: string, 
    requiredPermission: SharePermission = 'view',
    userEmail?: string
  ): Promise<{
    isValid: boolean;
    sharedItem?: SharedItem;
    userPermission?: SharePermission;
    error?: string;
  }> {
    const sharedItem = await this.getSharedItemByToken(token);
    
    if (!sharedItem) {
      return { isValid: false, error: 'Share link not found or has been revoked' };
    }
    
    if (!sharedItem.isActive) {
      return { isValid: false, error: 'Share link has been deactivated' };
    }
    
    if (this.isShareExpired(sharedItem)) {
      return { isValid: false, error: 'Share link has expired' };
    }
    
    // Check if user is owner
    if (userEmail === sharedItem.ownerEmail) {
      return { isValid: true, sharedItem, userPermission: 'edit' };
    }
    
    // Check if user is a collaborator with specific permissions
    const collaborator = sharedItem.collaborators?.find(c => c.email === userEmail);
    if (collaborator) {
      const userPermission = collaborator.permission;
      if (requiredPermission === 'edit' && userPermission === 'view') {
        return { 
          isValid: false, 
          error: 'You only have view access to this item',
          userPermission 
        };
      }
      return { isValid: true, sharedItem, userPermission };
    }
    
    // Use general share permission
    const userPermission = sharedItem.permission;
    if (requiredPermission === 'edit' && userPermission === 'view') {
      return { 
        isValid: false, 
        error: 'This share link only allows viewing',
        userPermission
      };
    }
    
    return { isValid: true, sharedItem, userPermission };
  },

  // Update share settings
  async updateShareSettings(
    token: string, 
    settings: Partial<Pick<SharedItem, 'allowComments' | 'allowDownload' | 'expiresAt'>>
  ): Promise<void> {
    const sharedItemsRef = collection(db, COLLECTIONS.SHARED_ITEMS);
    const q = query(sharedItemsRef, where('shareToken', '==', token));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return;
    
    const docRef = querySnapshot.docs[0].ref;
    const sharedItem = querySnapshot.docs[0].data() as SharedItem;
    
    const historyEntry: ShareHistoryEntry = {
      id: Date.now().toString(),
      userId: sharedItem.ownerEmail,
      userName: sharedItem.ownerName,
      action: 'settings_updated',
      timestamp: Date.now(),
      details: `Share settings updated: ${Object.keys(settings).join(', ')}`
    };
    
    const updatedHistory = [...(sharedItem.history || []), historyEntry];
    
    await updateDoc(docRef, {
      ...settings,
      history: updatedHistory,
      updatedAt: Timestamp.now(),
    });
  }
};

// Chat Service for AI Conversation Hub
export const chatService = {
  // Create a new chat session
  async createChatSession(userEmail: string, title?: string): Promise<string> {
    const sessionId = `${userEmail}_${Date.now()}`;
    const sessionRef = doc(db, COLLECTIONS.CHAT_SESSIONS, sessionId);
    
    const sessionData: Omit<ChatSession, 'id'> = {
      userEmail,
      title: title || 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      isActive: true,
    };
    
    await setDoc(sessionRef, sessionData);
    return sessionId;
  },

  // Get user's chat sessions
  async getChatSessions(userEmail: string): Promise<ChatSession[]> {
    const sessionsRef = collection(db, COLLECTIONS.CHAT_SESSIONS);
    const q = query(
      sessionsRef,
      where('userEmail', '==', userEmail),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatSession[];
  },

  // Add message to session
  async addMessage(sessionId: string, message: Omit<ChatMessage, 'id'>): Promise<string> {
    const messageId = `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageRef = doc(db, COLLECTIONS.CHAT_MESSAGES, messageId);
    
    const messageData = {
      ...message,
      sessionId,
    };
    
    await setDoc(messageRef, messageData);
    
    // Update session with latest info
    const sessionRef = doc(db, COLLECTIONS.CHAT_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      updatedAt: Date.now(),
      messageCount: increment(1),
      lastMessage: message.content.substring(0, 100),
    });
    
    return messageId;
  },

  // Get messages for a session
  async getSessionMessages(sessionId: string, lastMessageDoc?: DocumentSnapshot): Promise<{ messages: ChatMessage[], hasMore: boolean }> {
    const messagesRef = collection(db, COLLECTIONS.CHAT_MESSAGES);
    let q = query(
      messagesRef,
      where('sessionId', '==', sessionId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    if (lastMessageDoc) {
      q = query(
        messagesRef,
        where('sessionId', '==', sessionId),
        orderBy('timestamp', 'desc'),
        startAfter(lastMessageDoc),
        limit(50)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const messages = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatMessage[];
    
    return {
      messages: messages.reverse(), // Reverse to get chronological order
      hasMore: querySnapshot.docs.length === 50
    };
  },

  // Update session title
  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const sessionRef = doc(db, COLLECTIONS.CHAT_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      title,
      updatedAt: Date.now(),
    });
  },

  // Delete chat session and all its messages
  async deleteSession(sessionId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete session
    const sessionRef = doc(db, COLLECTIONS.CHAT_SESSIONS, sessionId);
    batch.delete(sessionRef);
    
    // Delete all messages in the session
    const messagesRef = collection(db, COLLECTIONS.CHAT_MESSAGES);
    const q = query(messagesRef, where('sessionId', '==', sessionId));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  },

  // Get current active session for user
  async getActiveSession(userEmail: string): Promise<ChatSession | null> {
    const sessionsRef = collection(db, COLLECTIONS.CHAT_SESSIONS);
    const q = query(
      sessionsRef,
      where('userEmail', '==', userEmail),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as ChatSession;
  },

  // Set session as active/inactive
  async setSessionActive(sessionId: string, isActive: boolean): Promise<void> {
    const sessionRef = doc(db, COLLECTIONS.CHAT_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      isActive,
      updatedAt: Date.now(),
    });
  }
};

// Unified Notification Service
export const notificationService = {
  // Generate unique notification ID
  generateNotificationId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Add notification to Firestore
  async addNotification(
    userEmail: string, 
    notification: Omit<NotificationDocument, 'id' | 'userEmail' | 'createdAt' | 'isRead'>
  ): Promise<string> {
    const notificationId = this.generateNotificationId();
    const notificationRef = doc(db, `users/${userEmail}/notifications`, notificationId);
    
    // Remove undefined relatedTaskId before writing
    const cleanNotification = {
      ...notification,
      relatedTaskId:
        typeof notification.relatedTaskId !== 'undefined'
          ? notification.relatedTaskId
          : undefined,
    };
    const notificationData: NotificationDocument = {
      id: notificationId,
      userEmail,
      ...cleanNotification,
      isRead: false,
      createdAt: Date.now(),
    };
    
    try {
      await setDoc(notificationRef, notificationData);
      return notificationId;
    } catch (error) {
      console.error('Failed to write notification to Firestore:', error);
      throw error;
    }
  },

  // Get notifications for user
  async getNotifications(userEmail: string, maxCount?: number): Promise<NotificationDocument[]> {
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    const q = query(
      notificationsRef,
      orderBy('createdAt', 'desc'),
      ...(maxCount ? [limit(maxCount)] : [])
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt || Date.now(),
      sentAt: doc.data().sentAt,
      readAt: doc.data().readAt,
    })) as NotificationDocument[];
  },

  // Subscribe to real-time notifications
  subscribeToNotifications(
    userEmail: string, 
    callback: (notifications: NotificationDocument[]) => void
  ): () => void {
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    const q = query(notificationsRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
      const notifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || Date.now(),
        sentAt: doc.data().sentAt,
        readAt: doc.data().readAt,
      })) as NotificationDocument[];
      callback(notifications);
    });
  },

  // Mark notification as read
  async markAsRead(userEmail: string, notificationId: string): Promise<void> {
    const notificationRef = doc(db, `users/${userEmail}/notifications`, notificationId);
    await updateDoc(notificationRef, {
      isRead: true,
      readAt: Date.now(),
    });
  },

  // Mark all notifications as read
  async markAllAsRead(userEmail: string): Promise<void> {
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    const q = query(notificationsRef, where('isRead', '==', false));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        isRead: true,
        readAt: Date.now(),
      });
    });
    
    await batch.commit();
  },

  // Delete notification
  async deleteNotification(userEmail: string, notificationId: string): Promise<void> {
    const notificationRef = doc(db, `users/${userEmail}/notifications`, notificationId);
    await deleteDoc(notificationRef);
  },

  // Delete notifications by taskId
  async deleteNotificationsByTaskId(userEmail: string, taskId: string): Promise<void> {
    if (!userEmail || !taskId) return;
    
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    
    // First query: check relatedTaskId field
    const relatedTaskQuery = query(
      notificationsRef, 
      where('relatedTaskId', '==', taskId)
    );
    
    // Second query: check data.taskId field
    const dataTaskIdQuery = query(
      notificationsRef, 
      where('data.taskId', '==', taskId)
    );
    
    try {
      // Execute both queries
      const [relatedTaskSnapshot, dataTaskIdSnapshot] = await Promise.all([
        getDocs(relatedTaskQuery),
        getDocs(dataTaskIdQuery)
      ]);
      
      if (relatedTaskSnapshot.empty && dataTaskIdSnapshot.empty) {
        return; // No notifications to delete
      }
      
      // Combine results, avoiding duplicates
      const toDelete = new Set<DocumentReference>();
      relatedTaskSnapshot.docs.forEach(doc => toDelete.add(doc.ref));
      dataTaskIdSnapshot.docs.forEach(doc => toDelete.add(doc.ref));
      
      // Delete in batch
      if (toDelete.size > 0) {
        const batch = writeBatch(db);
        toDelete.forEach(docRef => {
          batch.delete(docRef);
        });
        await batch.commit();
        console.log(`Deleted ${toDelete.size} notifications for task ${taskId}`);
      }
    } catch (error) {
      console.error('Error deleting notifications by taskId:', error);
      throw error;
    }
  },

  // Clear all notifications
  async clearAllNotifications(userEmail: string): Promise<void> {
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    const querySnapshot = await getDocs(notificationsRef);
    
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  },

  // Get notification statistics
  async getNotificationStats(userEmail: string): Promise<NotificationStats> {
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    const querySnapshot = await getDocs(notificationsRef);
    
    const notifications = querySnapshot.docs.map(doc => doc.data()) as NotificationDocument[];
    const unreadCount = notifications.filter(n => !n.isRead).length;
    
    const notificationsByType = notifications.reduce((acc, notif) => {
      const type = notif.data?.type || notif.type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const dailyNotificationCount = notifications.filter(n => n.createdAt > oneDayAgo).length;
    const weeklyNotificationCount = notifications.filter(n => n.createdAt > oneWeekAgo).length;
    
    const lastNotification = notifications.sort((a, b) => b.createdAt - a.createdAt)[0];
    
    return {
      totalNotifications: notifications.length,
      unreadCount,
      notificationsByType,
      lastNotificationAt: lastNotification?.createdAt,
      dailyNotificationCount,
      weeklyNotificationCount,
    };
  },

  // Get unread count only (optimized)
  async getUnreadCount(userEmail: string): Promise<number> {
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    const q = query(notificationsRef, where('isRead', '==', false));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  },

  // Subscribe to unread count only (optimized)
  subscribeToUnreadCount(
    userEmail: string, 
    callback: (count: number) => void
  ): () => void {
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    const q = query(notificationsRef, where('isRead', '==', false));
    
    return onSnapshot(q, (querySnapshot) => {
      callback(querySnapshot.size);
    });
  },

  // Check if notification exists to prevent duplicates
  async notificationExists(userEmail: string, notificationData: { 
    title: string, 
    relatedTaskId?: string,
    type: string 
  }): Promise<boolean> {
    const notificationsRef = collection(db, `users/${userEmail}/notifications`);
    let q = query(
      notificationsRef, 
      where('title', '==', notificationData.title),
      where('type', '==', notificationData.type),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    if (notificationData.relatedTaskId) {
      q = query(
        notificationsRef, 
        where('title', '==', notificationData.title),
        where('relatedTaskId', '==', notificationData.relatedTaskId),
        where('type', '==', notificationData.type),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
    }
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return false;
    }
    
    // Check if the notification was created within the last hour to prevent duplicates
    const recentNotification = querySnapshot.docs[0].data();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const isRecent = recentNotification.createdAt > oneHourAgo;
    
    return isRecent;
  },

  // Add notification with duplicate check
  async addNotificationSafely(
    userEmail: string, 
    notification: Omit<NotificationDocument, 'id' | 'userEmail' | 'createdAt' | 'isRead'>
  ): Promise<string | null> {
    // Check for duplicates
    const exists = await this.notificationExists(userEmail, {
      title: notification.title,
      relatedTaskId: notification.relatedTaskId,
      type: notification.data?.type || notification.type,
    });
    
    if (exists) {
      return null;
    }
    
    try {
      return await this.addNotification(userEmail, notification);
    } catch (error) {
      console.error('addNotificationSafely failed:', error);
      return null;
    }
  },
};
