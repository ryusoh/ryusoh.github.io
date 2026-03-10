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
    let parseRgbFunction;
    let hexToRgbArray;

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
        parseRgbFunction = context.window.__PageTransitionForTesting.parseRgbFunction;
        hexToRgbArray = context.window.__PageTransitionForTesting.hexToRgbArray;
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

    describe('parseRgbFunction', () => {
        test('valid rgb() parsing', () => {
            expect(parseRgbFunction('rgb(255, 0, 128)')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 1,
            });
            expect(parseRgbFunction('RGB(255, 0, 128)')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 1,
            });
        });

        test('valid rgba() parsing', () => {
            expect(parseRgbFunction('rgba(255, 0, 128, 0.5)')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 0.5,
            });
            expect(parseRgbFunction('RGBA(255, 0, 128, 0.5)')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 0.5,
            });
        });

        test('space handling', () => {
            expect(parseRgbFunction('rgb( 255 ,  0  ,   128 )')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 1,
            });
            expect(parseRgbFunction('rgba(  255  ,0 ,128,  0.5 )')).toEqual({
                rgb: [1, 0, 128 / 255],
                alpha: 0.5,
            });
        });

        test('out of bounds values are clamped', () => {
            // Values are divided by 255. 300/255 > 1, so it is clamped to 1. -50 < 0, clamped to 0.
            expect(parseRgbFunction('rgb(300, -50, 255)')).toEqual({ rgb: [1, 0, 1], alpha: 1 });
            expect(parseRgbFunction('rgba(300, -50, 255, 1.5)')).toEqual({
                rgb: [1, 0, 1],
                alpha: 1,
            });
            expect(parseRgbFunction('rgba(300, -50, 255, -0.5)')).toEqual({
                rgb: [1, 0, 1],
                alpha: 0,
            });
        });

        test('malformed strings return null', () => {
            expect(parseRgbFunction('rgb(255, 0)')).toBeNull(); // Missing B
            expect(parseRgbFunction('rgb(255)')).toBeNull(); // Missing G, B
            expect(parseRgbFunction('rgb()')).toBeNull(); // Empty
            expect(parseRgbFunction('255, 0, 0')).toBeNull(); // No rgb() wrapper
            expect(parseRgbFunction('rgb(255, 0, 0')).toBeNull(); // Missing parenthesis
            expect(parseRgbFunction('rgb 255 0 0')).toBeNull(); // No parentheses
            expect(parseRgbFunction('rg(255, 0, 0)')).toBeNull(); // Typo
        });

        test('invalid numeric values return null', () => {
            expect(parseRgbFunction('rgb(a, b, c)')).toBeNull();
            expect(parseRgbFunction('rgb(255, b, 0)')).toBeNull();
            expect(parseRgbFunction('rgb(NaN, 0, 0)')).toBeNull();
        });

        test('missing alpha defaults to 1', () => {
            expect(parseRgbFunction('rgba(255, 0, 0)')).toEqual({ rgb: [1, 0, 0], alpha: 1 });
        });

        test('empty string returns null', () => {
            expect(parseRgbFunction('')).toBeNull();
        });
    });

    describe('hexToRgbArray', () => {
        test('valid 6-digit hex parsing', () => {
            expect(hexToRgbArray('#ff0080')).toEqual([1, 0, 128 / 255]);
            expect(hexToRgbArray('#00ff00')).toEqual([0, 1, 0]);
            expect(hexToRgbArray('#ffffff')).toEqual([1, 1, 1]);
            expect(hexToRgbArray('#000000')).toEqual([0, 0, 0]);
        });

        test('valid 3-digit hex parsing', () => {
            expect(hexToRgbArray('#f08')).toEqual([1, 0, 136 / 255]);
            expect(hexToRgbArray('#0f0')).toEqual([0, 1, 0]);
            expect(hexToRgbArray('#fff')).toEqual([1, 1, 1]);
            expect(hexToRgbArray('#000')).toEqual([0, 0, 0]);
        });

        test('case insensitivity', () => {
            expect(hexToRgbArray('#FF0080')).toEqual([1, 0, 128 / 255]);
            expect(hexToRgbArray('#F08')).toEqual([1, 0, 136 / 255]);
        });

        test('handling missing # prefix', () => {
            expect(hexToRgbArray('ff0080')).toEqual([1, 0, 128 / 255]);
            expect(hexToRgbArray('f08')).toEqual([1, 0, 136 / 255]);
        });

        test('invalid hex returns null', () => {
            // Note: The current implementation only checks for clean.length === 3 or 6.
            // It does not strictly validate that characters are valid hex or that length is exact BEFORE parsing.
            // However, it should return null if it cannot parse a valid 3 or 6 digit hex.
            expect(hexToRgbArray('')).toBeNull();
            expect(hexToRgbArray(' ')).toBeNull();
            expect(hexToRgbArray('#ff008')).toBeNull(); // Length 5 (after removing #)
            expect(hexToRgbArray('#ff00800')).toBeNull(); // Length 7 (after removing #)
        });
    });
});
