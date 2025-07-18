
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
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import type { Task, User, Accomplishment } from './types';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  TASKS: 'tasks',
  ACCOMPLISHMENTS: 'accomplishments',
  USER_SETTINGS: 'userSettings'
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
        password: data.password
      };
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

// Task operations
export const taskService = {
  async getTasks(userEmail: string): Promise<Task[]> {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(tasksRef, where('userEmail', '==', userEmail), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toMillis() || Date.now(),
        completedAt: data.completedAt?.toMillis(),
        lastRejectedAt: data.lastRejectedAt?.toMillis()
      } as Task;
    });
  },

  async addTask(userEmail: string, task: Omit<Task, 'id'>): Promise<string> {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    // Build taskData, omitting undefined fields (especially parentId)
    const taskData: any = {
      ...task,
      userEmail,
      createdAt: Timestamp.now(), // Use server timestamp
    };

    // Remove fields with undefined values to avoid Firestore errors
    Object.keys(taskData).forEach(key => {
      if (taskData[key] === undefined || taskData[key] === null) {
        delete taskData[key];
      }
    });

    const docRef = doc(tasksRef);
    await setDoc(docRef, taskData);
    return docRef.id;
  },

  async addTaskWithSubtasks(
    userEmail: string, 
    parentTaskData: Omit<Task, 'id' | 'createdAt'>, 
    subtasks: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted'>[]
  ): Promise<{ parentId: string, childIds: string[] }> {
    const batch = writeBatch(db);
    const tasksRef = collection(db, COLLECTIONS.TASKS);

    // Create parent task
    const parentRef = doc(tasksRef);
    const parentTask = {
      ...parentTaskData,
      userEmail,
      createdAt: Timestamp.now(),
    };
    batch.set(parentRef, parentTask);

    // Create subtasks
    const childIds: string[] = [];
    subtasks.forEach(subtaskData => {
      const childRef = doc(tasksRef);
      const childTask = {
        ...subtaskData,
        parentId: parentRef.id,
        userEmail,
        createdAt: Timestamp.now(),
        rejectionCount: 0,
        isMuted: false,
      };
      batch.set(childRef, childTask);
      childIds.push(childRef.id);
    });

    await batch.commit();

    return { parentId: parentRef.id, childIds };
  },

  async updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'userEmail'>>): Promise<void> {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    const updateData: any = { ...updates };
    
    // Convert timestamps
    if (updates.completedAt !== undefined) {
      updateData.completedAt = updates.completedAt ? Timestamp.fromMillis(updates.completedAt) : null;
    }
    if (updates.lastRejectedAt !== undefined) {
      updateData.lastRejectedAt = updates.lastRejectedAt ? Timestamp.fromMillis(updates.lastRejectedAt) : null;
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

  // Real-time subscription for tasks
  subscribeToTasks(userEmail: string, callback: (tasks: Task[]) => void): () => void {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(tasksRef, where('userEmail', '==', userEmail), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
      const tasks = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toMillis() || Date.now(),
          completedAt: data.completedAt?.toMillis(),
          lastRejectedAt: data.lastRejectedAt?.toMillis()
        } as Task;
      });
      callback(tasks);
    });
  }
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
    }));
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
      }));
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

    