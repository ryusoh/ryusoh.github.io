/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('load-animations.js', () => {
    let context;
    let mockTimeline;

    beforeEach(() => {
        // Setup simple DOM structure
        document.body.innerHTML = `
            <div id="mimida"></div>
            <div id="main"><h1><span>Zhuang Liu</span></h1></div>
            <p id="headline">Street Photographer</p>
            <nav id="nav"></nav>
        `;

        mockTimeline = {
            to: jest.fn().mockReturnThis(),
        };

        const mockGsap = {
            timeline: jest.fn().mockReturnValue(mockTimeline),
            set: jest.fn(),
        };

        // Initialize VM context to safely evaluate script
        context = vm.createContext({
            document,
            window: { console: { warn: jest.fn() } },
            gsap: mockGsap,
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    test('initializes without throwing', () => {
        const code = fs.readFileSync(path.join(__dirname, '../../js/load-animations.js'), 'utf8');

        expect(() => {
            vm.runInContext(code, context);
            // Manually dispatch DOMContentLoaded since we run in VM
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();
    });

    test('gracefully handles missing GSAP', () => {
        const contextWithoutGsap = vm.createContext({
            document,
            window: { console: { warn: jest.fn() } },
        });
        const code = fs.readFileSync(path.join(__dirname, '../../js/load-animations.js'), 'utf8');

        expect(() => {
            vm.runInContext(code, contextWithoutGsap);
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(contextWithoutGsap.window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping load animations.'
        );
    });
});
