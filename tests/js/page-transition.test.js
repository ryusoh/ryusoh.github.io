const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

// Strip out the ES module import statement because vm.runInContext runs in script mode
// and cannot parse 'import' syntax. We replace it with an empty object mock for THREE.
const codeToEvaluate = sourceCode.replace(
    /import\s+\*\s+as\s+THREE\s+from\s+['"][^'"]+['"];/,
    'const THREE = {};'
);

describe('page-transition.js hasTransitionParam', () => {
    let context;
    let hasTransitionParam;

    beforeEach(() => {
        // Mock the minimal DOM environment needed to bypass IIFE execution errors
        const mockDocument = {
            readyState: 'complete',
            documentElement: { classList: { add: jest.fn(), remove: jest.fn() } },
            body: {
                getAttribute: jest.fn(),
                appendChild: jest.fn(),
            },
            querySelectorAll: jest.fn().mockReturnValue([]),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockReturnValue({
                appendChild: jest.fn(),
                style: {},
            }),
            getElementById: jest.fn().mockReturnValue(null),
            head: { appendChild: jest.fn() },
        };

        const mockWindow = {
            location: {
                href: 'http://localhost/',
            },
            URL: jest.fn(),
            addEventListener: jest.fn(),
            matchMedia: jest.fn().mockReturnValue({ matches: false }),
            getComputedStyle: jest.fn().mockReturnValue({ getPropertyValue: jest.fn() }),
            sessionStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
            },
            innerWidth: 1024,
            innerHeight: 768,
            devicePixelRatio: 1,
            requestAnimationFrame: jest.fn(),
            cancelAnimationFrame: jest.fn(),
            setTimeout: jest.fn(),
            clearTimeout: jest.fn(),
        };

        // Prepare context for VM
        context = {
            window: mockWindow,
            document: mockDocument,
            Promise: Promise,
            console: console,
            setTimeout: mockWindow.setTimeout,
            clearTimeout: mockWindow.clearTimeout,
        };

        vm.createContext(context);

        // Run the code. The modified source exposes internals on window.__PageTransitionForTesting
        vm.runInContext(codeToEvaluate, context);
        hasTransitionParam = context.window.__PageTransitionForTesting.hasTransitionParam;
    });

    describe('hasTransitionParam', () => {
        test('should return false when window.URL constructor throws an error', () => {
            // Mock window.URL to throw an error
            context.window.URL.mockImplementation(() => {
                throw new Error('Invalid URL');
            });

            const result = hasTransitionParam();

            expect(result).toBe(false);
            expect(context.window.URL).toHaveBeenCalledWith('http://localhost/');
        });

        test('should return false when window is undefined', () => {
            // Simulate missing window
            const prevWindow = context.window;
            context.window = undefined;
            const result = hasTransitionParam();
            expect(result).toBe(false);
            context.window = prevWindow;
        });

        test('should return false when window.location is undefined', () => {
            // Simulate missing location
            const prevLocation = context.window.location;
            context.window.location = undefined;
            const result = hasTransitionParam();
            expect(result).toBe(false);
            context.window.location = prevLocation;
        });

        test('should return true when transition param is present', () => {
            context.window.URL.mockImplementation(() => ({
                searchParams: {
                    has: jest.fn().mockReturnValue(true),
                },
            }));
            expect(hasTransitionParam()).toBe(true);
        });
    });
});
