// Service Worker for KRTechUpdate PWA
const CACHE_NAME = 'krtech-v1.0.0';
const STATIC_CACHE = 'krtech-static-v1.0.0';
const DYNAMIC_CACHE = 'krtech-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/logo192.png',
    '/icons/logo512.png',
    'https://drive.google.com/uc?export=view&id=1p2JBdlvSelA7P7vpDpL4gzSpoEhzrYkO'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .catch((error) => {
                console.error('Error caching static files:', error);
            })
    );
    
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old caches that don't match current version
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - serve cached files when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Google Apps Script API calls (let them fail gracefully)
    if (url.hostname === 'script.google.com') {
        return;
    }
    
    // Skip external APIs and non-same-origin requests (except our logo)
    if (url.origin !== location.origin && !url.href.includes('drive.google.com')) {
        return;
    }
    
    event.respondWith(
        // Try cache first strategy
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('Serving from cache:', request.url);
                    return cachedResponse;
                }
                
                // If not in cache, fetch from network
                return fetch(request)
                    .then((networkResponse) => {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clone the response before caching
                        const responseToCache = networkResponse.clone();
                        
                        // Cache dynamic content (but not API calls)
                        if (!url.href.includes('script.google.com') && !url.href.includes('googleapis.com')) {
                            caches.open(DYNAMIC_CACHE)
                                .then((cache) => {
                                    cache.put(request, responseToCache);
                                });
                        }
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.log('Network fetch failed:', error);
                        
                        // Return offline page or cached fallback for navigation requests
                        if (request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        
                        // For other requests, return a basic offline response
                        return new Response('Offline - Please check your connection', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Handle background sync for form submissions when back online
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'form-submission') {
        event.waitUntil(
            // Try to submit any pending forms
            handleBackgroundSync()
        );
    }
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    console.log('Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New notification from KRTechUpdate',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        actions: [
            {
                action: 'open',
                title: 'Open App'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('KRTechUpdate', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Background sync handler
async function handleBackgroundSync() {
    try {
        // Check if there are any pending form submissions in IndexedDB
        // This would be implemented if we wanted to queue submissions when offline
        console.log('Checking for pending form submissions...');
        
        // For now, just log that sync was attempted
        console.log('Background sync completed');
        
        return Promise.resolve();
    } catch (error) {
        console.error('Background sync failed:', error);
        return Promise.reject(error);
    }
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                break;
                
            case 'GET_VERSION':
                event.ports[0].postMessage({ version: CACHE_NAME });
                break;
                
            case 'CACHE_URLS':
                event.waitUntil(
                    caches.open(DYNAMIC_CACHE)
                        .then((cache) => {
                            return cache.addAll(event.data.urls);
                        })
                );
                break;
                
            default:
                console.log('Unknown message type:', event.data.type);
        }
    }
});

// Periodic background sync (for future use)
self.addEventListener('periodicsync', (event) => {
    console.log('Periodic sync triggered:', event.tag);
    
    if (event.tag === 'content-sync') {
        event.waitUntil(
            // Could be used to sync dropdown data periodically
            handlePeriodicSync()
        );
    }
});

async function handlePeriodicSync() {
    try {
        console.log('Performing periodic sync...');
        // Could refresh dropdown data from Google Sheets
        return Promise.resolve();
    } catch (error) {
        console.error('Periodic sync failed:', error);
        return Promise.reject(error);
    }
}

// Error handling
self.addEventListener('error', (event) => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('Service Worker loaded successfully');