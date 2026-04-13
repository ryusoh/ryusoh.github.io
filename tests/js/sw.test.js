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
            location: { origin: 'https://example.com' },
            clients: { claim: jest.fn().mockResolvedValue() },
            console: { warn: jest.fn() },
        };

        mockFetch = jest.fn();

        // Inject globals onto the global object for the current test environment
        global.self = mockSelf;
        global.caches = mockCaches;
        global.fetch = mockFetch;
        global.skipWaiting = mockSelf.skipWaiting;
        global.clients = mockSelf.clients;

        // Also on window for JSDOM
        window.self = mockSelf;
        window.caches = mockCaches;
        window.fetch = mockFetch;
        window.skipWaiting = mockSelf.skipWaiting;
        window.clients = mockSelf.clients;

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
        const event = { waitUntil: jest.fn() };
        sw.installLogic(event);
        await event.waitUntil.mock.calls[0][0];
        expect(mockCaches.open).toHaveBeenCalledWith(sw.CACHE_NAME);
        expect(mockCache.addAll).toHaveBeenCalledWith(sw.CORE_ASSETS);
        expect(mockSelf.skipWaiting).toHaveBeenCalled();
    });

    test('activateLogic should clean up old caches', async () => {
        const event = { waitUntil: jest.fn() };
        mockCaches.keys.mockResolvedValue(['old', sw.CACHE_NAME]);
        sw.activateLogic(event);
        await event.waitUntil.mock.calls[0][0];
        expect(mockCaches.delete).toHaveBeenCalledWith('old');
        expect(mockCaches.delete).not.toHaveBeenCalledWith(sw.CACHE_NAME);
        expect(mockSelf.clients.claim).toHaveBeenCalled();
    });
});
