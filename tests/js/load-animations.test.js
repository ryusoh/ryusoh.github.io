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
            <div id="headline">Street Photography</div>
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
            registerPlugin: jest.fn(),
        };

        window.console = { warn: jest.fn() };
        window.matchMedia = jest.fn().mockReturnValue({ matches: false });

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
        delete window.SplitText;
        delete document.fonts;
        jest.restoreAllMocks();
    });

    test('initializes and reveals elements correctly without animating static title', () => {
        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(mockSet).toHaveBeenCalled();
        expect(mockTo).toHaveBeenCalled();

        // Assert that #main h1 is NOT animated
        const setCalls = mockSet.mock.calls;
        const revealedElements = setCalls.find((call) => Array.isArray(call[0]))?.[0] || [];
        const containsTitle = revealedElements.some(
            (el) => el.tagName === 'H1' || el.classList?.contains('brand-title')
        );
        expect(containsTitle).toBe(false);
    });

    test('uses SplitText when available to split and animate lines', () => {
        const mockLines = [document.createElement('div'), document.createElement('div')];
        window.SplitText = jest.fn().mockImplementation(() => ({
            lines: mockLines,
        }));

        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(window.gsap.registerPlugin).toHaveBeenCalledWith(window.SplitText);
        expect(window.SplitText).toHaveBeenCalledWith(document.getElementById('headline'), {
            type: 'lines',
            linesClass: 'headline-line',
        });
        expect(mockSet).toHaveBeenCalledWith(mockLines, { y: 24, opacity: 0 });
    });

    test('falls back gracefully when SplitText throws', () => {
        window.SplitText = jest.fn().mockImplementation(() => {
            throw new Error('SplitText failed');
        });

        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(mockSet).toHaveBeenCalledWith(document.getElementById('headline'), {
            y: 30,
            opacity: 0,
        });
    });

    test('handles prefers-reduced-motion by applying instant values without motion', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });

        require('../../js/load-animations.js');

        expect(domContentLoadedCb).toBeInstanceOf(Function);
        domContentLoadedCb();

        expect(mockTo).not.toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(document.getElementById('mimida'), { scale: 1 });
        expect(mockSet).toHaveBeenCalledWith(
            [document.getElementById('headline'), document.getElementById('nav')],
            { opacity: 1, y: 0 }
        );
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

        expect(mockSet).toHaveBeenCalled();
        expect(mockTo).toHaveBeenCalled();
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

        expect(mockSet).toHaveBeenCalled();
        expect(mockTo).toHaveBeenCalled();
    });
});
