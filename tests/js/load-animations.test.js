/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('js/load-animations.js', () => {
    let mockTo;
    let mockSet;
    let mockTimeline;
    let context;
    let code;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <div id="mimida"></div>
            <div id="main"><h1></h1></div>
            <div id="headline"></div>
            <div id="nav"></div>
        `;

        mockTo = jest.fn();
        mockSet = jest.fn();
        mockTimeline = {
            to: mockTo,
        };

        window.gsap = {
            timeline: jest.fn().mockReturnValue(mockTimeline),
            set: mockSet,
        };

        window.console = { warn: jest.fn() };

        code = fs.readFileSync(path.join(__dirname, '../../js/load-animations.js'), 'utf8');

        context = {
            document: window.document,
            window: window,
            gsap: window.gsap,
            console: window.console,
        };
        // Need to attach events explicitly
        context.document.addEventListener = document.addEventListener.bind(document);
        context.document.querySelector = document.querySelector.bind(document);
        context.document.getElementById = document.getElementById.bind(document);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
    });

    test('initializes and reveals elements correctly', () => {
        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockSet).toHaveBeenCalledTimes(2); // once for mimida, once for elementsToReveal
        expect(mockTo).toHaveBeenCalledTimes(2); // once for mimida, once for elementsToReveal
    });

    test('gracefully handles missing GSAP', () => {
        delete context.window.gsap;
        delete context.gsap;

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(context.window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping load animations.'
        );
    });

    test('handles missing elements gracefully', () => {
        document.body.innerHTML = ''; // Empty DOM

        vm.createContext(context);
        vm.runInContext(code, context);

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockSet).not.toHaveBeenCalled();
        expect(mockTo).not.toHaveBeenCalled();
    });
});
