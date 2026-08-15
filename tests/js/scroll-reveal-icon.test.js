/**
 * @jest-environment jsdom
 */

describe('scroll-reveal-icon.js', () => {
    let iconElement;
    let bannerElement;
    let observeMock;
    let unobserveMock;
    let observerCallback;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetModules();
        document.documentElement.innerHTML =
            '<html><body><img class="mobile-banner" alt="Banner"><div class="scroll-reveal-instagram"></div></body></html>';
        iconElement = document.querySelector('.scroll-reveal-instagram');
        bannerElement = document.querySelector('.mobile-banner');

        observeMock = jest.fn();
        unobserveMock = jest.fn();

        window.IntersectionObserver = jest.fn(function (cb) {
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

    test('should add "is-visible" class to icon and reveal banner when intersecting', () => {
        require('../../js/scroll-reveal-icon.js');

        // Ensure observer was created and observe was called
        expect(window.IntersectionObserver).toHaveBeenCalled();
        expect(observeMock).toHaveBeenCalled();

        // Reset classes to be sure
        iconElement.classList.remove('is-visible');
        bannerElement.classList.remove('is-visible');

        // Simulate intersecting
        observerCallback([{ isIntersecting: true, target: iconElement }]);

        expect(iconElement.classList.contains('is-visible')).toBe(true);
        expect(bannerElement.classList.contains('is-visible')).toBe(true);
    });

    test('should hide both icon and banner when not intersecting', () => {
        require('../../js/scroll-reveal-icon.js');

        // First make them visible
        observerCallback([{ isIntersecting: true, target: iconElement }]);
        expect(iconElement.classList.contains('is-visible')).toBe(true);
        expect(bannerElement.classList.contains('is-visible')).toBe(true);

        // Simulate not intersecting
        observerCallback([{ isIntersecting: false, target: iconElement }]);

        expect(iconElement.classList.contains('is-visible')).toBe(false);
        expect(bannerElement.classList.contains('is-visible')).toBe(false);
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
        expect(bannerElement.classList.contains('is-visible')).toBe(true);
    });
});
