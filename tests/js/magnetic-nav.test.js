/**
 * @jest-environment jsdom
 */

// We'll use the VM approach since the project seems to prefer it for testing JS modules
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('js/magnetic-nav.js', () => {
    let context;
    let code;
    let mockGSAP;

    beforeEach(() => {
        const sourcePath = path.resolve(__dirname, '../../js/magnetic-nav.js');
        const originalCode = fs.readFileSync(sourcePath, 'utf8');
        // Remove export keyword for VM
        code = originalCode.replace(
            'export function initMagneticNav()',
            'function initMagneticNav()'
        );

        mockGSAP = {
            to: jest.fn(),
            quickTo: jest.fn(() => {
                return jest.fn();
            }),
        };

        context = {
            window: {
                gsap: mockGSAP,
                matchMedia: jest.fn().mockReturnValue({ matches: false }),
            },
            navigator: {
                maxTouchPoints: 0,
            },
            document: {
                querySelectorAll: jest.fn().mockReturnValue([]),
            },
            // Add some globals that might be needed
            MouseEvent: global.MouseEvent,
        };
    });

    test('defines initMagneticNav function', () => {
        vm.createContext(context);
        vm.runInContext(code, context);
        expect(typeof context.initMagneticNav).toBe('function');
    });

    test('exits early if window.gsap is missing', () => {
        delete context.window.gsap;
        vm.createContext(context);
        vm.runInContext(code, context);

        context.initMagneticNav();
        expect(context.document.querySelectorAll).not.toHaveBeenCalled();
    });

    test('exits early on touch devices (ontouchstart)', () => {
        context.window.ontouchstart = () => {};
        vm.createContext(context);
        vm.runInContext(code, context);

        context.initMagneticNav();
        expect(context.document.querySelectorAll).not.toHaveBeenCalled();
    });

    test('targets correct elements and adds listeners', () => {
        const mockElement = {
            addEventListener: jest.fn(),
            querySelector: jest.fn(),
            getBoundingClientRect: jest.fn().mockReturnValue({
                left: 0,
                top: 0,
                width: 0,
                height: 0,
            }),
        };
        context.document.querySelectorAll = jest.fn().mockReturnValue([mockElement]);

        vm.createContext(context);
        vm.runInContext(code, context);

        context.initMagneticNav();

        expect(context.document.querySelectorAll).toHaveBeenCalledWith('.social-icons-container a');
        expect(mockElement.addEventListener).toHaveBeenCalledWith(
            'mouseenter',
            expect.any(Function)
        );
        expect(mockElement.addEventListener).toHaveBeenCalledWith(
            'mousemove',
            expect.any(Function)
        );
        expect(mockElement.addEventListener).toHaveBeenCalledWith(
            'mouseleave',
            expect.any(Function)
        );
    });

    test('applies magnetic pull on mousemove', () => {
        const mockChild = { id: 'child' };
        const mockElement = {
            addEventListener: jest.fn(),
            querySelector: jest.fn().mockReturnValue(mockChild),
            getBoundingClientRect: jest.fn().mockReturnValue({
                left: 100,
                top: 100,
                width: 50,
                height: 50,
            }),
        };
        context.document.querySelectorAll = jest.fn().mockReturnValue([mockElement]);

        vm.createContext(context);
        vm.runInContext(code, context);

        context.initMagneticNav();

        // Get the listeners
        const mouseEnterHandler = mockElement.addEventListener.mock.calls.find(
            (call) => call[0] === 'mouseenter'
        )[1];

        const mouseMoveHandler = mockElement.addEventListener.mock.calls.find(
            (call) => call[0] === 'mousemove'
        )[1];

        // Trigger mouseenter to cache dimensions
        mouseEnterHandler();

        // Check if quickTo was called correctly during initialization
        expect(mockGSAP.quickTo).toHaveBeenCalledWith(mockElement, 'x', expect.any(Object));
        expect(mockGSAP.quickTo).toHaveBeenCalledWith(mockElement, 'y', expect.any(Object));
        expect(mockGSAP.quickTo).toHaveBeenCalledWith(mockChild, 'x', expect.any(Object));
        expect(mockGSAP.quickTo).toHaveBeenCalledWith(mockChild, 'y', expect.any(Object));

        // Get the generated setter functions
        const setX = mockGSAP.quickTo.mock.results[0].value;
        const setY = mockGSAP.quickTo.mock.results[1].value;
        const setChildX = mockGSAP.quickTo.mock.results[2].value;
        const setChildY = mockGSAP.quickTo.mock.results[3].value;

        // Trigger mousemove with 10px offset from center (center is 125, 125)
        mouseMoveHandler({
            clientX: 135,
            clientY: 135,
        });

        // distX = 10, distY = 10, strength = 0.4 → x = 4, y = 4
        expect(setX).toHaveBeenCalledWith(4);
        expect(setY).toHaveBeenCalledWith(4);

        // child parallax: strength * 1.5 = 0.6 → x = 6, y = 6
        expect(setChildX).toHaveBeenCalledWith(expect.closeTo(6, 5));
        expect(setChildY).toHaveBeenCalledWith(expect.closeTo(6, 5));
    });

    test('snaps back on mouseleave', () => {
        const mockChild = { id: 'child' };
        const mockElement = {
            addEventListener: jest.fn(),
            querySelector: jest.fn().mockReturnValue(mockChild),
        };
        context.document.querySelectorAll = jest.fn().mockReturnValue([mockElement]);

        vm.createContext(context);
        vm.runInContext(code, context);

        context.initMagneticNav();

        // Get the mouseleave listener
        const mouseLeaveHandler = mockElement.addEventListener.mock.calls.find(
            (call) => call[0] === 'mouseleave'
        )[1];

        mouseLeaveHandler();

        expect(mockGSAP.to).toHaveBeenCalledWith(
            mockElement,
            expect.objectContaining({
                x: 0,
                y: 0,
                duration: 0.7,
                ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
            })
        );

        expect(mockGSAP.to).toHaveBeenCalledWith(
            mockChild,
            expect.objectContaining({
                x: 0,
                y: 0,
                duration: 0.7,
                ease: 'cubic-bezier(0.65, 0.05, 0, 1)',
            })
        );
    });
});
