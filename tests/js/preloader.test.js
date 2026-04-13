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
});
