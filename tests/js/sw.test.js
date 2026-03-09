const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../sw.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('Service Worker', () => {
    let context;
    let mockSelf;
    let mockCaches;
    let mockFetch;
    let mockCache;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCache = {
            addAll: jest.fn().mockResolvedValue(),
            put: jest.fn().mockResolvedValue()
        };

        mockCaches = {
            open: jest.fn().mockResolvedValue(mockCache),
            match: jest.fn(),
            keys: jest.fn().mockResolvedValue(['ryusoh-cache-v1']),
            delete: jest.fn().mockResolvedValue()
        };

        mockSelf = {
            addEventListener: jest.fn(),
            skipWaiting: jest.fn().mockResolvedValue(),
            location: { origin: 'https://example.com' },
            clients: { claim: jest.fn().mockResolvedValue() }
        };

        mockFetch = jest.fn();

        context = {
            self: mockSelf,
            caches: mockCaches,
            fetch: mockFetch,
            URL: URL,
            console: console,
        };

        vm.createContext(context);
        vm.runInContext(code, context);
    });

    // Helper to get registered event handler
    const getEventHandler = (eventName) => {
        const call = mockSelf.addEventListener.mock.calls.find(c => c[0] === eventName);
        return call ? call[1] : null;
    };

    describe('Lifecycle Events', () => {
        test('install event should cache CORE_ASSETS', async () => {
            const installHandler = getEventHandler('install');
            const mockEvent = {
                waitUntil: jest.fn()
            };

            installHandler(mockEvent);

            const waitUntilPromise = mockEvent.waitUntil.mock.calls[0][0];
            await waitUntilPromise;

            expect(mockCaches.open).toHaveBeenCalledWith('ryusoh-cache-v2');
            expect(mockCache.addAll).toHaveBeenCalledWith([
                '/',
                '/index.html',
                '/css/main_style.css',
                '/js/service-worker-register.js',
                '/js/page-transition.js',
                '/js/ga.js',
            ]);
            expect(mockSelf.skipWaiting).toHaveBeenCalled();
        });

        test('activate event should delete old caches and claim clients', async () => {
            const activateHandler = getEventHandler('activate');
            const mockEvent = {
                waitUntil: jest.fn()
            };

            // Set up caches.keys to return an old cache and the current cache
            mockCaches.keys.mockResolvedValue(['ryusoh-cache-v1', 'ryusoh-cache-v2', 'other-cache']);

            activateHandler(mockEvent);

            const waitUntilPromise = mockEvent.waitUntil.mock.calls[0][0];
            await waitUntilPromise;

            expect(mockCaches.keys).toHaveBeenCalled();
            // Wait for internal promises in activate to resolve
            await new Promise(process.nextTick);

            expect(mockCaches.delete).toHaveBeenCalledWith('ryusoh-cache-v1');
            expect(mockCaches.delete).toHaveBeenCalledWith('other-cache');
            expect(mockCaches.delete).not.toHaveBeenCalledWith('ryusoh-cache-v2');
            expect(mockSelf.clients.claim).toHaveBeenCalled();
        });
    });

    describe('Fetch Event Strategies', () => {
        test('should ignore cross-origin requests', () => {
            const fetchHandler = getEventHandler('fetch');
            const mockRequest = {
                url: 'https://other-domain.com/api/data.json',
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn()
            };

            fetchHandler(mockEvent);

            expect(mockEvent.respondWith).not.toHaveBeenCalled();
        });

        test('should use Cache First strategy for immutable assets (images)', async () => {
            const fetchHandler = getEventHandler('fetch');
            const mockRequest = {
                url: 'https://example.com/images/logo.png',
                destination: 'image',
                headers: { has: jest.fn().mockReturnValue(false) }
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn()
            };

            const mockCachedResponse = { status: 200, body: 'cached-image' };
            mockCaches.match.mockResolvedValue(mockCachedResponse);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockCaches.match).toHaveBeenCalledWith(mockRequest);
            // It found a cached response, so it shouldn't fetch
            expect(mockFetch).not.toHaveBeenCalled();
            expect(result).toBe(mockCachedResponse);
        });

        test('should fetch and cache if image is not in cache (Cache First fallback)', async () => {
            const fetchHandler = getEventHandler('fetch');
            const mockRequest = {
                url: 'https://example.com/fonts/custom.woff2',
                destination: 'font',
                headers: { has: jest.fn().mockReturnValue(false) }
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn()
            };

            // Cache miss
            mockCaches.match.mockResolvedValue(undefined);

            const mockResponseClone = { status: 200, cloned: true };
            const mockResponse = {
                ok: true,
                status: 200,
                type: 'basic',
                headers: { get: jest.fn().mockReturnValue(null) },
                clone: jest.fn().mockReturnValue(mockResponseClone)
            };
            mockFetch.mockResolvedValue(mockResponse);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockCaches.match).toHaveBeenCalledWith(mockRequest);
            expect(mockFetch).toHaveBeenCalledWith(mockRequest);
            expect(result).toBe(mockResponse);

            // Wait for internal cache.put promise to resolve
            await new Promise(process.nextTick);
            expect(mockCache.put).toHaveBeenCalledWith(mockRequest, mockResponseClone);
        });
    });

    describe('Network Fallback (Mutable assets)', () => {
        test('should fallback to cache when network fails', async () => {
            const fetchHandler = getEventHandler('fetch');

            const mockRequest = {
                url: 'https://example.com/api/data.json',
                destination: '',
                headers: { has: jest.fn().mockReturnValue(false) }
            };

            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn()
            };

            mockFetch.mockRejectedValue(new Error('Network error'));

            const mockCachedResponse = { status: 200, body: 'cached' };
            mockCaches.match.mockResolvedValue(mockCachedResponse);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockFetch).toHaveBeenCalledWith(mockRequest);
            expect(mockCaches.match).toHaveBeenCalledWith(mockRequest);
            expect(result).toBe(mockCachedResponse);
        });

        test('should cache the response when network succeeds (Network First)', async () => {
            const fetchHandler = getEventHandler('fetch');

            const mockRequest = {
                url: 'https://example.com/api/data.json',
                destination: '',
                headers: { has: jest.fn().mockReturnValue(false) }
            };

            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn()
            };

            const mockResponseClone = { status: 200, cloned: true };
            const mockResponse = {
                ok: true,
                status: 200,
                type: 'basic',
                headers: { get: jest.fn().mockReturnValue(null) },
                clone: jest.fn().mockReturnValue(mockResponseClone)
            };
            mockFetch.mockResolvedValue(mockResponse);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockFetch).toHaveBeenCalledWith(mockRequest);
            expect(result).toBe(mockResponse);

            expect(mockResponse.clone).toHaveBeenCalled();
            expect(mockCaches.open).toHaveBeenCalledWith('ryusoh-cache-v2');

            await new Promise(process.nextTick);
            expect(mockCache.put).toHaveBeenCalledWith(mockRequest, mockResponseClone);
        });

        test('should return undefined when both network and cache fail', async () => {
            const fetchHandler = getEventHandler('fetch');

            const mockRequest = {
                url: 'https://example.com/api/data.json',
                destination: '',
                headers: { has: jest.fn().mockReturnValue(false) }
            };

            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn()
            };

            mockFetch.mockRejectedValue(new Error('Network error'));

            mockCaches.match.mockResolvedValue(undefined);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockFetch).toHaveBeenCalledWith(mockRequest);
            expect(mockCaches.match).toHaveBeenCalledWith(mockRequest);
            expect(result).toBeUndefined();
        });
    });
});
