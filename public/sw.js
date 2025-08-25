const CACHE_NAME = 'mindmate-v3';
const STATIC_CACHE = 'mindmate-static-v3';
const DYNAMIC_CACHE = 'mindmate-dynamic-v3';
const API_CACHE = 'mindmate-api-v3';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
  '/favicon.svg',
  '/logo.png',
  '/audio/complete-tone.wav',
  '/audio/mixkit-bell-notification-933.wav'
];

// Additional routes to cache for offline navigation
const CACHE_ROUTES = [
  '/',
  '/offline',
  '/dashboard',
  '/tasks',
  '/notes',
  '/calendar',
  '/settings',
  '/analytics',
  '/chat'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE)
        .then((cache) => {
          console.log('Service Worker: Caching static files');
          return cache.addAll(STATIC_FILES).catch((error) => {
            console.error('Service Worker: Failed to cache some files', error);
            // Cache files individually to avoid failure of entire batch
            return Promise.allSettled(
              STATIC_FILES.map(file => cache.add(file))
            );
          });
        }),
      // Pre-cache important routes
      caches.open(DYNAMIC_CACHE)
        .then((cache) => {
          console.log('Service Worker: Pre-caching routes');
          return Promise.allSettled(
            CACHE_ROUTES.map(route => {
              return fetch(route)
                .then(response => {
                  if (response.ok) {
                    return cache.put(route, response);
                  }
                })
                .catch(err => console.log('Failed to pre-cache route:', route, err));
            })
          );
        }),
      // Initialize IndexedDB
      swDB.init().catch(err => console.log('Failed to init SW IndexedDB:', err))
    ])
    .then(() => {
      console.log('Service Worker: Installation complete');
      return self.skipWaiting();
    })
    .catch((error) => {
      console.error('Service Worker: Installation failed', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('Service Worker: Activation failed', error);
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received', event);
  
  let notificationData = {
    title: 'MindMate Reminder',
    body: 'You have a task reminder!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {},
    actions: [
      {
        action: 'view',
        title: '👀 View Task',
        icon: '/icon-192.png'
      },
      {
        action: 'dismiss',
        title: '❌ Dismiss',
        icon: '/icon-192.png'
      }
    ],
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    tag: 'mindmate-reminder'
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        data: data.data || {},
        actions: data.actions || notificationData.actions,
        tag: data.tag || notificationData.tag,
        requireInteraction: data.requireInteraction !== false,
        silent: data.silent || false
      };
    } catch (error) {
      console.error('Service Worker: Error parsing push data', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  const taskId = event.notification.data?.taskId;
  const action = event.action;
  
  if (action === 'dismiss') {
    // User explicitly chose the Dismiss action -> tell server this notification was dismissed/read
    const notificationId = event.notification.data?.notificationId;
  const userEmail = event.notification.data?.userEmail;
    if (notificationId) {
      event.waitUntil(
        fetch('/api/notifications/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId, userEmail })
        }).catch(err => console.error('SW: Failed to call dismiss endpoint:', err))
      );
    }

    // Close and do not navigate
    return;
  }
  
  // Default action or 'view' action
  const url = taskId ? `/task/${taskId}` : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (taskId) {
              client.postMessage({ 
                type: 'NAVIGATE_TO_TASK', 
                taskId: taskId 
              });
            }
            return;
          }
        }
        
        // Open new window if app is not open
        return clients.openWindow(url)
          .then((newClient) => {
            // Try to send NAVIGATE_TO_TASK to the newly opened client so it can mark related notifications read
            try {
              if (newClient && taskId) {
                newClient.postMessage({ type: 'NAVIGATE_TO_TASK', taskId: taskId });
              }
            } catch (err) {
              console.warn('SW: Failed to postMessage to newly opened client', err);
            }
            return newClient;
          })
          .catch((err) => {
            console.error('Service Worker: Failed to open window', err);
          });
      })
      .catch((error) => {
        console.error('Service Worker: Error handling notification click', error);
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed', event);
  // Previously we called the dismiss endpoint here on close.
  // We intentionally avoid calling the server on generic close events because those
  // can happen automatically (timeout) or via system UI — we only want to mark read
  // when the user explicitly taps the Dismiss action (handled in notificationclick).
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API requests with better caching strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful GET responses for read-only APIs
          if (response.status === 200 && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(API_CACHE)
              .then((cache) => {
                // Set a TTL for API cache
                const ttl = Date.now() + (5 * 60 * 1000); // 5 minutes
                const responseWithTTL = new Response(responseClone.body, {
                  status: responseClone.status,
                  statusText: responseClone.statusText,
                  headers: {
                    ...Object.fromEntries(responseClone.headers.entries()),
                    'sw-cache-ttl': ttl.toString()
                  }
                });
                cache.put(request, responseWithTTL);
              })
              .catch(err => console.log('API Cache error:', err));
          }
          
          return response;
        })
        .catch(async () => {
          // Handle offline API requests
          if (request.method === 'GET') {
            // Return cached API response if available and not expired
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
              const ttl = cachedResponse.headers.get('sw-cache-ttl');
              if (ttl && Date.now() < parseInt(ttl)) {
                return cachedResponse;
              }
            }
          } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
            // Handle offline write operations
            try {
              const body = await request.clone().json();
              const userEmail = body.userEmail || body.user?.email || 'unknown';
              
              // Determine action type based on URL and method
              let actionType = 'UNKNOWN';
              if (url.pathname.includes('/tasks')) {
                if (request.method === 'POST') actionType = 'CREATE_TASK';
                else if (request.method === 'PUT') actionType = 'UPDATE_TASK';
                else if (request.method === 'DELETE') actionType = 'DELETE_TASK';
              } else if (url.pathname.includes('/notes')) {
                if (request.method === 'POST') actionType = 'CREATE_NOTE';
                else if (request.method === 'PUT') actionType = 'UPDATE_NOTE';
                else if (request.method === 'DELETE') actionType = 'DELETE_NOTE';
              }
              
              // Store for later sync
              if (actionType !== 'UNKNOWN') {
                const actionId = await storeOfflineAction(actionType, body, userEmail);
                if (actionId) {
                  // Register background sync
                  if ('serviceWorker' in self && self.registration.sync) {
                    await self.registration.sync.register('sync-offline-actions');
                  }
                  
                  // Return success response for offline operation
                  return new Response(JSON.stringify({
                    success: true,
                    offline: true,
                    actionId,
                    message: 'Action queued for sync when online'
                  }), {
                    status: 202, // Accepted
                    headers: { 'Content-Type': 'application/json' }
                  });
                }
              }
            } catch (error) {
              console.error('Service Worker: Failed to handle offline request:', error);
            }
          }
          
          // Return a basic offline response for API requests
          return new Response(JSON.stringify({ 
            error: 'Offline', 
            message: 'You are currently offline. Please check your internet connection.',
            timestamp: Date.now(),
            offline: true
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful page responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseClone);
              })
              .catch(err => console.log('Cache error:', err));
          }
          
          return response;
        })
        .catch(() => {
          // Return cached page or offline page
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/offline');
            });
        })
    );
    return;
  }

  // Handle other requests (images, CSS, JS)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Don't cache error responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseClone = response.clone();

            // Cache the resource
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseClone);
              })
              .catch(err => console.log('Cache error:', err));

            return response;
          })
          .catch(() => {
            // Return a placeholder for failed resources
            if (request.destination === 'image') {
              return new Response('', { status: 404 });
            }
            return null;
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  } else if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  } else if (event.tag === 'background-sync-notifications') {
    event.waitUntil(
      fetch('/api/notifications/sync', {
        method: 'POST'
      }).catch(err => console.error('Background sync failed:', err))
    );
  }
});

// Periodic background sync for checking overdue tasks
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-overdue-tasks') {
    event.waitUntil(
      fetch('/api/notifications/check-overdue', {
        method: 'POST'
      }).catch(err => console.error('Periodic sync failed:', err))
    );
  }
});

// Helper function to sync tasks when back online
async function syncTasks() {
  try {
    console.log('Service Worker: Syncing offline tasks');
    // Get offline tasks from IndexedDB
    const offlineTasks = await getOfflineTasks();
    
    if (offlineTasks.length === 0) {
      console.log('Service Worker: No offline tasks to sync');
      return;
    }
    
    for (const task of offlineTasks) {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(task)
        });
        
        if (response.ok) {
          // Remove from offline storage
          await removeOfflineTask(task.id);
          console.log('Service Worker: Synced task', task.id);
        }
      } catch (error) {
        console.error('Failed to sync task:', task.id, error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB integration for offline storage
class ServiceWorkerDB {
  constructor() {
    this.dbName = 'MindMateOfflineDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB in Service Worker'));
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('offline_actions')) {
          const actionsStore = db.createObjectStore('offline_actions', { keyPath: 'id' });
          actionsStore.createIndex('userEmail', 'userEmail', { unique: false });
          actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('userEmail', 'userEmail', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('userEmail', 'userEmail', { unique: false });
        }
      };
    });
  }

  async ensureDB() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  }

  async getAll(storeName, indexName, indexValue) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      let request;
      if (indexName && indexValue !== undefined) {
        const index = store.index(indexName);
        request = index.getAll(indexValue);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get data from IndexedDB'));
    });
  }

  async delete(storeName, id) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete from IndexedDB'));
    });
  }

  async put(storeName, data) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to put data in IndexedDB'));
    });
  }
}

// Create DB instance
const swDB = new ServiceWorkerDB();

// Helper functions for offline storage
async function getOfflineTasks() {
  try {
    const actions = await swDB.getAll('offline_actions');
    return actions.filter(action => action.type === 'CREATE_TASK').map(action => action.data);
  } catch (error) {
    console.error('Error getting offline tasks:', error);
    return [];
  }
}

async function removeOfflineTask(taskId) {
  try {
    const actions = await swDB.getAll('offline_actions');
    const taskAction = actions.find(action => action.data?.id === taskId);
    if (taskAction) {
      await swDB.delete('offline_actions', taskAction.id);
      console.log('Service Worker: Removed offline task action', taskId);
    }
  } catch (error) {
    console.error('Error removing offline task:', error);
  }
}

// Store offline action for later sync
async function storeOfflineAction(type, data, userEmail) {
  try {
    const action = {
      id: `sw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      userEmail,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    await swDB.put('offline_actions', action);
    console.log('Service Worker: Stored offline action', type, action.id);
    return action.id;
  } catch (error) {
    console.error('Error storing offline action:', error);
    return null;
  }
}

// Enhanced sync function with better error handling
async function syncOfflineActions() {
  try {
    const actions = await swDB.getAll('offline_actions');
    console.log('Service Worker: Found', actions.length, 'offline actions to sync');
    
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const action of actions) {
      try {
        let response;
        
        switch (action.type) {
          case 'CREATE_TASK':
            response = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;
            
          case 'UPDATE_TASK':
            response = await fetch(`/api/tasks/${action.data.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;
            
          case 'DELETE_TASK':
            response = await fetch(`/api/tasks/${action.data.id}`, {
              method: 'DELETE',
            });
            break;
            
          case 'CREATE_NOTE':
            response = await fetch('/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;
            
          case 'UPDATE_NOTE':
            response = await fetch(`/api/notes/${action.data.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;
            
          case 'DELETE_NOTE':
            response = await fetch(`/api/notes/${action.data.id}`, {
              method: 'DELETE',
            });
            break;
            
          default:
            console.warn('Service Worker: Unknown action type:', action.type);
            continue;
        }
        
        if (response && response.ok) {
          await swDB.delete('offline_actions', action.id);
          syncedCount++;
          console.log('Service Worker: Synced action', action.type, action.id);
        } else {
          // Increment retry count
          action.retryCount = (action.retryCount || 0) + 1;
          action.lastAttempt = Date.now();
          
          if (action.retryCount >= 3) {
            // Remove after 3 failed attempts
            await swDB.delete('offline_actions', action.id);
            console.warn('Service Worker: Removed action after 3 failed attempts', action.id);
          } else {
            await swDB.put('offline_actions', action);
          }
          failedCount++;
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync action:', action.id, error);
        failedCount++;
      }
    }
    
    console.log(`Service Worker: Sync complete. ${syncedCount} synced, ${failedCount} failed`);
    
    // Notify clients about sync results
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        data: { syncedCount, failedCount }
      });
    });
    
  } catch (error) {
    console.error('Service Worker: Sync failed:', error);
  }
}
