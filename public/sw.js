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

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
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
      })
      .then(() => {
        console.log('Service Worker: Static files cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static files', error);
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
        .catch(() => {
          // Return cached API response if available and not expired
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              const ttl = cachedResponse.headers.get('sw-cache-ttl');
              if (ttl && Date.now() < parseInt(ttl)) {
                return cachedResponse;
              }
            }
            // Return a basic offline response for API requests
            return new Response(JSON.stringify({ 
              error: 'Offline', 
              message: 'You are currently offline. Please check your internet connection.',
              timestamp: Date.now()
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
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
  
  if (event.tag === 'sync-tasks') {
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

// Helper functions for offline storage
async function getOfflineTasks() {
  try {
    // Check if IndexedDB is available
    if (!('indexedDB' in self)) {
      return [];
    }

    // This would integrate with your IndexedDB implementation
    // For now, return empty array
    return [];
  } catch (error) {
    console.error('Error getting offline tasks:', error);
    return [];
  }
}

async function removeOfflineTask(taskId) {
  try {
    // This would integrate with your IndexedDB implementation
    console.log('Removing offline task:', taskId);
  } catch (error) {
    console.error('Error removing offline task:', error);
  }
}
