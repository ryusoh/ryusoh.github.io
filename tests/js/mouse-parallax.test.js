/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('mouse-parallax.js', () => {
    let context;
    let mockTo;
    let mockQuickTo;
    let mockSetterX;
    let mockSetterY;
    let mockSetterRotX;
    let mockSetterRotY;

    beforeEach(() => {
        // Setup simple DOM structure
        document.body.innerHTML = `
            <div id="main"><h1><span>Zhuang Liu</span></h1></div>
        `;

        mockTo = jest.fn();
        mockSetterX = jest.fn();
        mockSetterY = jest.fn();
        mockSetterRotX = jest.fn();
        mockSetterRotY = jest.fn();

        mockQuickTo = jest.fn((target, prop, config) => {
            if (prop === 'x') return mockSetterX;
            if (prop === 'y') return mockSetterY;
            if (prop === 'rotationX') return mockSetterRotX;
            if (prop === 'rotationY') return mockSetterRotY;
            return jest.fn();
        });

        const mockGsap = {
            to: mockTo,
            quickTo: mockQuickTo,
        };

        context = vm.createContext({
            document,
            window: {
                console: { warn: jest.fn() },
                innerWidth: 1024,
                innerHeight: 768,
                addEventListener: jest.fn(),
                PortfolioConfig: { enableMouseParallax: true },
            },
            gsap: mockGsap,
            PortfolioConfig: { enableMouseParallax: true },
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    test('initializes without throwing when enabled', () => {
        const code = fs.readFileSync(path.join(__dirname, '../../js/mouse-parallax.js'), 'utf8');

        expect(() => {
            vm.runInContext(code, context);
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();
    });

    test('gracefully handles being disabled', () => {
        context.window.PortfolioConfig.enableMouseParallax = false;
        context.PortfolioConfig.enableMouseParallax = false;
        const code = fs.readFileSync(path.join(__dirname, '../../js/mouse-parallax.js'), 'utf8');

        expect(() => {
            vm.runInContext(code, context);
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        // In this case, no GSAP should be called as it returns early
        expect(mockTo).not.toHaveBeenCalled();
        expect(mockQuickTo).not.toHaveBeenCalled();
    });

    test('updates correctly on mousemove', () => {
        const code = fs.readFileSync(path.join(__dirname, '../../js/mouse-parallax.js'), 'utf8');
        vm.runInContext(code, context);
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockQuickTo).toHaveBeenCalledTimes(4);

        // Dispatch a mousemove event
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
    });

    test('gracefully handles missing GSAP', () => {
        const contextWithoutGsap = vm.createContext({
            document,
            window: {
                console: { warn: jest.fn() },
                PortfolioConfig: { enableMouseParallax: true },
            },
            PortfolioConfig: { enableMouseParallax: true },
        });
        const code = fs.readFileSync(path.join(__dirname, '../../js/mouse-parallax.js'), 'utf8');

        expect(() => {
            vm.runInContext(code, contextWithoutGsap);
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(contextWithoutGsap.window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping mouse parallax.'
        );
    });
});
