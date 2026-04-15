/**
 * @jest-environment jsdom
 */

describe('scroll-reveal-icon.js', () => {
    let iconElement;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetModules();
        document.documentElement.innerHTML =
            '<html><body><div class="scroll-reveal-instagram"></div></body></html>';
        iconElement = document.querySelector('.scroll-reveal-instagram');

        // Mock scroll and window properties
        Object.defineProperty(document.documentElement, 'scrollHeight', {
            value: 1000,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(window, 'innerHeight', {
            value: 500,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

        // Mock requestAnimationFrame to execute asynchronously using setTimeout
        window.requestAnimationFrame = jest.fn((cb) => {
            return setTimeout(cb, 0);
        });

        require('../../js/scroll-reveal-icon.js');
        // Initial execution of IIFE triggers some logic, but wait for the 1000ms timeout
        jest.runAllTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should add "is-visible" class when scrolled near bottom', () => {
        // Mock scroll state: near the bottom
        window.scrollY = 450;

        // Reset class to be sure
        iconElement.classList.remove('is-visible');

        window.dispatchEvent(new Event('scroll'));
        jest.runAllTimers();

        expect(iconElement.classList.contains('is-visible')).toBe(true);
    });

    test('should remove "is-visible" class when scrolled away from bottom', () => {
        // First make it visible
        window.scrollY = 450;
        window.dispatchEvent(new Event('scroll'));
        jest.runAllTimers();
        expect(iconElement.classList.contains('is-visible')).toBe(true);

        // Then scroll up
        window.scrollY = 0;
        window.dispatchEvent(new Event('scroll'));
        jest.runAllTimers();

        expect(iconElement.classList.contains('is-visible')).toBe(false);
    });

    test('should exit early if icon is not present', () => {
        // We need to clear the event listeners attached from the first execution in beforeEach.
        // We'll replace window entirely or use a spy on addEventListener, but a simpler way
        // is to check if addEventListener was called *during* this second require.

        // Let's reset the DOM and setup a fresh mock for addEventListener to ensure it doesn't get called
        document.documentElement.innerHTML = '<html><body></body></html>';

        const originalAddEventListener = window.addEventListener;
        window.addEventListener = jest.fn();

        jest.resetModules();
        require('../../js/scroll-reveal-icon.js');

        expect(window.addEventListener).not.toHaveBeenCalled();

        // Clean up
        window.addEventListener = originalAddEventListener;
    });
});
