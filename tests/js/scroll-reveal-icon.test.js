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
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should add "is-visible" class when scrolled near bottom', () => {
        require('../../js/scroll-reveal-icon.js');
        jest.runAllTimers();

        // Mock scroll state: near the bottom
        window.scrollY = 450;

        // Reset class to be sure
        iconElement.classList.remove('is-visible');

        window.dispatchEvent(new Event('scroll'));
        jest.runAllTimers();

        expect(iconElement.classList.contains('is-visible')).toBe(true);
    });

    test('should remove "is-visible" class when scrolled away from bottom', () => {
        require('../../js/scroll-reveal-icon.js');
        jest.runAllTimers();

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

    test('should execute gracefully on resize event', () => {
        require('../../js/scroll-reveal-icon.js');
        jest.runAllTimers();

        // Trigger resize event
        window.dispatchEvent(new Event('resize'));
        jest.runAllTimers();

        // No particular expectation since it just runs updateVisibility
        expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    test('exits early if icon not found', () => {
        document.documentElement.innerHTML = '';

        const originalAddEventListener = window.addEventListener;
        window.addEventListener = jest.fn();

        require('../../js/scroll-reveal-icon.js');

        expect(window.requestAnimationFrame).not.toHaveBeenCalled();
        expect(window.addEventListener).not.toHaveBeenCalled();

        window.addEventListener = originalAddEventListener;
    });
});
