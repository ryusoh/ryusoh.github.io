/**
 * @jest-environment jsdom
 */

describe('load-animations.js', () => {
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

        window.gsap = mockGsap;
        window.console.warn = jest.fn();

        jest.resetModules();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        jest.restoreAllMocks();
    });

    test('initializes without throwing', () => {
        require('../../js/load-animations.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(window.gsap.timeline).toHaveBeenCalledWith({ defaults: { ease: 'power3.out', duration: 1.2 } });
        expect(window.gsap.set).toHaveBeenCalled();
        expect(mockTimeline.to).toHaveBeenCalled();
    });

    test('gracefully handles missing GSAP', () => {
        delete window.gsap;

        require('../../js/load-animations.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(window.console.warn).toHaveBeenCalledWith('GSAP is not loaded. Skipping load animations.');
    });

    test('handles missing background element gracefully', () => {
        document.getElementById('mimida').remove();

        require('../../js/load-animations.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        // timeline.to might be called for other elements, but not for background
    });

    test('handles missing main content elements gracefully', () => {
        document.querySelector('#main').remove();
        document.getElementById('headline').remove();
        document.getElementById('nav').remove();

        require('../../js/load-animations.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();
    });
});
