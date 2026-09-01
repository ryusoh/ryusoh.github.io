/* Simple service worker for lyeutsaon.com
 * The Pages workflow (.github/workflows/pages.yml) stamps CACHE_NAME with the
 * deploy SHA on every deploy — don't hand-bump it. */
const CACHE_NAME = 'ryusoh-cache-v2';
const IMAGE_CACHE_NAME = 'ryusoh-images-v1';
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/css/main_style.css',
    '/css/header.css',
    '/assets/fonts/syne-latin.woff2',
    '/assets/fonts/syne-latin-ext.woff2',
    '/assets/fonts/glowsans-sc-extended-bold.subset.woff2',
    '/js/service-worker-register.js',
    '/js/page-transition.js',
    '/js/mobile-dock.js',
    '/js/ga.js',
];

/**
 * @param {ExtendableEvent} event
 */
const installLogic = (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => {
                if (self.skipWaiting) {
                    return self.skipWaiting();
                }
            })
    );
};

/**
 * @param {ExtendableEvent} event
 */
const activateLogic = (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.map((k) => {
                        if (k !== CACHE_NAME && k !== IMAGE_CACHE_NAME) {
                            return caches.delete(k);
                        }
                    })
                )
            )
            .then(() => {
                if (self.clients && self.clients.claim) {
                    return self.clients.claim();
                }
            })
    );
};

// Helper to check if a response is a valid clean response we want to cache

/**
 * @param {Response} res
 */
const isBasicResponse = (res) => {
    return res && res.ok && res.status === 200 && res.type === 'basic';
};

/**
 * @param {Response} res
 * @param {Request} req
 */
const isValidResponse = (res, req) => {
    if (!isBasicResponse(res)) {
        return false;
    }
    const isRange = req.headers.has('range') || res.headers.get('Content-Range');
    return !isRange;
};

/**
 * @param {FetchEvent} event
 * @param {Request} req
 */
const handleFetchCacheFirst = (event, req) => {
    const isImgOrFont = isImageOrFontFile(new URL(req.url), req.destination);
    const targetCache = isImgOrFont ? IMAGE_CACHE_NAME : CACHE_NAME;
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(req).then((res) => {
                if (isValidResponse(res, req)) {
                    const resClone = res.clone();
                    caches.open(targetCache).then((cache) => {
                        cache.put(req, resClone).catch((e) => {
                            if (
                                typeof self !== 'undefined' &&
                                self.console &&
                                typeof self.console.warn === 'function'
                            ) {
                                self.console.warn('[ServiceWorker] Cache put failed:', e);
                            }
                        });
                    });
                }
                return res;
            });
        })
    );
};

/**
 * @param {FetchEvent} event
 * @param {Request} req
 */
const handleFetchNetworkFirst = (event, req) => {
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (isValidResponse(res, req)) {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, resClone).catch((e) => {
                            if (
                                typeof self !== 'undefined' &&
                                self.console &&
                                typeof self.console.warn === 'function'
                            ) {
                                self.console.warn('[ServiceWorker] Cache put failed:', e);
                            }
                        });
                    });
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
                const cachedRes = caches.match(req);
                return cachedRes.then((res) => {
                    if (res) {
                        return res;
                    }
                    return new Response('', { status: 408, statusText: 'Request Timeout' });
                });
            })
    );
};

/**
 * @param {URL} url
 * @param {string} dest
 */
const isImageOrFontFile = (url, dest) => {
    return (
        dest === 'image' ||
        dest === 'font' ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.avif')
    );
};

/**
 * @param {URL} url
 * @param {string} dest
 */
const isImmutableFile = (url, dest) => {
    return (
        isImageOrFontFile(url, dest) ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.woff2')
    );
};

/**
 * @param {FetchEvent} event
 */
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
    self.addEventListener(
        'install',
        /** @type {EventListener} */ (/** @type {unknown} */ (installLogic))
    );
    self.addEventListener(
        'activate',
        /** @type {EventListener} */ (/** @type {unknown} */ (activateLogic))
    );
    self.addEventListener(
        'fetch',
        /** @type {EventListener} */ (/** @type {unknown} */ (fetchLogic))
    );
}

// Expose for testing

const testing = {
    isValidResponse,
    installLogic,
    activateLogic,
    fetchLogic,
    CACHE_NAME,
    IMAGE_CACHE_NAME,
    CORE_ASSETS,
    isImmutableFile,
    handleFetchCacheFirst,
    handleFetchNetworkFirst,
};

/* istanbul ignore else */
if (typeof self !== 'undefined') {
    self.__swForTesting = testing;
}

/* eslint-disable no-undef */
/* istanbul ignore else */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = testing;
}
/* eslint-enable no-undef */
