/**
 * @jest-environment jsdom
 */

describe('AssetPreloader', () => {
    let AssetPreloader;

    beforeEach(() => {
        jest.resetModules();
        // Mock navigator.serviceWorker to enable init() logic
        Object.defineProperty(global.navigator, 'serviceWorker', {
            value: {},
            configurable: true,
        });

        require('../../js/preloader.js');
        AssetPreloader = window.__AssetPreloaderForTesting.AssetPreloader;
    });

    test('should identify current page key from pathname', () => {
        const preloader = new AssetPreloader();

        delete window.location;
        window.location = new URL('https://example.com/p1/');
        expect(preloader.getCurrentPageKey()).toBe('p1');

        window.location = new URL('https://example.com/p2/');
        expect(preloader.getCurrentPageKey()).toBe('p2');

        window.location = new URL('https://example.com/');
        expect(preloader.getCurrentPageKey()).toBe('main');
    });

    test('should create preload link with correct attributes', () => {
        const preloader = new AssetPreloader();
        const imgSrc = '/test.jpg';
        const link = preloader.createPreloadLink(imgSrc);

        expect(link.rel).toBe('preload');
        expect(link.as).toBe('image');
        expect(link.href).toContain(imgSrc);
    });

    test('should append multiple links to head when preloading assets', () => {
        const preloader = new AssetPreloader();
        const headSpy = jest.spyOn(document.head, 'appendChild');

        preloader.preloadAssets(['p1']);

        expect(headSpy).toHaveBeenCalled();
        // P1 has 18 assets
        expect(document.head.querySelectorAll('link[rel="preload"]').length).toBe(18);
    });

    test('init should register load event listener', () => {
        const preloader = new AssetPreloader();
        const addEventSpy = jest.spyOn(window, 'addEventListener');

        preloader.init();
        expect(addEventSpy).toHaveBeenCalledWith('load', expect.any(Function));
    });

    describe('preloadForCurrentPage', () => {
        test('should preload assets for all portfolio pages on main', () => {
            const preloader = new AssetPreloader();
            jest.spyOn(preloader, 'getCurrentPageKey').mockReturnValue('main');
            jest.spyOn(preloader, 'preloadAssets').mockImplementation(() => {});

            preloader.preloadForCurrentPage();

            expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
        });

        test('should preload assets for remaining portfolio pages on p1', () => {
            const preloader = new AssetPreloader();
            jest.spyOn(preloader, 'getCurrentPageKey').mockReturnValue('p1');
            jest.spyOn(preloader, 'preloadAssets').mockImplementation(() => {});

            preloader.preloadForCurrentPage();

            expect(preloader.preloadAssets).toHaveBeenCalledWith(['p2', 'p3']);
        });
    });

    describe('init', () => {
        let originalRequestIdleCallback;

        beforeEach(() => {
            jest.useFakeTimers();
            originalRequestIdleCallback = window.requestIdleCallback;
        });

        afterEach(() => {
            jest.useRealTimers();
            window.requestIdleCallback = originalRequestIdleCallback;
            jest.restoreAllMocks();
        });

        test('should use requestIdleCallback when available', () => {
            const preloader = new AssetPreloader();
            jest.spyOn(preloader, 'preloadForCurrentPage').mockImplementation(() => {});

            // Mock requestIdleCallback
            window.requestIdleCallback = jest.fn((cb) => cb());

            preloader.init();

            // Trigger load event
            window.dispatchEvent(new Event('load'));

            expect(window.requestIdleCallback).toHaveBeenCalled();
            expect(preloader.preloadForCurrentPage).toHaveBeenCalled();
        });

        test('should fall back to setTimeout when requestIdleCallback is unavailable', () => {
            const preloader = new AssetPreloader();
            jest.spyOn(preloader, 'preloadForCurrentPage').mockImplementation(() => {});

            // Ensure requestIdleCallback is unavailable
            delete window.requestIdleCallback;
            jest.spyOn(window, 'setTimeout');

            preloader.init();

            // Trigger load event
            window.dispatchEvent(new Event('load'));

            expect(window.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);

            jest.advanceTimersByTime(1000);
            expect(preloader.preloadForCurrentPage).toHaveBeenCalled();
        });
    });

    describe('preloadAssets with DocumentFragment', () => {
        test('should use a DocumentFragment for batch appending', () => {
            const preloader = new AssetPreloader();
            const originalCreateDocumentFragment = document.createDocumentFragment;
            const mockFragment = {
                appendChild: jest.fn(),
            };
            document.createDocumentFragment = jest.fn(() => mockFragment);

            // Mock head.appendChild
            const headSpy = jest.spyOn(document.head, 'appendChild').mockImplementation(() => {});

            // We only need a small mocked set
            preloader.assetSets = {
                mockPage: ['/test1.jpg', '/test2.jpg'],
            };

            preloader.preloadAssets(['mockPage']);

            // Verify createDocumentFragment was used
            expect(document.createDocumentFragment).toHaveBeenCalled();

            // Verify elements were appended to fragment first
            expect(mockFragment.appendChild).toHaveBeenCalledTimes(2);

            // Verify fragment was appended to head
            expect(headSpy).toHaveBeenCalledWith(mockFragment);

            // Cleanup
            document.createDocumentFragment = originalCreateDocumentFragment;
            headSpy.mockRestore();
        });
    });

    test('should identify index.html as main page', () => {
        const preloader = new AssetPreloader();
        delete window.location;
        window.location = new URL('https://example.com/index.html');
        expect(preloader.getCurrentPageKey()).toBe('main');
    });

    test('should identify p3 from pathname', () => {
        const preloader = new AssetPreloader();
        delete window.location;
        window.location = new URL('https://example.com/p3/');
        expect(preloader.getCurrentPageKey()).toBe('p3');
    });

    test('preloadForCurrentPage should preload assets for p1 and p2 when on p3', () => {
        const preloader = new AssetPreloader();
        jest.spyOn(preloader, 'getCurrentPageKey').mockReturnValue('p3');
        const preloadAssetsSpy = jest
            .spyOn(preloader, 'preloadAssets')
            .mockImplementation(() => {});

        preloader.preloadForCurrentPage();

        expect(preloadAssetsSpy).toHaveBeenCalledWith(['p1', 'p2']);
    });
});
