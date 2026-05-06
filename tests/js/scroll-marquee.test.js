/**
 * @jest-environment jsdom
 */

describe('Scroll Marquee', () => {
    let gsapMock;
    let requestAnimationFrameSpy;
    let eventListeners = {};

    beforeEach(() => {
        // Mock DOM
        document.body.innerHTML = `
            <div class="marquee-container">
                <div class="marquee-track">
                    <span class="marquee-text">TEST</span>
                </div>
            </div>
        `;

        // Mock window scroll properties
        Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

        // Mock element scrollWidth
        const track = document.querySelector('.marquee-track');
        Object.defineProperty(track, 'scrollWidth', { value: 1000, writable: true });

        // Mock GSAP quickSetter
        const mockSetter = jest.fn();
        gsapMock = {
            quickSetter: jest.fn(() => mockSetter),
        };
        window.gsap = gsapMock;

        // Mock requestAnimationFrame to call the tick function synchronously
        requestAnimationFrameSpy = jest
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation(() => {
                // we don't call cb() automatically to prevent infinite loops in tests,
                // but we can manually trigger it if needed, or just let it get registered.
                return 1;
            });

        // Track event listeners manually to fire them
        jest.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
            eventListeners[event] = handler;
        });

        jest.resetModules();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        eventListeners = {};
    });

    test('should warn if GSAP is not loaded', () => {
        window.gsap = undefined;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        require('../../js/scroll-marquee.js');

        // simulate DOMContentLoaded
        document.dispatchEvent(new Event('DOMContentLoaded'));

        expect(consoleSpy).toHaveBeenCalledWith('GSAP is not loaded. Skipping scroll marquee.');
        consoleSpy.mockRestore();
    });

    test('should early return if no marquee containers exist', () => {
        document.body.innerHTML = '';
        require('../../js/scroll-marquee.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        expect(gsapMock.quickSetter).not.toHaveBeenCalled();
    });

    test('should initialize and set up quickSetter on marquee-track', () => {
        require('../../js/scroll-marquee.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const track = document.querySelector('.marquee-track');
        expect(gsapMock.quickSetter).toHaveBeenCalledWith(track, 'x', 'px');
        expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function), {
            passive: true,
        });
        expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), {
            passive: true,
        });
    });

    test('should update targetScroll on scroll event', () => {
        require('../../js/scroll-marquee.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        // Fire scroll event
        window.scrollY = 300;
        if (eventListeners['scroll']) {
            eventListeners['scroll']();
        }

        // The tick function is requested, we can extract it from the rAF mock
        const tickFn = requestAnimationFrameSpy.mock.calls[0][0];

        // Execute tick to process lerp
        tickFn();

        const setter = gsapMock.quickSetter.mock.results[0].value;
        expect(setter).toHaveBeenCalled();
    });
});
