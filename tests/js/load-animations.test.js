/**
 * @jest-environment jsdom
 */

describe('js/load-animations.js', () => {
    let mockTo;
    let mockSet;
    let mockTimeline;

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
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        jest.restoreAllMocks();
    });

    test('initializes and reveals elements correctly', () => {
        require('../../js/load-animations.js');

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockSet).toHaveBeenCalledTimes(2); // once for mimida, once for elementsToReveal
        expect(mockTo).toHaveBeenCalledTimes(2); // once for mimida, once for elementsToReveal
    });

    test('gracefully handles missing GSAP', () => {
        delete window.gsap;

        require('../../js/load-animations.js');

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping load animations.'
        );
    });

    test('handles missing elements gracefully', () => {
        document.body.innerHTML = ''; // Empty DOM

        require('../../js/load-animations.js');

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockSet).not.toHaveBeenCalled();
        expect(mockTo).not.toHaveBeenCalled();
    });
});
