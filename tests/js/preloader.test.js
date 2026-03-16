/**
 * Tests for preloader.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../js/preloader.js');
const code = fs.readFileSync(sourcePath, 'utf8');

describe('AssetPreloader', () => {
    let context;
    let mockDocument;
    let mockWindow;
    let AssetPreloader;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDocument = {
            createElement: jest.fn().mockReturnValue({}),
            head: {
                appendChild: jest.fn(),
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
            // To capture the class
            AssetPreloader: undefined,
        };

        // Capture module.exports
        const mockModule = { exports: {} };
        context.module = mockModule;

        vm.createContext(context);
        vm.runInContext(code, context);

        AssetPreloader = mockModule.exports.AssetPreloader;
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
});
