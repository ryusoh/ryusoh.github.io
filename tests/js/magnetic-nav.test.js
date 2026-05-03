/**
 * @jest-environment jsdom
 */

// We mock it so we don't have to deal with Babel transform issues for the export
// Actually, jest currently fails to parse export without babel. Let's add a simple babel config to fix it for all modules using export/import
describe('js/magnetic-nav.js', () => {
    let mockGSAP;

    beforeEach(() => {
        jest.resetModules();
        const setters = new Map();
        mockGSAP = {
            to: jest.fn(),
            quickTo: jest.fn((target, prop) => {
                const key = `${target.id || target.tagName}-${prop}`;
                if (!setters.has(key)) {
                    setters.set(key, jest.fn());
                }
                return setters.get(key);
            }),
            _setters: setters, // Expose for assertions
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

        const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: 135,
            clientY: 135,
        });
        el.dispatchEvent(mouseMoveEvent);

        const xTo = mockGSAP._setters.get('A-x');
        const yTo = mockGSAP._setters.get('A-y');
        expect(xTo).toHaveBeenCalledWith(4);
        expect(yTo).toHaveBeenCalledWith(4);

        const childXTo = mockGSAP._setters.get('child-x');
        const childYTo = mockGSAP._setters.get('child-y');
        expect(childXTo).toHaveBeenCalledWith(expect.closeTo(6, 5));
        expect(childYTo).toHaveBeenCalledWith(expect.closeTo(6, 5));
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

        el.dispatchEvent(new MouseEvent('mousemove', { clientX: 135, clientY: 135 }));

        const xTo = mockGSAP._setters.get('A-x');
        const yTo = mockGSAP._setters.get('A-y');
        expect(xTo).toHaveBeenCalledWith(4);
        expect(yTo).toHaveBeenCalledWith(4);

        el.dispatchEvent(new MouseEvent('mouseleave'));
        expect(mockGSAP.to).toHaveBeenCalledWith(el, expect.objectContaining({ x: 0, y: 0 }));
    });
});
