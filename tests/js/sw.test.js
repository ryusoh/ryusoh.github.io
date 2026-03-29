const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { URL } = require('url');

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
            put: jest.fn().mockResolvedValue(),
        };

        mockCaches = {
            open: jest.fn().mockResolvedValue(mockCache),
            match: jest.fn(),
            keys: jest.fn().mockResolvedValue(['ryusoh-cache-v1']),
            delete: jest.fn().mockResolvedValue(),
        };

        mockSelf = {
            addEventListener: jest.fn(),
            skipWaiting: jest.fn().mockResolvedValue(),
            location: { origin: 'https://example.com' },
            clients: { claim: jest.fn().mockResolvedValue() },
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
        const call = mockSelf.addEventListener.mock.calls.find((c) => c[0] === eventName);
        return call ? call[1] : null;
    };

    describe('Lifecycle Events', () => {
        test('install event should cache CORE_ASSETS', async () => {
            const installHandler = getEventHandler('install');
            const mockEvent = {
                waitUntil: jest.fn(),
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
                waitUntil: jest.fn(),
            };

            // Set up caches.keys to return an old cache and the current cache
            mockCaches.keys.mockResolvedValue([
                'ryusoh-cache-v1',
                'ryusoh-cache-v2',
                'other-cache',
            ]);

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
                respondWith: jest.fn(),
            };

            fetchHandler(mockEvent);

            expect(mockEvent.respondWith).not.toHaveBeenCalled();
        });

        test('should use Cache First strategy for immutable assets (images)', async () => {
            const fetchHandler = getEventHandler('fetch');
            const mockRequest = {
                url: 'https://example.com/images/logo.png',
                destination: 'image',
                headers: { has: jest.fn().mockReturnValue(false) },
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
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
                headers: { has: jest.fn().mockReturnValue(false) },
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
            };

            // Cache miss
            mockCaches.match.mockResolvedValue(undefined);

            const mockResponseClone = { status: 200, cloned: true };
            const mockResponse = {
                ok: true,
                status: 200,
                type: 'basic',
                headers: { get: jest.fn().mockReturnValue(null) },
                clone: jest.fn().mockReturnValue(mockResponseClone),
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

        test('should skip caching if response has Content-Range header during Cache First fallback', async () => {
            const fetchHandler = getEventHandler('fetch');
            const mockRequest = {
                url: 'https://example.com/images/large.jpg',
                destination: 'image',
                headers: { has: jest.fn().mockReturnValue(false) },
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
            };

            mockCaches.match.mockResolvedValue(undefined);

            const mockResponse = {
                ok: true,
                status: 200,
                type: 'basic',
                headers: { get: jest.fn().mockReturnValue('bytes 21010-47021/47022') }, // Content-Range header present
            };
            mockFetch.mockResolvedValue(mockResponse);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockFetch).toHaveBeenCalledWith(mockRequest);
            expect(result).toBe(mockResponse);

            expect(mockCache.put).not.toHaveBeenCalled();
        });

        test('should skip caching if response is invalid (e.g. status 500) during Cache First fallback', async () => {
            const fetchHandler = getEventHandler('fetch');
            const mockRequest = {
                url: 'https://example.com/images/fail.png',
                destination: 'image',
                headers: { has: jest.fn().mockReturnValue(false) },
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
            };

            mockCaches.match.mockResolvedValue(undefined); // Cache miss

            const mockResponse = {
                ok: false,
                status: 500,
                type: 'basic',
                headers: { get: jest.fn().mockReturnValue(null) },
            };
            mockFetch.mockResolvedValue(mockResponse);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockFetch).toHaveBeenCalledWith(mockRequest);
            expect(result).toBe(mockResponse);
            // Cache should not be put
            expect(mockCache.put).not.toHaveBeenCalled();
        });

        test('should skip caching if request has range headers during Cache First fallback', async () => {
            const fetchHandler = getEventHandler('fetch');
            const mockRequest = {
                url: 'https://example.com/images/large.jpg',
                destination: 'image',
                headers: { has: jest.fn().mockReturnValue(true) }, // simulate range header
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
            };

            mockCaches.match.mockResolvedValue(undefined);

            const mockResponse = {
                ok: true,
                status: 200,
                type: 'basic',
                headers: { get: jest.fn().mockReturnValue(null) },
            };
            mockFetch.mockResolvedValue(mockResponse);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockFetch).toHaveBeenCalledWith(mockRequest);
            expect(result).toBe(mockResponse);
            expect(mockCache.put).not.toHaveBeenCalled();
        });
    });

    describe('Network Fallback (Mutable assets)', () => {
        test('should fallback to cache when network fails', async () => {
            const fetchHandler = getEventHandler('fetch');

            const mockRequest = {
                url: 'https://example.com/api/data.json',
                destination: '',
                headers: { has: jest.fn().mockReturnValue(false) },
            };

            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
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
                headers: { has: jest.fn().mockReturnValue(false) },
            };

            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
            };

            const mockResponseClone = { status: 200, cloned: true };
            const mockResponse = {
                ok: true,
                status: 200,
                type: 'basic',
                headers: { get: jest.fn().mockReturnValue(null) },
                clone: jest.fn().mockReturnValue(mockResponseClone),
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

        test('should skip caching if response is invalid during Network First', async () => {
            const fetchHandler = getEventHandler('fetch');
            const mockRequest = {
                url: 'https://example.com/api/data.json',
                destination: '',
                headers: { has: jest.fn().mockReturnValue(false) },
            };
            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
            };

            const mockResponse = {
                ok: false,
                status: 404, // Invalid status
                type: 'basic',
                headers: { get: jest.fn().mockReturnValue(null) },
            };
            mockFetch.mockResolvedValue(mockResponse);

            fetchHandler(mockEvent);

            const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
            const result = await respondWithPromise;

            expect(mockFetch).toHaveBeenCalledWith(mockRequest);
            expect(result).toBe(mockResponse);
            expect(mockCache.put).not.toHaveBeenCalled();
        });

        test('should return undefined when both network and cache fail', async () => {
            const fetchHandler = getEventHandler('fetch');

            const mockRequest = {
                url: 'https://example.com/api/data.json',
                destination: '',
                headers: { has: jest.fn().mockReturnValue(false) },
            };

            const mockEvent = {
                request: mockRequest,
                respondWith: jest.fn(),
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

describe('sw.js uncovered lines', () => {
    let mockCache;
    let mockCaches;
    let mockFetch;
    let mockSelf;
    let context;
    const fs = require('fs');
    const path = require('path');
    const vm = require('vm');
    const { URL } = require('url');

    const sourcePath = path.resolve(__dirname, '../../sw.js');
    const code = fs.readFileSync(sourcePath, 'utf8');

    beforeEach(() => {
        jest.clearAllMocks();

        mockCache = {
            addAll: jest.fn().mockResolvedValue(),
            put: jest.fn().mockResolvedValue(),
            delete: jest.fn().mockResolvedValue(),
        };

        mockCaches = {
            open: jest.fn().mockResolvedValue(mockCache),
            keys: jest.fn().mockResolvedValue(['ryusoh-cache-v1', 'ryusoh-cache-v2']),
            delete: jest.fn().mockResolvedValue(true),
            match: jest.fn().mockResolvedValue(undefined),
        };

        mockFetch = jest.fn();

        mockSelf = {
            addEventListener: jest.fn(),
            skipWaiting: jest.fn().mockResolvedValue(),
            clients: { claim: jest.fn().mockResolvedValue() },
            location: { origin: 'https://example.com' },
            console: { warn: jest.fn() },
        };

        context = vm.createContext({
            self: mockSelf,
            caches: mockCaches,
            fetch: mockFetch,
            URL,
            Promise,
            console: { warn: jest.fn() },
        });

        vm.runInContext(code, context);
    });

    const getEventHandler = (event) => {
        const call = mockSelf.addEventListener.mock.calls.find((call) => call[0] === event);
        return call ? call[1] : null;
    };

    it('should ignore requests with range headers in isValidResponse check', async () => {
        const fetchHandler = getEventHandler('fetch');
        const req = {
            url: 'https://example.com/some/path',
            destination: 'document',
            headers: { has: jest.fn().mockReturnValue(true) },
        };
        const event = {
            request: req,
            respondWith: jest.fn(),
        };

        const res = {
            ok: true,
            status: 200,
            type: 'basic',
            headers: { get: jest.fn().mockReturnValue(null) },
        };
        mockFetch.mockResolvedValue(res);

        fetchHandler(event);
        const result = await event.respondWith.mock.calls[0][0];

        expect(result).toBe(res);
        expect(req.headers.has).toHaveBeenCalledWith('range');
        // Because has('range') is true, it fails isValidResponse, so cache.put is not called
        await new Promise(process.nextTick);
        expect(mockCache.put).not.toHaveBeenCalled();
    });

    it('should ignore responses with Content-Range header in isValidResponse check', async () => {
        const fetchHandler = getEventHandler('fetch');
        const req = {
            url: 'https://example.com/some/path',
            destination: 'document',
            headers: { has: jest.fn().mockReturnValue(false) },
        };
        const event = {
            request: req,
            respondWith: jest.fn(),
        };

        const res = {
            ok: true,
            status: 200,
            type: 'basic',
            headers: { get: jest.fn().mockReturnValue('bytes 0-100/200') },
        };
        mockFetch.mockResolvedValue(res);

        fetchHandler(event);
        const result = await event.respondWith.mock.calls[0][0];

        expect(result).toBe(res);
        expect(res.headers.get).toHaveBeenCalledWith('Content-Range');
        // Because get('Content-Range') returns true, it fails isValidResponse
        await new Promise(process.nextTick);
        expect(mockCache.put).not.toHaveBeenCalled();
    });

    it('should handle network failure gracefully without self.console', async () => {
        // Remove console from mockSelf
        mockSelf.console = undefined;

        const fetchHandler = getEventHandler('fetch');
        const req = {
            url: 'https://example.com/some/path',
            destination: 'document',
            headers: { has: jest.fn().mockReturnValue(false) },
        };
        const event = {
            request: req,
            respondWith: jest.fn(),
        };

        const mockCachedResponse = { status: 200, body: 'cached fallback' };
        mockCaches.match.mockResolvedValue(mockCachedResponse);
        mockFetch.mockRejectedValue(new Error('Network offline'));

        fetchHandler(event);
        const result = await event.respondWith.mock.calls[0][0];

        expect(result).toBe(mockCachedResponse);
        expect(mockCaches.match).toHaveBeenCalledWith(req);
    });

    it('should fall back correctly if a fetch for an image throws an error', async () => {
        const fetchHandler = getEventHandler('fetch');
        const req = {
            url: 'https://example.com/image.png',
            destination: 'image',
            headers: { has: jest.fn().mockReturnValue(false) },
        };
        const event = {
            request: req,
            respondWith: jest.fn(),
        };

        // Cache miss
        mockCaches.match.mockResolvedValue(undefined);
        mockFetch.mockRejectedValue(new Error('Network offline'));

        fetchHandler(event);

        // Ensure the error from fetch rejects the promise because Cache First Strategy does not catch error.
        await expect(event.respondWith.mock.calls[0][0]).rejects.toThrow('Network offline');
    });
});

describe('more sw.js coverage', () => {
    let mockCache;
    let mockCaches;
    let mockFetch;
    let mockSelf;
    let context;
    const fs = require('fs');
    const path = require('path');
    const vm = require('vm');
    const { URL } = require('url');

    const sourcePath = path.resolve(__dirname, '../../sw.js');
    const code = fs.readFileSync(sourcePath, 'utf8');

    beforeEach(() => {
        jest.clearAllMocks();

        mockCache = {
            addAll: jest.fn().mockResolvedValue(),
            put: jest.fn().mockResolvedValue(),
            delete: jest.fn().mockResolvedValue(),
        };

        mockCaches = {
            open: jest.fn().mockResolvedValue(mockCache),
            keys: jest.fn().mockResolvedValue(['ryusoh-cache-v1', 'ryusoh-cache-v2']),
            delete: jest.fn().mockResolvedValue(true),
            match: jest.fn().mockResolvedValue(undefined),
        };

        mockFetch = jest.fn();

        mockSelf = {
            addEventListener: jest.fn(),
            skipWaiting: jest.fn().mockResolvedValue(),
            clients: { claim: jest.fn().mockResolvedValue() },
            location: { origin: 'https://example.com' },
            console: { warn: jest.fn() },
        };

        context = vm.createContext({
            self: mockSelf,
            caches: mockCaches,
            fetch: mockFetch,
            URL,
            Promise,
            console: { warn: jest.fn() },
        });

        vm.runInContext(code, context);
    });

    const getEventHandler = (event) => {
        const call = mockSelf.addEventListener.mock.calls.find((call) => call[0] === event);
        return call ? call[1] : null;
    };

    it('should test typeof self.console.warn is not function', async () => {
        // Mock so warn is not a function
        mockSelf.console.warn = 'not a function';

        const fetchHandler = getEventHandler('fetch');
        const req = {
            url: 'https://example.com/some/path',
            destination: 'document',
            headers: { has: jest.fn().mockReturnValue(false) },
        };
        const event = {
            request: req,
            respondWith: jest.fn(),
        };

        const mockCachedResponse = { status: 200, body: 'cached fallback' };
        mockCaches.match.mockResolvedValue(mockCachedResponse);
        mockFetch.mockRejectedValue(new Error('Network offline'));

        fetchHandler(event);
        const result = await event.respondWith.mock.calls[0][0];

        expect(result).toBe(mockCachedResponse);
        expect(mockCaches.match).toHaveBeenCalledWith(req);
    });
});
