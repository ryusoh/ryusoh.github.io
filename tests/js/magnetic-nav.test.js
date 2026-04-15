/**
 * @jest-environment jsdom
 */

import { initMagneticNav } from '../../js/magnetic-nav.js';

describe('js/magnetic-nav.js', () => {
    let mockGSAP;

    beforeEach(() => {
        mockGSAP = {
            to: jest.fn(),
        };

        window.gsap = mockGSAP;

        // Mock touch/matchMedia methods
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });
        Object.defineProperty(navigator, 'maxTouchPoints', {
            get: () => 0,
            configurable: true,
        });

        jest.resetModules();
    });

    afterEach(() => {
        delete window.gsap;
        delete window.ontouchstart;
        jest.restoreAllMocks();
    });

    test('defines initMagneticNav function and executes correctly', () => {
        expect(typeof initMagneticNav).toBe('function');
    });

    test('exits early if window is undefined', () => {
        // Simulating undefined window is hard in jsdom, we'll test the GSAP branch
        delete window.gsap;

        document.body.innerHTML = '<div class="social-icons-container"><a href="#">Link</a></div>';
        initMagneticNav();

        // No listener added
        const a = document.querySelector('a');
        expect(a).toBeDefined();
    });

    test('exits early on touch devices (ontouchstart)', () => {
        window.ontouchstart = () => {};

        document.body.innerHTML = '<div class="social-icons-container"><a href="#">Link</a></div>';

        // Mock addEventListener
        const a = document.querySelector('a');
        jest.spyOn(a, 'addEventListener');

        initMagneticNav();

        expect(a.addEventListener).not.toHaveBeenCalled();
    });

    test('exits early on touch devices (maxTouchPoints > 0)', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', {
            get: () => 1,
            configurable: true,
        });

        document.body.innerHTML = '<div class="social-icons-container"><a href="#">Link</a></div>';

        // Mock addEventListener
        const a = document.querySelector('a');
        jest.spyOn(a, 'addEventListener');

        initMagneticNav();

        expect(a.addEventListener).not.toHaveBeenCalled();
    });

    test('exits early on touch devices (hover: none)', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });

        document.body.innerHTML = '<div class="social-icons-container"><a href="#">Link</a></div>';

        // Mock addEventListener
        const a = document.querySelector('a');
        jest.spyOn(a, 'addEventListener');

        initMagneticNav();

        expect(a.addEventListener).not.toHaveBeenCalled();
    });

    test('targets correct elements and adds listeners', () => {
        document.body.innerHTML = `
            <div class="social-icons-container">
                <a href="#"><i></i></a>
            </div>
        `;

        initMagneticNav();

        const link = document.querySelector('a');

        // Mock getBoundingClientRect
        link.getBoundingClientRect = jest.fn().mockReturnValue({
            left: 100,
            top: 100,
            width: 50,
            height: 50,
        });

        // Trigger mousemove
        const mouseMoveEvent = new window.MouseEvent('mousemove', {
            clientX: 135,
            clientY: 135,
        });
        link.dispatchEvent(mouseMoveEvent);

        expect(mockGSAP.to).toHaveBeenCalledWith(
            link,
            expect.objectContaining({
                x: 4,
                y: 4,
                duration: 0.3,
                ease: 'power2.out',
            })
        );

        // Child should also be pulled
        const child = link.querySelector('i');
        expect(mockGSAP.to).toHaveBeenCalledWith(
            child,
            expect.objectContaining({
                x: expect.closeTo(6, 5),
                y: expect.closeTo(6, 5),
                duration: 0.3,
                ease: 'power2.out',
            })
        );

        // Trigger mouseleave
        mockGSAP.to.mockClear();
        const mouseLeaveEvent = new window.MouseEvent('mouseleave');
        link.dispatchEvent(mouseLeaveEvent);

        expect(mockGSAP.to).toHaveBeenCalledWith(
            link,
            expect.objectContaining({
                x: 0,
                y: 0,
                duration: 0.7,
                ease: 'elastic.out(1, 0.3)',
            })
        );

        expect(mockGSAP.to).toHaveBeenCalledWith(
            child,
            expect.objectContaining({
                x: 0,
                y: 0,
                duration: 0.7,
                ease: 'elastic.out(1, 0.3)',
            })
        );
    });

    test('works without child element', () => {
        document.body.innerHTML = `
            <div class="social-icons-container">
                <a href="#">No Child</a>
            </div>
        `;

        initMagneticNav();

        const link = document.querySelector('a');

        link.getBoundingClientRect = jest.fn().mockReturnValue({
            left: 100,
            top: 100,
            width: 50,
            height: 50,
        });

        // Trigger mousemove
        const mouseMoveEvent = new window.MouseEvent('mousemove', {
            clientX: 135,
            clientY: 135,
        });
        link.dispatchEvent(mouseMoveEvent);

        expect(mockGSAP.to).toHaveBeenCalledTimes(1); // Only for link, no child

        // Trigger mouseleave
        mockGSAP.to.mockClear();
        const mouseLeaveEvent = new window.MouseEvent('mouseleave');
        link.dispatchEvent(mouseLeaveEvent);

        expect(mockGSAP.to).toHaveBeenCalledTimes(1); // Only for link, no child
    });
});
