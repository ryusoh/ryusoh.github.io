/**
 * @jest-environment jsdom
 */

describe('js/scroll-marquee.js', () => {
    let mockQuickSetter;
    let mockSetterX;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <div class="scroll-marquee">
                <div class="scroll-marquee__inner" style="width: 2000px">
                    <span class="scroll-marquee__text">TEST MARQUEE • </span>
                    <span class="scroll-marquee__text">TEST MARQUEE • </span>
                </div>
            </div>
        `;

        mockSetterX = jest.fn();
        mockQuickSetter = jest.fn().mockReturnValue(mockSetterX);

        window.gsap = {
            quickSetter: mockQuickSetter,
        };

        // Mock scrollWidth
        Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            get: function () {
                return 2000;
            },
        });

        // Set initial scrollY
        window.scrollY = 0;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        jest.restoreAllMocks();
        delete window.__ScrollMarqueeForTesting;
    });

    test('initializes and calculates width correctly', () => {
        require('../../js/scroll-marquee.js');
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(window.gsap.quickSetter).toHaveBeenCalledWith(
            document.querySelector('.scroll-marquee__inner'),
            'x',
            'px'
        );

        // test manual updateMarquee call via testing object
        expect(window.__ScrollMarqueeForTesting).toBeDefined();

        window.scrollY = 100;
        window.__ScrollMarqueeForTesting.updateMarquee();

        // currentScroll = 100. loopWidth = 2000 / 2 = 1000.
        // translation = -(100 * 0.8) % 1000 = -80.
        expect(mockSetterX).toHaveBeenCalledWith(-80);
    });

    test('updateMarquee handles scroll exceeding loopWidth', () => {
        require('../../js/scroll-marquee.js');
        document.dispatchEvent(new window.Event('DOMContentLoaded'));

        // simulate high scroll
        window.scrollY = 2000;
        // currentScroll = 2000. loopWidth = 1000.
        // translation = -(2000 * 0.8) % 1000 = -1600 % 1000 = -600.
        window.__ScrollMarqueeForTesting.updateMarquee();

        expect(mockSetterX).toHaveBeenCalledWith(-600);
    });

    test('does not throw if gsap is missing', () => {
        delete window.gsap;
        expect(() => {
            require('../../js/scroll-marquee.js');
            document.dispatchEvent(new window.Event('DOMContentLoaded'));
        }).not.toThrow();
        expect(window.__ScrollMarqueeForTesting).toBeUndefined();
    });

    test('does not throw if marquee is missing', () => {
        document.body.innerHTML = '';
        expect(() => {
            require('../../js/scroll-marquee.js');
            document.dispatchEvent(new window.Event('DOMContentLoaded'));
        }).not.toThrow();
        expect(window.__ScrollMarqueeForTesting).toBeUndefined();
    });

    test('updates width on resize', () => {
        require('../../js/scroll-marquee.js');
        document.dispatchEvent(new window.Event('DOMContentLoaded'));

        // Change scrollWidth
        Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            get: function () {
                return 4000;
            },
        });

        window.dispatchEvent(new window.Event('resize'));
        window.scrollY = 100;
        window.__ScrollMarqueeForTesting.updateMarquee();

        // loopWidth is now 2000. currentScroll = 100.
        // translation = -80 % 2000 = -80.
        expect(mockSetterX).toHaveBeenCalledWith(-80);
    });

    test('animates on scroll event', () => {
        require('../../js/scroll-marquee.js');
        document.dispatchEvent(new window.Event('DOMContentLoaded'));

        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb();
            return 1;
        });

        window.scrollY = 50;
        window.dispatchEvent(new window.Event('scroll'));

        // -50 * 0.8 % 1000 = -40
        expect(mockSetterX).toHaveBeenCalledWith(-40);
    });
});
