/**
 * @jest-environment jsdom
 */

// We mock it so we don't have to deal with Babel transform issues for the export
// Actually, jest currently fails to parse export without babel. Let's add a simple babel config to fix it for all modules using export/import
describe('js/magnetic-nav.js', () => {
    describe('Magnetic Nav Edge Cases', () => {
        let originalWindow;
        let originalNavigator;

        beforeEach(() => {
            originalWindow = global.window;
            originalNavigator = global.navigator;
        });

        afterEach(() => {
            global.window = originalWindow;
            global.navigator = originalNavigator;
            jest.resetModules();
        });

        test('returns early when window or navigator is undefined', () => {
            global.window = undefined;
            global.navigator = undefined;

            expect(() => {
                require('../../js/magnetic-nav.js');
            }).not.toThrow();
        });
    });

    let mockGSAP;

    beforeEach(() => {
        jest.resetModules();
        const setters = new Map();
        mockGSAP = {
            to: jest.fn(),
            quickTo: jest.fn().mockImplementation((target, prop) => {
                const key = `${target.id || target.tagName}-${prop}`;
                const setter = jest.fn();
                setters.set(key, setter);
                return setter;
            }),
            _setters: setters,
        };

        window.gsap = mockGSAP;
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });

        Object.defineProperty(navigator, 'maxTouchPoints', {
            value: 0,
            configurable: true,
        });

        document.body.innerHTML = `
            <div class="social-icons-container">
                <a href="#"><i id="child"></i></a>
            </div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        delete window.ontouchstart;
        jest.restoreAllMocks();
    });

    test('exits early if window.gsap is missing', () => {
        delete window.gsap;
        const { initMagneticNav } = require('../../js/magnetic-nav.js');
        const spy = jest.spyOn(document, 'querySelectorAll');
        initMagneticNav();
        expect(spy).not.toHaveBeenCalled();
    });

    test('checkTouchDevice returns false when navigator is undefined', () => {
        const { initMagneticNav } = require('../../js/magnetic-nav.js');
        const originalNavigator = global.navigator;

        Object.defineProperty(global, 'navigator', {
            get: () => undefined,
            configurable: true,
        });

        const spy = jest.spyOn(document, 'querySelectorAll');
        initMagneticNav();
        expect(spy).toHaveBeenCalled();

        Object.defineProperty(global, 'navigator', {
            value: originalNavigator,
            configurable: true,
        });
    });

    test('exits early on touch devices (ontouchstart)', () => {
        window.ontouchstart = () => {};
        const { initMagneticNav } = require('../../js/magnetic-nav.js');
        const spy = jest.spyOn(document, 'querySelectorAll');
        initMagneticNav();
        expect(spy).not.toHaveBeenCalled();
    });

    test('targets correct elements and adds listeners', () => {
        const spy = jest.spyOn(document, 'querySelectorAll');
        const { initMagneticNav } = require('../../js/magnetic-nav.js');
        initMagneticNav();
        expect(spy).toHaveBeenCalledWith('.social-icons-container a');
    });

    test('does not apply pull when move is small', () => {
        const { initMagneticNav } = require('../../js/magnetic-nav.js');
        initMagneticNav();

        const el = document.querySelector('a');
        el.getBoundingClientRect = jest.fn().mockReturnValue({
            left: 100,
            top: 100,
            width: 50,
            height: 50,
        });

        el.dispatchEvent(new MouseEvent('mouseenter'));

        // Center is 125, 125. Mouse is at 125.5, 125.5. Difference is 0.5 < 1
        const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: 125.5,
            clientY: 125.5,
        });
        el.dispatchEvent(mouseMoveEvent);

        const elXSetter = mockGSAP._setters.get('A-x');
        const elYSetter = mockGSAP._setters.get('A-y');
        expect(elXSetter).not.toHaveBeenCalled();
        expect(elYSetter).not.toHaveBeenCalled();
    });

    test('applies magnetic pull on mousemove', () => {
        const { initMagneticNav } = require('../../js/magnetic-nav.js');
        initMagneticNav();

        const el = document.querySelector('a');
        el.getBoundingClientRect = jest.fn().mockReturnValue({
            left: 100,
            top: 100,
            width: 50,
            height: 50,
        });

        el.dispatchEvent(new MouseEvent('mouseenter'));

        const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: 135,
            clientY: 135,
        });
        el.dispatchEvent(mouseMoveEvent);

        const elXSetter = mockGSAP._setters.get('A-x');
        const elYSetter = mockGSAP._setters.get('A-y');
        expect(elXSetter).toHaveBeenCalledWith(4);
        expect(elYSetter).toHaveBeenCalledWith(4);

        const childXSetter = mockGSAP._setters.get('child-x');
        const childYSetter = mockGSAP._setters.get('child-y');
        expect(childXSetter).toHaveBeenCalledWith(expect.closeTo(6, 5));
        expect(childYSetter).toHaveBeenCalledWith(expect.closeTo(6, 5));
    });

    test('snaps back on mouseleave', () => {
        const { initMagneticNav } = require('../../js/magnetic-nav.js');
        initMagneticNav();

        const el = document.querySelector('a');
        const mouseLeaveEvent = new MouseEvent('mouseleave');
        el.dispatchEvent(mouseLeaveEvent);

        expect(mockGSAP.to).toHaveBeenCalledWith(
            el,
            expect.objectContaining({ x: 0, y: 0, duration: 0.7 })
        );

        const child = document.getElementById('child');
        expect(mockGSAP.to).toHaveBeenCalledWith(
            child,
            expect.objectContaining({ x: 0, y: 0, duration: 0.7 })
        );
    });

    test('works without child element', () => {
        document.body.innerHTML = `
            <div class="social-icons-container">
                <a href="#">No child</a>
            </div>
        `;

        const { initMagneticNav } = require('../../js/magnetic-nav.js');
        initMagneticNav();

        const el = document.querySelector('a');
        el.getBoundingClientRect = jest.fn().mockReturnValue({
            left: 100,
            top: 100,
            width: 50,
            height: 50,
        });

        el.dispatchEvent(new MouseEvent('mouseenter'));
        el.dispatchEvent(new MouseEvent('mousemove', { clientX: 135, clientY: 135 }));
        const elXSetter = mockGSAP._setters.get('A-x');
        const elYSetter = mockGSAP._setters.get('A-y');
        expect(elXSetter).toHaveBeenCalledWith(4);
        expect(elYSetter).toHaveBeenCalledWith(4);

        el.dispatchEvent(new MouseEvent('mouseleave'));
        expect(mockGSAP.to).toHaveBeenCalledWith(el, expect.objectContaining({ x: 0, y: 0 }));
    });
});
