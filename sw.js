/* Simple service worker for Ryusoh */
const CACHE_NAME = 'ryusoh-cache-v2';
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/css/main_style.css',
    '/js/service-worker-register.js',
    '/js/page-transition.js',
    '/js/ga.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.map((k) => {
                        if (k !== CACHE_NAME) {
                            return caches.delete(k);
                        }
                    })
                )
            )
            .then(() => self.clients.claim())
    );
});

// Helper to check if a response is a valid clean response we want to cache
const isValidResponse = (res, req) => {
    return (
        res &&
        res.ok &&
        res.status === 200 &&
        res.type === 'basic' &&
        !req.headers.has('range') &&
        !res.headers.get('Content-Range')
    );
};

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // Determine strategy based on file type
    // Images & Fonts: Cache First (Immutable-ish, speed priority)
    // HTML, JS, CSS: Network First (Mutable, freshness priority)
    const isImmutable =
        req.destination === 'image' ||
        req.destination === 'font' ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.woff2');

    if (isImmutable) {
        // --- CACHE FIRST ---
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) {
                    return cached;
                }
                return fetch(req).then((res) => {
                    if (isValidResponse(res, req)) {
                        const resClone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    }
                    return res;
                });
            })
        );
    } else {
        // --- NETWORK FIRST ---
        // (Includes style, script, document, and everything else)
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (isValidResponse(res, req)) {
                        const resClone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    }
                    return res;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(req);
                })
        );
    }
});
