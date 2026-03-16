const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('AssetPreloader', () => {
    let context;
    let mockDocument;
    let mockWindow;
    let AssetPreloader;
    let appendedElements = [];

    beforeEach(() => {
        appendedElements = [];
        jest.clearAllMocks();

        mockDocument = {
            createElement: jest.fn((tag) => {
                const el = { tagName: tag.toUpperCase() };
                return el;
            }),
            head: {
                appendChild: jest.fn((el) => appendedElements.push(el)),
            },
            addEventListener: jest.fn(),
        };

        mockWindow = {
            location: {
                pathname: '/',
            },
            addEventListener: jest.fn(),
        };

        context = {
            document: mockDocument,
            window: mockWindow,
            navigator: {
                serviceWorker: {},
            },
            console: console,
            module: { exports: {} },
        };

        vm.createContext(context);
        const sourcePath = path.resolve(__dirname, '../../js/preloader.js');
        let code = fs.readFileSync(sourcePath, 'utf8');

        // Strip out the event listener that initializes it on load
        code = code.replace(
            /document\.addEventListener\('DOMContentLoaded', \(\) => {[\s\S]*?}\);/g,
            ''
        );

        vm.runInContext(code, context);
        AssetPreloader = context.module.exports.AssetPreloader;
    });

    describe('getCurrentPageKey', () => {
        it('should return "p1" when pathname contains "/p1/"', () => {
            mockWindow.location.pathname = '/p1/';
            const preloader = new AssetPreloader();
            expect(preloader.getCurrentPageKey()).toBe('p1');

            mockWindow.location.pathname = '/project/p1/index.html';
            expect(preloader.getCurrentPageKey()).toBe('p1');
        });

        it('should return "p2" when pathname contains "/p2/"', () => {
            mockWindow.location.pathname = '/p2/';
            const preloader = new AssetPreloader();
            expect(preloader.getCurrentPageKey()).toBe('p2');

            mockWindow.location.pathname = '/p2/gallery.html';
            expect(preloader.getCurrentPageKey()).toBe('p2');
        });

        it('should return "p3" when pathname contains "/p3/"', () => {
            mockWindow.location.pathname = '/p3/';
            const preloader = new AssetPreloader();
            expect(preloader.getCurrentPageKey()).toBe('p3');
        });

        it('should return "main" when pathname is "/"', () => {
            mockWindow.location.pathname = '/';
            const preloader = new AssetPreloader();
            expect(preloader.getCurrentPageKey()).toBe('main');
        });

        it('should return "main" when pathname contains "/index.html"', () => {
            mockWindow.location.pathname = '/index.html';
            const preloader = new AssetPreloader();
            expect(preloader.getCurrentPageKey()).toBe('main');

            mockWindow.location.pathname = '/subdir/index.html';
            expect(preloader.getCurrentPageKey()).toBe('main');
        });

        it('should return "main" for unknown paths', () => {
            mockWindow.location.pathname = '/about.html';
            const preloader = new AssetPreloader();
            expect(preloader.getCurrentPageKey()).toBe('main');
        });
    });

    test('preloadImage creates link element and appends to head', () => {
        const preloader = new AssetPreloader();
        preloader.preloadImage('test-image.jpg');

        expect(mockDocument.createElement).toHaveBeenCalledWith('link');
        expect(mockDocument.head.appendChild).toHaveBeenCalled();

        const appended = appendedElements[0];
        expect(appended.rel).toBe('preload');
        expect(appended.as).toBe('image');
        expect(appended.href).toBe('test-image.jpg');
    });

    test('preloadAssets calls preloadImage for correct sets', () => {
        const preloader = new AssetPreloader();
        preloader.preloadImage = jest.fn();

        preloader.preloadAssets(['p1']);
        expect(preloader.preloadImage).toHaveBeenCalledTimes(preloader.assetSets.p1.length);
        expect(preloader.preloadImage).toHaveBeenCalledWith(preloader.assetSets.p1[0]);
    });

    test('preloadForCurrentPage calls preloadAssets with correct pages', () => {
        const preloader = new AssetPreloader();
        preloader.preloadAssets = jest.fn();

        mockWindow.location.pathname = '/p1/';
        preloader.preloadForCurrentPage();
        expect(preloader.preloadAssets).toHaveBeenCalledWith(['p2', 'p3']);

        mockWindow.location.pathname = '/p2/';
        preloader.preloadForCurrentPage();
        expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p3']);

        mockWindow.location.pathname = '/p3/';
        preloader.preloadForCurrentPage();
        expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p2']);

        mockWindow.location.pathname = '/';
        preloader.preloadForCurrentPage();
        expect(preloader.preloadAssets).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
    });

    test('init sets up load event listener when serviceWorker is available', () => {
        const preloader = new AssetPreloader();
        preloader.init();
        expect(mockWindow.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    });

    test('init load event listener calls preloadForCurrentPage', () => {
        const preloader = new AssetPreloader();
        preloader.preloadForCurrentPage = jest.fn();
        preloader.init();

        const loadCallback = mockWindow.addEventListener.mock.calls.find(
            (call) => call[0] === 'load'
        )[1];
        loadCallback();

        expect(preloader.preloadForCurrentPage).toHaveBeenCalled();
    });

    test('init does nothing when serviceWorker is not available', () => {
        delete context.navigator.serviceWorker;
        const preloader = new AssetPreloader();
        preloader.init();
        expect(mockWindow.addEventListener).not.toHaveBeenCalled();
    });
});
