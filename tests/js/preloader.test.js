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
            createDocumentFragment: jest.fn(() => {
                const frag = {
                    nodeType: 11,
                    children: [],
                    appendChild: jest.fn(function (el) {
                        this.children.push(el);
                    }),
                };
                return frag;
            }),
            head: {
                appendChild: jest.fn((el) => {
                    if (el && el.nodeType === 11) {
                        appendedElements.push(...el.children);
                    } else if (el) {
                        appendedElements.push(el);
                    }
                }),
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

    test('createPreloadLink creates link element and returns it', () => {
        const preloader = new AssetPreloader();
        const link = preloader.createPreloadLink('test-image.jpg');

        expect(mockDocument.createElement).toHaveBeenCalledWith('link');

        expect(link.rel).toBe('preload');
        expect(link.as).toBe('image');
        expect(link.href).toBe('test-image.jpg');
    });

    test('preloadImage creates link element and appends to head (maintains public API)', () => {
        const preloader = new AssetPreloader();
        preloader.preloadImage('test-image.jpg');

        expect(mockDocument.createElement).toHaveBeenCalledWith('link');
        expect(mockDocument.head.appendChild).toHaveBeenCalled();

        const appended = appendedElements[0];
        expect(appended.rel).toBe('preload');
        expect(appended.as).toBe('image');
        expect(appended.href).toBe('test-image.jpg');
    });

    test('preloadAssets creates links via createPreloadLink and appends them using a fragment', () => {
        const preloader = new AssetPreloader();
        preloader.createPreloadLink = jest.fn((imgSrc) => {
            return {
                tagName: 'LINK',
                rel: 'preload',
                as: 'image',
                href: imgSrc,
            };
        });

        preloader.preloadAssets(['p1']);

        expect(mockDocument.createDocumentFragment).toHaveBeenCalled();
        expect(preloader.createPreloadLink).toHaveBeenCalledTimes(preloader.assetSets.p1.length);
        expect(preloader.createPreloadLink).toHaveBeenCalledWith(preloader.assetSets.p1[0]);

        expect(mockDocument.head.appendChild).toHaveBeenCalled();
        expect(appendedElements.length).toBe(preloader.assetSets.p1.length);

        const firstAppended = appendedElements[0];
        expect(firstAppended.rel).toBe('preload');
        expect(firstAppended.href).toBe(preloader.assetSets.p1[0]);
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

    test('init load event listener calls preloadForCurrentPage via requestIdleCallback', () => {
        const preloader = new AssetPreloader();
        preloader.preloadForCurrentPage = jest.fn();
        mockWindow.requestIdleCallback = jest.fn((cb) => cb());
        preloader.init();

        const loadCallback = mockWindow.addEventListener.mock.calls.find(
            (call) => call[0] === 'load'
        )[1];
        loadCallback();

        expect(mockWindow.requestIdleCallback).toHaveBeenCalled();
        expect(preloader.preloadForCurrentPage).toHaveBeenCalled();
    });

    test('init load event listener calls preloadForCurrentPage via setTimeout fallback', () => {
        const preloader = new AssetPreloader();
        preloader.preloadForCurrentPage = jest.fn();
        mockWindow.requestIdleCallback = undefined;
        mockWindow.setTimeout = jest.fn((cb) => cb());
        preloader.init();

        const loadCallback = mockWindow.addEventListener.mock.calls.find(
            (call) => call[0] === 'load'
        )[1];
        loadCallback();

        expect(mockWindow.setTimeout).toHaveBeenCalled();
        expect(preloader.preloadForCurrentPage).toHaveBeenCalled();
    });

    test('init does nothing when serviceWorker is not available', () => {
        delete context.navigator.serviceWorker;
        const preloader = new AssetPreloader();
        preloader.init();
        expect(mockWindow.addEventListener).not.toHaveBeenCalled();
    });

    test('initializes preloader on DOMContentLoaded', () => {
        const sourcePath = path.resolve(__dirname, '../../js/preloader.js');
        const originalCode = fs.readFileSync(sourcePath, 'utf8');

        context.document.addEventListener = jest.fn((event, cb) => {
            if (event === 'DOMContentLoaded') {
                context.__domContentLoadedCb = cb;
            }
        });

        vm.createContext(context);

        // Create a fresh context to avoid 'Identifier has already been declared'
        const freshContext = {
            document: context.document,
            window: context.window,
            navigator: context.navigator,
            console: console,
            module: { exports: {} },
        };
        freshContext.document.addEventListener = context.document.addEventListener;
        vm.createContext(freshContext);
        vm.runInContext(originalCode, freshContext);

        expect(context.document.addEventListener).toHaveBeenCalledWith(
            'DOMContentLoaded',
            expect.any(Function)
        );

        expect(() => {
            context.__domContentLoadedCb();
        }).not.toThrow();
    });
});
