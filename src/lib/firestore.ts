
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
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import type { 
  Task, User, Accomplishment, Note, SharedItem, ShareHistoryEntry, SharePermission, ShareCollaborator, ShareAnalytics, 
  GoogleCalendarSettings, ChatMessage, ChatSession, ChatContext, NotificationDocument, NotificationData, NotificationStats,
  Team, TeamMember, TeamRole, TeamPermissions, Workspace, WorkspaceSettings, WorkspaceStats, TeamTask, TaskDependency, TaskTemplate,
  BatchOperation, BatchResult, AutomationRule, TeamAnalytics, SearchQuery, SearchResult, ProjectTemplate,
  TeamChatMessage, Resource, ResourceBooking
} from './types';

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
  // New team collaboration collections
  TEAMS: 'teams',
  TEAM_MEMBERS: 'teamMembers',
  WORKSPACES: 'workspaces',
  TEAM_TASKS: 'teamTasks',
  TASK_DEPENDENCIES: 'taskDependencies',
  TASK_TEMPLATES: 'taskTemplates',
  PROJECT_TEMPLATES: 'projectTemplates',
  BATCH_OPERATIONS: 'batchOperations',
  AUTOMATION_RULES: 'automationRules',
  TEAM_ANALYTICS: 'teamAnalytics',
  SEARCH_QUERIES: 'searchQueries',
  TEAM_CHAT_MESSAGES: 'teamChatMessages',
  RESOURCES: 'resources',
  RESOURCE_BOOKINGS: 'resourceBookings'
} as const;

// User operations
export const userService = {
  async createUser(userData: User): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, userData.email);
    await setDoc(userRef, {
      ...userData,
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
    await updateDoc(userRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  async userExists(email: string): Promise<boolean> {
    const userRef = doc(db, COLLECTIONS.USERS, email);
    const userSnap = await getDoc(userRef);
    return userSnap.exists();
  }
};

const serializeTaskForFirestore = (task: any) => {
    const data: any = { ...task };
    if (data.reminderAt) {
      data.reminderAt = Timestamp.fromMillis(data.reminderAt);
    }
    if (data.recurrence?.endDate) {
      data.recurrence.endDate = Timestamp.fromMillis(data.recurrence.endDate);
    }
    // Remove fields with undefined values to avoid Firestore errors
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
      if (key === 'recurrence' && data.recurrence && data.recurrence.endDate === undefined) {
        delete data.recurrence.endDate;
      }
    });
    return data;
}

const deserializeTaskFromFirestore = (docSnap: any) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
      completedAt: data.completedAt?.toMillis ? data.completedAt.toMillis() : data.completedAt,
      lastRejectedAt: data.lastRejectedAt?.toMillis ? data.lastRejectedAt.toMillis() : data.lastRejectedAt,
      reminderAt: data.reminderAt?.toMillis ? data.reminderAt.toMillis() : data.reminderAt,
      recurrence: data.recurrence ? {
          ...data.recurrence,
          endDate: data.recurrence.endDate?.toMillis ? data.recurrence.endDate.toMillis() : data.recurrence.endDate,
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
    try {
      console.log('🔍 Firebase addTask called with:', { userEmail, task });
      const tasksRef = collection(db, COLLECTIONS.TASKS);
      // Build taskData, omitting undefined fields
      const taskData: any = {
        ...task,
        userEmail,
        createdAt: Timestamp.now(), // Use server timestamp
      };
      
      console.log('🔍 Task data to be saved:', taskData);
      const serializedData = serializeTaskForFirestore(taskData);
      console.log('🔍 Serialized task data:', serializedData);
      
      const docRef = doc(tasksRef);
      console.log('🔍 Saving task to Firebase with ID:', docRef.id);
      await setDoc(docRef, serializedData);
      console.log('✅ Task saved to Firebase successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Firebase addTask error:', error);
      throw error;
    }
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
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    const updateData: any = { ...updates };
    
    // Remove undefined fields before processing
    Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
            delete updateData[key];
        }
    });

    // Convert timestamps
    if ('completedAt' in updateData && updateData.completedAt) {
      updateData.completedAt = Timestamp.fromMillis(updateData.completedAt);
    }
    if ('lastRejectedAt' in updateData && updateData.lastRejectedAt) {
      updateData.lastRejectedAt = Timestamp.fromMillis(updateData.lastRejectedAt);
    }
    if ('reminderAt' in updateData && updateData.reminderAt) {
      updateData.reminderAt = Timestamp.fromMillis(updateData.reminderAt);
    }
     if ('notifiedAt' in updateData && updateData.notifiedAt) {
      updateData.notifiedAt = Timestamp.fromMillis(updateData.notifiedAt);
    }
    if (updateData.recurrence && 'endDate' in updateData.recurrence && updateData.recurrence.endDate) {
        updateData.recurrence.endDate = Timestamp.fromMillis(updateData.recurrence.endDate);
    } else if (updateData.recurrence && 'endDate' in updateData.recurrence) {
        // Handle removal of endDate
        delete updateData.recurrence.endDate;
    }
    
    await updateDoc(taskRef, updateData);
  },

  async deleteTask(taskId: string): Promise<void> {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    await deleteDoc(taskRef);
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
        console.log('🔥 Firestore getNotes called for user:', userEmail);
        const notesRef = collection(db, COLLECTIONS.NOTES);
        const q = query(notesRef, where('userEmail', '==', userEmail), orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        console.log('🔥 Firestore query returned', querySnapshot.docs.length, 'notes');
        const notes = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : data.createdAt || Date.now(),
                updatedAt: typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : data.updatedAt || Date.now(),
            } as Note;
        });
        if (notes.length > 0) {
            console.log('🔥 Note details:', notes.map(note => ({ id: note.id, title: note.title, userEmail: note.userEmail })));
        }
        return notes;
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
        console.log('🔥 Firestore addNote called with:', { userEmail: note.userEmail, title: note.title, hasUserEmail: !!note.userEmail });
        const notesRef = collection(db, COLLECTIONS.NOTES);
        const now = Timestamp.now();
        const docRef = doc(notesRef);
        const noteToSave = { ...note, createdAt: now, updatedAt: now };
        console.log('🔥 Saving note to Firestore:', { id: docRef.id, userEmail: noteToSave.userEmail, title: noteToSave.title });
        await setDoc(docRef, noteToSave);
        console.log('✅ Note saved to Firestore with ID:', docRef.id);
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

// Google Calendar settings operations
export const googleCalendarService = {
  async getGoogleCalendarSettings(userEmail: string): Promise<GoogleCalendarSettings | null> {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userEmail);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        return userData.googleCalendarSettings || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting Google Calendar settings:', error);
      return null;
    }
  },

  async updateGoogleCalendarSettings(userEmail: string, settings: Partial<GoogleCalendarSettings>): Promise<void> {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userEmail);
      
      // Get existing settings to preserve connectedAt if it exists
      const existingDoc = await getDoc(userRef);
      const existingSettings = existingDoc.exists() ? existingDoc.data()?.googleCalendarSettings : null;
      
      const updateData = {
        ...settings,
        lastSyncAt: settings.lastSyncAt || Date.now()
      };
      
      // Only set connectedAt if it doesn't exist and we're connecting
      if (!existingSettings?.connectedAt && settings.isConnected) {
        updateData.connectedAt = Date.now();
      }
      
      await updateDoc(userRef, {
        [`googleCalendarSettings`]: updateData
      });
    } catch (error) {
      console.error('Error updating Google Calendar settings:', error);
      throw error;
    }
  },

  async disconnectGoogleCalendar(userEmail: string): Promise<void> {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userEmail);
      await updateDoc(userRef, {
        [`googleCalendarSettings`]: {
          isConnected: false,
          syncEnabled: false,
          accessToken: undefined,
          refreshToken: undefined,
          tokenExpiresAt: undefined,
          userEmail: undefined,
          defaultCalendarId: undefined,
          syncStatus: 'idle',
          lastError: undefined,
          connectedAt: undefined,
          lastSyncAt: undefined
        }
      });
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      throw error;
    }
  },

  async syncTaskToGoogleCalendar(userEmail: string, taskId: string, syncData: {
    googleCalendarEventId?: string;
    syncStatus: 'pending' | 'synced' | 'error' | 'deleted';
    lastSync?: number;
    googleCalendarUrl?: string;
    error?: string;
  }): Promise<void> {
    try {
      const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
      await updateDoc(taskRef, {
        googleCalendarEventId: syncData.googleCalendarEventId || null,
        googleCalendarSyncStatus: syncData.syncStatus,
        googleCalendarLastSync: syncData.lastSync || Date.now(),
        googleCalendarUrl: syncData.googleCalendarUrl || null,
        ...(syncData.error && { googleCalendarError: syncData.error })
      });
    } catch (error) {
      console.error('Error updating task Google Calendar sync status:', error);
      throw error;
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

// ============================================================================
// TEAM COLLABORATION SERVICES
// ============================================================================

// Team operations
export const teamService = {
  // Create a new team
  async createTeam(teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'memberCount'>): Promise<string> {
    const teamsRef = collection(db, COLLECTIONS.TEAMS);
    const teamRef = doc(teamsRef);
    
    const team: Omit<Team, 'id'> = {
      ...teamData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      memberCount: 1, // Owner is the first member
      isActive: true,
    };
    
    await setDoc(teamRef, team);
    
    // Add owner as first team member
    await teamMemberService.addTeamMember(teamRef.id, teamData.ownerId, 'owner', teamData.ownerId);
    
    return teamRef.id;
  },

  // Get team by ID
  async getTeam(teamId: string): Promise<Team | null> {
    const teamRef = doc(db, COLLECTIONS.TEAMS, teamId);
    const teamSnap = await getDoc(teamRef);
    
    if (teamSnap.exists()) {
      return { id: teamSnap.id, ...teamSnap.data() } as Team;
    }
    return null;
  },

  // Get teams for a user
  async getUserTeams(userEmail: string): Promise<Team[]> {
    const teamMembersRef = collection(db, COLLECTIONS.TEAM_MEMBERS);
    const memberQuery = query(teamMembersRef, where('userId', '==', userEmail), where('status', '==', 'active'));
    const memberSnapshot = await getDocs(memberQuery);
    
    if (memberSnapshot.empty) return [];
    
    const teamIds = memberSnapshot.docs.map(doc => doc.data().teamId);
    const teamsRef = collection(db, COLLECTIONS.TEAMS);
    
    // Firestore 'in' queries are limited to 10 values, so we need to batch the requests
    const teamBatches = [];
    for (let i = 0; i < teamIds.length; i += 10) {
      const batchIds = teamIds.slice(i, i + 10);
      const batchQuery = query(teamsRef, where('__name__', 'in', batchIds), where('isActive', '==', true));
      teamBatches.push(getDocs(batchQuery));
    }
    
    const batchResults = await Promise.all(teamBatches);
    const teams: Team[] = [];
    
    batchResults.forEach(querySnapshot => {
      querySnapshot.docs.forEach(doc => {
        teams.push({ id: doc.id, ...doc.data() } as Team);
      });
    });
    
    return teams;
  },

  // Update team
  async updateTeam(teamId: string, updates: Partial<Omit<Team, 'id' | 'createdAt'>>): Promise<void> {
    const teamRef = doc(db, COLLECTIONS.TEAMS, teamId);
    await updateDoc(teamRef, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  // Delete team (archive)
  async deleteTeam(teamId: string): Promise<void> {
    const teamRef = doc(db, COLLECTIONS.TEAMS, teamId);
    await updateDoc(teamRef, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },

  // Update member count
  async updateMemberCount(teamId: string, delta: number): Promise<void> {
    const teamRef = doc(db, COLLECTIONS.TEAMS, teamId);
    await updateDoc(teamRef, {
      memberCount: increment(delta),
      updatedAt: Date.now(),
    });
  },
};

// Team member operations
export const teamMemberService = {
  // Add team member
  async addTeamMember(teamId: string, userId: string, role: TeamRole, invitedBy: string): Promise<string> {
    const membersRef = collection(db, COLLECTIONS.TEAM_MEMBERS);
    const memberRef = doc(membersRef);
    
    // Get user info
    const userInfo = await userService.getUser(userId);
    const userName = userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : userId.split('@')[0];
    
    // Generate default permissions based on role
    const permissions = generateDefaultPermissions(role);
    
    const member: Omit<TeamMember, 'id'> = {
      teamId,
      userId,
      userName,
      role,
      joinedAt: Date.now(),
      invitedBy,
      status: 'active',
      permissions,
    };
    
    await setDoc(memberRef, member);
    
    // Update team member count
    await teamService.updateMemberCount(teamId, 1);
    
    return memberRef.id;
  },

  // Get team members
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const membersRef = collection(db, COLLECTIONS.TEAM_MEMBERS);
    const q = query(
      membersRef,
      where('teamId', '==', teamId),
      where('status', '==', 'active'),
      orderBy('joinedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember));
  },

  // Update team member
  async updateTeamMember(memberId: string, updates: Partial<Omit<TeamMember, 'id' | 'teamId' | 'userId' | 'joinedAt'>>): Promise<void> {
    const memberRef = doc(db, COLLECTIONS.TEAM_MEMBERS, memberId);
    await updateDoc(memberRef, {
      ...updates,
      lastActiveAt: Date.now(),
    });
  },

  // Remove team member
  async removeTeamMember(memberId: string, teamId: string): Promise<void> {
    const memberRef = doc(db, COLLECTIONS.TEAM_MEMBERS, memberId);
    await updateDoc(memberRef, {
      status: 'inactive',
    });
    
    // Update team member count
    await teamService.updateMemberCount(teamId, -1);
  },

  // Get member permissions
  async getMemberPermissions(teamId: string, userId: string): Promise<TeamPermissions | null> {
    const membersRef = collection(db, COLLECTIONS.TEAM_MEMBERS);
    const q = query(
      membersRef,
      where('teamId', '==', teamId),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    
    const member = querySnapshot.docs[0].data() as TeamMember;
    return member.permissions;
  },
};

// Helper function to generate default permissions based on role
function generateDefaultPermissions(role: TeamRole): TeamPermissions {
  switch (role) {
    case 'owner':
      return {
        canCreateTasks: true,
        canAssignTasks: true,
        canEditAllTasks: true,
        canDeleteTasks: true,
        canManageMembers: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canManageTemplates: true,
      };
    case 'admin':
      return {
        canCreateTasks: true,
        canAssignTasks: true,
        canEditAllTasks: true,
        canDeleteTasks: true,
        canManageMembers: true,
        canManageSettings: false,
        canViewAnalytics: true,
        canManageTemplates: true,
      };
    case 'member':
      return {
        canCreateTasks: true,
        canAssignTasks: false,
        canEditAllTasks: false,
        canDeleteTasks: false,
        canManageMembers: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageTemplates: false,
      };
    case 'viewer':
      return {
        canCreateTasks: false,
        canAssignTasks: false,
        canEditAllTasks: false,
        canDeleteTasks: false,
        canManageMembers: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageTemplates: false,
      };
    default:
      return {
        canCreateTasks: false,
        canAssignTasks: false,
        canEditAllTasks: false,
        canDeleteTasks: false,
        canManageMembers: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageTemplates: false,
      };
  }
}

// Workspace operations
export const workspaceService = {
  // Create workspace
  async createWorkspace(workspaceData: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<string> {
    const workspacesRef = collection(db, COLLECTIONS.WORKSPACES);
    const workspaceRef = doc(workspacesRef);
    
    const workspace: Omit<Workspace, 'id'> = {
      ...workspaceData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        totalTasks: 0,
        completedTasks: 0,
        activeTasks: 0,
        overdueTasks: 0,
        totalMembers: workspaceData.memberIds.length,
      },
    };
    
    await setDoc(workspaceRef, workspace);
    return workspaceRef.id;
  },

  // Get workspace
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
    const workspaceSnap = await getDoc(workspaceRef);
    
    if (workspaceSnap.exists()) {
      return { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;
    }
    return null;
  },

  // Get workspaces for team
  async getTeamWorkspaces(teamId: string): Promise<Workspace[]> {
    const workspacesRef = collection(db, COLLECTIONS.WORKSPACES);
    const q = query(
      workspacesRef,
      where('teamId', '==', teamId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
  },

  // Get workspaces for user
  async getUserWorkspaces(userEmail: string): Promise<Workspace[]> {
    const workspacesRef = collection(db, COLLECTIONS.WORKSPACES);
    const q = query(
      workspacesRef,
      where('memberIds', 'array-contains', userEmail),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
  },

  // Update workspace
  async updateWorkspace(workspaceId: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<void> {
    const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
    await updateDoc(workspaceRef, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  // Add member to workspace
  async addWorkspaceMember(workspaceId: string, userEmail: string): Promise<void> {
    const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
    const workspace = await this.getWorkspace(workspaceId);
    
    if (workspace && !workspace.memberIds.includes(userEmail)) {
      const updatedMemberIds = [...workspace.memberIds, userEmail];
      await updateDoc(workspaceRef, {
        memberIds: updatedMemberIds,
        'stats.totalMembers': updatedMemberIds.length,
        updatedAt: Date.now(),
      });
    }
  },

  // Remove member from workspace
  async removeWorkspaceMember(workspaceId: string, userEmail: string): Promise<void> {
    const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
    const workspace = await this.getWorkspace(workspaceId);
    
    if (workspace) {
      const updatedMemberIds = workspace.memberIds.filter(id => id !== userEmail);
      await updateDoc(workspaceRef, {
        memberIds: updatedMemberIds,
        'stats.totalMembers': updatedMemberIds.length,
        updatedAt: Date.now(),
      });
    }
  },

  // Update workspace stats
  async updateWorkspaceStats(workspaceId: string, stats: Partial<WorkspaceStats>): Promise<void> {
    const workspaceRef = doc(db, COLLECTIONS.WORKSPACES, workspaceId);
    
    const updateData: any = {};
    Object.entries(stats).forEach(([key, value]) => {
      updateData[`stats.${key}`] = value;
    });
    
    await updateDoc(workspaceRef, {
      ...updateData,
      'stats.lastActivityAt': Date.now(),
      updatedAt: Date.now(),
    });
  },
};

// Team task operations (extends regular task operations)
export const teamTaskService = {
  // Create team task
  async createTeamTask(teamTaskData: Omit<TeamTask, 'id' | 'createdAt'>): Promise<string> {
    const teamTasksRef = collection(db, COLLECTIONS.TEAM_TASKS);
    const taskRef = doc(teamTasksRef);
    
    const teamTask: Omit<TeamTask, 'id'> = {
      ...teamTaskData,
      createdAt: Date.now(),
    };
    
    await setDoc(taskRef, serializeTaskForFirestore(teamTask));
    
    // Update workspace stats if workspace is specified
    if (teamTask.workspaceId) {
      await workspaceService.updateWorkspaceStats(teamTask.workspaceId, {
        totalTasks: increment(1) as any,
        activeTasks: increment(1) as any,
      });
    }
    
    return taskRef.id;
  },

  // Get team tasks for workspace
  async getWorkspaceTasks(workspaceId: string): Promise<TeamTask[]> {
    const teamTasksRef = collection(db, COLLECTIONS.TEAM_TASKS);
    const q = query(
      teamTasksRef,
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const taskData = deserializeTaskFromFirestore(doc);
      return {
        ...taskData,
        id: doc.id, // Ensure the document ID is used
      } as TeamTask;
    });
  },

  // Get tasks assigned to user
  async getAssignedTasks(userEmail: string, workspaceId?: string): Promise<TeamTask[]> {
    const teamTasksRef = collection(db, COLLECTIONS.TEAM_TASKS);
    let q = query(
      teamTasksRef,
      where('assigneeId', '==', userEmail),
      orderBy('createdAt', 'desc')
    );
    
    if (workspaceId) {
      q = query(
        teamTasksRef,
        where('workspaceId', '==', workspaceId),
        where('assigneeId', '==', userEmail),
        orderBy('createdAt', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const taskData = deserializeTaskFromFirestore(doc);
      return {
        ...taskData,
        id: doc.id, // Ensure the document ID is used
      } as TeamTask;
    });
  },

  // Assign task to team member
  async assignTask(taskId: string, assigneeId: string, assignedBy: string, notes?: string): Promise<void> {
    const taskRef = doc(db, COLLECTIONS.TEAM_TASKS, taskId);
    
    // Get assignee info
    const assigneeInfo = await userService.getUser(assigneeId);
    const assigneeName = assigneeInfo ? `${assigneeInfo.firstName} ${assigneeInfo.lastName}` : assigneeId.split('@')[0];
    
    await updateDoc(taskRef, {
      assigneeId,
      assigneeName,
      assignedBy,
      assignedAt: Date.now(),
      assignmentStatus: 'pending',
      assignmentNotes: notes || null,
    });
  },

  // Accept/decline task assignment
  async updateAssignmentStatus(taskId: string, status: 'accepted' | 'declined'): Promise<void> {
    const taskRef = doc(db, COLLECTIONS.TEAM_TASKS, taskId);
    const updateData: any = {
      assignmentStatus: status,
    };
    
    if (status === 'accepted') {
      updateData.acceptedAt = Date.now();
    }
    
    await updateDoc(taskRef, updateData);
  },

  // Add collaborator to task
  async addCollaborator(taskId: string, userEmail: string): Promise<void> {
    const taskRef = doc(db, COLLECTIONS.TEAM_TASKS, taskId);
    const task = await getDoc(taskRef);
    
    if (task.exists()) {
      const taskData = task.data() as TeamTask;
      const currentCollaborators = taskData.collaborators || [];
      
      if (!currentCollaborators.includes(userEmail)) {
        await updateDoc(taskRef, {
          collaborators: [...currentCollaborators, userEmail],
        });
      }
    }
  },

  // Remove collaborator from task
  async removeCollaborator(taskId: string, userEmail: string): Promise<void> {
    const taskRef = doc(db, COLLECTIONS.TEAM_TASKS, taskId);
    const task = await getDoc(taskRef);
    
    if (task.exists()) {
      const taskData = task.data() as TeamTask;
      const currentCollaborators = taskData.collaborators || [];
      
      await updateDoc(taskRef, {
        collaborators: currentCollaborators.filter(email => email !== userEmail),
      });
    }
  },

  // Subscribe to team tasks
  subscribeToTeamTasks(workspaceId: string, callback: (tasks: TeamTask[]) => void): () => void {
    const teamTasksRef = collection(db, COLLECTIONS.TEAM_TASKS);
    const q = query(
      teamTasksRef,
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const tasks = querySnapshot.docs.map(doc => {
        const taskData = deserializeTaskFromFirestore(doc);
        return {
          ...taskData,
          id: doc.id, // Ensure the document ID is used
        } as TeamTask;
      });
      callback(tasks);
    });
  },
};

// Task dependency operations
export const taskDependencyService = {
  // Add task dependency
  async addDependency(dependency: Omit<TaskDependency, 'id' | 'createdAt'>): Promise<string> {
    const dependenciesRef = collection(db, COLLECTIONS.TASK_DEPENDENCIES);
    const dependencyRef = doc(dependenciesRef);
    
    const dependencyData: Omit<TaskDependency, 'id'> = {
      ...dependency,
      createdAt: Date.now(),
    };
    
    await setDoc(dependencyRef, dependencyData);
    return dependencyRef.id;
  },

  // Get task dependencies
  async getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
    const dependenciesRef = collection(db, COLLECTIONS.TASK_DEPENDENCIES);
    const q = query(
      dependenciesRef,
      where('successorTaskId', '==', taskId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskDependency));
  },

  // Get dependent tasks
  async getDependentTasks(taskId: string): Promise<TaskDependency[]> {
    const dependenciesRef = collection(db, COLLECTIONS.TASK_DEPENDENCIES);
    const q = query(
      dependenciesRef,
      where('predecessorTaskId', '==', taskId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskDependency));
  },

  // Remove dependency
  async removeDependency(dependencyId: string): Promise<void> {
    const dependencyRef = doc(db, COLLECTIONS.TASK_DEPENDENCIES, dependencyId);
    await deleteDoc(dependencyRef);
  },

  // Get workspace dependencies (for visualization)
  async getWorkspaceDependencies(workspaceId: string): Promise<TaskDependency[]> {
    const dependenciesRef = collection(db, COLLECTIONS.TASK_DEPENDENCIES);
    const q = query(
      dependenciesRef,
      where('workspaceId', '==', workspaceId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskDependency));
  },

  // Check for circular dependencies
  async hasCircularDependency(predecessorId: string, successorId: string): Promise<boolean> {
    // Simple check - in a real implementation, you'd do a more thorough graph traversal
    const dependencies = await this.getTaskDependencies(predecessorId);
    return dependencies.some(dep => dep.predecessorTaskId === successorId);
  },
};

// Template operations
export const templateService = {
  // Create task template
  async createTaskTemplate(template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'version'>): Promise<string> {
    const templatesRef = collection(db, COLLECTIONS.TASK_TEMPLATES);
    const templateRef = doc(templatesRef);
    
    const templateData: Omit<TaskTemplate, 'id'> = {
      ...template,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
      version: 1,
    };
    
    await setDoc(templateRef, templateData);
    return templateRef.id;
  },

  // Get task templates
  async getTaskTemplates(workspaceId?: string, isPublic?: boolean): Promise<TaskTemplate[]> {
    const templatesRef = collection(db, COLLECTIONS.TASK_TEMPLATES);
    let q = query(templatesRef, orderBy('usageCount', 'desc'));
    
    if (workspaceId) {
      q = query(
        templatesRef,
        where('workspaceId', '==', workspaceId),
        orderBy('usageCount', 'desc')
      );
    } else if (isPublic !== undefined) {
      q = query(
        templatesRef,
        where('isPublic', '==', isPublic),
        orderBy('usageCount', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskTemplate));
  },

  // Get template by ID
  async getTaskTemplate(templateId: string): Promise<TaskTemplate | null> {
    const templateRef = doc(db, COLLECTIONS.TASK_TEMPLATES, templateId);
    const templateSnap = await getDoc(templateRef);
    
    if (templateSnap.exists()) {
      return { id: templateSnap.id, ...templateSnap.data() } as TaskTemplate;
    }
    return null;
  },

  // Update template usage count
  async incrementUsageCount(templateId: string): Promise<void> {
    const templateRef = doc(db, COLLECTIONS.TASK_TEMPLATES, templateId);
    await updateDoc(templateRef, {
      usageCount: increment(1),
      updatedAt: Date.now(),
    });
  },

  // Apply template to create tasks
  async applyTemplate(templateId: string, workspaceId: string, createdBy: string, customizations?: any): Promise<string[]> {
    const template = await this.getTaskTemplate(templateId);
    if (!template) throw new Error('Template not found');
    
    const batch = writeBatch(db);
    const teamTasksRef = collection(db, COLLECTIONS.TEAM_TASKS);
    const createdTaskIds: string[] = [];
    
    // Create tasks from template
    template.templateData.tasks.forEach((taskItem) => {
      const taskRef = doc(teamTasksRef);
      const teamTask: Omit<TeamTask, 'id'> = {
        userEmail: createdBy,
        title: taskItem.title,
        description: taskItem.description,
        category: taskItem.category,
        priority: taskItem.priority,
        duration: taskItem.estimatedDuration,
        timeOfDay: 'Morning', // Default
        createdAt: Date.now(),
        rejectionCount: 0,
        isMuted: false,
        workspaceId,
        templateId,
        isFromTemplate: true,
        ...customizations,
      };
      
      batch.set(taskRef, serializeTaskForFirestore(teamTask));
      createdTaskIds.push(taskRef.id);
    });
    
    await batch.commit();
    
    // Increment usage count
    await this.incrementUsageCount(templateId);
    
    return createdTaskIds;
  },

  // Create project template
  async createProjectTemplate(template: Omit<ProjectTemplate, 'id' | 'createdAt' | 'usageCount'>): Promise<string> {
    const templatesRef = collection(db, COLLECTIONS.PROJECT_TEMPLATES);
    const templateRef = doc(templatesRef);
    
    const templateData: Omit<ProjectTemplate, 'id'> = {
      ...template,
      createdAt: Date.now(),
      usageCount: 0,
    };
    
    await setDoc(templateRef, templateData);
    return templateRef.id;
  },

  // Get project templates
  async getProjectTemplates(isPublic?: boolean): Promise<ProjectTemplate[]> {
    const templatesRef = collection(db, COLLECTIONS.PROJECT_TEMPLATES);
    let q = query(templatesRef, orderBy('usageCount', 'desc'));
    
    if (isPublic !== undefined) {
      q = query(
        templatesRef,
        where('isPublic', '==', isPublic),
        orderBy('usageCount', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectTemplate));
  },
};

// Batch operations service
export const batchOperationService = {
  // Create batch operation
  async createBatchOperation(operation: Omit<BatchOperation, 'id' | 'executedAt' | 'completedAt' | 'status' | 'progress' | 'results' | 'processedItems' | 'failedItems'>): Promise<string> {
    const operationsRef = collection(db, COLLECTIONS.BATCH_OPERATIONS);
    const operationRef = doc(operationsRef);
    
    const batchOp: Omit<BatchOperation, 'id'> = {
      ...operation,
      executedAt: Date.now(),
      status: 'pending',
      progress: 0,
      results: [],
      totalItems: operation.taskIds.length,
      processedItems: 0,
      failedItems: 0,
    };
    
    await setDoc(operationRef, batchOp);
    return operationRef.id;
  },

  // Update batch operation progress
  async updateBatchProgress(operationId: string, progress: number, status: BatchOperation['status'], results?: BatchResult[]): Promise<void> {
    const operationRef = doc(db, COLLECTIONS.BATCH_OPERATIONS, operationId);
    const updateData: any = {
      progress,
      status,
    };
    
    if (results) {
      updateData.results = results;
      updateData.processedItems = results.length;
      updateData.failedItems = results.filter(r => !r.success).length;
    }
    
    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = Date.now();
    }
    
    await updateDoc(operationRef, updateData);
  },

  // Get batch operation
  async getBatchOperation(operationId: string): Promise<BatchOperation | null> {
    const operationRef = doc(db, COLLECTIONS.BATCH_OPERATIONS, operationId);
    const operationSnap = await getDoc(operationRef);
    
    if (operationSnap.exists()) {
      return { id: operationSnap.id, ...operationSnap.data() } as BatchOperation;
    }
    return null;
  },

  // Get user's batch operations
  async getUserBatchOperations(userEmail: string): Promise<BatchOperation[]> {
    const operationsRef = collection(db, COLLECTIONS.BATCH_OPERATIONS);
    const q = query(
      operationsRef,
      where('executedBy', '==', userEmail),
      orderBy('executedAt', 'desc'),
      limit(50)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BatchOperation));
  },

  // Execute batch update
  async executeBatchUpdate(operationId: string, taskIds: string[], updates: Record<string, any>): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const batch = writeBatch(db);
    
    taskIds.forEach((taskId) => {
      try {
        const taskRef = doc(db, COLLECTIONS.TEAM_TASKS, taskId);
        batch.update(taskRef, {
          ...updates,
          updatedAt: Date.now(),
        });
        
        results.push({
          taskId,
          success: true,
          changes: updates,
          executedAt: Date.now(),
        });
      } catch (error) {
        results.push({
          taskId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executedAt: Date.now(),
        });
      }
    });
    
    try {
      await batch.commit();
      await this.updateBatchProgress(operationId, 100, 'completed', results);
    } catch (error) {
      await this.updateBatchProgress(operationId, 100, 'failed', results);
    }
    
    return results;
  },
};
