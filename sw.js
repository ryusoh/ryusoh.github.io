'use strict';

const staticCacheName = 'pages-cache-v1';
const assetsCacheName = 'assets-cache-v1';

// Install event - pre-cache important resources
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(staticCacheName).then(function (cache) {
            return cache.addAll([
                '/',
                '/index.html',
                '/css/main_style.css',
                '/js/service-worker-register.js',
                '/js/page-transition.js',
                '/js/ga.js',
            ]);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (cacheName) {
                    if (cacheName !== staticCacheName && cacheName !== assetsCacheName) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - handle network requests with cache strategies
self.addEventListener('fetch', function (event) {
    // Skip non-GET requests and navigation requests to different origins
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);

    // Handle navigation requests (pages) with network-first strategy
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match(event.request).then(function (response) {
                return (
                    response ||
                    fetch(event.request).then(function (fetchResponse) {
                        // Update the cache with the latest version
                        caches.open(staticCacheName).then(function (cache) {
                            cache.put(event.request, fetchResponse.clone());
                        });
                        return fetchResponse;
                    })
                );
            })
        );
        return;
    }

    // For assets, use cache-first strategy with network fallback
    if (requestUrl.origin === location.origin) {
        event.respondWith(
            caches.match(event.request).then(function (response) {
                return (
                    response ||
                    fetch(event.request).then(function (fetchResponse) {
                        // Check if we received a valid response
                        if (
                            !fetchResponse ||
                            fetchResponse.status !== 200 ||
                            fetchResponse.type !== 'basic'
                        ) {
                            return fetchResponse;
                        }

                        // Add response to cache
                        const responseToCache = fetchResponse.clone();
                        caches.open(assetsCacheName).then(function (cache) {
                            cache.put(event.request, responseToCache);
                        });

                        return fetchResponse;
                    })
                );
            })
        );
    }
});

// Handle push notifications (for future use)
self.addEventListener('push', function (/* event */) {
    // Handle push events for notifications (optional)
});

// Handle background sync (for future use)
self.addEventListener('sync', function (/* event */) {
    // Handle background sync events (optional)
});
