const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('AssetPreloader', () => {
    let context;
    let preloader;
    let appendedElements = [];
    let mockWindow;

    beforeEach(() => {
        appendedElements = [];

        mockWindow = {
            location: {
                pathname: '/',
            },
            addEventListener: jest.fn(),
        };

        context = {
            window: mockWindow,
            document: {
                head: {
                    appendChild: jest.fn((el) => appendedElements.push(el)),
                },
                createElement: jest.fn((tag) => ({
                    tagName: tag.toUpperCase(),
                })),
                addEventListener: jest.fn(),
            },
            navigator: {
                serviceWorker: {},
            },
        };

        vm.createContext(context);
        let code = fs.readFileSync(path.resolve(__dirname, '../../js/preloader.js'), 'utf8');

        // Strip out the event listener that initializes it on load,
        // to avoid DOMContentLoaded side effects in our test environment
        code = code.replace(
            /document\.addEventListener\('DOMContentLoaded', \(\) => {[\s\S]*?}\);/g,
            ''
        );

        // Expose class to context
        code += '\nwindow.AssetPreloader = AssetPreloader;';

        vm.runInContext(code, context);
        preloader = new context.window.AssetPreloader();
    });

    test('getCurrentPageKey returns correct key based on URL', () => {
        context.window.location.pathname = '/p1/index.html';
        expect(preloader.getCurrentPageKey()).toBe('p1');

        context.window.location.pathname = '/p2/';
        expect(preloader.getCurrentPageKey()).toBe('p2');

        context.window.location.pathname = '/p3/foo.html';
        expect(preloader.getCurrentPageKey()).toBe('p3');

        context.window.location.pathname = '/';
        expect(preloader.getCurrentPageKey()).toBe('main');

        context.window.location.pathname = '/index.html';
        expect(preloader.getCurrentPageKey()).toBe('main');

        context.window.location.pathname = '/about';
        expect(preloader.getCurrentPageKey()).toBe('main');
    });

    test('preloadImage creates link element and appends to head', () => {
        preloader.preloadImage('test-image.jpg');

        expect(context.document.createElement).toHaveBeenCalledWith('link');
        expect(context.document.head.appendChild).toHaveBeenCalled();

        const appended = appendedElements[0];
        expect(appended.rel).toBe('preload');
        expect(appended.as).toBe('image');
        expect(appended.href).toBe('test-image.jpg');
    });

    test('preloadAssets calls preloadImage for correct sets', () => {
        preloader.preloadImage = jest.fn();

        preloader.preloadAssets(['p1']);
        expect(preloader.preloadImage).toHaveBeenCalledTimes(preloader.assetSets.p1.length);
        expect(preloader.preloadImage).toHaveBeenCalledWith(preloader.assetSets.p1[0]);
    });

    test('preloadForCurrentPage calls preloadAssets with correct pages', () => {
        preloader.preloadAssets = jest.fn();

        context.window.location.pathname = '/p1/';
        preloader.preloadForCurrentPage();
        expect(preloader.preloadAssets).toHaveBeenCalledWith(['p2', 'p3']);

        context.window.location.pathname = '/p2/';
        preloader.preloadForCurrentPage();
        expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p3']);

        context.window.location.pathname = '/p3/';
        preloader.preloadForCurrentPage();
        expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p2']);

        context.window.location.pathname = '/';
        preloader.preloadForCurrentPage();
        expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
    });

    test('init sets up load event listener when serviceWorker is available', () => {
        preloader.init();
        expect(context.window.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    });

    test('init load event listener calls preloadForCurrentPage', () => {
        preloader.preloadForCurrentPage = jest.fn();
        preloader.init();

        const loadCallback = context.window.addEventListener.mock.calls.find(
            (call) => call[0] === 'load'
        )[1];
        loadCallback();

        expect(preloader.preloadForCurrentPage).toHaveBeenCalled();
    });

    test('init does nothing when serviceWorker is not available', () => {
        delete context.navigator.serviceWorker;
        preloader.init();
        expect(context.window.addEventListener).not.toHaveBeenCalled();
    });
});
