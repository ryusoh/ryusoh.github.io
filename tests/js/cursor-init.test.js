/**
 * @jest-environment jsdom
 */

describe('js/cursor-init.js', () => {
    test('does not execute if document is null', () => {
        const originalDocument = global.document;
        global.document = null;
        expect(() => {
            require('../../js/cursor-init.js');
        }).not.toThrow();
        global.document = originalDocument;
    });
    let mockInitCursor;
    let mockInitMagneticNav;
    let originalDocument;

    beforeEach(() => {
        jest.resetModules();

        mockInitCursor = jest.fn().mockReturnValue({ cursor: { id: 'mocked-cursor' } });
        mockInitMagneticNav = jest.fn();

        jest.doMock('../../js/vendor/cursor.js', () => ({
            initCursor: mockInitCursor,
        }));
        jest.doMock('../../js/magnetic-nav.js', () => ({
            initMagneticNav: mockInitMagneticNav,
        }));

        originalDocument = global.document;

        // Reset global state
        delete window.gsap;
        delete window.cursorInstances;
    });

    afterEach(() => {
        global.document = originalDocument;
        jest.restoreAllMocks();
    });

    test('adds a DOMContentLoaded event listener', () => {
        const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
        require('../../js/cursor-init.js');
        expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
    });

    test('exits early if window.gsap is not defined', () => {
        let cb;
        jest.spyOn(document, 'addEventListener').mockImplementation((event, fn) => {
            if (event === 'DOMContentLoaded') {
                cb = fn;
            }
        });

        require('../../js/cursor-init.js');

        // window.gsap is undefined by default in this test
        if (cb) {
            cb();
        }

        expect(mockInitCursor).not.toHaveBeenCalled();
        expect(window.cursorInstances).toBeUndefined();
    });

    test('initializes cursor if window.gsap is available', () => {
        window.gsap = {}; // Provide gsap

        let cb;
        jest.spyOn(document, 'addEventListener').mockImplementation((event, fn) => {
            if (event === 'DOMContentLoaded') {
                cb = fn;
            }
        });

        require('../../js/cursor-init.js');

        if (cb) {
            cb();
        }

        expect(mockInitCursor).toHaveBeenCalledWith({
            cursor: {
                hoverTargets: 'a, button, .container li',
                followEase: 0.4,
                fadeEase: 0.1,
                hoverScale: 3,
            },
        });
        expect(mockInitMagneticNav).toHaveBeenCalled();
        expect(window.cursorInstances).toBeDefined();
        expect(window.cursorInstances.cursor).toEqual({ id: 'mocked-cursor' });
    });

    test('does not execute if typeof document is undefined', () => {
        const vm = require('vm');
        const fs = require('fs');
        const path = require('path');
        // Strip ES import lines: the imported bindings are only referenced inside
        // the DOMContentLoaded callback, which never runs when document is absent,
        // so removing them lets the source run in a bare vm context that has no
        // `document` global (exercising the `typeof document !== 'undefined'` guard).
        const code = fs
            .readFileSync(path.join(__dirname, '../../js/cursor-init.js'), 'utf8')
            .replace(/^import .*$/gm, '');

        const context = {
            window: {},
            console: console,
        };
        vm.createContext(context);

        expect(() => {
            vm.runInContext(code, context);
        }).not.toThrow();

        expect(context.window.cursorInstances).toBeUndefined();
    });
});
