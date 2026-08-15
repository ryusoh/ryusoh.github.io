/**
 * @jest-environment jsdom
 */

describe('js/load-animations.js', () => {
    let mockTo;
    let mockSet;
    let mockTimeline;
    let domContentLoadedCb;

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

        domContentLoadedCb = null;
        jest.spyOn(document, 'addEventListener').mockImplementation((event, fn) => {
            if (event === 'DOMContentLoaded') {
                domContentLoadedCb = fn;
            }
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        delete document.fonts;
        jest.restoreAllMocks();
    });

    test('initializes and reveals elements correctly', () => {
        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(mockSet).toHaveBeenCalledTimes(2); // once for mimida, once for elementsToReveal
        expect(mockTo).toHaveBeenCalledTimes(2); // once for mimida, once for elementsToReveal
    });

    test('gracefully handles missing GSAP', () => {
        delete window.gsap;

        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping load animations.'
        );
    });

    test('handles missing elements gracefully', () => {
        document.body.innerHTML = ''; // Empty DOM

        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(mockSet).not.toHaveBeenCalled();
        expect(mockTo).not.toHaveBeenCalled();
    });

    test('waits for document.fonts.ready when available', async () => {
        let resolveFonts;
        document.fonts = {
            ready: new Promise((resolve) => {
                resolveFonts = resolve;
            }),
        };

        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(mockSet).not.toHaveBeenCalled();

        resolveFonts();
        await Promise.resolve();
        await Promise.resolve();

        expect(mockSet).toHaveBeenCalledTimes(2);
        expect(mockTo).toHaveBeenCalledTimes(2);
    });

    test('handles document.fonts.ready rejection gracefully', async () => {
        let rejectFonts;
        document.fonts = {
            ready: new Promise((_, reject) => {
                rejectFonts = reject;
            }),
        };

        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(mockSet).not.toHaveBeenCalled();

        rejectFonts(new Error('Font load failed'));
        await Promise.resolve();
        await Promise.resolve();

        expect(mockSet).toHaveBeenCalledTimes(2);
        expect(mockTo).toHaveBeenCalledTimes(2);
    });
});
