/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('AssetPreloader', () => {
    let context;
    let code;
    let AssetPreloader;

    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = '';

        const sourcePath = path.resolve(__dirname, '../../js/preloader.js');
        code = fs.readFileSync(sourcePath, 'utf8');

        // Strip the DOMContentLoaded listener to avoid side effects
        const strippedCode = code.replace(
            /document\.addEventListener\('DOMContentLoaded'[\s\S]*?\}\);/,
            ''
        );

        context = {
            window,
            document: window.document,
            navigator: window.navigator,
            setTimeout: window.setTimeout,
            URL: window.URL,
            console: window.console,
        };

        vm.createContext(context);
        vm.runInContext(strippedCode, context);

        AssetPreloader = context.window.__AssetPreloaderForTesting.AssetPreloader;
    });

    test('getCurrentPageKey should identify p1 correctly', () => {
        const preloader = new AssetPreloader();
        delete context.window.location;
        context.window.location = new URL('https://example.com/p1/');
        expect(preloader.getCurrentPageKey()).toBe('p1');
    });

    test('getCurrentPageKey should identify p2 correctly', () => {
        const preloader = new AssetPreloader();
        delete context.window.location;
        context.window.location = new URL('https://example.com/p2/');
        expect(preloader.getCurrentPageKey()).toBe('p2');
    });

    test('getCurrentPageKey should identify p3 correctly', () => {
        const preloader = new AssetPreloader();
        delete context.window.location;
        context.window.location = new URL('https://example.com/p3/');
        expect(preloader.getCurrentPageKey()).toBe('p3');
    });

    test('should preload single image with correct link', () => {
        const preloader = new AssetPreloader();
        const imgSrc = '/test.jpg';
        const headSpy = jest.spyOn(context.document.head, 'appendChild');

        preloader.preloadImage(imgSrc);

        expect(headSpy).toHaveBeenCalled();
        const addedLink = headSpy.mock.calls[0][0];
        expect(addedLink.rel).toBe('preload');
        expect(addedLink.as).toBe('image');
        expect(addedLink.href).toContain(imgSrc);
    });

    test('should append multiple links to head when preloading assets', () => {
        const preloader = new AssetPreloader();
        const headSpy = jest.spyOn(context.document.head, 'appendChild');

        preloader.preloadAssets(['p1']);

        expect(headSpy).toHaveBeenCalled();
        expect(
            context.document.head.querySelectorAll('link[rel="preload"]').length
        ).toBeGreaterThan(0);
    });

    test('init should register load event listener', () => {
        const addEventSpy = jest.spyOn(context.window, 'addEventListener');
        const preloader = new AssetPreloader();

        // Mock serviceWorker in navigator to pass the check
        context.window.navigator.serviceWorker = {};

        preloader.init();
        expect(addEventSpy).toHaveBeenCalledWith('load', expect.any(Function));
    });

    describe('preloadForCurrentPage', () => {
        test('should preload assets for other portfolio pages on p1', () => {
            const preloader = new AssetPreloader();
            jest.spyOn(preloader, 'getCurrentPageKey').mockReturnValue('p1');
            jest.spyOn(preloader, 'preloadAssets').mockImplementation(() => {});

            preloader.preloadForCurrentPage();

            expect(preloader.preloadAssets).toHaveBeenCalledWith(['p2', 'p3']);
        });

        test('should preload assets for remaining portfolio pages on p2', () => {
            const preloader = new AssetPreloader();
            jest.spyOn(preloader, 'getCurrentPageKey').mockReturnValue('p2');
            jest.spyOn(preloader, 'preloadAssets').mockImplementation(() => {});

            preloader.preloadForCurrentPage();

            expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p3']);
        });

        test('should preload assets for remaining portfolio pages on p3', () => {
            const preloader = new AssetPreloader();
            jest.spyOn(preloader, 'getCurrentPageKey').mockReturnValue('p3');
            jest.spyOn(preloader, 'preloadAssets').mockImplementation(() => {});

            preloader.preloadForCurrentPage();

            expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p2']);
        });

        test('should fallback to main for unknown paths', () => {
            const preloader = new AssetPreloader();
            jest.spyOn(preloader, 'getCurrentPageKey').mockReturnValue('unknown');
            jest.spyOn(preloader, 'preloadAssets').mockImplementation(() => {});

            preloader.preloadForCurrentPage();

            expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
        });
    });

    describe('init behaviors', () => {
        let preloader;
        let preloadSpy;

        beforeEach(() => {
            preloader = new AssetPreloader();
            preloadSpy = jest
                .spyOn(preloader, 'preloadForCurrentPage')
                .mockImplementation(() => {});

            // Mock serviceWorker check
            context.window.navigator.serviceWorker = {};

            // Trigger the 'load' listener automatically
            jest.spyOn(context.window, 'addEventListener').mockImplementation((event, cb) => {
                if (event === 'load') {
                    cb();
                }
            });
        });

        test('should call preloadForCurrentPage using requestIdleCallback if available', () => {
            context.window.requestIdleCallback = jest.fn((cb) => cb());
            preloader.init();
            expect(context.window.requestIdleCallback).toHaveBeenCalled();
            expect(preloadSpy).toHaveBeenCalled();
        });

        test('should fallback to setTimeout if requestIdleCallback is not available', () => {
            delete context.window.requestIdleCallback;
            jest.useFakeTimers();
            preloader.init();
            jest.runAllTimers();
            expect(preloadSpy).toHaveBeenCalled();
            jest.useRealTimers();
        });
    });
});
