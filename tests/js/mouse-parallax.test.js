/**
 * @jest-environment jsdom
 */

describe('mouse-parallax.js', () => {
    let mockTo;
    let mockQuickTo;
    let mockSetterX;
    let mockSetterY;
    let mockSetterRotX;
    let mockSetterRotY;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <div id="main"><h1><span>Zhuang Liu</span></h1></div>
        `;

        mockTo = jest.fn();
        mockSetterX = jest.fn();
        mockSetterY = jest.fn();
        mockSetterRotX = jest.fn();
        mockSetterRotY = jest.fn();

        mockQuickTo = jest.fn((target, prop) => {
            if (prop === 'x') {
                return mockSetterX;
            }
            if (prop === 'y') {
                return mockSetterY;
            }
            if (prop === 'rotationX') {
                return mockSetterRotX;
            }
            if (prop === 'rotationY') {
                return mockSetterRotY;
            }
            return jest.fn();
        });

        window.gsap = {
            to: mockTo,
            quickTo: mockQuickTo,
        };

        window.console = { warn: jest.fn() };
        window.innerWidth = 1024;
        window.innerHeight = 768;
        window.PortfolioConfig = { enableMouseParallax: true };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        delete window.PortfolioConfig;
        jest.restoreAllMocks();
    });

    test('initializes without throwing when enabled', () => {
        expect(() => {
            require('../../js/mouse-parallax.js');
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();
    });

    test('gracefully handles being disabled', () => {
        window.PortfolioConfig.enableMouseParallax = false;

        expect(() => {
            require('../../js/mouse-parallax.js');
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(mockTo).not.toHaveBeenCalled();
        expect(mockQuickTo).not.toHaveBeenCalled();
    });

    test('updates correctly on mousemove', () => {
        require('../../js/mouse-parallax.js');
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockQuickTo).toHaveBeenCalled();

        const mouseEvent = new window.Event('mousemove');
        mouseEvent.clientX = 512 + 100; // Offset from center X
        mouseEvent.clientY = 384 + 50; // Offset from center Y
        document.dispatchEvent(mouseEvent);

        // diffX = 100 / 512 = 0.1953125
        // diffY = 50 / 384 = 0.13020833333333334

        expect(mockSetterX).toHaveBeenCalledWith(-0.1953125 * 15);
        expect(mockSetterY).toHaveBeenCalledWith(-0.13020833333333334 * 15);
        expect(mockSetterRotY).toHaveBeenCalledWith(0.1953125 * 5);
        expect(mockSetterRotX).toHaveBeenCalledWith(-0.13020833333333334 * 5);

        // Also test resize
        const resizeEvent = new window.Event('resize');
        window.innerWidth = 2000;
        window.innerHeight = 1000;
        window.dispatchEvent(resizeEvent);

        // Check that centerX/Y is updated by checking next mousemove
        const mouseEvent2 = new window.Event('mousemove');
        mouseEvent2.clientX = 1000 + 100;
        mouseEvent2.clientY = 500 + 50;
        document.dispatchEvent(mouseEvent2);
        expect(mockSetterX).toHaveBeenCalledWith(-0.1 * 15);
    });

    test('gracefully handles missing GSAP', () => {
        delete window.gsap;

        expect(() => {
            require('../../js/mouse-parallax.js');
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping mouse parallax.'
        );
    });

    test('gracefully exits when element is missing', () => {
        document.body.innerHTML = '';
        expect(() => {
            require('../../js/mouse-parallax.js');
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();
        expect(mockQuickTo).not.toHaveBeenCalled();
    });
});
