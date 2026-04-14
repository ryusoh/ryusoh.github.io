/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('mouse-parallax.js', () => {
    let context;
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

        context = vm.createContext({
            document,
            window: {
                console: { warn: jest.fn() },
                innerWidth: 1024,
                innerHeight: 768,
                addEventListener: jest.fn(),
            },
            gsap: mockGsap,
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    test('initializes without throwing', () => {
        const code = fs.readFileSync(path.join(__dirname, '../../js/mouse-parallax.js'), 'utf8');

        expect(() => {
            vm.runInContext(code, context);
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();
    });

    test('gracefully handles missing GSAP', () => {
        const contextWithoutGsap = vm.createContext({
            document,
            window: { console: { warn: jest.fn() } },
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
