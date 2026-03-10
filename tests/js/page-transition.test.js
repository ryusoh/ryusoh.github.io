const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { URL } = require('url');

/**
 * Tests for PageTransition class and internal functions like clampUnit
 *
 * NOTE: We use manual mocks for the DOM environment because the 'jest-environment-jsdom'
 * package was not available in the environment. The mocks are designed to be just sufficient
 * for the functionality being tested.
 */

const sourcePath = path.resolve(__dirname, '../../js/page-transition.js');
let code = fs.readFileSync(sourcePath, 'utf8');

// Strip the import statement which causes syntax errors in the Node vm
code = code.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"][^'"]+['"];/, '');

// Expose clampUnit to the global window object for testing
code = code.replace(
    'function clampUnit(value) {',
    'window.clampUnit = function clampUnit(value) {'
);

describe('page-transition.js', () => {
    let context;

    beforeEach(() => {
        jest.clearAllMocks();

        // Define mock objects
        const mockDocument = {
            readyState: 'complete',
            createElement: jest.fn().mockReturnValue({
                appendChild: jest.fn(),
                style: {},
            }),
            body: {
                appendChild: jest.fn(),
                getAttribute: jest.fn().mockReturnValue(null),
                style: {},
            },
            head: {
                appendChild: jest.fn(),
            },
            documentElement: {
                clientWidth: 1024,
                clientHeight: 768,
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                },
            },
            getElementById: jest.fn().mockReturnValue(null),
            querySelectorAll: jest.fn().mockReturnValue([]),
            addEventListener: jest.fn(),
        };

        const mockWindow = {
            matchMedia: jest.fn().mockReturnValue({ matches: false }),
            getComputedStyle: jest.fn().mockReturnValue({
                getPropertyValue: jest.fn().mockReturnValue(''),
            }),
            location: {
                href: 'http://localhost/',
            },
            URL: URL,
            sessionStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
            },
            innerWidth: 1024,
            innerHeight: 768,
            devicePixelRatio: 1,
            addEventListener: jest.fn(),
            setTimeout: jest.setTimeout || global.setTimeout,
            clearTimeout: jest.clearTimeout || global.clearTimeout,
            requestAnimationFrame: jest.fn(),
            cancelAnimationFrame: jest.fn(),
        };

        // Prepare context for VM
        context = {
            document: mockDocument,
            window: mockWindow,
            console: console,
            URL: URL,
            setTimeout: mockWindow.setTimeout,
            clearTimeout: mockWindow.clearTimeout,
            THREE: {}, // Mock THREE just enough to bypass the initial check
        };
        // Ensure circular references work if needed
        context.window.document = mockDocument;
        context.document.defaultView = mockWindow;

        vm.createContext(context);

        // Run the code
        vm.runInContext(code, context);
    });

    describe('clampUnit', () => {
        let clampUnit;

        beforeEach(() => {
            clampUnit = context.window.clampUnit;
        });

        test('should exist', () => {
            expect(typeof clampUnit).toBe('function');
        });

        test('should return the value if it is between 0 and 1', () => {
            expect(clampUnit(0.5)).toBe(0.5);
            expect(clampUnit(0.1)).toBe(0.1);
            expect(clampUnit(0.9)).toBe(0.9);
        });

        test('should clamp values less than 0 to 0', () => {
            expect(clampUnit(-0.1)).toBe(0);
            expect(clampUnit(-1)).toBe(0);
            expect(clampUnit(-100)).toBe(0);
            expect(clampUnit(-0.0001)).toBe(0);
        });

        test('should clamp values greater than 1 to 1', () => {
            expect(clampUnit(1.1)).toBe(1);
            expect(clampUnit(2)).toBe(1);
            expect(clampUnit(100)).toBe(1);
            expect(clampUnit(1.0001)).toBe(1);
        });

        test('should return exactly 0 for 0 and 1 for 1', () => {
            expect(clampUnit(0)).toBe(0);
            expect(clampUnit(1)).toBe(1);
        });
    });
});
