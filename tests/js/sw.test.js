/**
 * @jest-environment jsdom
 */

describe('Service Worker', () => {
    let sw;
    let mockSelf;
    let mockCaches;
    let mockFetch;
    let mockCache;

    beforeEach(() => {
        jest.resetModules();

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
            location: { origin: 'http://localhost' },
            clients: { claim: jest.fn().mockResolvedValue() },
            console: { warn: jest.fn() },
        };

        mockFetch = jest.fn();

        global.self = mockSelf;
        global.caches = mockCaches;
        global.fetch = mockFetch;

        window.self = mockSelf;
        window.caches = mockCaches;
        window.fetch = mockFetch;

        require('../../sw.js');
        sw = window.__swForTesting;
    });

    test('isValidResponse should validate correctly', () => {
        const res = { ok: true, status: 200, type: 'basic', headers: { get: () => null } };
        const req = { headers: { has: () => false } };
        expect(sw.isValidResponse(res, req)).toBe(true);

        expect(sw.isValidResponse({ ...res, ok: false }, req)).toBe(false);
        expect(sw.isValidResponse(res, { headers: { has: () => true } })).toBe(false);
    });

    test('installLogic should cache CORE_ASSETS', async () => {
        window.skipWaiting = mockSelf.skipWaiting;
        const event = { waitUntil: jest.fn() };
        sw.installLogic(event);
        await event.waitUntil.mock.calls[0][0];
        expect(mockCaches.open).toHaveBeenCalledWith(sw.CACHE_NAME);
        expect(mockCache.addAll).toHaveBeenCalledWith(sw.CORE_ASSETS);
        expect(mockSelf.skipWaiting).toHaveBeenCalled();
    });

    test('activateLogic should clean up old caches', async () => {
        window.clients = mockSelf.clients;
        const event = { waitUntil: jest.fn() };
        mockCaches.keys.mockResolvedValue(['old', sw.CACHE_NAME]);
        sw.activateLogic(event);
        await event.waitUntil.mock.calls[0][0];
        expect(mockCaches.delete).toHaveBeenCalledWith('old');
        expect(mockCaches.delete).not.toHaveBeenCalledWith(sw.CACHE_NAME);
        expect(mockSelf.clients.claim).toHaveBeenCalled();
    });

    describe('fetchLogic', () => {
        let event;

        beforeEach(() => {
            event = {
                request: {
                    url: 'http://localhost/test.js',
                    destination: 'script',
                    headers: { has: () => false },
                },
                respondWith: jest.fn(),
            };
        });

        test('should ignore cross-origin requests', () => {
            event.request.url = 'https://other-domain.com/test.js';
            sw.fetchLogic(event);
            expect(event.respondWith).not.toHaveBeenCalled();
        });

        describe('Cache First Strategy (Immutable Assets)', () => {
            beforeEach(() => {
                event.request.destination = 'image';
                event.request.url = 'http://localhost/test.png';
            });

            test('should return cached response if found', async () => {
                const mockResponse = { ok: true, status: 200 };
                mockCaches.match.mockResolvedValue(mockResponse);

                sw.fetchLogic(event);

                const respondWithPromise = event.respondWith.mock.calls[0][0];
                const res = await respondWithPromise;

                expect(mockCaches.match).toHaveBeenCalledWith(event.request);
                expect(res).toBe(mockResponse);
                expect(mockFetch).not.toHaveBeenCalled();
            });

            test('should fallback to fetch if not cached, and put in cache if valid', async () => {
                mockCaches.match.mockResolvedValue(null);

                const mockFetchResponse = {
                    ok: true,
                    status: 200,
                    type: 'basic',
                    headers: { get: () => null },
                    clone: jest.fn().mockReturnValue('cloned-response'),
                };
                mockFetch.mockResolvedValue(mockFetchResponse);

                sw.fetchLogic(event);

                const respondWithPromise = event.respondWith.mock.calls[0][0];
                const res = await respondWithPromise;

                expect(mockFetch).toHaveBeenCalledWith(event.request);
                expect(mockCache.put).toHaveBeenCalledWith(event.request, 'cloned-response');
                expect(res).toBe(mockFetchResponse);
            });
        });

        describe('Network First Strategy (Mutable Assets)', () => {
            beforeEach(() => {
                event.request.destination = 'document';
                event.request.url = 'http://localhost/index.html';
            });

            test('should fetch from network and put in cache if valid', async () => {
                const mockFetchResponse = {
                    ok: true,
                    status: 200,
                    type: 'basic',
                    headers: { get: () => null },
                    clone: jest.fn().mockReturnValue('cloned-response'),
                };
                mockFetch.mockResolvedValue(mockFetchResponse);

                sw.fetchLogic(event);

                const respondWithPromise = event.respondWith.mock.calls[0][0];
                const res = await respondWithPromise;

                expect(mockFetch).toHaveBeenCalledWith(event.request);
                expect(mockCache.put).toHaveBeenCalledWith(event.request, 'cloned-response');
                expect(res).toBe(mockFetchResponse);
            });

            test('should fallback to cache if network fetch fails', async () => {
                window.console = mockSelf.console;
                mockFetch.mockRejectedValue(new Error('Network offline'));
                const mockCachedResponse = { ok: true, status: 200 };
                mockCaches.match.mockResolvedValue(mockCachedResponse);

                sw.fetchLogic(event);

                const respondWithPromise = event.respondWith.mock.calls[0][0];
                const res = await respondWithPromise;

                expect(mockFetch).toHaveBeenCalledWith(event.request);
                expect(mockSelf.console.warn).toHaveBeenCalled();
                expect(mockCaches.match).toHaveBeenCalledWith(event.request);
                expect(res).toBe(mockCachedResponse);
            });

            test('should gracefully handle missing console during fallback', async () => {
                mockFetch.mockRejectedValue(new Error('Network offline'));
                delete mockSelf.console;

                sw.fetchLogic(event);
                const respondWithPromise = event.respondWith.mock.calls[0][0];
                await respondWithPromise;
                expect(mockCaches.match).toHaveBeenCalledWith(event.request);
            });
        });
    });
});
