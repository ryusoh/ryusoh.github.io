/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('mouse-parallax.js', () => {
    let mockQuickTo;
    let mockSetX;
    let mockSetY;
    let mockSetRotationX;
    let mockSetRotationY;
    let context;
    let code;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <div id="main"><h1>Title</h1></div>
        `;

        mockSetX = jest.fn();
        mockSetY = jest.fn();
        mockSetRotationX = jest.fn();
        mockSetRotationY = jest.fn();

        mockQuickTo = jest.fn().mockImplementation((target, prop) => {
            if (prop === 'x') {
                return mockSetX;
            }
            if (prop === 'y') {
                return mockSetY;
            }
            if (prop === 'rotationX') {
                return mockSetRotationX;
            }
            if (prop === 'rotationY') {
                return mockSetRotationY;
            }
            return jest.fn();
        });

        window.gsap = {
            quickTo: mockQuickTo,
        };

        window.PortfolioConfig = { enableMouseParallax: true };
        window.console = { warn: jest.fn() };

        code = fs.readFileSync(path.join(__dirname, '../../js/mouse-parallax.js'), 'utf8');

        context = {
            document: window.document,
            window: window,
            gsap: window.gsap,
            PortfolioConfig: window.PortfolioConfig,
            console: window.console,
        };
        // Need to attach events explicitly
        context.document.addEventListener = document.addEventListener.bind(document);
        context.window.addEventListener = window.addEventListener.bind(window);
        context.document.querySelector = document.querySelector.bind(document);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        delete window.PortfolioConfig;
    });

    test('initializes without throwing when enabled', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockQuickTo).toHaveBeenCalledTimes(4);
    });

    test('gracefully handles being disabled', () => {
        context.window.PortfolioConfig.enableMouseParallax = false;

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockQuickTo).not.toHaveBeenCalled();
    });

    test('updates correctly on mousemove', () => {
        // Mock innerWidth/Height for center calc
        window.innerWidth = 1000;
        window.innerHeight = 800;

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        // Center is 500, 400
        const mousemoveEvent = new MouseEvent('mousemove', { clientX: 750, clientY: 600 });
        document.dispatchEvent(mousemoveEvent);

        // diffX = (750 - 500) / 500 = 0.5
        // diffY = (600 - 400) / 400 = 0.5

        expect(mockSetX).toHaveBeenCalledWith(-0.5 * 15);
        expect(mockSetY).toHaveBeenCalledWith(-0.5 * 15);
        expect(mockSetRotationY).toHaveBeenCalledWith(0.5 * 5);
        expect(mockSetRotationX).toHaveBeenCalledWith(-0.5 * 5);
    });

    test('gracefully handles missing GSAP', () => {
        delete context.window.gsap;
        delete context.gsap;

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(context.window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping mouse parallax.'
        );
    });
});
