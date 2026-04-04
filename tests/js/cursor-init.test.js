const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('js/cursor-init.js', () => {
    let context;
    let code;
    let mockInitCursor;

    beforeEach(() => {
        // We replace the import statement to make it executable in the VM context
        const sourcePath = path.resolve(__dirname, '../../js/cursor-init.js');
        const originalCode = fs.readFileSync(sourcePath, 'utf8');
        code = originalCode.replace("import { initCursor } from './vendor/cursor.js';", '');

        mockInitCursor = jest.fn().mockReturnValue({ cursor: { id: 'mocked-cursor' } });

        context = {
            window: {
                console: {
                    warn: jest.fn(),
                },
            },
            document: {
                addEventListener: jest.fn((event, cb) => {
                    if (event === 'DOMContentLoaded') {
                        // We store the callback to call it manually
                        context.__domContentLoadedCb = cb;
                    }
                }),
            },
            initCursor: mockInitCursor,
            console: {
                warn: jest.fn(),
            },
        };
    });

    test('adds a DOMContentLoaded event listener', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        expect(context.document.addEventListener).toHaveBeenCalledWith(
            'DOMContentLoaded',
            expect.any(Function)
        );
    });

    test('exits early if window.gsap is not defined', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        // Trigger DOMContentLoaded
        context.__domContentLoadedCb();

        expect(mockInitCursor).not.toHaveBeenCalled();
        expect(context.window.cursorInstances).toBeUndefined();
    });

    test('initializes cursor if window.gsap is available', () => {
        context.window.gsap = {}; // Mock GSAP

        vm.createContext(context);
        vm.runInContext(code, context);

        // Trigger DOMContentLoaded
        context.__domContentLoadedCb();

        expect(mockInitCursor).toHaveBeenCalledWith({
            cursor: {
                hoverTargets: 'a, button, .container li',
                followEase: 0.4,
                fadeEase: 0.1,
                hoverScale: 3,
            },
        });

        expect(context.window.cursorInstances).toBeDefined();
        expect(context.window.cursorInstances.cursor).toEqual({ id: 'mocked-cursor' });
    });

    test('does not throw when document is not defined', () => {
        const customCode = `
            let document; // shadow the document
            ${code}
        `;

        vm.createContext(context);
        expect(() => {
            vm.runInContext(customCode, context);
        }).not.toThrow();
    });

    test('does not execute if window.gsap is missing and document exists', () => {
        delete context.window.gsap;

        vm.createContext(context);
        vm.runInContext(code, context);

        // Trigger DOMContentLoaded
        context.__domContentLoadedCb();

        expect(mockInitCursor).not.toHaveBeenCalled();
    });

    test('does not throw when initCursor throws but allows bubbling', () => {
        context.window.gsap = {}; // Mock GSAP

        // Let's modify the custom context to throw
        const customContext = {
            ...context,
            initCursor: jest.fn().mockImplementation(() => {
                throw new Error('initCursor error');
            }),
            document: {
                addEventListener: jest.fn((event, cb) => {
                    if (event === 'DOMContentLoaded') {
                        customContext.__domContentLoadedCb = cb;
                    }
                }),
            },
        };

        vm.createContext(customContext);
        vm.runInContext(code, customContext);

        // Trigger DOMContentLoaded which calls initCursor
        // The script doesn't wrap it in a try-catch, so we assert it throws.
        expect(() => {
            customContext.__domContentLoadedCb();
        }).toThrow('initCursor error');

        expect(customContext.window.cursorInstances).toBeUndefined();
    });

    test('does not execute if document is not defined', () => {
        const customCode = `
            let document; // shadow the document
            ${code}
        `;

        vm.createContext(context);
        vm.runInContext(customCode, context);

        expect(context.document.addEventListener).not.toHaveBeenCalled();
    });
});
