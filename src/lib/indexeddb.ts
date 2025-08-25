/**
 * IndexedDB Service for Offline Data Storage
 * Provides offline-first data persistence for tasks, notes, and user data
 */

export interface OfflineData {
  id: string;
  type: 'task' | 'note' | 'user_setting' | 'offline_action';
  data: any;
  timestamp: number;
  userEmail?: string;
  synced?: boolean;
  lastModified: number;
}

export interface OfflineAction {
  id: string;
  type: 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'CREATE_NOTE' | 'UPDATE_NOTE' | 'DELETE_NOTE';
  data: any;
  timestamp: number;
  userEmail: string;
  retryCount?: number;
  lastAttempt?: number;
}

class IndexedDBService {
  private dbName = 'MindMateOfflineDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  // Object stores
  private stores = {
    tasks: 'tasks',
    notes: 'notes',
    offlineActions: 'offline_actions',
    userSettings: 'user_settings',
    cache: 'cache'
  };

  async init(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('✅ IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create tasks store
        if (!db.objectStoreNames.contains(this.stores.tasks)) {
          const tasksStore = db.createObjectStore(this.stores.tasks, { keyPath: 'id' });
          tasksStore.createIndex('userEmail', 'userEmail', { unique: false });
          tasksStore.createIndex('timestamp', 'timestamp', { unique: false });
          tasksStore.createIndex('synced', 'synced', { unique: false });
        }

        // Create notes store
        if (!db.objectStoreNames.contains(this.stores.notes)) {
          const notesStore = db.createObjectStore(this.stores.notes, { keyPath: 'id' });
          notesStore.createIndex('userEmail', 'userEmail', { unique: false });
          notesStore.createIndex('timestamp', 'timestamp', { unique: false });
          notesStore.createIndex('synced', 'synced', { unique: false });
        }

        // Create offline actions store
        if (!db.objectStoreNames.contains(this.stores.offlineActions)) {
          const actionsStore = db.createObjectStore(this.stores.offlineActions, { keyPath: 'id' });
          actionsStore.createIndex('userEmail', 'userEmail', { unique: false });
          actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
          actionsStore.createIndex('type', 'type', { unique: false });
        }

        // Create user settings store
        if (!db.objectStoreNames.contains(this.stores.userSettings)) {
          const settingsStore = db.createObjectStore(this.stores.userSettings, { keyPath: 'id' });
          settingsStore.createIndex('userEmail', 'userEmail', { unique: false });
        }

        // Create cache store
        if (!db.objectStoreNames.contains(this.stores.cache)) {
          const cacheStore = db.createObjectStore(this.stores.cache, { keyPath: 'id' });
          cacheStore.createIndex('type', 'type', { unique: false });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  // Generic CRUD operations
  async put(storeName: string, data: any): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store data'));
    });
  }

  async get(storeName: string, id: string): Promise<any> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get data'));
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete data'));
    });
  }

  async getAll(storeName: string, indexName?: string, indexValue?: any): Promise<any[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      let request: IDBRequest;
      if (indexName && indexValue !== undefined) {
        const index = store.index(indexName);
        request = index.getAll(indexValue);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get all data'));
    });
  }

  async clear(storeName: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear store'));
    });
  }

  // Task-specific operations
  async saveTasks(userEmail: string, tasks: any[]): Promise<void> {
    const timestamp = Date.now();
    for (const task of tasks) {
      const offlineTask: OfflineData = {
        id: task.id,
        type: 'task',
        data: task,
        timestamp,
        userEmail,
        synced: true,
        lastModified: task.updatedAt || task.createdAt || timestamp,
      };
      await this.put(this.stores.tasks, offlineTask);
    }
  }

  async getTasks(userEmail: string): Promise<any[]> {
    const offlineTasks = await this.getAll(this.stores.tasks, 'userEmail', userEmail);
    return offlineTasks.map(item => item.data);
  }

  async saveTask(userEmail: string, task: any, synced: boolean = false): Promise<void> {
    const offlineTask: OfflineData = {
      id: task.id,
      type: 'task',
      data: task,
      timestamp: Date.now(),
      userEmail,
      synced,
      lastModified: task.updatedAt || task.createdAt || Date.now(),
    };
    await this.put(this.stores.tasks, offlineTask);
  }

  // Alias for saveTask to match the context usage
  async createTask(userEmail: string, task: any): Promise<void> {
    return this.saveTask(userEmail, task, false);
  }

  // Update an existing task
  async updateTask(userEmail: string, taskId: string, updates: any): Promise<void> {
    // Get the existing task
    const existingTaskData = await this.get(this.stores.tasks, taskId);
    if (existingTaskData) {
      const updatedTask = { ...existingTaskData.data, ...updates };
      return this.saveTask(userEmail, updatedTask, existingTaskData.synced || false);
    } else {
      // If task doesn't exist, create it with the updates
      const newTask = { id: taskId, ...updates };
      return this.saveTask(userEmail, newTask, false);
    }
  }

  // Sync tasks from server - save multiple tasks
  async syncTasks(userEmail: string, tasks: any[]): Promise<void> {
    return this.saveTasks(userEmail, tasks);
  }

  async deleteTask(userEmail: string, taskId: string): Promise<void> {
    await this.delete(this.stores.tasks, taskId);
  }

  // Note-specific operations
  async saveNotes(userEmail: string, notes: any[]): Promise<void> {
    const timestamp = Date.now();
    for (const note of notes) {
      const offlineNote: OfflineData = {
        id: note.id,
        type: 'note',
        data: note,
        timestamp,
        userEmail,
        synced: true,
        lastModified: note.updatedAt || note.createdAt || timestamp,
      };
      await this.put(this.stores.notes, offlineNote);
    }
  }

  // Sync notes from server - alias for saveNotes
  async syncNotes(userEmail: string, notes: any[]): Promise<void> {
    return this.saveNotes(userEmail, notes);
  }

  async getNotes(userEmail: string): Promise<any[]> {
    const offlineNotes = await this.getAll(this.stores.notes, 'userEmail', userEmail);
    return offlineNotes.map(item => item.data);
  }

  async saveNote(userEmail: string, note: any, synced: boolean = false): Promise<void> {
    const offlineNote: OfflineData = {
      id: note.id,
      type: 'note',
      data: note,
      timestamp: Date.now(),
      userEmail,
      synced,
      lastModified: note.updatedAt || note.createdAt || Date.now(),
    };
    await this.put(this.stores.notes, offlineNote);
  }

  // Alias for saveNote to match the context usage
  async createNote(userEmail: string, note: any): Promise<void> {
    return this.saveNote(userEmail, note, false);
  }

  // Update an existing note
  async updateNote(userEmail: string, noteId: string, updates: any): Promise<void> {
    // Get the existing note
    const existingNoteData = await this.get(this.stores.notes, noteId);
    if (existingNoteData) {
      const updatedNote = { ...existingNoteData.data, ...updates };
      return this.saveNote(userEmail, updatedNote, existingNoteData.synced || false);
    } else {
      // If note doesn't exist, create it with the updates
      const newNote = { id: noteId, ...updates };
      return this.saveNote(userEmail, newNote, false);
    }
  }

  async deleteNote(userEmail: string, noteId: string): Promise<void> {
    await this.delete(this.stores.notes, noteId);
  }

  // Offline actions operations
  async addOfflineAction(action: OfflineAction): Promise<void> {
    await this.put(this.stores.offlineActions, action);
  }

  async getOfflineActions(userEmail?: string): Promise<OfflineAction[]> {
    if (userEmail) {
      return await this.getAll(this.stores.offlineActions, 'userEmail', userEmail);
    }
    return await this.getAll(this.stores.offlineActions);
  }

  async removeOfflineAction(actionId: string): Promise<void> {
    await this.delete(this.stores.offlineActions, actionId);
  }

  async clearOfflineActions(userEmail?: string): Promise<void> {
    if (userEmail) {
      const actions = await this.getOfflineActions(userEmail);
      for (const action of actions) {
        await this.removeOfflineAction(action.id);
      }
    } else {
      await this.clear(this.stores.offlineActions);
    }
  }

  // User settings operations
  async saveUserSettings(userEmail: string, settings: any): Promise<void> {
    const userSettings: OfflineData = {
      id: userEmail,
      type: 'user_setting',
      data: settings,
      timestamp: Date.now(),
      userEmail,
      synced: true,
      lastModified: Date.now(),
    };
    await this.put(this.stores.userSettings, userSettings);
  }

  async getUserSettings(userEmail: string): Promise<any | null> {
    const settings = await this.get(this.stores.userSettings, userEmail);
    return settings ? settings.data : null;
  }

  // Cache operations
  async cacheData(key: string, data: any, type: string = 'api'): Promise<void> {
    const cacheItem = {
      id: key,
      type,
      data,
      timestamp: Date.now(),
    };
    await this.put(this.stores.cache, cacheItem);
  }

  async getCachedData(key: string): Promise<any | null> {
    const cached = await this.get(this.stores.cache, key);
    if (!cached) return null;

    // Check if cache is still valid (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - cached.timestamp > maxAge) {
      await this.delete(this.stores.cache, key);
      return null;
    }

    return cached.data;
  }

  async clearCache(): Promise<void> {
    await this.clear(this.stores.cache);
  }

  // Sync status operations
  async getUnsyncedItems(userEmail: string): Promise<{
    tasks: OfflineData[];
    notes: OfflineData[];
    actions: OfflineAction[];
  }> {
    const [tasks, notes, actions] = await Promise.all([
      this.getAll(this.stores.tasks, 'userEmail', userEmail).then(items => 
        items.filter(item => !item.synced)
      ),
      this.getAll(this.stores.notes, 'userEmail', userEmail).then(items => 
        items.filter(item => !item.synced)
      ),
      this.getOfflineActions(userEmail)
    ]);

    return { tasks, notes, actions };
  }

  async markAsSynced(storeName: string, id: string): Promise<void> {
    const item = await this.get(storeName, id);
    if (item) {
      item.synced = true;
      await this.put(storeName, item);
    }
  }

  // Storage usage
  async getStorageUsage(): Promise<{
    tasks: number;
    notes: number;
    actions: number;
    cache: number;
    total: number;
  }> {
    const [tasks, notes, actions, cache] = await Promise.all([
      this.getAll(this.stores.tasks),
      this.getAll(this.stores.notes),
      this.getAll(this.stores.offlineActions),
      this.getAll(this.stores.cache)
    ]);

    return {
      tasks: tasks.length,
      notes: notes.length,
      actions: actions.length,
      cache: cache.length,
      total: tasks.length + notes.length + actions.length + cache.length
    };
  }

  // Cleanup operations
  async cleanup(): Promise<void> {
    // Remove old cached data (older than 7 days)
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const cacheItems = await this.getAll(this.stores.cache);
    
    for (const item of cacheItems) {
      if (item.timestamp < weekAgo) {
        await this.delete(this.stores.cache, item.id);
      }
    }

    // Remove old synced actions (older than 30 days)
    const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const actions = await this.getAll(this.stores.offlineActions);
    
    for (const action of actions) {
      if (action.timestamp < monthAgo && action.retryCount === 0) {
        await this.removeOfflineAction(action.id);
      }
    }
  }

  // Export/Import for backup
  async exportData(userEmail: string): Promise<any> {
    const [tasks, notes, settings] = await Promise.all([
      this.getTasks(userEmail),
      this.getNotes(userEmail),
      this.getUserSettings(userEmail)
    ]);

    return {
      timestamp: Date.now(),
      userEmail,
      tasks,
      notes,
      settings
    };
  }

  async importData(data: any): Promise<void> {
    const { userEmail, tasks, notes, settings } = data;
    
    if (tasks) {
      await this.saveTasks(userEmail, tasks);
    }
    
    if (notes) {
      await this.saveNotes(userEmail, notes);
    }
    
    if (settings) {
      await this.saveUserSettings(userEmail, settings);
    }
  }
}

// Create singleton instance
export const indexedDBService = new IndexedDBService();

// Note: We no longer auto-initialize on import to avoid issues with user authentication
// IndexedDB will be initialized on-demand when contexts need it after user login

// Helper functions for specific use cases
export const offlineStorage = {
  // Quick access methods
  async saveTask(userEmail: string, task: any): Promise<void> {
    return indexedDBService.saveTask(userEmail, task, false);
  },

  async saveNote(userEmail: string, note: any): Promise<void> {
    return indexedDBService.saveNote(userEmail, note, false);
  },

  async addAction(action: OfflineAction): Promise<void> {
    return indexedDBService.addOfflineAction(action);
  },

  async getOfflineData(userEmail: string): Promise<{
    tasks: any[];
    notes: any[];
    actions: OfflineAction[];
  }> {
    const [tasks, notes, actions] = await Promise.all([
      indexedDBService.getTasks(userEmail),
      indexedDBService.getNotes(userEmail),
      indexedDBService.getOfflineActions(userEmail)
    ]);

    return { tasks, notes, actions };
  },

  async clearUserData(userEmail: string): Promise<void> {
    await indexedDBService.clearOfflineActions(userEmail);
    // Keep tasks and notes for offline viewing, just mark as needs sync
  },

  async getStorageInfo(): Promise<any> {
    return indexedDBService.getStorageUsage();
  }
};
