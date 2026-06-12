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

const installLogic = (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
};

const activateLogic = (event) => {
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
};

// Helper to check if a response is a valid clean response we want to cache

const isBasicResponse = (res) => {
    return res && res.ok && res.status === 200 && res.type === 'basic';
};

const isValidResponse = (res, req) => {
    if (!isBasicResponse(res)) {
        return false;
    }
    const isRange = req.headers.has('range') || res.headers.get('Content-Range');
    return !isRange;
};

const handleFetchCacheFirst = (event, req) => {
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
};

const handleFetchNetworkFirst = (event, req) => {
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (isValidResponse(res, req)) {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                }
                return res;
            })
            .catch((e) => {
                if (
                    typeof self !== 'undefined' &&
                    self.console &&
                    typeof self.console.warn === 'function'
                ) {
                    self.console.warn(
                        '[ServiceWorker] Network fetch failed, falling back to cache:',
                        e
                    );
                }
                return caches.match(req);
            })
    );
};

const isImageOrFontFile = (url, dest) => {
    return (
        dest === 'image' ||
        dest === 'font' ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg')
    );
};

const isImmutableFile = (url, dest) => {
    return (
        isImageOrFontFile(url, dest) ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.woff2')
    );
};

const fetchLogic = (event) => {
    const req = event.request;
    if (req.url.length > 2000) {
        return;
    }
    const url = new URL(req.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // Determine strategy based on file type
    // Images & Fonts: Cache First (Immutable-ish, speed priority)
    // HTML, JS, CSS: Network First (Mutable, freshness priority)
    const isImmutable = isImmutableFile(url, req.destination);

    if (isImmutable) {
        // --- CACHE FIRST ---
        handleFetchCacheFirst(event, req);
    } else {
        // --- NETWORK FIRST ---
        // (Includes style, script, document, and everything else)
        handleFetchNetworkFirst(event, req);
    }
};

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
    self.addEventListener('install', installLogic);
    self.addEventListener('activate', activateLogic);
    self.addEventListener('fetch', fetchLogic);
}

// Expose for testing

const testing = {
    isValidResponse,
    installLogic,
    activateLogic,
    fetchLogic,
    CACHE_NAME,
    CORE_ASSETS,
    isImmutableFile,
    handleFetchCacheFirst,
    handleFetchNetworkFirst,
};

if (typeof self !== 'undefined') {
    self.__swForTesting = testing;
}

/* eslint-disable no-undef */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = testing;
}
/* eslint-enable no-undef */
