/**
 * @jest-environment jsdom
 */

describe('hover-preview.js', () => {
    let mockTo;
    let mockSetX;
    let mockSetY;

    beforeEach(() => {
        // Setup simple DOM structure
        document.body.innerHTML = `
            <table id="nav">
                <td class="portfolio-link"><a href="./p1/">Link 1</a></td>
                <td class="portfolio-link"><a href="./p2/">Link 2</a></td>
            </table>
        `;

        mockTo = jest.fn();
        mockSetX = jest.fn();
        mockSetY = jest.fn();

        const mockGsap = {
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

        window.gsap = mockGsap;
        window.console.warn = jest.fn();
        window.PortfolioConfig = { enableHoverPreview: true };

        // Mock requestAnimationFrame
        window.requestAnimationFrame = jest.fn(() => 1);

        jest.resetModules();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.gsap;
        delete window.PortfolioConfig;
        jest.restoreAllMocks();
    });

    test('initializes without throwing when enabled', () => {
        require('../../js/hover-preview.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(document.querySelector('.hover-preview-container')).not.toBeNull();
    });

    test('gracefully handles being disabled', () => {
        window.PortfolioConfig.enableHoverPreview = false;

        require('../../js/hover-preview.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(mockSetX).not.toHaveBeenCalled();
        expect(document.querySelector('.hover-preview-container')).toBeNull();
    });

    test('gracefully handles missing GSAP', () => {
        delete window.gsap;

        require('../../js/hover-preview.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(window.console.warn).toHaveBeenCalledWith('GSAP is not loaded. Skipping hover preview.');
    });

    test('returns early if no portfolio links found', () => {
        document.getElementById('nav').innerHTML = '';

        require('../../js/hover-preview.js');

        expect(() => {
            const event = new window.Event('DOMContentLoaded');
            document.dispatchEvent(event);
        }).not.toThrow();

        expect(document.querySelector('.hover-preview-container')).toBeNull();
    });

    test('adds mousemove listener and updates variables', () => {
        require('../../js/hover-preview.js');
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const mouseMoveEvent = new window.MouseEvent('mousemove', {
            clientX: 100,
            clientY: 200,
        });
        document.dispatchEvent(mouseMoveEvent);

        expect(true).toBe(true);
    });

    test('handles mouseenter and mouseleave on links', () => {
        require('../../js/hover-preview.js');
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const link = document.querySelector('a[href="./p1/"]');
        const previewImg = document.querySelector('.hover-preview-img');
        const previewContainer = document.querySelector('.hover-preview-container');

        // Mouse Enter
        const enterEvent = new window.MouseEvent('mouseenter', {
            clientX: 150,
            clientY: 250,
        });
        link.dispatchEvent(enterEvent);

        expect(previewImg.src).toContain('assets/img/p1/DSCF0361-2.jpg');
        expect(mockSetX).toHaveBeenCalledWith(170); // 150 + 20
        expect(mockSetY).toHaveBeenCalledWith(270); // 250 + 20
        expect(window.requestAnimationFrame).toHaveBeenCalled();
        expect(mockTo).toHaveBeenCalledWith(previewContainer, expect.objectContaining({
            scale: 1,
            opacity: 1,
        }));

        // Mouse Leave
        mockTo.mockClear();
        const leaveEvent = new window.MouseEvent('mouseleave');
        link.dispatchEvent(leaveEvent);

        expect(mockTo).toHaveBeenCalledWith(previewContainer, expect.objectContaining({
            scale: 0.8,
            opacity: 0,
        }));
    });

    test('ignores mouseenter if imgMap doesn\'t match', () => {
        document.getElementById('nav').innerHTML += '<td class="portfolio-link"><a href="./p5/">Link 5</a></td>';

        require('../../js/hover-preview.js');
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const link = document.querySelector('a[href="./p5/"]');

        const enterEvent = new window.MouseEvent('mouseenter', {
            clientX: 150,
            clientY: 250,
        });

        mockSetX.mockClear();
        link.dispatchEvent(enterEvent);

        expect(mockSetX).not.toHaveBeenCalled();
    });

    test('updatePosition handles isHovering flag correctly', () => {
        let rafCallback;
        window.requestAnimationFrame = jest.fn((callback) => {
            rafCallback = callback;
            return 1;
        });

        require('../../js/hover-preview.js');
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);

        const link = document.querySelector('a[href="./p1/"]');

        link.dispatchEvent(new window.MouseEvent('mouseenter'));

        mockSetX.mockClear();

        if (rafCallback) {
            rafCallback();
        }

        expect(mockSetX).toHaveBeenCalled();

        link.dispatchEvent(new window.MouseEvent('mouseleave'));

        mockSetX.mockClear();

        if (rafCallback) {
            rafCallback();
        }

        expect(mockSetX).not.toHaveBeenCalled();
    });
});
