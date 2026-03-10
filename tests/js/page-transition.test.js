const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Tests for internal functions in page-transition.js
 *
 * NOTE: We use manual mocks for the DOM environment because the 'jest-environment-jsdom'
 * package was not available in the environment and could not be installed due to
 * network restrictions. The mocks are designed to be just sufficient for the
 * functionality being tested.
 */

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
let code = fs.readFileSync(sourcePath, 'utf8');

// Replace module imports which cause issues in VM context
code = code.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"].*?['"];/g, '');

// Expose the internal parseRgbFunction on the window object
code = code.replace(/function parseRgbFunction/, 'window.__parseRgbFunction = parseRgbFunction;\n    function parseRgbFunction');

describe('parseRgbFunction', () => {
    let parseRgbFunction;

    beforeAll(() => {
        // Define mock objects required by page-transition.js IIFE
        const mockDocument = {
            body: {
                appendChild: jest.fn(),
                getAttribute: jest.fn().mockReturnValue(null),
            },
            documentElement: {
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                },
                clientWidth: 1024,
                clientHeight: 768,
            },
            getElementById: jest.fn().mockReturnValue(null),
            createElement: jest.fn().mockReturnValue({
                appendChild: jest.fn(),
                className: '',
                style: {},
            }),
            head: {
                appendChild: jest.fn(),
            },
            querySelectorAll: jest.fn().mockReturnValue([]),
            addEventListener: jest.fn(),
            readyState: 'complete',
        };

        const mockWindow = {
            addEventListener: jest.fn(),
            matchMedia: jest.fn().mockReturnValue({ matches: false }),
            location: { href: 'http://localhost' },
            URL: function () {
                return {
                    searchParams: { has: jest.fn(), delete: jest.fn() },
                    pathname: '',
                    search: '',
                    hash: '',
                };
            },
            getComputedStyle: jest.fn().mockReturnValue({
                getPropertyValue: jest.fn().mockReturnValue(''),
            }),
            setTimeout: jest.fn(),
            clearTimeout: jest.fn(),
            requestAnimationFrame: jest.fn(),
            cancelAnimationFrame: jest.fn(),
            innerWidth: 1024,
            innerHeight: 768,
            devicePixelRatio: 1,
        };

        // Prepare context for VM
        const context = {
            document: mockDocument,
            window: mockWindow,
            console: console,
            THREE: {},
            setTimeout: mockWindow.setTimeout,
            clearTimeout: mockWindow.clearTimeout,
        };

        vm.createContext(context);

        // Run the modified code
        vm.runInContext(code, context);

        parseRgbFunction = context.window.__parseRgbFunction;
    });

    // Test cases will go here...
    test('exists in context', () => {
        expect(typeof parseRgbFunction).toBe('function');
    });

    test('valid rgb() parsing', () => {
        expect(parseRgbFunction('rgb(255, 0, 128)')).toEqual({ rgb: [1, 0, 128/255], alpha: 1 });
        expect(parseRgbFunction('RGB(255, 0, 128)')).toEqual({ rgb: [1, 0, 128/255], alpha: 1 });
    });

    test('valid rgba() parsing', () => {
        expect(parseRgbFunction('rgba(255, 0, 128, 0.5)')).toEqual({ rgb: [1, 0, 128/255], alpha: 0.5 });
        expect(parseRgbFunction('RGBA(255, 0, 128, 0.5)')).toEqual({ rgb: [1, 0, 128/255], alpha: 0.5 });
    });

    test('space handling', () => {
        expect(parseRgbFunction('rgb( 255 ,  0  ,   128 )')).toEqual({ rgb: [1, 0, 128/255], alpha: 1 });
        expect(parseRgbFunction('rgba(  255  ,0 ,128,  0.5 )')).toEqual({ rgb: [1, 0, 128/255], alpha: 0.5 });
    });

    test('out of bounds values are clamped', () => {
        // Values are divided by 255. 300/255 > 1, so it is clamped to 1. -50 < 0, clamped to 0.
        expect(parseRgbFunction('rgb(300, -50, 255)')).toEqual({ rgb: [1, 0, 1], alpha: 1 });
        expect(parseRgbFunction('rgba(300, -50, 255, 1.5)')).toEqual({ rgb: [1, 0, 1], alpha: 1 });
        expect(parseRgbFunction('rgba(300, -50, 255, -0.5)')).toEqual({ rgb: [1, 0, 1], alpha: 0 });
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
