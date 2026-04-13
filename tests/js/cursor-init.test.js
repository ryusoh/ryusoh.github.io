/**
 * @jest-environment jsdom
 */

describe('js/cursor-init.js', () => {
    let init;
    let mockInitCursor;

    beforeEach(() => {
        jest.resetModules();
        document.documentElement.innerHTML = '<html><body></body></html>';

        // Mock window.gsap
        window.gsap = {};

        // Mock the vendor cursor module
        mockInitCursor = jest.fn();
        jest.mock('../../js/vendor/cursor.js', () => ({
            initCursor: mockInitCursor,
        }));

        require('../../js/cursor-init.js');
        init = window.__CursorInitForTesting.init;
    });

    test('init should register DOMContentLoaded listener', () => {
        const addSpy = jest.spyOn(document, 'addEventListener');
        init();
        expect(addSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
    });

    test('should not crash if GSAP is missing', () => {
        delete window.gsap;
        init();
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
        expect(mockInitCursor).not.toHaveBeenCalled();
    });

    test('should call initCursor on DOMContentLoaded if GSAP is present', () => {
        init();
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
        expect(mockInitCursor).toHaveBeenCalled();
    });
});
