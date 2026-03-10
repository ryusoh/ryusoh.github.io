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

describe('page-transition.js', () => {
    let context;
    let hasTransitionParam;
    let clampUnit;

    beforeEach(() => {
        // Mock the minimal DOM environment needed to bypass IIFE execution errors
        const mockDocument = {
            readyState: 'complete',
            documentElement: {
                classList: { add: jest.fn(), remove: jest.fn() },
                scrollHeight: 1000,
                clientWidth: 1024,
                clientHeight: 768,
            },
            body: {
                getAttribute: jest.fn(),
                appendChild: jest.fn(),
                style: {},
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
            getComputedStyle: jest.fn().mockReturnValue({
                getPropertyValue: jest.fn().mockReturnValue(''),
            }),
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

        context = {
            window: mockWindow,
            document: mockDocument,
            Promise: Promise,
            console: console,
            setTimeout: mockWindow.setTimeout,
            clearTimeout: mockWindow.clearTimeout,
            URL: URL, // Use native URL for tests that don't mock it
        };

        vm.createContext(context);

        // Run the code. The modified source exposes internals on window.__PageTransitionForTesting
        vm.runInContext(codeToEvaluate, context);
        hasTransitionParam = context.window.__PageTransitionForTesting.hasTransitionParam;
        clampUnit = context.window.__PageTransitionForTesting.clampUnit;
    });

    describe('hasTransitionParam', () => {
        test('should return false when window.URL constructor throws an error', () => {
            // Mock window.URL to throw an error
            context.window.URL = jest.fn().mockImplementation(() => {
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
            context.window.URL = jest.fn().mockImplementation(() => ({
                searchParams: {
                    has: jest.fn().mockReturnValue(true),
                },
            }));
            expect(hasTransitionParam()).toBe(true);
        });
    });

    describe('clampUnit', () => {
        test('should return the value if it is between 0 and 1', () => {
            expect(clampUnit(0.5)).toBe(0.5);
            expect(clampUnit(0.1)).toBe(0.1);
            expect(clampUnit(0.9)).toBe(0.9);
        });

        test('should clamp values less than 0 to 0', () => {
            expect(clampUnit(-0.1)).toBe(0);
            expect(clampUnit(-1)).toBe(0);
        });

        test('should clamp values greater than 1 to 1', () => {
            expect(clampUnit(1.1)).toBe(1);
            expect(clampUnit(2)).toBe(1);
        });

        test('should return exactly 0 for 0 and 1 for 1', () => {
            expect(clampUnit(0)).toBe(0);
            expect(clampUnit(1)).toBe(1);
        });
    });
});
