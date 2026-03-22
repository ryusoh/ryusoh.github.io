const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('js/vendor/cursor.js', () => {
    let context;
    let code;

    beforeEach(() => {
        const sourcePath = path.resolve(__dirname, '../../../js/vendor/cursor.js');
        const rawCode = fs.readFileSync(sourcePath, 'utf8');

        // Strip exports for VM eval
        code = rawCode
            .replace(/export class CustomCursor/g, 'class CustomCursor')
            .replace(/export function initCursor/g, 'function initCursor');

        // Provide a mock GSAP
        const mockGsap = {
            set: jest.fn(),
        };

        const mockBody = {
            appendChild: jest.fn(),
            style: { setProperty: jest.fn(), removeProperty: jest.fn() },
            querySelectorAll: jest.fn().mockReturnValue([]),
        };

        const mockDocumentElement = {
            classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
            style: { setProperty: jest.fn(), removeProperty: jest.fn() },
        };

        context = {
            window: {
                innerWidth: 1024,
                innerHeight: 768,
                sessionStorage: {
                    getItem: jest.fn(),
                    setItem: jest.fn(),
                },
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                matchMedia: jest.fn().mockReturnValue({ matches: false }),
                gsap: mockGsap,
            },
            document: {
                documentElement: mockDocumentElement,
                body: mockBody,
                createElement: jest.fn((tag) => ({
                    tagName: tag.toUpperCase(),
                    className: '',
                    style: { setProperty: jest.fn(), removeProperty: jest.fn() },
                    appendChild: jest.fn(),
                    remove: jest.fn(),
                    classList: { add: jest.fn(), remove: jest.fn() },
                })),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
            },
            Math: Math,
            Number: Number,
            JSON: JSON,
            requestAnimationFrame: jest.fn().mockReturnValue(123),
            cancelAnimationFrame: jest.fn(),
            setTimeout: jest.fn((cb) => {
                cb();
                return 1;
            }),
            clearTimeout: jest.fn(),
            Date: Date,
            console: console,
            Map: Map,
            Set: Set,
        };

        // Ensure circular references work
        context.window.document = context.document;
    });

    test('should initialize correctly when instantiated', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const CustomCursor = vm.runInContext('CustomCursor', context);
        const cursor = new CustomCursor();

        expect(cursor.disabled).toBe(false);
        expect(context.document.createElement).toHaveBeenCalledWith('div');
        expect(context.document.body.appendChild).toHaveBeenCalled();
        expect(context.window.addEventListener).toHaveBeenCalledWith(
            'mousemove',
            expect.any(Function)
        );
    });

    test('should disable on touch devices', () => {
        context.window.matchMedia.mockReturnValue({ matches: true });

        vm.createContext(context);
        vm.runInContext(code, context);

        const CustomCursor = vm.runInContext('CustomCursor', context);
        const cursor = new CustomCursor();

        expect(cursor.disabled).toBe(true);
        expect(context.document.createElement).not.toHaveBeenCalled();
    });

    test('initCursor should return null if disabled', () => {
        context.window.matchMedia.mockReturnValue({ matches: true });

        vm.createContext(context);
        vm.runInContext(code, context);

        const initCursor = vm.runInContext('initCursor', context);
        const result = initCursor();

        expect(result.cursor).toBeNull();
    });

    test('throttle implementation works', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const throttle = vm.runInContext('throttle', context);
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 100);

        throttledFn('arg1');

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('arg1');
    });

    test('CustomCursor binds and unbinds events', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const CustomCursor = vm.runInContext('CustomCursor', context);
        const cursor = new CustomCursor();

        expect(context.window.addEventListener).toHaveBeenCalledWith(
            'mousemove',
            cursor.onMouseMove
        );

        cursor.destroy();

        expect(context.window.removeEventListener).toHaveBeenCalledWith(
            'mousemove',
            cursor.onMouseMove
        );
        expect(context.cancelAnimationFrame).toHaveBeenCalledWith(123);
    });

    test('onMouseMove updates coordinates', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const CustomCursor = vm.runInContext('CustomCursor', context);
        const cursor = new CustomCursor();

        cursor.onMouseMove({ clientX: 100, clientY: 200 });

        expect(cursor.coords.x.current).toBe(100);
        expect(cursor.coords.y.current).toBe(200);
        expect(cursor.coords.opacity.current).toBe(1);
    });

    describe('storeCursorPosition & readStoredCursorPosition fallback', () => {
        test('gracefully handles sessionStorage SecurityError without throwing', () => {
            const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Create a custom mock window object instead of using global window
            const mockWindow = {
                document: {},
                sessionStorage: {
                    getItem: jest.fn().mockImplementation(() => {
                        throw new Error('SecurityError');
                    }),
                    setItem: jest.fn().mockImplementation(() => {
                        throw new Error('SecurityError');
                    }),
                    removeItem: jest.fn(),
                },
                matchMedia: jest.fn().mockReturnValue({ matches: false }),
                innerWidth: 1024,
                innerHeight: 768,
                console: console,
            };

            const fs = require('fs');
            const path = require('path');
            const vm = require('vm');

            const sourcePath = path.resolve(__dirname, '../../../js/vendor/cursor.js');
            const code = fs
                .readFileSync(sourcePath, 'utf8')
                .replace('export class CustomCursor', 'class CustomCursor')
                .replace('export function initCursor', 'function initCursor');

            const context = {
                window: mockWindow,
                document: mockWindow.document,
                console: console,
                setTimeout: setTimeout,
                clearTimeout: clearTimeout,
                Date: Date,
                JSON: JSON,
                Math: Math,
                Number: Number,
            };
            vm.createContext(context);
            vm.runInContext(code, context);

            const storeCursorPosition = context.window.__CursorForTesting.storeCursorPosition;
            const readStoredCursorPosition =
                context.window.__CursorForTesting.readStoredCursorPosition;

            expect(() => storeCursorPosition({ x: 100, y: 100 })).not.toThrow();
            expect(() => readStoredCursorPosition()).not.toThrow();

            const result = readStoredCursorPosition();
            expect(result).toBeNull();

            spyWarn.mockRestore();
        });
    });
});
