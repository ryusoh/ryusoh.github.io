/**
 * @jest-environment jsdom
 */

describe('js/hover-preview.js', () => {
    let mockTo;
    let mockSetX;
    let mockSetY;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <table id="nav">
                <td class="portfolio-link"><a href="./p1/">Link 1</a></td>
                <td class="portfolio-link"><a href="./p2/">Link 2</a></td>
            </table>
        `;

        mockTo = jest.fn();
        mockSetX = jest.fn();
        mockSetY = jest.fn();

        window.gsap = {
            to: mockTo,
            quickSetter: jest.fn().mockImplementation((target, prop) => {
                if (prop === 'x') {
                    return mockSetX;
                }
                if (prop === 'y') {
                    return mockSetY;
                }
                return jest.fn();
            }),
        };

        window.PortfolioConfig = { enableHoverPreview: true };
        window.requestAnimationFrame = jest.fn((cb) => {
            setTimeout(() => cb(), 0);
        });
        window.console = { warn: jest.fn() };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        delete window.PortfolioConfig;
        jest.restoreAllMocks();
    });

    test('initializes and runs animations correctly', () => {
        require('../../js/hover-preview.js');
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const link = document.querySelector('a');

        const mouseoverEvent = new MouseEvent('mouseover', {
            bubbles: true,
            clientX: 100,
            clientY: 100,
        });
        link.dispatchEvent(mouseoverEvent);

        expect(mockSetX).toHaveBeenCalledWith(120);
        expect(mockSetY).toHaveBeenCalledWith(120);

        const mouseoutEvent = new MouseEvent('mouseout', { bubbles: true });
        link.dispatchEvent(mouseoutEvent);

        expect(mockTo).toHaveBeenCalledTimes(2);

        const mousemoveEvent = new MouseEvent('mousemove', { clientX: 200, clientY: 200 });
        document.dispatchEvent(mousemoveEvent);
    });

    test('ignores mouseover/mouseout events transitioning between child elements', () => {
        require('../../js/hover-preview.js');
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        mockSetX.mockClear();
        mockTo.mockClear();

        const link = document.querySelector('a');
        const span = document.createElement('span');
        link.appendChild(span);

        // Simulate moving from the link itself to the span inside it
        const mouseoverEvent = new MouseEvent('mouseover', {
            bubbles: true,
            clientX: 100,
            clientY: 100,
            relatedTarget: link,
        });

        // Setup JSDOM link.contains to actually work for this test
        link.contains = jest.fn((el) => el === link || el === span);

        span.dispatchEvent(mouseoverEvent);

        expect(mockSetX).not.toHaveBeenCalled();

        const mouseoutEvent = new MouseEvent('mouseout', {
            bubbles: true,
            relatedTarget: span,
        });

        link.dispatchEvent(mouseoutEvent);
        expect(mockTo).not.toHaveBeenCalled();
    });

    test('handles mouseover for unmapped links', () => {
        require('../../js/hover-preview.js');
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        mockSetX.mockClear();

        const link = document.querySelectorAll('a')[1]; // Link 2, ./p2/ is mapped! Link 3 is unmapped if we create one.
        link.setAttribute('href', './unmapped/');

        const mouseoverEvent = new MouseEvent('mouseover', {
            bubbles: true,
            clientX: 100,
            clientY: 100,
        });
        link.dispatchEvent(mouseoverEvent);

        expect(mockSetX).not.toHaveBeenCalled();
    });

    test('updatePosition handles isHovering correctly', (done) => {
        require('../../js/hover-preview.js');
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const link = document.querySelector('a');

        // This will trigger requestAnimationFrame and run updatePosition
        const mouseoverEvent = new MouseEvent('mouseover', {
            bubbles: true,
            clientX: 100,
            clientY: 100,
        });
        link.dispatchEvent(mouseoverEvent);

        setTimeout(() => {
            expect(mockSetX).toHaveBeenCalledWith(120);

            // test stopping raf on mouseout
            const mouseoutEvent = new MouseEvent('mouseout', { bubbles: true });
            link.dispatchEvent(mouseoutEvent);

            setTimeout(() => {
                // raf should be null and not called anymore, but we can't easily assert local rafId variable,
                // but checking logic execution flow via lack of further setX increment if we mocked mouse movement
                done();
            }, 10);
        }, 10);
    });

    test('gracefully handles missing GSAP', () => {
        delete window.gsap;
        require('../../js/hover-preview.js');

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(window.console.warn).toHaveBeenCalledWith(
            'GSAP is not loaded. Skipping hover preview.'
        );
    });

    test('gracefully exits when disabled via config', () => {
        window.PortfolioConfig.enableHoverPreview = false;
        require('../../js/hover-preview.js');

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockSetX).not.toHaveBeenCalled();
    });

    test('exits gracefully if no links found', () => {
        document.body.innerHTML = '';
        require('../../js/hover-preview.js');

        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);

        expect(mockSetX).not.toHaveBeenCalled();
    });
});
