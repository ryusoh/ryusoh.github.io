/**
 * @jest-environment jsdom
 */

describe('AssetPreloader', () => {
    let AssetPreloader;
    let originalWindowLocation;

    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = '';

        require('../../js/preloader.js');
        const testing = window.__AssetPreloaderForTesting;
        if (!testing) {
            throw new Error('window.__AssetPreloaderForTesting is undefined');
        }
        AssetPreloader = testing.AssetPreloader;

        // Mock window.location
        originalWindowLocation = window.location;
        delete window.location;
        window.location = { pathname: '/p1/' };
    });

    afterEach(() => {
        window.location = originalWindowLocation;
    });

    it('getCurrentPageKey should identify p1 correctly', () => {
        window.location.pathname = '/p1/';
        const preloader = new AssetPreloader();
        expect(preloader.getCurrentPageKey()).toBe('p1');
    });

    it('getCurrentPageKey should identify p2 correctly', () => {
        window.location.pathname = '/p2/index.html';
        const preloader = new AssetPreloader();
        expect(preloader.getCurrentPageKey()).toBe('p2');
    });

    it('getCurrentPageKey should identify p3 correctly', () => {
        window.location.pathname = '/p3/';
        const preloader = new AssetPreloader();
        expect(preloader.getCurrentPageKey()).toBe('p3');
    });

    it('should preload single image with correct link', () => {
        const preloader = new AssetPreloader();
        preloader.preloadAssets(['p3']);
        const links = document.head.querySelectorAll('link');
        expect(links.length).toBeGreaterThan(0);
        expect(links[0].href).toContain('/assets/img/p3/');
        expect(links[0].rel).toBe('preload');
        expect(links[0].as).toBe('image');
        // The code does not set crossorigin attribute for images.
    });

    it('should append multiple links to head when preloading assets', () => {
        const preloader = new AssetPreloader();
        preloader.preloadAssets(['p2', 'p3']);
        const links = document.head.querySelectorAll('link');
        expect(links.length).toBeGreaterThan(0);
        // Check that assets from both sets are preloaded
        const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
        expect(hrefs.some((h) => h.includes('/assets/img/p2/'))).toBe(true);
        expect(hrefs.some((h) => h.includes('/assets/img/p3/'))).toBe(true);
    });

    it('init should register load event listener', () => {
        const preloader = new AssetPreloader();
        Object.defineProperty(navigator, 'serviceWorker', {
            value: {},
            configurable: true,
        });
        const spy = jest.spyOn(window, 'addEventListener');
        preloader.init();
        expect(spy).toHaveBeenCalledWith('load', expect.any(Function));
        spy.mockRestore();
    });

    describe('preloadForCurrentPage', () => {
        it('should preload assets for other portfolio pages on p1', () => {
            window.location.pathname = '/p1/';
            const preloader = new AssetPreloader();
            const spy = jest.spyOn(preloader, 'preloadAssets');
            preloader.preloadForCurrentPage();

            // Should preload p2, p3, p4, main
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should preload assets for remaining portfolio pages on p2', () => {
            window.location.pathname = '/p2/';
            const preloader = new AssetPreloader();
            const spy = jest.spyOn(preloader, 'preloadAssets');
            preloader.preloadForCurrentPage();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should preload assets for remaining portfolio pages on p3', () => {
            window.location.pathname = '/p3/';
            const preloader = new AssetPreloader();
            const spy = jest.spyOn(preloader, 'preloadAssets');
            preloader.preloadForCurrentPage();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should fallback to main for unknown paths', () => {
            window.location.pathname = '/unknown/';
            const preloader = new AssetPreloader();
            const spy = jest.spyOn(preloader, 'preloadAssets');
            preloader.preloadForCurrentPage();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('init behaviors', () => {
        it('should call preloadForCurrentPage using requestIdleCallback if available', () => {
            Object.defineProperty(navigator, 'serviceWorker', {
                value: {},
                configurable: true,
            });
            const preloader = new AssetPreloader();
            const spy = jest.spyOn(preloader, 'preloadForCurrentPage').mockImplementation(() => {});

            window.requestIdleCallback = jest.fn((cb) => cb());

            preloader.init();

            // Trigger the load event
            const event = new Event('load');
            window.dispatchEvent(event);

            expect(window.requestIdleCallback).toHaveBeenCalled();
            expect(spy).toHaveBeenCalled();

            spy.mockRestore();
            delete window.requestIdleCallback;
        });

        it('should fallback to setTimeout if requestIdleCallback is not available', () => {
            Object.defineProperty(navigator, 'serviceWorker', {
                value: {},
                configurable: true,
            });
            jest.useFakeTimers();
            const preloader = new AssetPreloader();
            const spy = jest.spyOn(preloader, 'preloadForCurrentPage').mockImplementation(() => {});

            delete window.requestIdleCallback;
            window.setTimeout = jest.fn((cb) => cb());

            preloader.init();

            const event = new Event('load');
            window.dispatchEvent(event);

            expect(window.setTimeout).toHaveBeenCalled();
            expect(spy).toHaveBeenCalled();

            spy.mockRestore();
            jest.useRealTimers();
        });
    });
});
