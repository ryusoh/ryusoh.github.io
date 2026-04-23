/**
 * @jest-environment node
 */

describe('js/cursor-init.js', () => {
    let mockInitCursor;
    let mockInitMagneticNav;

    beforeEach(() => {
        jest.resetModules();
        mockInitCursor = jest.fn().mockReturnValue({ cursor: { id: 'mocked-cursor' } });
        mockInitMagneticNav = jest.fn();

        jest.mock('../../js/vendor/cursor.js', () => ({
            initCursor: mockInitCursor,
        }));
        jest.mock('../../js/magnetic-nav.js', () => ({
            initMagneticNav: mockInitMagneticNav,
        }));

        global.window = { gsap: {} };
        global.document = { addEventListener: jest.fn() };
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        jest.restoreAllMocks();
    });

    test('exits early if window.gsap is not defined', () => {
        delete global.window.gsap;
        require('../../js/cursor-init.js');

        const cb = global.document.addEventListener.mock.calls[0][1];
        cb();

        expect(mockInitCursor).not.toHaveBeenCalled();
        expect(global.window.cursorInstances).toBeUndefined();
    });

    test('initializes cursor if window.gsap is available', () => {
        require('../../js/cursor-init.js');

        const cb = global.document.addEventListener.mock.calls[0][1];
        cb();

        expect(mockInitCursor).toHaveBeenCalledWith({
            cursor: {
                hoverTargets: 'a, button, .container li',
                followEase: 0.4,
                fadeEase: 0.1,
                hoverScale: 3,
            },
        });

        expect(mockInitMagneticNav).toHaveBeenCalled();

        expect(global.window.cursorInstances).toBeDefined();
        expect(global.window.cursorInstances.cursor).toEqual({ id: 'mocked-cursor' });
    });

    test('does not throw when initCursor throws but allows bubbling', () => {
        require('../../js/cursor-init.js');

        mockInitCursor.mockImplementation(() => {
            throw new Error('initCursor error');
        });

        const cb = global.document.addEventListener.mock.calls[0][1];

        expect(() => {
            cb();
        }).toThrow('initCursor error');

        expect(global.window.cursorInstances).toBeUndefined();
    });

    test('does not execute if document is not defined', () => {
        delete global.document;

        expect(() => {
            require('../../js/cursor-init.js');
        }).not.toThrow();
    });
});
