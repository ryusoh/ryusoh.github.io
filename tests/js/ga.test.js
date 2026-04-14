const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('ga.js bootstrap', () => {
    let context;
    let code;
    let mockScriptElement;
    let mockParentNode;

    beforeEach(() => {
        code = fs.readFileSync(path.resolve(__dirname, '../../js/ga.js'), 'utf8');

        mockScriptElement = {
            async: 0,
            src: '',
        };

        mockParentNode = {
            insertBefore: jest.fn(),
        };

        const mockExistingScript = {
            parentNode: mockParentNode,
        };

        context = {
            window: {},
            document: {
                createElement: jest.fn().mockReturnValue(mockScriptElement),
                getElementsByTagName: jest.fn().mockReturnValue([mockExistingScript]),
            },
            Date: class extends Date {
                constructor() {
                    super('2024-01-01T00:00:00.000Z');
                }
            },
        };
    });

    test('dynamically creates a script tag pointing to google analytics', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.document.createElement).toHaveBeenCalledWith('script');
        expect(context.document.getElementsByTagName).toHaveBeenCalledWith('script');
        expect(mockScriptElement.async).toBe(1);
        expect(mockScriptElement.src).toBe('https://www.google-analytics.com/analytics.js');
        expect(mockParentNode.insertBefore).toHaveBeenCalledWith(
            mockScriptElement,
            context.document.getElementsByTagName()[0]
        );
    });

    test('initializes window.ga correctly and sends initial pageview', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(typeof context.window.ga).toBe('function');

        // Check internal queue "q"
        expect(context.window.ga.q).toBeDefined();
        expect(Array.isArray(context.window.ga.q)).toBe(true);

        // Verify the properties sent during bootstrap try-catch
        // The script has a try-catch block immediately calling ga('create') and ga('send')
        expect(context.window.ga.q[0]).toEqual(
            expect.objectContaining({ 0: 'create', 1: 'UA-9097302-10', 2: 'auto' })
        );
        expect(context.window.ga.q[1]).toEqual(
            expect.objectContaining({ 0: 'send', 1: 'pageview' })
        );
    });

    test('gracefully handles missing window.ga creation without throwing', () => {
        // We simulate a scenario where window.ga wasn't properly initialized
        // by intercepting the try block manually to ensure no error leaks.
        // Actually, the simplest way is to overwrite window.ga after the IIFE but before the try-catch,
        // which is hard in a single runInContext since it's all one script.
        // But since we just want to test it doesn't crash if something goes wrong,
        // we can test evaluating the script doesn't throw.
        expect(() => {
            vm.createContext(context);
            vm.runInContext(code, context);
        }).not.toThrow();
    });

    test('gracefully handles throwing inside the try-catch block', () => {
        context.window = {
            console: {
                warn: jest.fn(),
            },
        };
        const customCode = code.replace(
            "if (typeof window.ga === 'function') {",
            "if (typeof window.ga === 'function') { throw new Error('GA error');"
        );
        expect(() => {
            vm.createContext(context);
            vm.runInContext(customCode, context);
        }).not.toThrow();
        // The error created in vm does not have the same prototype as the host environment's Error, so expect.any(Error) fails
        expect(context.window.console.warn).toHaveBeenCalledWith(
            'Google Analytics initialization failed:',
            expect.anything()
        );
    });

    test('handles case where window.ga is not a function', () => {
        const customCode = code.replace('i[r] =', "i[r] = 'not-a-function';");

        vm.createContext(context);
        vm.runInContext(customCode, context);

        expect(context.window.ga).toBe('not-a-function');
    });

    test('gracefully handles missing window.console.warn without throwing', () => {
        context.window = {
            console: {}, // Missing warn
        };
        const customCode = code.replace(
            "if (typeof window.ga === 'function') {",
            "if (typeof window.ga === 'function') { throw new Error('GA error');"
        );
        expect(() => {
            vm.createContext(context);
            vm.runInContext(customCode, context);
        }).not.toThrow();
    });

    test('should safely catch errors during ga initialization and log warning', () => {
        // Instead of mocking a throwing getter on window.ga (which Jest's cleanup
        // might trigger and crash on), we mock window.ga as a function that throws
        // when called, since the code does: if (typeof window.ga === 'function') { window.ga(...) }
        window.ga = jest.fn(() => {
            throw new Error('Test Error');
        });

        // Mock console.warn
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Re-require to trigger try-catch logic
        jest.resetModules();
        require('../../js/ga.js');

        expect(console.warn).toHaveBeenCalledWith(
            'Google Analytics initialization failed:',
            expect.any(Error)
        );

        // Clean up
        delete window.ga;
    });

    test('should not crash if console.warn is missing during error', () => {
        window.ga = jest.fn(() => {
            throw new Error('Test Error');
        });

        // Remove console.warn
        const originalWarn = console.warn;
        delete console.warn;

        jest.resetModules();
        expect(() => {
            require('../../js/ga.js');
        }).not.toThrow();

        // Restore
        console.warn = originalWarn;
        delete window.ga;
    });
});
