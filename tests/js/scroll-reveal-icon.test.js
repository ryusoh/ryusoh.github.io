/**
 * @jest-environment jsdom
 */

describe('scroll-reveal-icon.js', () => {
    let iconElement;
    let observeMock;
    let unobserveMock;
    let observerCallback;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetModules();
        document.documentElement.innerHTML =
            '<html><body><div class="scroll-reveal-instagram"></div></body></html>';
        iconElement = document.querySelector('.scroll-reveal-instagram');

        observeMock = jest.fn();
        unobserveMock = jest.fn();

        window.IntersectionObserver = jest.fn(function(cb) {
            observerCallback = cb;
            this.observe = observeMock;
            this.unobserve = unobserveMock;
            this.disconnect = jest.fn();
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        delete window.IntersectionObserver;
    });

    test('should add "is-visible" class when intersecting', () => {
        require('../../js/scroll-reveal-icon.js');

        // Ensure observer was created and observe was called
        expect(window.IntersectionObserver).toHaveBeenCalled();
        expect(observeMock).toHaveBeenCalled();

        // Reset class to be sure
        iconElement.classList.remove('is-visible');

        // Simulate intersecting
        observerCallback([{ isIntersecting: true, target: iconElement }]);

        expect(iconElement.classList.contains('is-visible')).toBe(true);
    });

    test('should remove "is-visible" class when not intersecting', () => {
        require('../../js/scroll-reveal-icon.js');

        // First make it visible
        observerCallback([{ isIntersecting: true, target: iconElement }]);
        expect(iconElement.classList.contains('is-visible')).toBe(true);

        // Simulate not intersecting
        observerCallback([{ isIntersecting: false, target: iconElement }]);

        expect(iconElement.classList.contains('is-visible')).toBe(false);
    });

    test('exits early if icon not found', () => {
        document.documentElement.innerHTML = '';
        require('../../js/scroll-reveal-icon.js');
        expect(window.IntersectionObserver).not.toHaveBeenCalled();
    });

    test('fallback works without IntersectionObserver', () => {
        delete window.IntersectionObserver;
        require('../../js/scroll-reveal-icon.js');

        expect(iconElement.classList.contains('is-visible')).toBe(true);
    });
});
