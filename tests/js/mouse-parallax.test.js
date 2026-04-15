/**
 * @jest-environment jsdom
 */

describe('mouse-parallax.js', () => {
    let mockTo;

    beforeEach(() => {
        // Setup simple DOM structure
        document.body.innerHTML = `
            <div id="main"><h1><span>Zhuang Liu</span></h1></div>
        `;

        mockTo = jest.fn();

        const mockGsap = {
            to: mockTo,
        };

        window.gsap = mockGsap;
        window.console.warn = jest.fn();
        window.PortfolioConfig = { enableMouseParallax: true };

        // Mock innerWidth/innerHeight
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
        Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

        jest.resetModules();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        delete window.PortfolioConfig;
        jest.restoreAllMocks();
    });

    test('initializes without throwing when enabled', () => {
        require('../../js/mouse-parallax.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();
    });

    test('gracefully handles being disabled', () => {
        window.PortfolioConfig.enableMouseParallax = false;

        require('../../js/mouse-parallax.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(mockTo).not.toHaveBeenCalled();
    });

    test('gracefully handles missing GSAP', () => {
        delete window.gsap;

        require('../../js/mouse-parallax.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(window.console.warn).toHaveBeenCalledWith('GSAP is not loaded. Skipping mouse parallax.');
    });

    test('returns early if title element not found', () => {
        document.body.innerHTML = '';

        require('../../js/mouse-parallax.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        // We can't directly check the internal state, but we know it should exit early
    });

    test('updates center coordinates on window resize', () => {
        require('../../js/mouse-parallax.js');
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        window.innerWidth = 800;
        window.innerHeight = 600;

        const resizeEvent = new window.Event('resize');
        window.dispatchEvent(resizeEvent);

        // We'll test the effect via the mousemove event calculation
        const mouseMoveEvent = new window.MouseEvent('mousemove', {
            clientX: 0, // Should be -1 diffX
            clientY: 0 // Should be -1 diffY
        });
        document.dispatchEvent(mouseMoveEvent);

        expect(mockTo).toHaveBeenCalledWith(
            expect.any(Element),
            expect.objectContaining({
                x: 15, // -(-1) * 15
                y: 15, // -(-1) * 15
            })
        );
    });

    test('applies parallax translation on mousemove', () => {
        require('../../js/mouse-parallax.js');
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const titleElement = document.querySelector('#main h1');

        // Center is 512, 384
        // Mouse at 1024, 768 (bottom right) -> diffX = 1, diffY = 1
        const mouseMoveEvent = new window.MouseEvent('mousemove', {
            clientX: 1024,
            clientY: 768
        });
        document.dispatchEvent(mouseMoveEvent);

        expect(mockTo).toHaveBeenCalledWith(
            titleElement,
            expect.objectContaining({
                x: -15,
                y: -15,
                rotationY: 5,
                rotationX: -5,
                ease: 'power2.out',
                duration: 0.8,
            })
        );
    });
});
